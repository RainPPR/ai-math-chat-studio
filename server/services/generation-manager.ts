import fs from 'fs/promises';
import path from 'path';
import sanitize from 'sanitize-filename';
import { streamChat } from '../providers/stream';
import { MATH_INSTRUCTIONS } from '../providers/config';
import * as unicodeit from 'unicodeit';
import { markdownToTxt } from 'markdown-to-txt';

/**
 * Convert non-standard thinking format to standard format.
 * Non-standard format:
 *   Thinking...
 *   > line 1
 *   > line 2
 *   ...
 *   (content without > prefix)
 *
 * Standard format:
 *   <think>\nline 1\nline 2\n...\n</think>\n\n(content)
 */
function convertNonStandardThinking(content: string): string {
  // Check if content starts with "Thinking..." followed by lines starting with ">"
  const thinkingHeaderRegex = /^Thinking\.\.\.(\r?\n)/;
  const headerMatch = thinkingHeaderRegex.exec(content);

  if (!headerMatch) {
    return content;
  }

  const lines = content.split(/\r?\n/);

  // First line should start with "Thinking..." (allow trailing whitespace)
  if (!lines[0].trim().startsWith('Thinking...')) {
    return content;
  }

  const thinkingLines: string[] = [];
  let mainContentStartIndex = -1;

  // Start from index 1 (after "Thinking...")
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Check if line starts with ">" (possibly with leading whitespace)
    // Capture content after ">" and optional spaces
    const quotedMatch = /^\s*>\s*(.*)$/.exec(line);
    if (quotedMatch) {
      thinkingLines.push(quotedMatch[1]);
    } else {
      // Non-quoted line found, this is where main content starts
      mainContentStartIndex = i;
      break;
    }
  }

  // If no thinking lines found or no main content, return as-is
  if (thinkingLines.length === 0) {
    return content;
  }

  // Build standard format
  const thinkingContent = thinkingLines.join('\n');
  const mainContent = mainContentStartIndex >= 0
    ? lines.slice(mainContentStartIndex).join('\n').trimStart()
    : '';

  const standardThinking = `<think>\n${thinkingContent}\n</think>\n\n${mainContent}`;

  return standardThinking.trim();
}

// Limit input length for title generation

