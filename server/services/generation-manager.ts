import fs from 'fs/promises';
import path from 'path';
import sanitize from 'sanitize-filename';
import { convert } from 'pandoc-wasm';
import { streamChat, StreamChunk } from '../providers/stream';
import { MATH_INSTRUCTIONS } from '../providers/config';

const PANDOC_OPTIONS = {
  from: 'markdown',
  to: 'plain',
  standalone: true,
  wrap: 'none',
};

// Limit input length to avoid unnecessary pandoc processing
const TITLE_INPUT_LIMIT = 100;

async function generateTitleFromMarkdown(markdown: string): Promise<string> {
  // Only take first N characters - title only needs beginning of message
  const truncated = markdown.slice(0, TITLE_INPUT_LIMIT);
  const _markdown = truncated.replaceAll("\\dfrac", "\\frac");
  try {
    const result = await convert(PANDOC_OPTIONS, _markdown, {});
    const plainText = result.stdout || _markdown;
    const trimmed = plainText.trim().replaceAll("$", "");
    if (trimmed.length <= 50) return trimmed;
    return trimmed.slice(0, 50) + '...';
  } catch {
    const trimmed = _markdown.trim().replaceAll("$", "");
    if (trimmed.length <= 50) return trimmed;
    return trimmed.slice(0, 50) + '...';
  }
}

export interface ServerChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string;
}

export interface ServerChatSession {
  id: string;
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
    const sanitizedId = sanitize(id);
    return path.join(this.sessionsDir, `${sanitizedId}.json`);
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

  // Generate title asynchronously and notify subscribers
  private async generateTitleAsync(sessionId: string, content: string): Promise<void> {
    try {
      const title = await generateTitleFromMarkdown(content);
      const session = await this.readSession(sessionId);
      if (!session) return;

      // Only update if title actually changed and session has no custom title yet
      if (session.title !== title && (session.title === 'New Chat' || session.messages.length <= 1)) {
        session.title = title;
        session.updatedAt = new Date().toISOString();
        await this.writeSession(session);

        // Notify subscribers about title update via delta event
        const task = this.tasks.get(sessionId);
        if (task) {
          task.subscribers.forEach(cb => cb('title', { title }));
        }
      }
    } catch (err) {
      console.error('[Title] Failed to generate title for session %s:', sessionId, err);
    }
  }

  async sendMessage(sessionId: string, content: string, model: GenerationModel, provider: GenerationProvider, systemPrompt: string, injectThinkingTemplate?: boolean): Promise<void> {
    let session = await this.readSession(sessionId);
    if (!session) {
      // Create session with temporary title immediately
      session = {
        id: sessionId,
        title: 'New Chat',
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

    // For first message, update title immediately with raw content, then refine async
    if (session.messages.length === 1) {
      const rawTitle = content.trim().slice(0, 50) + (content.length > 50 ? '...' : '');
      session.title = rawTitle || 'New Chat';
    }

    session.updatedAt = new Date().toISOString();
    await this.writeSession(session);

    // Start generation immediately
    this.startGeneration(session, model, provider, systemPrompt, injectThinkingTemplate);

    // Generate refined title asynchronously in background
    if (session.messages.length === 1) {
      this.generateTitleAsync(sessionId, content).catch(() => {});
    }
  }

  async retryMessage(sessionId: string, messageId: string, model: GenerationModel, provider: GenerationProvider, systemPrompt: string, injectThinkingTemplate?: boolean): Promise<void> {
    const session = await this.readSession(sessionId);
    if (!session) throw new Error('Session not found');

    const idx = session.messages.findIndex(m => m.id === messageId);
    if (idx === -1) throw new Error('Message not found');

    let userIdx = idx;
    while (userIdx >= 0 && session.messages[userIdx].role !== 'user') userIdx--;
    if (userIdx === -1) throw new Error('No user message found before the target message');

    const originalMessages = session.messages;
    session.messages = session.messages.slice(0, userIdx + 1);
    session.updatedAt = new Date().toISOString();

    try {
      await this.writeSession(session);
      this.startGeneration(session, model, provider, systemPrompt, injectThinkingTemplate);
    } catch (err) {
      session.messages = originalMessages;
      await this.writeSession(session);
      throw err;
    }
  }

  async continueGeneration(sessionId: string, model: GenerationModel, provider: GenerationProvider, systemPrompt: string, injectThinkingTemplate?: boolean): Promise<void> {
    const session = await this.readSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.messages.length === 0) throw new Error('Session has no messages');

    const continueMsg: ServerChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `The previous response was interrupted due to network error or stream timeout. Please review your previous reasoning and output, then continue to complete the response:

- If you had already started generating the final output (outside thinking tags): Review your previous reasoning and the partial output already generated, then regenerate the COMPLETE final output from the beginning to ensure nothing is missing.
- If you were still in the thinking/reasoning phase: Review your previous thinking content, continue your analysis from where you left off, and then generate the complete final response.

Do not skip steps or assume previous content was sufficient. Ensure the final response is comprehensive and complete.`,
      createdAt: new Date().toISOString(),
    };

    const originalMessages = session.messages;
    session.messages.push(continueMsg);
    session.updatedAt = new Date().toISOString();

    try {
      await this.writeSession(session);
      this.startGeneration(session, model, provider, systemPrompt, injectThinkingTemplate);
    } catch (err) {
      session.messages = originalMessages;
      await this.writeSession(session);
      throw err;
    }
  }

