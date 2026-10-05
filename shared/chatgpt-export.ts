import { extractThinkingBlocks } from './thinking';

/**
 * UUID v4 generator for NodeJS/Browser environments.
 */
function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error('Crypto API is not available');
}

export const OPENAI_USER_ID = `user-${generateUuidV4().replace(/-/g, '').substring(0, 24)}`;

export interface ChatGPTAuthor {
  role: 'system' | 'user' | 'assistant';
  name: string | null;
}

export interface ChatGPTContent {
  content_type: 'text';
  parts: string[];
}

export interface ChatGPTMessage {
  id: string;
  author: ChatGPTAuthor;
  create_time: number | null;
  content: ChatGPTContent;
  metadata: Record<string, unknown>;
}

export interface ChatGPTNode {
  id: string;
  message: ChatGPTMessage | null;
  parent: string | null;
}

export interface ChatGPTConversation {
  id: string;
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, ChatGPTNode>;
  current_node: string;
  conversation_id: string;
  conversation_template_id: null;
  default_model_slug: string;
  is_archived: boolean;
  is_do_not_remember: boolean;
  is_read_only: null;
  is_starred: null;
  is_study_mode: boolean;
  memory_scope: 'global_enabled';
  pinned_time: null;
  plugin_ids: null;
  voice: null;
}

export interface ChatGPTUser {
  id: string;
  email: string;
  chatgpt_plus_user: boolean;
  birth_year: number;
}

export interface ChatGPTExportManifestFile {
  path: string;
  size_bytes: number;
}

export interface ChatGPTExportManifest {
  version: number;
  manifest_file: string;
  export_files: ChatGPTExportManifestFile[];
  logical_files: Record<string, { files: string[]; sharded: boolean }>;
}

export interface SourceMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system' | 'model';
  content: string;
  createdAt?: string | number;
}

export interface SourceSession {
  id: string;
  title: string;
  createdAt: string | number;
  updatedAt: string | number;
  messages: SourceMessage[];
}

function parseUnixTimestamp(val?: string | number): number | null {
  if (val === undefined || val === null) return null;
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return null;
    return val > 1e11 ? val / 1000 : val;
  }
  if (typeof val === 'string') {
    const ms = Date.parse(val);
    if (Number.isFinite(ms)) return ms / 1000;
  }
  return null;
}

/**
 * Converts a local session into a ChatGPT format conversation object strictly matching official schema.
 */
export function buildChatGPTConversation(session: SourceSession): ChatGPTConversation {
  const convId = session.id || generateUuidV4();
  const createTime = parseUnixTimestamp(session.createdAt) ?? (Date.now() / 1000);
  const updateTime = parseUnixTimestamp(session.updatedAt) ?? createTime;
  const title = session.title || 'Untitled Conversation';

  const mapping: Record<string, ChatGPTNode> = {};

  // 1. Root node
  const rootNodeId = 'client-created-root';
  mapping[rootNodeId] = {
    id: rootNodeId,
    message: null,
    parent: null,
  };

  let parentId = rootNodeId;

  // 2. Linear message chain
  for (let i = 0; i < session.messages.length; i++) {
    const msg = session.messages[i];
    const rawContent = msg.content || '';

    const authorRole: 'system' | 'user' | 'assistant' =
      msg.role === 'assistant' || msg.role === 'model' ? 'assistant' : msg.role === 'system' ? 'system' : 'user';

    // Strip thinking process entirely for output only from assistant/model messages.
    // Use allowUnclosed = false to prevent unclosed <think> blocks from stripping trailing body content.
    const cleanContent = authorRole === 'assistant'
      ? extractThinkingBlocks(rawContent, false).mainContent
      : rawContent;

    const msgId = msg.id || generateUuidV4();
    const msgCreateTime = parseUnixTimestamp(msg.createdAt) ?? (createTime + i);

    const chatGPTMsg: ChatGPTMessage = {
      id: msgId,
      author: {
        role: authorRole,
        name: null,
      },
      create_time: msgCreateTime,
      content: {
        content_type: 'text',
        parts: [cleanContent],
      },
      metadata: authorRole === 'assistant' ? { model_slug: 'gpt-4o' } : {},
    };

    const node: ChatGPTNode = {
      id: msgId,
      message: chatGPTMsg,
      parent: parentId,
    };

    mapping[msgId] = node;
    parentId = msgId;
  }

  return {
    id: convId,
    conversation_id: convId,
    title,
    create_time: createTime,
    update_time: updateTime,
    mapping,
    current_node: parentId,
    conversation_template_id: null,
    default_model_slug: 'auto',
    is_archived: false,
    is_do_not_remember: false,
    is_read_only: null,
    is_starred: null,
    is_study_mode: false,
    memory_scope: 'global_enabled',
    pinned_time: null,
    plugin_ids: null,
    voice: null,
  };
}

/**
 * Builds user.json object strictly following official ChatGPT export format
 */
export function buildChatGPTUserFile(): ChatGPTUser {
  return {
    id: OPENAI_USER_ID,
    email: 'user@example.com',
    chatgpt_plus_user: false,
    birth_year: 2000,
  };
}

/**
 * Returns all bundle files required for an OpenAI/ChatGPT export ZIP.
 */
export function buildChatGPTBundleFiles(conversations: ChatGPTConversation[]): Record<string, string> {
  const conversationsJson = JSON.stringify(conversations, null, 2);
  const userJson = JSON.stringify(buildChatGPTUserFile(), null, 2);

  const exportFiles: ChatGPTExportManifestFile[] = [
    {
      path: 'conversations.json',
      size_bytes: new TextEncoder().encode(conversationsJson).length,
    },
    {
      path: 'user.json',
      size_bytes: new TextEncoder().encode(userJson).length,
    },
  ];

  const exportManifest: ChatGPTExportManifest = {
    version: 1,
    manifest_file: 'export_manifest.json',
    export_files: exportFiles,
    logical_files: {
      'conversations.json': { files: ['conversations.json'], sharded: false },
      'user.json': { files: ['user.json'], sharded: false },
    },
  };

  const manifestJson = JSON.stringify(exportManifest, null, 2);

  return {
    'conversations.json': conversationsJson,
    'user.json': userJson,
    'export_manifest.json': manifestJson,
  };
}
