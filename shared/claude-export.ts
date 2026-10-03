/**
 * Builders for Claude-compatible export bundles.
 *
 * Gemini 的 Import chats（gemini.google.com/import）从 2026-09 起会在「来源识别」
 * 阶段拒绝只含一个 conversations.json 的压缩包，报「无法读取上传的文件。请确保该文件
 * 来自受支持的 AI 应用」。可导入的结构需要同时满足：
 *   - zip 根目录带有 Claude 导出包的标志文件：conversations.json + users.json + projects.json
 *   - 每条消息带 text 字段（不能只有 content 块，且不能为空）
 *   - 对话带 account 字段，thinking 块带 start/stop_timestamp
 *   - 时间戳为 ISO-8601 UTC、6 位微秒、结尾大写 Z，且消息时间单调不降
 *   - 严格遵循 “输入 -> 思考 -> 输出” 的轮次结构，缺失部分自动使用 '...' 补齐占位
 */

import { extractThinkingBlocks } from './thinking';

export const CLAUDE_ACCOUNT_UUID = '7c3d41e5-9b02-4a6f-8f14-2d5e6a90c431';

export interface ClaudeSourceMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface ClaudeSourceSession {
  id: string;
  title?: string;
  messages: ClaudeSourceMessage[];
  createdAt: string;
  updatedAt: string;
}

export type ClaudeContentBlock =
  | { type: 'thinking'; thinking: string; start_timestamp: string; stop_timestamp: string }
  | { type: 'text'; text: string };

export interface ClaudeMessage {
  uuid: string;
  text: string;
  content: ClaudeContentBlock[];
  sender: string;
  created_at: string;
  updated_at: string;
  attachments: unknown[];
  files: unknown[];
}

export interface ClaudeConversation {
  uuid: string;
  name: string;
  created_at: string;
  updated_at: string;
  account: { uuid: string };
  chat_messages: ClaudeMessage[];
}

export interface ClaudeUser {
  uuid: string;
  full_name: string;
  email_address: string;
  verified_phone_number: null;
}

export function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** YYYY-MM-DDTHH:MM:SS.ffffffZ */
export function formatClaudeTime(timeMs: number): string {
  const iso = new Date(timeMs).toISOString();
  return iso.replace(/\.(\d+)Z$/, (_match, fraction: string) => {
    return '.' + fraction.padEnd(6, '0') + 'Z';
  });
}

export function formatClaudeDate(dateStr: string): string {
  const ms = new Date(dateStr).getTime();
  return formatClaudeTime(Number.isFinite(ms) ? ms : Date.now());
}

/** 消息时间单调不降，回退或无效的时间戳顺延。 */
export function buildMonotonicTimes(messages: ClaudeSourceMessage[]): number[] {
  const times: number[] = [];
  let previous = 0;
  for (const message of messages) {
    let current = new Date(message.createdAt).getTime();
    if (!Number.isFinite(current) || (times.length > 0 && current <= previous)) {
      current = previous > 0 ? previous + 1 : Date.now();
    }
    times.push(current);
    previous = current;
  }
  return times;
}

/**
 * Align source messages into strict alternating pairs: Human ('user') -> Assistant ('model'/'assistant').
 * Missing turns are automatically supplemented with placeholder messages containing '...'.
 */
export function alignStrictTurns(sourceMessages: ClaudeSourceMessage[], baseTimeMs: number): ClaudeSourceMessage[] {
  if (sourceMessages.length === 0) {
    return [];
  }

  const aligned: ClaudeSourceMessage[] = [];
  let sourceIdx = 0;
  let lastTimeMs = baseTimeMs;

  while (sourceIdx < sourceMessages.length) {
    // 1. Expect Human message ('user')
    if (sourceIdx < sourceMessages.length && sourceMessages[sourceIdx].role === 'user') {
      const msg = sourceMessages[sourceIdx];
      const timeMs = new Date(msg.createdAt).getTime();
      if (Number.isFinite(timeMs) && timeMs > lastTimeMs) {
        lastTimeMs = timeMs;
      } else {
        lastTimeMs = lastTimeMs + 1;
      }
      aligned.push({
        id: msg.id || generateUuidV4(),
        role: 'user',
        content: msg.content,
        createdAt: new Date(lastTimeMs).toISOString()
      });
      sourceIdx++;
    } else {
      // Missing Human message before Assistant -> Insert placeholder Human message
      lastTimeMs = lastTimeMs + 1;
      aligned.push({
        id: generateUuidV4(),
        role: 'user',
        content: '...',
        createdAt: new Date(lastTimeMs).toISOString()
      });
    }

    // 2. Expect Assistant message ('model' or 'assistant')
    if (sourceIdx < sourceMessages.length && sourceMessages[sourceIdx].role !== 'user') {
      const msg = sourceMessages[sourceIdx];
      const timeMs = new Date(msg.createdAt).getTime();
      if (Number.isFinite(timeMs) && timeMs > lastTimeMs) {
        lastTimeMs = timeMs;
      } else {
        lastTimeMs = lastTimeMs + 1;
      }
      aligned.push({
        id: msg.id || generateUuidV4(),
        role: 'model',
        content: msg.content,
        createdAt: new Date(lastTimeMs).toISOString()
      });
      sourceIdx++;
    } else {
      // Missing Assistant message after Human -> Insert placeholder Assistant message
      lastTimeMs = lastTimeMs + 1;
      aligned.push({
        id: generateUuidV4(),
        role: 'model',
        content: '...',
        createdAt: new Date(lastTimeMs).toISOString()
      });
    }
  }

  return aligned;
}

