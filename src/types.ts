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
  enableTools: boolean;
  disabledTools: string[];
  extraBody?: Record<string, any>;
  injectThinkingTemplate?: boolean;
}

export interface UserSettings {
  activeModelId?: string;
  providers: ProviderInstance[];
  models: ModelInstance[];
  systemPrompt: string;
  renderThinkingAsMarkdown: boolean;
  autoScroll: boolean;
  collapseThinkingFinished: boolean;
  gemmaTrimThinkingSpaces: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  providers: [],
  models: [],
  systemPrompt: '',
  renderThinkingAsMarkdown: false,
  autoScroll: true,
  collapseThinkingFinished: true,
  gemmaTrimThinkingSpaces: false,
};

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
  enableTools: boolean;
  disabledTools: string[];
}

export interface ToolCallRecord {
  name: string;
  args: any;
  result: string;
  messageId?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  createdAt: string;
  toolCalls?: ToolCallRecord[];
}

export interface ChatSession {
  id: string;
  uid: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
