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
  modelSyncType?: 'none' | 'json' | 'v1_models'; // 模型列表同步模式
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
  thinkingLevel?: string;           // 思考级别（Gemini 专用：minimal/low/medium/high/xhigh）
  extraBody?: Record<string, any>;  // 额外请求体（JSON 对象，合并到 API 请求中）
  injectThinkingTemplate?: boolean; // 注入 chat_template_kwargs thinking（Nvidia 用）
}
```

### TempModel（临时模型实例）

```typescript
interface TempModel {
  id: string;                       // UUID
  name?: string;                    // 临时模型显示名称（可选）
  baseURL: string;                  // 显式 Base URL
  apiKey: string;                   // 显式 API Key
  modelId: string;                  // 模型 ID（如 Qwen/Qwen3.8-27B）
  temperature?: number;             // 温度参数
  maxTokens?: number;               // 最大 token 数
  reasoningEffort?: string;         // 推理努力程度
  extraBody?: Record<string, any>;  // 额外请求体
  injectThinkingTemplate?: boolean; // 是否注入 thinking 参数
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

### Skill（技能）

```typescript
interface Skill {
  id: string;            // UUID / 唯一标识符
  name: string;          // 技能名称（如 "Assistant"）
  prompt: string;        // 技能提示词内容
}
```

> **设计意图**：技能是独立于角色的可多选提示词模块。默认系统包含 "Assistant" 技能。发送消息时，后端通过 `shared/system-prompt.ts` 依次拼接活跃 Character 系统提示词（或回退 `systemPrompt`）、选中的 Skills 块（`# Skill: ${name}\n${prompt}`），并在末尾追加 KaTeX/Markdown 格式指令（`FORMAT_INSTRUCTIONS`）。

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
type StarColor = 'yellow' | 'rose' | 'blue' | 'green' | 'orange';

interface UserSettings {
  activeModelId?: string;           // 当前活跃模型的 ModelInstance.id 或 TempModel.id
  activeCharacterId?: string;       // 当前活跃角色的 Character.id
  activeSkillIds?: string[];        // 默认激活的技能 ID 列表
  providers: ProviderInstance[];    // 提供商实例列表
  models: ModelInstance[];          // 模型实例列表
  tempModels?: TempModel[];         // 临时模型实例列表
  characters: Character[];          // 角色列表
  skills?: Skill[];                 // 技能列表
  systemPrompt: string;             // 全局回退系统提示词（向后兼容）
  renderThinkingAsMarkdown: boolean;
  autoScroll: boolean;
  collapseThinkingFinished: boolean;
  trimThinkingSpaces: boolean;      // 仅作用于前端 parseMessageContent 渲染展示，不改写存储或分块编辑内容
  stripThinkingForApi?: boolean;    // 构造 API 请求时过滤历史模型消息（非末条）的 <think> 块
  userAsSystem?: boolean;           // 以 role: 'user' + <system>...</system> 传入系统提示词
  starredSessions?: Record<string, StarColor>; // 加星会话映射（会话 ID => 星星颜色 ID）
  chatgptChunks?: string[];         // ChatGPT 导出时间分片点（ISO 8601 字符串列表）
  chatgptChunkRemarks?: Record<string, string>; // 分片时间戳备注映射
  stickyNotes?: { id: string; content: string; createdAt: string }[]; // 全局便利贴
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

数据通过 Express 服务端 REST API 读写本地 JSON 文件；`server/lib/settings-helper.ts` 负责将配置列表分拆存储到独立 JSON 文件（仅写入内容发生变更的文件，并通过 `.tmp-` 与 `.bak-` 实现多文件事务写入与回滚），并在启动/加载时透明执行旧版单文件字段及 `claudeChunks` → `chatgptChunks` 的迁移：

**文件结构**：

```
/data/
  settings.json           # UserSettings 通用设置（不含分拆列表）
  providers.json          # ProviderInstance[]（提供商列表，自动排序）
  models.json             # ModelInstance[]（模型列表，自动排序）
  temp-models.json        # TempModel[]（临时模型列表，包含 API Key，已 Git 忽略）
  characters.json         # Character[]（角色列表，自动排序）
  skills.json             # Skill[]（技能列表，自动排序）
  templates.json          # Template[]（聊天自动填入模板单文件，自动排序）
  sessions/{sessionId}.json  # ChatSession（每会话一个文件，characterId 始终位于 JSON 最后字段）
  log/                    # 日志文件（YYYY-MM-DD.log）
```

**API 端点**：

- `GET /api/settings` — 读取并合并分拆设置
- `PUT /api/settings` — 分拆排序并原子写入设置
- `GET /api/templates` — 读取模板列表
- `PUT /api/templates` — 保存/更新模板列表（严格校验 `name` 非空、`content` 为字符串，并经 `sortTemplates` 自动排序）
- `GET /api/sessions` — 列出所有会话
- `GET /api/sessions/:id` — 获取单个会话
- `DELETE /api/sessions/:id` — 停止生成并删除会话
- `PATCH /api/sessions/:id` — 更新会话元数据或消息。接受 `title`、`characterId` 和 `messages`（校验数组结构与唯一 `id`）。若磁盘上不存在目标会话，`GenerationManager.updateSession()` 返回 `null` 并响应 `404`（防止生成幽灵会话）
- `POST /api/sessions/:id/duplicate` — 复制会话（重新生成会话及消息 UUID）
- `POST /api/sessions/clean` — 批量规范化清洗所有会话（转换旧式思考块、合并连续 `<think>` 块、重新生成标题并将 `characterId` 置于末尾）
- `POST /api/sessions/:id/messages` — 发送消息并触发生成
- `GET /api/sessions/:id/generation` — SSE 订阅生成进度
- `DELETE /api/sessions/:id/generation` — 停止生成
- `GET /api/generation-status` — 获取正在运行的会话 ID 列表（页面刷新后恢复状态用）
- `POST /api/sessions/:id/retry` — 重试消息
- `POST /api/sessions/:id/continue` — 继续生成
- `POST /api/sessions/:id/regenerate` — 保留思考过程重新生成正文
- `GET /api/providers` — 获取内置提供商类型列表
- `POST /api/providers/:type/models` — 获取指定类型的模型列表（POST 避免在 URL 中传递敏感信息）

## 默认设置

```typescript
const DEFAULT_SETTINGS: UserSettings = {
  providers: [],
  models: [],
  tempModels: [],
  characters: [],
  skills: DEFAULT_SKILLS,
  activeSkillIds: [],
  systemPrompt: '',
  renderThinkingAsMarkdown: false,
  autoScroll: true,
  collapseThinkingFinished: true,
  trimThinkingSpaces: false,
  stripThinkingForApi: false,
  userAsSystem: false,
  starredSessions: {},
  chatgptChunks: [],
  chatgptChunkRemarks: {},
  stickyNotes: [],
};
```

> **设计要点**：所有参数（temperature、maxTokens 等）为 "Unset" 时不传给 API，由供应商使用默认值。已删除 `topP` 参数。

## ChatGPT 导出包（`shared/chatgpt-export.ts`）

「导出为 ChatGPT 格式」生成的每个子压缩包都采用 OpenAI ChatGPT 官方导出包结构，由 `buildChatGPTConversation()` 与 `buildChatGPTBundleFiles()` 集中构造：

```
All_Conversations.zip / <角色名>.zip
├── conversations.json     # ChatGPTConversation[]
├── user.json              # ChatGPTUser
└── export_manifest.json   # ChatGPTExportManifest（记录文件字节大小与分片信息）
```

```typescript
interface ChatGPTNode {
  id: string;
  message: ChatGPTMessage | null; // 根节点 'client-created-root' 的 message 为 null
  parent: string | null;          // 线性父节点链接
}

interface ChatGPTConversation {
  id: string;
  title: string;
  create_time: number;            // Unix 浮点秒级时间戳
  update_time: number;
  mapping: Record<string, ChatGPTNode>;
  current_node: string;
  conversation_id: string;
  default_model_slug: string;     // 'auto'
  // ...其余官方导出兼容元数据字段
}
```

> **处理细节**：
> - `assistant`（本地 `model`）消息在导出前通过 `extractThinkingBlocks(rawContent, false).mainContent` 剥离已闭合的 `<think>...</think>` 思考过程（`allowUnclosed = false` 以避免未闭合标签误删正文）。
> - 分片时间过滤支持基于 `settings.chatgptChunks` 仅导出更新于指定 ISO 时间戳及之后的会话，并忽略无会话命中的角色子压缩包；导出成功后自动追加新分片时间戳。