export function buildClaudeHumanMessage(message: ClaudeSourceMessage, stamp: string): ClaudeMessage {
  const textContent = message.content?.trim() || '...';
  return {
    uuid: message.id,
    text: textContent,
    content: [{ type: 'text', text: textContent }],
    sender: 'human',
    created_at: stamp,
    updated_at: stamp,
    attachments: [],
    files: []
  };
}

export function buildClaudeAssistantMessage(message: ClaudeSourceMessage, stamp: string): ClaudeMessage {
  const extracted = extractThinkingBlocks(message.content || '', false);

  // 1. Thinking block
  let thinkingText = '...';
  if (extracted.thoughts.length > 0) {
    const joined = extracted.thoughts.join('\n\n').trim();
    if (joined) {
      thinkingText = joined;
    }
  }

  const thinkingBlock: ClaudeContentBlock = {
    type: 'thinking',
    thinking: thinkingText,
    start_timestamp: stamp,
    stop_timestamp: stamp
  };

  // 2. Output text block
  let outputText = '...';
  if (extracted.mainContent?.trim()) {
    outputText = extracted.mainContent.trim();
  }

  const textBlock: ClaudeContentBlock = {
    type: 'text',
    text: outputText
  };

  return {
    uuid: message.id,
    text: outputText,
    content: [thinkingBlock, textBlock],
    sender: 'assistant',
    created_at: stamp,
    updated_at: stamp,
    attachments: [],
    files: []
  };
}

export function buildClaudeMessage(message: ClaudeSourceMessage, stamp: string): ClaudeMessage {
  if (message.role === 'user') {
    return buildClaudeHumanMessage(message, stamp);
  } else {
    return buildClaudeAssistantMessage(message, stamp);
  }
}

export function buildClaudeConversation(session: ClaudeSourceSession): ClaudeConversation {
  let initialTimeMs = new Date(session.createdAt).getTime();
  if (!Number.isFinite(initialTimeMs)) {
    initialTimeMs = Date.now();
  }

  const alignedMessages = alignStrictTurns(session.messages, initialTimeMs);
  const messageTimes = buildMonotonicTimes(alignedMessages);

  const chat_messages = alignedMessages.map((message, index) => {
    const stamp = formatClaudeTime(messageTimes[index]);
    return buildClaudeMessage(message, stamp);
  });

  let createdTime = initialTimeMs;
  let updatedTime = new Date(session.updatedAt).getTime();
  if (!Number.isFinite(updatedTime)) {
    updatedTime = messageTimes[messageTimes.length - 1] || createdTime;
  }

  if (messageTimes.length > 0) {
    createdTime = Math.min(createdTime, messageTimes[0]);
    updatedTime = Math.max(updatedTime, messageTimes[messageTimes.length - 1]);
  }
  if (updatedTime < createdTime) {
    updatedTime = createdTime;
  }

  return {
    uuid: session.id,
    name: session.title || '',
    created_at: formatClaudeTime(createdTime),
    updated_at: formatClaudeTime(updatedTime),
    account: { uuid: CLAUDE_ACCOUNT_UUID },
    chat_messages
  };
}

export function buildClaudeUsersFile(): ClaudeUser[] {
  return [
    {
      uuid: CLAUDE_ACCOUNT_UUID,
      full_name: 'AI Math Chat Studio',
      email_address: 'export@localhost',
      verified_phone_number: null
    }
  ];
}

/** zip 根目录的三个成员，缺一不可（users.json 是 Gemini 识别 Claude 包的关键标志）。 */
export function buildClaudeBundleFiles(conversations: ClaudeConversation[]): Record<string, string> {
  return {
    'conversations.json': JSON.stringify(conversations, null, 2),
    'users.json': JSON.stringify(buildClaudeUsersFile(), null, 2),
    'projects.json': JSON.stringify([], null, 2)
  };
}