  async regenerateMessage(sessionId: string, messageId: string, model: GenerationModel, provider: GenerationProvider, systemPrompt: string, injectThinkingTemplate?: boolean): Promise<void> {
    const session = await this.readSession(sessionId);
    if (!session) throw new Error('Session not found');

    const idx = session.messages.findIndex(m => m.id === messageId);
    if (idx === -1) throw new Error('Message not found');
    if (session.messages[idx].role !== 'model') throw new Error('Can only regenerate model messages');

    // Extract thinking process from the message content
    const messageContent = session.messages[idx].content;
    let cleanedContent = '';

    const thoughtRegex = /<details(?: open)?>\n<summary>Thinking Process<\/summary>\n\n```text\n([\s\S]*?)(?:\n```\n\n<\/details>|$)/;
    const match = messageContent.match(thoughtRegex);

    if (match && match[1]) {
      // Keep only the thinking process, wrapped properly
      cleanedContent = `<details open>\n<summary>Thinking Process</summary>\n\n\`\`\`text\n${match[1].trim()}\n\`\`\`\n\n</details>\n\n`;
    }

    // Update the message with cleaned content (only thinking preserved)
    const originalMessages = session.messages;
    session.messages[idx].content = cleanedContent;

    // Truncate messages after this one
    session.messages = session.messages.slice(0, idx + 1);

    // Add regenerate instruction
    const regenerateMsg: ServerChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: `Based on your previous thinking process above, please continue your analysis and provide a comprehensive response. Review the reasoning you've done so far, identify any gaps or areas that need deeper exploration, and then generate a complete, well-structured output. Do not assume your previous thinking was perfect—critically examine it and extend it where necessary before producing the final response.`,
      createdAt: new Date().toISOString(),
    };

    session.messages.push(regenerateMsg);
    session.updatedAt = new Date().toISOString();

    try {
      await this.writeSession(session);
      this.startGeneration(session, model, provider, systemPrompt, injectThinkingTemplate);
    } catch (err) {
      session.messages = originalMessages;
      await this.writeSession(session);
      throw err;
    }
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
      console.error('[Generation] Error for session %s:', session.id, err);
      task.status = 'error';
      task.error = err.message;
      task.subscribers.forEach(cb => cb('error', { message: err.message }));
    });
  }

  private async runGeneration(task: GenerationTask, session: ServerChatSession, model: GenerationModel, provider: GenerationProvider, systemPrompt: string, injectThinkingTemplate?: boolean): Promise<void> {
    console.log('[Generation] Starting for session %s, provider=%s, model=%s, messages=%d', session.id, model.providerType, model.modelId, session.messages.length);

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

    console.log('[Generation] Finished for session %s, status=%s, contentLen=%d', session.id, task.status, fullContent.length);

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

  private async sanitizeSession(raw: any): Promise<ServerChatSession> {
    const messages = (raw.messages || []).map((m: any) => ({
      id: m.id ?? crypto.randomUUID(),
      role: m.role === 'model' || m.role === 'user' ? m.role : 'user',
      content: m.content ?? '',
      createdAt: m.createdAt ?? new Date().toISOString(),
    }));

    const firstUserMsg = messages.find((m: any) => m.role === 'user') || 'Untitled';
    const title = await generateTitleFromMarkdown(firstUserMsg.content);

    return {
      id: raw.id ?? crypto.randomUUID(),
      title,
      messages,
      createdAt: raw.createdAt ?? new Date().toISOString(),
      updatedAt: raw.updatedAt ?? new Date().toISOString(),
    };
  }

  async cleanSessions(): Promise<{ cleaned: number; total: number; details: string[] }> {
    const sessions = await this.listSessions();
    const details: string[] = [];
    let cleaned = 0;

    for (const session of sessions) {
      const clean = await this.sanitizeSession(session);
      await this.writeSession(clean);
      cleaned++;
      details.push(clean.title);
    }

    return { cleaned, total: sessions.length, details };
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
