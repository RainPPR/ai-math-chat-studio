# AI 供应商集成文档

## 供应商总览

本项目内置 3 种提供商类型，均通过服务端代理调用：

| 类型 | ID | 默认 Base URL | 默认 Env Key |
|------|-------------|----------|----------|
| Google Gemini | `google` | generativelanguage.googleapis.com/v1beta | `GEMINI_API_KEY` |
| Nvidia NIM | `nvidia` | integrate.api.nvidia.com/v1 | `NVIDIA_API_KEY` |
| OpenAI Compatible | `openai-compatible` | 用户配置 | `OPENAI_API_KEY` |

> 用户可自行添加任意数量的 `openai-compatible` 提供商实例。

## 架构

### 服务端模块

- **`server/providers/built-in.ts`** — 内置提供商类型定义
  - `BUILT_IN_PROVIDERS` 记录：存储每种内置类型的默认配置
  
- **`server/providers/config.ts`** — 提供商配置解析
  - `resolveApiKey()` — 解析 API Key（优先配置项，其次环境变量，最后 `OPENAI_API_KEY` 回退）
  - `resolveBaseURL()` — 解析 Base URL（优先配置项，其次内置默认值）

- **`server/providers/stream.ts`** — 流式 API 调用
  - `streamChat()` — 统一入口，根据 `providerType` 分发到三种流式函数
  - `streamGoogle()` — Google Gemini 专用流式调用（使用 `@google/genai`）
  - `streamNvidia()` — Nvidia NIM 流式调用（OpenAI SDK）
  - `streamOpenAICompatible()` — 通用 OpenAI 兼容流式调用，支持 `reasoning_effort` 自动重试机制（从 `max` -> `xhigh` -> `high` 依次尝试并带有重试，最后回退到无参数；若检测到请求过快/429限制，则不继续试错直接抛出错误）
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
  - Thinking Level 配置（minimal/low/medium/high）
  - `includeThoughts: true` 确保思考过程可见
  - 流式响应 + 思考过程分段（`part.thought` 标记）

## Nvidia NIM

- **SDK**：OpenAI SDK
- **Base URL**：`https://integrate.api.nvidia.com/v1`
- **特殊功能**：支持 `extraBody` 透传（如 `chat_template_kwargs`）
- **推理过程**：通过 `delta.reasoning` 或 `delta.reasoning_content` 字段检测

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
