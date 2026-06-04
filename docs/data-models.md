# 数据模型与存储

## TypeScript 类型定义

### ProviderInstance（提供商实例）

```typescript
interface ProviderInstance {
  id: string;           // UUID
  type: 'google' | 'nvidia' | 'openai-compatible';  // 内置类型
  name: string;         // 显示名称
  baseURL?: string;     // 自定义 Base URL（覆盖内置默认值）
  apiKey?: string;      // 自定义 API Key（覆盖环境变量）
  envKey?: string;      // 环境变量前缀（如 NVIDIA_API_KEY）
  extra?: Record<string, any>;  // 额外配置（高拓展性）
}
```

### ModelInstance（模型实例）

```typescript
interface ModelInstance {
  id: string;                       // UUID
  providerId: string;               // 关联的 ProviderInstance.id
  providerType: 'google' | 'nvidia' | 'openai-compatible';  // 冗余字段，高效传递
  modelId: string;                  // 模型 ID（如 gemini-3.5-flash）
  displayName?: string;             // 显示名称（可选）
  temperature?: number;             // 温度参数（Unset 时不传给 API）
  maxTokens?: number;               // 最大 token 数（Unset 时不传给 API）
  reasoningEffort?: string;         // 推理努力程度（low/medium/high，OpenAI 兼容用）
  thinkingLevel?: string;           // 思考级别（Gemini 专用）
  enableTools: boolean;             // 是否启用数学工具
  disabledTools: string[];          // 禁用的工具名称列表
  extraBody?: Record<string, any>;  // 额外请求体（JSON 对象，合并到 API 请求中）
  injectThinkingTemplate?: boolean; // 注入 chat_template_kwargs thinking（Nvidia 用）
}
```

### UserSettings（用户设置）

```typescript
interface UserSettings {
  activeModelId?: string;           // 当前活跃模型的 ModelInstance.id
  providers: ProviderInstance[];    // 提供商实例列表
  models: ModelInstance[];         // 模型实例列表
  systemPrompt: string;            // 系统提示词
  renderThinkingAsMarkdown: boolean;
  autoScroll: boolean;
  collapseThinkingFinished: boolean;
  gemmaTrimThinkingSpaces: boolean;
}
```

### ChatMessage（聊天消息）

```typescript
interface ChatMessage {
  id: string;                       // UUID
  role: 'user' | 'model';          // 角色
  content: string;                   // 消息内容（含 Markdown 和思考过程包装）
  createdAt: string;                // ISO 时间戳
  toolCalls?: ToolCallRecord[];    // 工具调用记录
}
```

### ToolCallRecord（工具调用记录）

```typescript
interface ToolCallRecord {
  name: string;       // 工具名称
  args: any;          // 调用参数
  result: string;     // 执行结果
  messageId?: string; // 关联消息 ID
}
```

### ChatSession（聊天会话）

```typescript
interface ChatSession {
  id: string;         // UUID
  uid: string;        // 固定为 'local'（历史遗留字段）
  title: string;      // 会话标题（首条消息前 30 字符）
  messages: ChatMessage[];  // 消息列表
  createdAt: string;  // ISO 时间戳
  updatedAt: string;  // ISO 时间戳
}
```

### 服务端类型（GenerationManager 内部）

```typescript
interface GenerationModel {
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
  enableTools: boolean;
  disabledTools: string[];
}

interface GenerationProvider {
  baseURL?: string;
  apiKey?: string;
  envKey?: string;
  type: string;
  name: string;
}
```

## 存储方案

### 本地 JSON 文件存储

数据通过 Express 服务端 REST API 读写本地 JSON 文件：

**文件结构**：

```
/data/
  settings.json           # UserSettings（单文件）
  sessions/{sessionId}.json  # ChatSession（每会话一个文件）
```

**API 端点**：

- `GET /api/settings` — 读取设置
- `PUT /api/settings` — 写入设置
- `GET /api/sessions` — 列出所有会话
- `GET /api/sessions/:id` — 获取单个会话
- `DELETE /api/sessions/:id` — 删除会话
- `POST /api/sessions/:id/messages` — 发送消息并触发生成
- `GET /api/sessions/:id/generation` — SSE 订阅生成进度
- `DELETE /api/sessions/:id/generation` — 停止生成
- `POST /api/sessions/:id/retry` — 重试消息
- `POST /api/sessions/:id/continue` — 继续生成
- `GET /api/providers` — 获取内置提供商类型列表
- `GET /api/providers/:type/models` — 获取指定类型的模型列表

## 默认设置

```typescript
const DEFAULT_SETTINGS: UserSettings = {
  providers: [],
  models: [],
  systemPrompt: '',
  renderThinkingAsMarkdown: false,
  autoScroll: true,
  collapseThinkingFinished: true,
  gemmaTrimThinkingSpaces: false,
};
```

> **设计要点**：所有参数（temperature、maxTokens 等）为 "Unset" 时不传给 API，由供应商使用默认值。已删除 `topP` 参数。
