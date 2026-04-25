export interface UserSettings {
  model: string;
  systemPrompt: string;
  thinkingLevel: string;
  memories?: string[];
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
