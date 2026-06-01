import fs from 'fs/promises';
import path from 'path';
import { streamChat, StreamChunk } from '../providers/stream';
import { MATH_INSTRUCTIONS } from '../providers/tools';

export interface ServerChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string;
  toolCalls?: { name: string; args: any; result: string; messageId?: string }[];
}

export interface ServerChatSession {
  id: string;
  uid: string;
  title: string;
  messages: ServerChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ModelPoolEntry {
  id: string;
  providerId: string;
  modelId: string;
  displayName?: string;
  baseURL?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: string;
  extraBody?: Record<string, any>;
  thinkingLevel?: string;
  enableTools: boolean;
  disabledTools: string[];
}

export interface GenerationTask {
  sessionId: string;
  status: 'running' | 'done' | 'error' | 'stopped';
  content: string;
  toolCalls: { name: string; args: any; result: string }[];
  subscribers: Set<(event: string, data: any) => void>;
  abortController: AbortController;
  error?: string;
}

export class GenerationManager {
  private tasks = new Map<string, GenerationTask>();
  private sessionsDir: string;

  constructor(sessionsDir: string) {
    this.sessionsDir = sessionsDir;
  }

  private sessionPath(id: string): string {
    return path.join(this.sessionsDir, `${id}.json`);
  }

  async readSession(id: string): Promise<ServerChatSession | null> {
    try {
      const data = await fs.readFile(this.sessionPath(id), 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async writeSession(session: ServerChatSession): Promise<void> {
    await fs.writeFile(this.sessionPath(id(session)), JSON.stringify(session, null, 2));
  }

  async listSessions(): Promise<ServerChatSession[]> {
    try {
      const files = (await fs.readdir(this.sessionsDir)).filter(f => f.endsWith('.json'));
      const sessions = await Promise.all(files.map(async f => {
        const data = await fs.readFile(path.join(this.sessionsDir, f), 'utf-8');
        return JSON.parse(data) as ServerChatSession;
      }));
      return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch {
      return [];
    }
  }

  async deleteSession(id: string): Promise<void> {
    try { await fs.unlink(this.sessionPath(id)); } catch {}
  }

  async sendMessage(sessionId: string, content: string, modelEntry: ModelPoolEntry, systemPrompt: string): Promise<void> {
    let session = await this.readSession(sessionId);
    if (!session) {
      session = {
        id: sessionId,
        uid: 'local',
        title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const userMsg: ServerChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    session.messages.push(userMsg);
    if (session.messages.length === 1) {
      session.title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
    }
    session.updatedAt = new Date().toISOString();
    await this.writeSession(session);

    this.startGeneration(session, modelEntry, systemPrompt);
  }

  async retryMessage(sessionId: string, messageId: string, modelEntry: ModelPoolEntry, systemPrompt: string): Promise<void> {
    const session = await this.readSession(sessionId);
    if (!session) return;

    const idx = session.messages.findIndex(m => m.id === messageId);
    if (idx === -1) return;

    let userIdx = idx;
    while (userIdx >= 0 && session.messages[userIdx].role !== 'user') userIdx--;
    if (userIdx === -1) return;

    session.messages = session.messages.slice(0, userIdx + 1);
    session.updatedAt = new Date().toISOString();
    await this.writeSession(session);

    this.startGeneration(session, modelEntry, systemPrompt);
  }

  async continueGeneration(sessionId: string, modelEntry: ModelPoolEntry, systemPrompt: string): Promise<void> {
    const session = await this.readSession(sessionId);
    if (!session || session.messages.length === 0) return;

    const continueMsg: ServerChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: 'continue',
      createdAt: new Date().toISOString(),
    };
    session.messages.push(continueMsg);
    session.updatedAt = new Date().toISOString();
    await this.writeSession(session);

    this.startGeneration(session, modelEntry, systemPrompt);
  }

  private startGeneration(session: ServerChatSession, modelEntry: ModelPoolEntry, systemPrompt: string): void {
    const existing = this.tasks.get(session.id);
    if (existing && existing.status === 'running') {
      existing.abortController.abort();
    }

    const abortController = new AbortController();
    const task: GenerationTask = {
      sessionId: session.id,
      status: 'running',
      content: '',
      toolCalls: [],
      subscribers: new Set(),
      abortController,
    };
    this.tasks.set(session.id, task);

    this.runGeneration(task, session, modelEntry, systemPrompt).catch(err => {
      console.error(`[Generation] Error for session ${session.id}:`, err);
      task.status = 'error';
      task.error = err.message;
      task.subscribers.forEach(cb => cb('error', { message: err.message }));
    });
  }

  private async runGeneration(task: GenerationTask, session: ServerChatSession, modelEntry: ModelPoolEntry, systemPrompt: string): Promise<void> {
    console.log(`[Generation] Starting for session ${session.id}, provider=${modelEntry.providerId}, model=${modelEntry.modelId}, messages=${session.messages.length}`);

    const messages = session.messages.map(m => ({
      role: m.role as string,
      content: m.content,
      ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
    }));

    let fullContent = '';
    const allToolCalls: { name: string; args: any; result: string }[] = [];
    let pendingToolCalls: { index: number; id: string; name: string; args: string }[] = [];
    let isThinking = false;

    const buildSystemPrompt = () => {
      if (modelEntry.providerId === 'gemini') {
        return systemPrompt ? systemPrompt + '\n\n' + MATH_INSTRUCTIONS : MATH_INSTRUCTIONS;
      }
      return systemPrompt;
    };

    let keepResolving = true;
    let currentMessages = [...messages];

    while (keepResolving) {
      if (task.abortController.signal.aborted) {
        task.status = 'stopped';
        break;
      }

      pendingToolCalls = [];

      const reqMessages = currentMessages.map((m: any) => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: m.content,
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      }));

      try {
        for await (const chunk of streamChat(modelEntry.providerId, {
          model: modelEntry.modelId,
          messages: reqMessages,
          systemPrompt: buildSystemPrompt(),
          temperature: modelEntry.temperature,
          maxTokens: modelEntry.maxTokens,
          reasoningEffort: modelEntry.reasoningEffort,
          extraBody: modelEntry.extraBody,
          thinkingLevel: modelEntry.thinkingLevel,
          enableTools: modelEntry.enableTools,
          disabledTools: modelEntry.disabledTools || [],
          overrideBaseURL: modelEntry.baseURL,
          overrideApiKey: modelEntry.apiKey,
        })) {
          if (task.abortController.signal.aborted) break;

          if (chunk.type === 'reasoning') {
            if (!isThinking) {
              isThinking = true;
              fullContent += '<details open>\n<summary>Thinking Process</summary>\n\n```text\n';
            }
            fullContent += chunk.content;
          } else if (chunk.type === 'content') {
            if (isThinking) {
              isThinking = false;
              fullContent += '\n```\n\n</details>\n\n';
            }
            fullContent += chunk.content;
          } else if (chunk.type === 'tool_call_delta') {
            const idx = chunk.toolCallIndex!;
            while (pendingToolCalls.length <= idx) pendingToolCalls.push({ index: pendingToolCalls.length, id: '', name: '', args: '' });
            if (chunk.toolCallId) pendingToolCalls[idx].id = chunk.toolCallId;
            if (chunk.name) pendingToolCalls[idx].name = chunk.name;
            if (chunk.args) pendingToolCalls[idx].args += chunk.args;
          } else if (chunk.type === 'tool_call') {
            allToolCalls.push({ name: chunk.name!, args: JSON.parse(chunk.args || '{}'), result: chunk.result! });
            task.toolCalls = [...allToolCalls];
            task.subscribers.forEach(cb => cb('tool_call', { name: chunk.name, args: chunk.args, result: chunk.result }));
          }

          task.content = fullContent;
          task.subscribers.forEach(cb => cb('delta', { content: fullContent }));
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          task.status = 'stopped';
          break;
        }
        throw err;
      }

      if (isThinking) {
        fullContent += '\n```\n\n</details>\n\n';
        isThinking = false;
        task.content = fullContent;
        task.subscribers.forEach(cb => cb('delta', { content: fullContent }));
      }

      const validToolCalls = pendingToolCalls.filter(tc => tc.name);
      if (validToolCalls.length > 0 && modelEntry.enableTools) {
        const toolMessages: any[] = [];
        toolMessages.push({
          role: 'assistant',
          content: null,
          tool_calls: validToolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.args },
          })),
        });

        for (const tc of validToolCalls) {
          let parsedArgs: Record<string, any>;
          try { parsedArgs = JSON.parse(tc.args); } catch { parsedArgs = {}; }

          const { executeMathTool } = await import('../providers/tools');
          const result = executeMathTool(tc.name, parsedArgs);
          allToolCalls.push({ name: tc.name, args: parsedArgs, result });
          task.toolCalls = [...allToolCalls];
          task.subscribers.forEach(cb => cb('tool_call', { name: tc.name, args: parsedArgs, result }));

          toolMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }

        currentMessages.push(...toolMessages);
      } else {
        keepResolving = false;
      }
    }

