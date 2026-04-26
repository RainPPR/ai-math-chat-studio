export interface UserSettings {
  provider?: 'gemini' | 'nvidia' | 'custom';
  model: string;
  systemPrompt: string;
  thinkingLevel: string;
  reasoningEffort?: string;
  geminiApiKey?: string;
  customBaseUrl?: string;
  customApiKey?: string;
  customModel?: string;
  customParameters?: { key: string; value: string }[];
  memories?: string[];
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  extraBody?: string; // Stored as JSON string
  renderThinkingAsMarkdown?: boolean;
  autoScroll?: boolean;
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
