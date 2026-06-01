# AI 供应商集成文档

## 供应商总览

本项目支持 6 个 AI 供应商 + 自定义供应商，所有供应商统一通过服务端代理调用：

| 供应商 | Provider ID | Base URL | 环境变量 | Tool Calling |
|--------|-------------|----------|----------|-------------|
| Google Gemini | `gemini` | generativelanguage.googleapis.com/v1beta | `GEMINI_API_KEY` | ✓（原生 Function Calling） |
| Nvidia | `nvidia` | integrate.api.nvidia.com/v1 | `NVIDIA_API_KEY` | ✓（OpenAI 格式） |
| Cloudflare Workers AI | `cloudflare` | 动态构建 | `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID` | ✓（OpenAI 格式） |
| AIHubMix | `aihubmix` | aihubmix.com/v1 | `AIHUBMIX_API_KEY` | ✓（OpenAI 格式） |
| Poe | `poe` | api.poe.com/v1 | `POE_API_KEY` | ✓（OpenAI 格式） |
| Gitlawb Opengateway | `opengateway` | opengateway.gitlawb.com/v1 | `OPENGATEWAY_API_KEY` | ✓（OpenAI 格式） |
| Custom（自定义） | 用户配置 | 用户配置 | 用户配置 | ✓（OpenAI 格式） |

## 架构

### 服务端模块

- **`server/providers/config.ts`** — 提供商配置数据
  - `PROVIDERS` 数组：定义所有预设提供商的 id、name、baseURL、envKey
  - `getProviderById()` — 按 ID 查找提供商
  - `resolveBaseURL()` — 解析 Base URL（Cloudflare 特殊处理）
  - `resolveApiKey()` — 解析 API Key（支持 OPENAI_API_KEY 回退）
  - `listProviderModels()` — 获取提供商的模型列表（Gemini 使用 @google/genai，Cloudflare 使用 REST，其他使用 OpenAI SDK）

- **`server/providers/stream.ts`** — 流式 API 调用
  - `streamChat()` — 统一入口，根据 providerId 分发到 Gemini 或 OpenAI 兼容模式
  - `streamOpenAI()` — OpenAI 兼容供应商的流式调用（使用 OpenAI SDK）
  - `streamGemini()` — Gemini 专用流式调用（使用 @google/genai），含工具调用循环
  - `StreamRequest` / `StreamChunk` 类型定义

- **`server/providers/tools.ts`** — 数学工具
  - `executeMathTool()` — 执行数学工具（math.js + nerdamer）
  - `buildOpenAITools()` — 构建 OpenAI 格式工具定义
  - `buildGeminiTools()` — 构建 Gemini 格式工具定义
  - `MATH_INSTRUCTIONS` — 数学工具系统提示词

### 前端统一客户端

- **`src/lib/api.ts`** — 统一 API 客户端
  - `api.settings` — 设置读写
  - `api.sessions` — 会话 CRUD
  - `api.chat` — 消息发送、停止、重试、继续
  - `api.providers` — 获取提供商列表和模型列表
  - `api.subscribeGeneration()` — SSE 订阅生成进度

## 各供应商详情

### Google Gemini

- **SDK**：`@google/genai` v2
- **特殊功能**：
  - 原生 Function Calling（3 个数学工具）
  - Thinking Level 配置（minimal/low/medium/high）
  - 流式响应 + 思考过程分段（`part.thought` 标记）
- **工具声明**：使用 `@google/genai` 的 `FunctionDeclaration` 格式
- **工具执行循环**：在 `streamGemini()` 中检测 `functionCalls` → 本地执行 → 返回 `functionResponse` → 继续流式生成

### Nvidia

- **SDK**：OpenAI SDK
- **Base URL**：`https://integrate.api.nvidia.com/v1`
- **特殊功能**：支持 `extraBody` 透传（如 `reasoning_effort`）
- **推理过程**：通过 `delta.reasoning` 或 `delta.reasoning_content` 字段检测

### Cloudflare Workers AI

- **SDK**：OpenAI SDK
- **Base URL**：动态构建 `https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/v1`
- **模型列表**：使用 Cloudflare REST API 获取，仅返回 Text Generation 类型
- **环境变量**：需要 `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID`

### AIHubMix

- **SDK**：OpenAI SDK
- **Base URL**：`https://aihubmix.com/v1`

### Poe

- **SDK**：OpenAI SDK
- **Base URL**：`https://api.poe.com/v1`
- **特殊功能**：支持 Tool Calling（OpenAI 格式 `tools` + `tool_calls`）

### Gitlawb Opengateway

- **SDK**：OpenAI SDK
- **Base URL**：`https://opengateway.gitlawb.com/v1`
- **API Key**：支持 `OPENGATEWAY_API_KEY` 或 `OPENAI_API_KEY` 回退（所有供应商均支持 `OPENAI_API_KEY` 作为通用回退）

### Custom（自定义供应商）

- **配置方式**：在 Models tab 中选择 "Custom (OpenAI-compatible)"，手动填写 Base URL 和 API Key
- **用途**：允许用户配置任意 OpenAI 兼容 API 端点

## SSE 流式协议

前端通过 `EventSource` 订阅 `/api/sessions/:id/generation`，服务端发送以下事件：

```
event: delta
data: {"content": "完整内容（含思考过程包装）"}

event: tool_call
data: {"name": "evaluate_expression", "args": "{\"expression\":\"2+2\"}", "result": "4"}

event: done
data: {"content": "最终内容", "toolCalls": [...]}

event: error
data: {"message": "错误信息"}

event: stopped
data: {}
```

## 环境变量汇总

```env
GEMINI_API_KEY=          # Gemini
NVIDIA_API_KEY=          # Nvidia
CLOUDFLARE_API_KEY=      # Cloudflare
CLOUDFLARE_ACCOUNT_ID=   # Cloudflare
AIHUBMIX_API_KEY=        # AIHubMix
POE_API_KEY=             # Poe
OPENGATEWAY_API_KEY=     # Opengateway
```

> 所有 API Key 均在服务端读取（通过 dotenv），前端不暴露任何 Key。
> 当某个供应商的专用 Key 未设置时，`resolveApiKey()` 会回退到 `OPENAI_API_KEY`。
>
> **注意**：Gemini 的工具声明（`functionDeclarations`）不受 `enableTools` 字段控制，始终通过 `buildGeminiTools()` 构建并通过 `disabledTools` 过滤。

## 添加新供应商的步骤

1. 在 `server/providers/config.ts` 的 `PROVIDERS` 数组中添加新提供商配置
2. 如果是 OpenAI 兼容 API，无需额外代码（`streamOpenAI()` 自动处理）
3. 如果需要特殊处理，在 `server/providers/stream.ts` 中添加新的流式函数
4. 更新 `.env.example`
5. 前端通过 `api.providers.list()` 自动获取新供应商，无需修改前端代码
