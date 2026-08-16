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
  modelSource?: string; // 远程模型列表 JSON URL（仅适用于 nvidia/openai-compatible，启动时自动同步）
}
```

> **特殊行为**：
> - `nvidia` 类型的 `baseURL` 固定为 `https://integrate.api.nvidia.com/v1`，无法覆盖
> - `google` 类型不支持 `modelSource`（模型列表通过 API 获取）

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
  reasoningEffort?: string;         // 推理努力程度（max/xhigh/high/medium/low/minimal/none，OpenAI 兼容用）
  thinkingLevel?: string;           // 思考级别（Gemini 专用）
  extraBody?: Record<string, any>;  // 额外请求体（JSON 对象，合并到 API 请求中）
  injectThinkingTemplate?: boolean; // 注入 chat_template_kwargs thinking（Nvidia 用）
}
```

### Character（角色）

```typescript
interface Character {
  id: string;            // UUID
  name: string;          // 角色名称
  systemPrompt: string;  // 系统提示词
}
```

> **设计意图**：角色是系统提示词的容器。用户可在设置中创建多个角色（如"数学导师"、"代码助手"），每个角色携带不同的 `systemPrompt`。发送消息时，后端根据 `activeCharacterId` 查找对应角色的 `systemPrompt` 注入请求。

### Template（自动填入模板）

```typescript
interface Template {
  id: string;            // UUID / 唯一标识符
  name: string;          // 模板名称（显示在菜单中）
  content: string;       // 模板具体内容（支持 LaTeX，可自动追加到输入框）
}
```

> **设计意图**：聊天自动填入模板是一个独立的数据模型。用户可以在设置中配置三角形、数列等高频填入的数学句式，并在聊天中一键快捷 append 到输入框中，避免重复输入。

### UserSettings（用户设置）

```typescript
interface UserSettings {
  activeModelId?: string;           // 当前活跃模型的 ModelInstance.id
  activeCharacterId?: string;       // 当前活跃角色的 Character.id
  providers: ProviderInstance[];    // 提供商实例列表
  models: ModelInstance[];          // 模型实例列表
  characters: Character[];          // 角色列表
  systemPrompt: string;             // 全局回退系统提示词（向后兼容）
  renderThinkingAsMarkdown: boolean;
  autoScroll: boolean;
  collapseThinkingFinished: boolean;
  trimThinkingSpaces: boolean;
  starredSessions?: Record<string, string>; // 加星会话映射（会话 ID => 星星颜色 ID）
}
```

### ChatMessage（聊天消息）

```typescript
interface ChatMessage {
  id: string;                       // UUID
  role: 'user' | 'model';          // 角色
  content: string;                   // 消息内容（含 Markdown 和思考过程包装）
  createdAt: string;                // ISO 时间戳
 }
```

### ChatSession（聊天会话）

```typescript
interface ChatSession {
  id: string;               // UUID
  title: string;            // 会话标题
  messages: ChatMessage[];  // 消息列表
  characterId?: string;    // 创建时使用的角色 ID（仅记录首次）
  createdAt: string;        // ISO 时间戳
  updatedAt: string;        // ISO 时间戳
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
  templates.json          # Template[]（聊天自动填入模板单文件）
  sessions/{sessionId}.json  # ChatSession（每会话一个文件）
  log/                    # 日志文件（YYYY-MM-DD.log）
```

**API 端点**：

- `GET /api/settings` — 读取设置
- `PUT /api/settings` — 写入设置
- `GET /api/templates` — 读取模板列表
- `PUT /api/templates` — 保存/更新模板列表（带严格的结构和非空校验）
- `GET /api/sessions` — 列出所有会话
- `GET /api/sessions/:id` — 获取单个会话
- `DELETE /api/sessions/:id` — 删除会话
- `PATCH /api/sessions/:id` — 更新会话元数据或消息。接受 `title`、`characterId` 和 `messages`（数组类型，元素结构需符合 `ChatMessage` 规范，必须包含 `id`、`role`、`content`、`createdAt`）
- `POST /api/sessions/:id/messages` — 发送消息并触发生成
- `GET /api/sessions/:id/generation` — SSE 订阅生成进度
- `DELETE /api/sessions/:id/generation` — 停止生成
- `GET /api/generation-status` — 获取正在运行的会话 ID 列表（页面刷新后恢复状态用）
- `POST /api/sessions/:id/retry` — 重试消息
- `POST /api/sessions/:id/continue` — 继续生成
- `GET /api/providers` — 获取内置提供商类型列表
- `POST /api/providers/:type/models` — 获取指定类型的模型列表（POST 避免在 URL 中传递敏感信息）

## 默认设置

```typescript
const DEFAULT_SETTINGS: UserSettings = {
  providers: [],
  models: [],
  characters: [],
  systemPrompt: '',
  renderThinkingAsMarkdown: false,
  autoScroll: true,
  collapseThinkingFinished: true,
  trimThinkingSpaces: false,
  starredSessions: {},
};
```

> **设计要点**：所有参数（temperature、maxTokens 等）为 "Unset" 时不传给 API，由供应商使用默认值。已删除 `topP` 参数。
