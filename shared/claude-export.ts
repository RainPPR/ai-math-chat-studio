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
 */

import { v4 as uuidv4 } from 'uuid';

import { extractThinkingBlocks } from './thinking';

/** 导出包内 account.uuid / users.json 共用的账户 UUID，每次导出时用标准库生成一个，不手写。 */
export const CLAUDE_ACCOUNT_UUID = uuidv4();

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
    if (!Number.isFinite(current) || (times.length > 0 && current < previous)) {
      current = previous > 0 ? previous + 1 : Date.now();
    }
    times.push(current);
    previous = current;
  }
  return times;
}

export function buildClaudeMessage(message: ClaudeSourceMessage, stamp: string): ClaudeMessage {
  const extracted = extractThinkingBlocks(message.content, false);

  const content: ClaudeContentBlock[] = [];
  for (const thought of extracted.thoughts) {
    content.push({
      type: 'thinking',
      thinking: thought,
      start_timestamp: stamp,
      stop_timestamp: stamp
    });
  }
  // content 数组只在「有正文」或「完全没有思考内容」时补一个 text 块；
  // 纯思考（生成被打断，仅有 <think> 没有正文）的消息，content 就只保留 thinking 块，
  // 不额外拼接重复的 text 块——这与真实 Claude 导出样例完全一致。
  if (extracted.mainContent) {
    content.push({ type: 'text', text: extracted.mainContent });
  }

  // text 字段永不为空：正文 -> 思考内容兜底 -> 原始内容兜底 -> 空格兜底。
  let text = extracted.mainContent;
  if (!text && extracted.thoughts.length > 0) {
    text = extracted.thoughts.join('\n\n');
  }
  if (!text || !text.trim()) {
    // Gemini rejects Claude messages whose visible text is empty. Keep the
    // message structurally valid and make the text/content representations
    // agree, instead of emitting a blank text block or a single whitespace.
    text = '(empty message)';
  }
  // A Claude message always has a readable text block. Thinking-only messages
  // still retain their thinking block, but also need this fallback text block.
  if (content.length === extracted.thoughts.length) {
    content.push({ type: 'text', text });
  }

  let sender = 'assistant';
  if (message.role === 'user') {
    sender = 'human';
  }

  return {
    uuid: message.id,
    text,
    content,
    sender,
    created_at: stamp,
    updated_at: stamp,
    attachments: [],
    files: []
  };
}

export function buildClaudeConversation(session: ClaudeSourceSession): ClaudeConversation {
  const messageTimes = buildMonotonicTimes(session.messages);
  const chat_messages = session.messages.map((message, index) => {
    return buildClaudeMessage(message, formatClaudeTime(messageTimes[index]));
  });

  let createdTime = new Date(session.createdAt).getTime();
  let updatedTime = new Date(session.updatedAt).getTime();
  if (!Number.isFinite(createdTime)) {
    createdTime = messageTimes[0] || Date.now();
  }
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