function generateTitleFromMarkdown(markdown: string): string {
  // First replace \dfrac with \frac
  let processed = markdown.replace(/\\dfrac/g, '\\frac');

  // Replace \displaystyle and \scriptstyle with ''
  processed = processed.replace(/\\displaystyle/g, '').replace(/\\scriptstyle/g, '');

  // Target block math $$ ... $$ and convert LaTeX to Unicode
  processed = processed.replace(/\$\$(?=[\s\S])([\s\S]*?)\$\$/g, (_, math) => {
    return (unicodeit as any).replace(math);
  });

  // Target inline math $ ... $ and convert LaTeX to Unicode
  processed = processed.replace(/\$([^$\n]+?)\$/g, (_, math) => {
    return (unicodeit as any).replace(math);
  });

  // Strip remaining Markdown syntax (headers, bold, links, etc.)
  let text = markdownToTxt(processed);

  // 同时处理全角空格、换行符或制表符等所有空白字符并将其替换为单个空格
  text = text.replace(/\s+/g, " ");

  // Remove remaining $ and backslashes, then trim
  text = text.replace(/[$\\]/g, '').trim().replace(/[\n\r]+/g, ' ');

  // 返回最多 50 个字符，如果超过则强制切断
  if (text.length <= 50) return text;
  return text.slice(0, 50) + '...';
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
  characterId?: string;
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
  private pendingWrites = new Map<string, Promise<void>>();
  private deletedSessions = new Set<string>(); // Track deleted sessions to prevent writes

  constructor(sessionsDir: string) {
    this.sessionsDir = sessionsDir;
  }

  // Debounced write to batch rapid successive writes for the same session
  private async debouncedWrite(session: ServerChatSession, delay = 100): Promise<void> {
    const sessionId = session.id;

    // Skip if session was deleted
    if (this.deletedSessions.has(sessionId)) {
      return;
    }

    // Cancel any pending write for this session
    const existing = this.pendingWrites.get(sessionId);
    if (existing) {
      // Wait for it to complete before starting new one
      try { await existing; } catch { /* ignore */ }
    }

    const writePromise = new Promise<void>((resolve, reject) => {
      setTimeout(async () => {
        try {
          // Double-check session wasn't deleted during wait
          if (!this.deletedSessions.has(sessionId)) {
            await this.writeSession(session);
          }
          resolve();
        } catch (err) {
          console.error('[Write] Failed to write session %s:', sessionId, err);
          reject(err);
        } finally {
          this.pendingWrites.delete(sessionId);
        }
      }, delay);
    });

    this.pendingWrites.set(sessionId, writePromise);
    return writePromise;
  }

  // Clear all pending operations for a session (called on delete)
  private clearSessionOperations(sessionId: string): void {
    this.deletedSessions.add(sessionId);

    // Cancel pending writes
    this.pendingWrites.delete(sessionId);

    // Clean up completed tasks
    this.cleanup(sessionId);

    // Remove from deleted tracking after a delay to allow cleanup to propagate
    setTimeout(() => {
      this.deletedSessions.delete(sessionId);
    }, 5000);
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

  async duplicateSession(id: string): Promise<ServerChatSession | null> {
    const source = await this.readSession(id);
    if (!source) return null;

    const now = new Date().toISOString();
    const newSession: ServerChatSession = {
      ...source,
      id: crypto.randomUUID(),
      title: source.title,
      messages: (source.messages || []).map(m => ({
        ...m,
        id: crypto.randomUUID(),
      })),
      createdAt: now,
      updatedAt: now,
    };

    await this.writeSession(newSession);
    return newSession;
  }

  async updateSession(id: string, updates: Partial<ServerChatSession>): Promise<ServerChatSession | null> {
    const pending = this.pendingWrites?.get(id);
    if (pending) {
      try { await pending; } catch {}
    }

    const session = await this.readSession(id);
    if (!session) {
      return null;
    }

    const shouldUpdateTimestamp = Object.keys(updates).some(key => key !== 'characterId');
    const updated = {
      ...session,
      ...updates,
      id: session.id,
      updatedAt: shouldUpdateTimestamp ? new Date().toISOString() : session.updatedAt,
    };

    if (updated.characterId === "") {
      delete updated.characterId;
    }

    await this.writeSession(updated);
    return updated;
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
    // First, clear all pending operations and mark as deleted
    this.clearSessionOperations(id);

    // Stop any running generation
    this.stop(id);

    // Delete the file
    try { await fs.unlink(this.sessionPath(id)); } catch {}

    // Clean up the task entry
    this.tasks.delete(id);
  }



  async sendMessage(sessionId: string, content: string, model: GenerationModel, provider: GenerationProvider, systemPrompt: string, injectThinkingTemplate?: boolean, characterId?: string): Promise<void> {
    let session = await this.readSession(sessionId);
    if (!session) {
      // Create session with temporary title immediately
      session = {
        id: sessionId,
        title: 'New Chat',
        messages: [],
        characterId,
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

    // Generate title synchronously for first message
    if (session.messages.length === 1) {
      session.title = generateTitleFromMarkdown(content);
    }

    session.updatedAt = new Date().toISOString();
    await this.debouncedWrite(session, 0); // Immediate write for first message

    // Start generation immediately (fire-and-forget, errors handled internally)
    this.startGeneration(session, model, provider, systemPrompt, injectThinkingTemplate).catch(() => {});
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
      // Start generation (fire-and-forget, errors handled internally)
      this.startGeneration(session, model, provider, systemPrompt, injectThinkingTemplate).catch(() => {});
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
      // Start generation (fire-and-forget, errors handled internally)
      this.startGeneration(session, model, provider, systemPrompt, injectThinkingTemplate).catch(() => {});
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

    const thoughtRegex = /<think>(?:\r?\n)?([\s\S]*?)(?:(?:\r?\n)?<\/think>|$)/;
    const match = thoughtRegex.exec(messageContent);

    if (match && match[1]) {
      // Keep only the thinking process, wrapped properly
      cleanedContent = `<think>\n${match[1].trim()}\n</think>\n\n`;
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
      // Start generation (fire-and-forget, errors handled internally)
      this.startGeneration(session, model, provider, systemPrompt, injectThinkingTemplate).catch(() => {});
    } catch (err) {
      session.messages = originalMessages;
      await this.writeSession(session);
      throw err;
    }
  }

  private async startGeneration(session: ServerChatSession, model: GenerationModel, provider: GenerationProvider, systemPrompt: string, injectThinkingTemplate?: boolean): Promise<void> {
    const existing = this.tasks.get(session.id);
    if (existing?.status === 'running') {
      // Abort existing task
      existing.abortController.abort();

      // Wait a short time for the old task to complete its cleanup
      // This prevents race conditions between old task's final cleanup and new task's start
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Clean up any completed task for this session
    this.cleanup(session.id);

    const abortController = new AbortController();
    const task: GenerationTask = {
      sessionId: session.id,
      status: 'running',
      content: '',
      subscribers: new Set(),
      abortController,
    };
    this.tasks.set(session.id, task);

    try {
      await this.runGeneration(task, session, model, provider, systemPrompt, injectThinkingTemplate);
    } catch (err: any) {
      console.warn('[Generation] Error for session %s:', session.id, err);
      task.status = 'error';
      task.error = err.message || String(err);
      try {
        task.subscribers.forEach(cb => { cb('error', { message: task.error }); });
      } catch {
        // Ignore errors notifying closed connections
      }
    }
  }

  private async runGeneration(task: GenerationTask, session: ServerChatSession, model: GenerationModel, provider: GenerationProvider, systemPrompt: string, injectThinkingTemplate?: boolean): Promise<void> {
    console.log('[Generation] Starting for session %s, provider=%s, model=%s, messages=%d', session.id, model.providerType, model.modelId, session.messages.length);

    const messages = session.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    let fullContent = '';
    let isThinking = false;
    let lastNotifyTime = 0;
    let pendingNotify = false;
    let pendingNotifyTimeout: ReturnType<typeof setTimeout> | null = null;
    let firstTokenReceived = false;

    const buildSystemPrompt = () => {
      // For Google, we must provide a system prompt.
      // We append MATH_INSTRUCTIONS only if it's not already present in the prompt to ensure LaTeX rendering rules are clear.
      if (model.providerType === 'google') {
        const hasMath = systemPrompt && (systemPrompt.includes('KaTeX') || systemPrompt.includes('LaTeX'));
        if (hasMath) return systemPrompt;
        return systemPrompt ? systemPrompt + '\n\n' + MATH_INSTRUCTIONS : MATH_INSTRUCTIONS;
      }
      return systemPrompt;
    };

    const reqMessages = messages.map((m: any) => ({
      role: m.role === 'model' ? 'assistant' : m.role,
      content: m.content,
    }));

    // Throttled notification to prevent overwhelming clients
    const notifySubscribers = (event: string, data: any, immediate = false) => {
      if (immediate) {
        task.subscribers.forEach(cb => {
          try { cb(event, data); } catch { /* ignore closed connections */ }
        });
        lastNotifyTime = Date.now();
        pendingNotify = false;
        return;
      }

      const now = Date.now();
      if (now - lastNotifyTime >= 50) { // Max 20 updates per second
        task.subscribers.forEach(cb => {
          try { cb(event, data); } catch { /* ignore closed connections */ }
        });
        lastNotifyTime = now;
        pendingNotify = false;
      } else if (!pendingNotify) {
        pendingNotify = true;
        if (pendingNotifyTimeout) clearTimeout(pendingNotifyTimeout);
        pendingNotifyTimeout = setTimeout(() => {
          pendingNotifyTimeout = null;
          if (pendingNotify && task.status === 'running') {
            task.subscribers.forEach(cb => {
              try { cb(event, { content: task.content }); } catch { /* ignore */ }
            });
            lastNotifyTime = Date.now();
            pendingNotify = false;
          }
        }, 50 - (now - lastNotifyTime));
      }
    };

    let hasSaved = false;
    const savePartialContent = async () => {
      if (hasSaved) {
        return;
      }
      if (this.deletedSessions.has(session.id)) {
        return;
      }
      hasSaved = true;
      if (isThinking) {
        fullContent += '\n</think>\n\n';
        isThinking = false;
        task.content = fullContent;
      }
      if (model.providerType === 'openai-compatible') {
        fullContent = convertNonStandardThinking(fullContent);
      }
      task.content = fullContent;

      if (fullContent.trim()) {
        const modelMsg: ServerChatMessage = {
          id: crypto.randomUUID(),
          role: 'model',
          content: fullContent,
          createdAt: new Date().toISOString(),
        };
        const latestSession = await this.readSession(session.id) || session;
        latestSession.messages.push(modelMsg);
        latestSession.updatedAt = new Date().toISOString();
        await this.debouncedWrite(latestSession, 0);
      }
    };

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
        if (task.abortController.signal.aborted) {
          break;
        }

        if (!firstTokenReceived) {
          if (chunk.content) {
            if (chunk.content.length > 0) {
              firstTokenReceived = true;
              console.log('[Generation] First token received for session %s', session.id);
            }
          }
        }

        if (chunk.type === 'reasoning') {
          if (!isThinking) {
            isThinking = true;
            fullContent += '<think>\n';
          }
          fullContent += chunk.content || '';
        } else if (chunk.type === 'content') {
          if (isThinking) {
            isThinking = false;
            fullContent += '\n</think>\n\n';
          }
          fullContent += chunk.content || '';
        }

        task.content = fullContent;
        notifySubscribers('delta', { content: fullContent });
      }

      if (task.abortController.signal.aborted || task.status === 'stopped') {
        const isManualStop = task.status === 'stopped';
        task.status = 'stopped';
        console.log('[Generation] Aborted/stopped detected at end of stream for session %s, manual=%s', session.id, isManualStop);
        if (isManualStop) {
          await savePartialContent();
        }
        notifySubscribers('stopped', {}, true);
        this.cleanup(session.id);
      } else {
        // Normal completion
        await savePartialContent();
        const currentStatus = task.status as string;
        if (task.abortController.signal.aborted || currentStatus === 'stopped') {
          task.status = 'stopped';
          notifySubscribers('stopped', {}, true);
          this.cleanup(session.id);
        } else {
          if (task.status === 'running') {
            task.status = 'done';
          }
          console.log('[Generation] Finished for session %s, status=%s, contentLen=%d', session.id, task.status, fullContent.length);
          notifySubscribers('done', { content: fullContent }, true);
          this.cleanup(session.id);
        }
      }
    } catch (err: any) {
      const isManualStop = task.status === 'stopped';
      if (isManualStop || err.name === 'AbortError' || err.message === 'Aborted') {
        task.status = 'stopped';
        console.log('[Generation] Aborted/stopped for session %s, manual=%s', session.id, isManualStop);
        if (isManualStop) {
          await savePartialContent();
        }
        notifySubscribers('stopped', {}, true);
        this.cleanup(session.id);
      } else {
        console.warn('[Generation] Unexpected error during stream for session %s', session.id, err);
        await savePartialContent();
        throw err;
      }
    }
  }

  private async sanitizeSession(raw: any): Promise<ServerChatSession> {
    const messages = (raw.messages || []).map((m: any) => {
      let content = m.content ?? '';
      // Convert non-standard thinking format for old messages (from before this feature was added)
      if (m.role === 'model') {
        content = convertNonStandardThinking(content);
      }
      return {
        id: m.id ?? crypto.randomUUID(),
        role: m.role === 'model' || m.role === 'user' ? m.role : 'user',
        content,
        createdAt: m.createdAt ?? new Date().toISOString(),
      };
    });

    const firstUserMsg = messages.find((m: any) => m.role === 'user');
    const title = firstUserMsg ? generateTitleFromMarkdown(firstUserMsg.content) : 'Untitled';

    return {
      id: raw.id ?? crypto.randomUUID(),
      title,
      messages,
      characterId: raw.characterId,
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
    if (task?.status === 'running') {
      task.status = 'stopped';
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
