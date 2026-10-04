import { stripThinking } from './thinking';

/**
 * UUID v4 generator for NodeJS/Browser environments.
 */
function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const OPENAI_USER_ID = `user-${generateUuidV4().replace(/-/g, '').substring(0, 24)}`;

export interface ChatGPTAuthor {
  role: 'system' | 'user' | 'assistant';
  name: string | null;
  metadata: Record<string, unknown>;
}

export interface ChatGPTContent {
  content_type: 'text';
  parts: string[];
}

export interface ChatGPTMessage {
  id: string;
  author: ChatGPTAuthor;
  create_time: number | null;
  update_time?: number | null;
  content: ChatGPTContent;
  status: 'finished_successfully';
  end_turn: boolean | null;
  weight: number;
  metadata: Record<string, unknown>;
  recipient: 'all';
}

export interface ChatGPTNode {
  id: string;
  message: ChatGPTMessage | null;
  parent: string | null;
  children: string[];
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
  name: string;
  picture: string;
  idp: string;
  iat: number;
  mfa_verified: boolean;
  user_id: string;
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

function parseUnixTimestamp(val?: string | number): number {
  if (typeof val === 'number') {
    return val > 1e11 ? val / 1000 : val;
  }
  if (typeof val === 'string') {
    const ms = Date.parse(val);
    if (Number.isFinite(ms)) return ms / 1000;
  }
  return Date.now() / 1000;
}

/**
 * Converts a local session into a ChatGPT format conversation object.
 */
export function buildChatGPTConversation(session: SourceSession): ChatGPTConversation {
  const convId = session.id || generateUuidV4();
  const createTime = parseUnixTimestamp(session.createdAt);
  const updateTime = parseUnixTimestamp(session.updatedAt);
  const title = session.title || 'Untitled Conversation';

  const mapping: Record<string, ChatGPTNode> = {};

  // 1. Root node
  const rootNodeId = 'client-created-root';
  mapping[rootNodeId] = {
    id: rootNodeId,
    message: null,
    parent: null,
    children: [],
  };

  let parentId = rootNodeId;

  // 2. Linear message chain
  for (let i = 0; i < session.messages.length; i++) {
    const msg = session.messages[i];
    const rawContent = msg.content || '';
    // Strip thinking process entirely for output
    const cleanContent = stripThinking(rawContent);

    const msgId = msg.id || generateUuidV4();
    const msgCreateTime = parseUnixTimestamp(msg.createdAt) || createTime + i;

    const authorRole: 'system' | 'user' | 'assistant' =
      msg.role === 'assistant' || msg.role === 'model' ? 'assistant' : msg.role === 'system' ? 'system' : 'user';

    const chatGPTMsg: ChatGPTMessage = {
      id: msgId,
      author: {
        role: authorRole,
        name: null,
        metadata: {},
      },
      create_time: msgCreateTime,
      update_time: null,
      content: {
        content_type: 'text',
        parts: [cleanContent],
      },
      status: 'finished_successfully',
      end_turn: true,
      weight: 1.0,
      metadata: {},
      recipient: 'all',
    };

    const node: ChatGPTNode = {
      id: msgId,
      message: chatGPTMsg,
      parent: parentId,
      children: [],
    };

    mapping[msgId] = node;

    // Attach as child to parent
    if (mapping[parentId]) {
      mapping[parentId].children.push(msgId);
    }

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
 * Builds user.json object
 */
export function buildChatGPTUserFile(): ChatGPTUser {
  return {
    id: OPENAI_USER_ID,
    email: 'user@example.com',
    name: 'ChatGPT User',
    picture: '',
    idp: 'auth0',
    iat: Math.floor(Date.now() / 1000),
    mfa_verified: false,
    user_id: OPENAI_USER_ID,
  };
}

/**
 * Returns all bundle files required for an OpenAI/ChatGPT export ZIP (Option B).
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