    fullContent = fullContent.replace(/<details open>/g, '<details>');
    task.content = fullContent;

    if (task.status === 'running') {
      task.status = 'done';
    }

    console.log(`[Generation] Finished for session ${session.id}, status=${task.status}, contentLen=${fullContent.length}, toolCalls=${allToolCalls.length}`);

    const modelMsg: ServerChatMessage = {
      id: crypto.randomUUID(),
      role: 'model',
      content: fullContent,
      createdAt: new Date().toISOString(),
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
    };
    session.messages.push(modelMsg);
    session.updatedAt = new Date().toISOString();
    await this.writeSession(session);

    task.subscribers.forEach(cb => cb('done', { content: fullContent, toolCalls: allToolCalls }));
  }

  subscribe(sessionId: string, callback: (event: string, data: any) => void): (() => void) | null {
    const task = this.tasks.get(sessionId);
    if (!task) return null;

    task.subscribers.add(callback);

    if (task.status === 'done' || task.status === 'error' || task.status === 'stopped') {
      queueMicrotask(() => {
        if (task.status === 'done') callback('done', { content: task.content, toolCalls: task.toolCalls });
        else if (task.status === 'error') callback('error', { message: task.error });
        else callback('stopped', {});
      });
    }

    return () => { task.subscribers.delete(callback); };
  }

  stop(sessionId: string): void {
    const task = this.tasks.get(sessionId);
    if (task && task.status === 'running') {
      task.abortController.abort();
    }
  }

  getStatus(sessionId: string): { status: string; content?: string; toolCalls?: any[] } | null {
    const task = this.tasks.get(sessionId);
    if (!task) return null;
    return { status: task.status, content: task.content, toolCalls: task.toolCalls };
  }

  cleanup(sessionId: string): void {
    const task = this.tasks.get(sessionId);
    if (task && task.status !== 'running') {
      this.tasks.delete(sessionId);
    }
  }
}

function id(session: ServerChatSession): string { return session.id; }
