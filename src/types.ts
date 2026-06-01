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

export interface UserSettings {
  activeModelId?: string;
  modelPool: ModelPoolEntry[];
  systemPrompt: string;
  renderThinkingAsMarkdown: boolean;
  autoScroll: boolean;
  collapseThinkingFinished: boolean;
  gemmaTrimThinkingSpaces: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  modelPool: [],
  systemPrompt: '',
  renderThinkingAsMarkdown: false,
  autoScroll: true,
  collapseThinkingFinished: true,
  gemmaTrimThinkingSpaces: false,
};

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
