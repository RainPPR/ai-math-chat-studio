# AI 供应商集成文档

## 供应商总览

本项目内置 3 种提供商类型，均通过服务端代理调用：

| 类型 | ID | 默认 Base URL | 默认 Env Key |
|------|-------------|----------|----------|
| Google Gemini | `google` | generativelanguage.googleapis.com/v1beta | `GEMINI_API_KEY` |
| Nvidia NIM | `nvidia` | integrate.api.nvidia.com/v1 | `NVIDIA_API_KEY` |
| OpenAI Compatible | `openai-compatible` | 用户配置 | `OPENAI_API_KEY` |

> 用户可自行添加任意数量的 `openai-compatible` 提供商实例，也可以在 Settings 中独立配置不依赖 Provider 实体、只支持 OpenAI 兼容 API 的“临时模型 (Temp Models)”。

## 架构

### 服务端模块

- **`server/providers/built-in.ts`** — 内置提供商类型定义
  - `BUILT_IN_PROVIDERS` 记录：存储每种内置类型的默认配置
  
- **`server/providers/config.ts`** — 提供商配置解析
  - `resolveApiKey()` — 解析 API Key（优先配置项，其次环境变量，最后 `OPENAI_API_KEY` 回退）
  - `resolveBaseURL()` — 解析 Base URL（优先配置项，其次内置默认值）

- **`server/app.ts`** — 启动时模型同步 (`syncRemoteModels`)
  - 对非 Google 提供商按 `modelSyncType`（`'none' | 'json' | 'v1_models'`）自动同步远端模型列表（旧配置若存在 `modelSource` 且未设 `modelSyncType` 则按 `'json'` 处理）
  - 通过 `isTextGenerationModel()` 优先检查 `modelId`、`displayName`、`endpoints`、`object`/`type`/`mode` 与排除关键词，过滤 embedding、绘图、TTS/audio、moderation、rerank 等非文本生成模型
  - `/v1/models` 模式使用 `buildProviderHeaders()` 注入配置的 `apiKey`（及 `.env` 回退），仅发送给解析后的目标端点，不会泄露给任意 URL
  - 按 `modelId` 分组保留现有本地模型实例（含 UUID、自定义 `displayName`、`temperature`、`maxTokens`、`reasoningEffort`、`thinkingLevel`、`extraBody`、`injectThinkingTemplate`），支持同 `modelId` 多实例；若本地已有未在远端返回但用户自定义过名称或参数的模型也会予以保留
  - 默认展示名称由 `deriveDisplayName()` 生成：若含 `a/b` 前缀则提取末段 `b`，并附加基于提供商名称大写字母生成的缩写括号（如 `ModelScope` → `MS`、`FreeTheAI*` → `FTAI`、`AMD*` → `AMD`）

- **`server/routes/chat.ts`** — 模型/提供商解析
  - `resolveActiveModel()` — 根据 `activeModelId` 解析要使用的模型与提供商；如命中临时模型（TempModel），通过 `buildTempModelPayload()` 自动合成 `openai-compatible` 类型提供商 payload（采用显式 Base URL 与 API Key）；仅当常规 `models` 完全为空（`!settings.models?.length`）时才默认回退到首个 `TempModel`
  - 所有生成端点（messages / retry / continue / regenerate）均无条件使用全局 `settings.json` 中的 `activeModelId`、`activeCharacterId` 与 `activeSkillIds`

- **`server/providers/stream.ts`** — 流式 API 调用
  - `streamChat()` — 统一入口，根据 `providerType` 分发到三种流式函数
  - `streamGoogle()` — Google Gemini 专用流式调用（使用 `@google/genai`，通过 `part.thought` / `part.text` 区分推理与正文）
  - `streamNvidia()` — Nvidia NIM 流式调用（OpenAI SDK，不启用 `reasoning_effort` 级联回退机制）
  - `streamOpenAICompatible()` — 通用 OpenAI 兼容流式调用，支持 `reasoning_effort` 自动重试机制（若未显式指定级别，会从 `max` -> `xhigh` -> `high` 依次尝试请求，每个级别失败后重试一次。若抛出 401、403、404 等严重配置或不存在错误，则立即停止并向上抛出；若抛出与 `reasoning_effort` 相关的 400 或 422 错误，则立刻停止重试尝试并直接回退调用无 `reasoning_effort` 参数的模型流；若检测到 429 速率限制，也会立即向上抛出错误以提升用户体验）
  - 历史裁剪与 System Prompt 注入：最多截取最近 40 条消息并剔除开头非 `user` 角色消息以确保交替轮次合法；当 `userAsSystem` 开启时，不设置原生 `system` role 或 `systemInstruction`，而是将系统提示词包装为 `<system>...</system>` 作为 `role: 'user'` 消息置于历史最前方
  - 外部提供商 API 异常或级联重试失败通过 `console.warn` 记录日志，以区分外部连接/配额问题与内部应用错误
  - `StreamRequest` / `StreamChunk` 类型定义

### 前端统一客户端

- **`src/lib/api.ts`** — 统一 API 客户端
  - `api.settings` — 设置读写
  - `api.sessions` — 会话 CRUD
  - `api.chat` — 消息发送、停止、重试、继续
  - `api.providers` — 获取内置提供商类型列表和模型列表
  - `api.subscribeGeneration()` — SSE 订阅生成进度

## Google Gemini

- **SDK**：`@google/genai`
- **特殊功能**：
  - Thinking Level 配置（minimal/low/medium/high/xhigh）
  - `includeThoughts: true` 确保思考过程可见
  - 流式响应 + 思考过程分段（`part.thought` 标记）

## Nvidia NIM

- **SDK**：OpenAI SDK
- **Base URL**：`https://integrate.api.nvidia.com/v1`
- **特殊功能**：支持 `extraBody` 透传（如 `chat_template_kwargs`）
- **推理过程**：通过 `delta.reasoning` 或 `delta.reasoning_content` 字段检测
- **推理强度配置**：不启用 `reasoning_effort` 级联回退机制或自动参数注入。在未显式设置 `reasoning_effort` 时，默认进行无 `reasoning_effort` 参数的请求；若用户显式配置了 `reasoning_effort`（例如 Kimi K2.6），则依然会直接遵循该显式配置发出请求。

## OpenAI Compatible

- **SDK**：OpenAI SDK
- **用途**：支持任意 OpenAI 兼容 API 端点
- **配置方式**：在 Settings → Providers tab 中手动填写名称、Base URL、API Key、Env Key Prefix

## SSE 流式协议

前端通过 `EventSource` 订阅 `/api/sessions/:id/generation`，服务端发送以下事件：

```
event: delta
data: {"content": "完整内容（含思考过程包装）"}

event: done
data: {"content": "最终内容"}

event: error
data: {"message": "错误信息"}

event: stopped
data: {}
```

**标题生成**：当新建会话时，服务端同步生成标题（使用 `unicodeit` + `markdown-to-txt` 转换 Markdown 为 Plain Text）。标题生成后立即保存到 session.json。

## 环境变量汇总

```env
GEMINI_API_KEY=          # Google Gemini
NVIDIA_API_KEY=          # Nvidia NIM
OPENAI_API_KEY=          # 通用回退（所有 OpenAI 兼容供应商）
```

> 所有 API Key 均在服务端读取（通过 dotenv），前端不暴露任何 Key。
> API Key 解析优先级：Providers 配置中的 API Key > 配置中的 Env Key 对应的环境变量 > 供应商默认环境变量（如 `GEMINI_API_KEY`）> `OPENAI_API_KEY` 回退。
