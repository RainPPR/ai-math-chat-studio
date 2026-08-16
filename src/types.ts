// 内置提供商类型
export type BuiltInProviderType = 'google' | 'nvidia' | 'openai-compatible';

// 用户配置的提供商实例
export interface ProviderInstance {
  id: string;
  type: BuiltInProviderType;
  name: string;
  baseURL?: string;
  apiKey?: string;
  envKey?: string;
  extra?: Record<string, any>;
  modelSource?: string; // 远程模型列表 JSON URL（仅适用于 nvidia/openai-compatible，启动时自动同步）
}

// 用户配置的模型实例
export interface ModelInstance {
  id: string;
  providerId: string;
  providerType: BuiltInProviderType;
  modelId: string;
  displayName?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: string;
  thinkingLevel?: string;
  extraBody?: Record<string, any>;
  injectThinkingTemplate?: boolean;
}

// 临时模型实例 (不依赖 provider，仅支持 openai 兼容型 api，显式 baseURL/apiKey)
export interface TempModel {
  id: string;
  name?: string;
  baseURL: string;
  apiKey: string;
  modelId: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: string;
  extraBody?: Record<string, any>;
  injectThinkingTemplate?: boolean;
}

export interface Character {
  id: string;
  name: string;
  systemPrompt: string;
}

export interface Template {
  id: string;
  name: string;
  content: string;
}

export interface UserSettings {
  activeModelId?: string;
  activeCharacterId?: string;
  providers: ProviderInstance[];
  models: ModelInstance[];
  tempModels?: TempModel[];
  characters: Character[];
  systemPrompt: string;
  renderThinkingAsMarkdown: boolean;
  autoScroll: boolean;
  collapseThinkingFinished: boolean;
  trimThinkingSpaces: boolean;
  starredSessions?: Record<string, StarColor>;
  claudeChunks?: string[];
  claudeChunkRemarks?: Record<string, string>;
  stickyNotes?: { id: string; content: string; createdAt: string }[];
  katexFont?: string;
}

export type StarColor = 'yellow' | 'rose' | 'blue' | 'green' | 'orange';

export const DEFAULT_SETTINGS: UserSettings = {
  providers: [],
  models: [],
  tempModels: [],
  characters: [],
  systemPrompt: '',
  renderThinkingAsMarkdown: false,
  autoScroll: true,
  collapseThinkingFinished: true,
  trimThinkingSpaces: false,
  starredSessions: {},
  claudeChunks: [],
  claudeChunkRemarks: {},
  stickyNotes: [],
  katexFont: 'default',
};

export const KATEX_FONTS = [
  { id: 'default', name: 'Default' },
  { id: 'euler', name: 'Euler Math' },
  { id: 'fira', name: 'Fira Math' },
  { id: 'cambria', name: 'Cambria Math' },
];

// Legacy type (kept for backward compatibility)
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
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  characterId?: string;  // 创建时使用的角色 ID（仅记录首次）
  createdAt: string;
  updatedAt: string;
}
