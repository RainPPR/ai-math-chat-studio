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
- **`server/providers/config.ts`** — 提供商配置解析
- **`server/providers/stream.ts`** — 流式 API 调用
- **远程模型同步**: `server/app.ts` 中的 `syncRemoteModels()` 在启动时运行，同步配置了 `modelSource` 的供应商模型。

### 前端统一客户端

- **`src/lib/api.ts`** — 统一 API 客户端，封装了所有 REST 调用和 SSE 订阅逻辑。

## Google Gemini

- **SDK**：`@google/genai`
- **特殊功能**：
  - Thinking Level 配置（minimal/low/medium/high）
  - `includeThoughts: true` 确保思考过程可见
  - 流式响应 + 思考过程分段（`part.thought` 标记）

## Nvidia NIM

- **SDK**：OpenAI SDK
- **Base URL**：`https://integrate.api.nvidia.com/v1` (固定，不可覆盖)
- **特殊功能**：支持 `injectThinkingTemplate` (注入 `chat_template_kwargs`)

## OpenAI Compatible

- **SDK**：OpenAI SDK
- **用途**：支持任意 OpenAI 格式 API 端点。支持通过 `modelSource` 自动同步远程模型列表。

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

**标题生成**：当新建会话时，服务端同步生成标题（使用 `unicodeit` + `markdown-to-txt`）。

## 环境变量汇总

```env
GEMINI_API_KEY=          # Google Gemini
NVIDIA_API_KEY=          # Nvidia NIM
OPENAI_API_KEY=          # 通用回退
```

> API Key 解析优先级：Providers 配置中的 API Key > 配置中的 Env Key 对应的环境变量 > 供应商默认环境变量 > `OPENAI_API_KEY` 回退。
