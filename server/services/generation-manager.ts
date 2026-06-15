import fs from 'fs/promises';
import path from 'path';
import { streamChat, StreamChunk } from '../providers/stream';
import { MATH_INSTRUCTIONS } from '../providers/config';

export interface ServerChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string;
}

export interface ServerChatSession {
  id: string;
  uid: string;
  title: string;
  messages: ServerChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// Generation configs - must be serializable plain objects
export interface GenerationModel {
  id: string;
  providerId: string;
  providerType: string;
  modelId: string;
  displayName?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: string;
  extraBody?: Record<string, any>;
  thinkingLevel?: string;
}

export interface GenerationProvider {
  baseURL?: string;
  apiKey?: string;
  envKey?: string;
  type: string;
  name: string;
}

export interface GenerationTask {
  sessionId: string;
  status: 'running' | 'done' | 'error' | 'stopped';
  content: string;
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
    await fs.writeFile(this.sessionPath(session.id), JSON.stringify(session, null, 2));
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

  async sendMessage(sessionId: string, content: string, model: GenerationModel, provider: GenerationProvider, systemPrompt: string, injectThinkingTemplate?: boolean): Promise<void> {
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

    this.startGeneration(session, model, provider, systemPrompt, injectThinkingTemplate);
  }

  async retryMessage(sessionId: string, messageId: string, model: GenerationModel, provider: GenerationProvider, systemPrompt: string, injectThinkingTemplate?: boolean): Promise<void> {
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

    this.startGeneration(session, model, provider, systemPrompt, injectThinkingTemplate);
  }

  async continueGeneration(sessionId: string, model: GenerationModel, provider: GenerationProvider, systemPrompt: string, injectThinkingTemplate?: boolean): Promise<void> {
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

    this.startGeneration(session, model, provider, systemPrompt, injectThinkingTemplate);
  }

  private startGeneration(session: ServerChatSession, model: GenerationModel, provider: GenerationProvider, systemPrompt: string, injectThinkingTemplate?: boolean): void {
    const existing = this.tasks.get(session.id);
    if (existing && existing.status === 'running') {
      existing.abortController.abort();
    }

    const abortController = new AbortController();
    const task: GenerationTask = {
      sessionId: session.id,
      status: 'running',
      content: '',
      subscribers: new Set(),
      abortController,
    };
    this.tasks.set(session.id, task);

    this.runGeneration(task, session, model, provider, systemPrompt, injectThinkingTemplate).catch(err => {
      console.error(`[Generation] Error for session ${session.id}:`, err);
      task.status = 'error';
      task.error = err.message;
      task.subscribers.forEach(cb => cb('error', { message: err.message }));
    });
  }

  private async runGeneration(task: GenerationTask, session: ServerChatSession, model: GenerationModel, provider: GenerationProvider, systemPrompt: string, injectThinkingTemplate?: boolean): Promise<void> {
    console.log(`[Generation] Starting for session ${session.id}, provider=${model.providerType}, model=${model.modelId}, messages=${session.messages.length}`);

    const messages = session.messages.map(m => ({
      role: m.role as string,
      content: m.content,
    }));

    let fullContent = '';
    let isThinking = false;

    const buildSystemPrompt = () => {
      if (model.providerType === 'google') {
        return systemPrompt ? systemPrompt + '\n\n' + MATH_INSTRUCTIONS : MATH_INSTRUCTIONS;
      }
      return systemPrompt;
    };

    const reqMessages = messages.map((m: any) => ({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: m.content,
    }));

    try {
      for await (const chunk of streamChat(model.providerType, provider, {
        model: model.modelId,
        messages: reqMessages,
        systemPrompt: buildSystemPrompt(),
        temperature: model.temperature,
        maxTokens: model.maxTokens,
        reasoningEffort: model.reasoningEffort,
        extraBody: model.extraBody,
        thinkingLevel: model.thinkingLevel,
        injectThinkingTemplate,
      }, task.abortController.signal)) {
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
        }

        task.content = fullContent;
        task.subscribers.forEach(cb => cb('delta', { content: fullContent }));
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        task.status = 'stopped';
      } else {
        throw err;
      }
    }

    if (isThinking) {
      fullContent += '\n```\n\n</details>\n\n';
      isThinking = false;
      task.content = fullContent;
      task.subscribers.forEach(cb => cb('delta', { content: fullContent }));
    }

    fullContent = fullContent.replace(/<details open>/g, '<details>');
    task.content = fullContent;

    if (task.status === 'running') {
      task.status = 'done';
    }

    console.log(`[Generation] Finished for session ${session.id}, status=${task.status}, contentLen=${fullContent.length}`);

    const modelMsg: ServerChatMessage = {
      id: crypto.randomUUID(),
      role: 'model',
      content: fullContent,
      createdAt: new Date().toISOString(),
    };
    session.messages.push(modelMsg);
    session.updatedAt = new Date().toISOString();
    await this.writeSession(session);

    task.subscribers.forEach(cb => cb('done', { content: fullContent }));
  }

  subscribe(sessionId: string, callback: (event: string, data: any) => void): (() => void) | null {
    const task = this.tasks.get(sessionId);
    if (!task) return null;

    task.subscribers.add(callback);

    if (task.status === 'running') {
      queueMicrotask(() => {
        if (task.content) callback('delta', { content: task.content });
      });
    } else if (task.status === 'done' || task.status === 'error' || task.status === 'stopped') {
      queueMicrotask(() => {
        if (task.status === 'done') callback('done', { content: task.content });
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

  getStatus(sessionId: string): { status: string; content?: string } | null {
    const task = this.tasks.get(sessionId);
    if (!task) return null;
    return { status: task.status, content: task.content };
  }

  getRunningSessionIds(): string[] {
    const result: string[] = [];
    for (const [sessionId, task] of this.tasks) {
      if (task.status === 'running') result.push(sessionId);
    }
    return result;
  }

  cleanup(sessionId: string): void {
    const task = this.tasks.get(sessionId);
    if (task && task.status !== 'running') {
      this.tasks.delete(sessionId);
    }
  }
}
