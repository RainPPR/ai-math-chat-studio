# 项目架构概览

## 项目名称

**AI Math & Chat Studio** — 一款专注于对话体验的多会话 AI 聊天应用，支持丰富的数学公式渲染和多供应商接入。

## 整体架构

```mermaid
graph TD
    subgraph Frontend (React SPA)
        A[Sidebar] --> |Manages sessions| App
        B[ChatArea] --> |Displays messages, handles input| App
        C[SettingsModal] --> |Configures app| App
        D[MarkdownRenderer] --> |Renders content| B

        subgraph App State & Logic
            App(App.tsx - State Center)
        end

        E[src/lib/api.ts] --> |REST+SSE Client| F
        App --> |Uses| E
    end

    subgraph Backend (Express 5)
        F(server/app.ts - Express App)
        subgraph API Routes (server/routes/)
            R_Settings[settings.ts]
            R_Sessions[sessions.ts]
            R_Chat[chat.ts]
            R_Models[models.ts]
        end

        subgraph Core Services (server/services/)
            S_GenMan[generation-manager.ts]
        end

        subgraph AI Providers (server/providers/)
            P_BuiltIn[built-in.ts]
            P_Config[config.ts]
            P_Stream[stream.ts]
        end

        F --> R_Settings
        F --> R_Sessions
        F --> R_Chat
        F --> R_Models

        R_Chat --> S_GenMan
        S_GenMan --> P_Stream
        P_Stream --> P_Config
        P_Config --> P_BuiltIn
    end

    subgraph Data Layer
        subgraph Local Storage (data/)
            Data_Settings[settings.json]
            Data_Sessions[sessions/*.json]
        end
    end

    subgraph External Services
        Ext_Google[Google Gemini API]
        Ext_Nvidia[Nvidia NIM API]
        Ext_OpenAI[OpenAI Compatible API]
    end

    F -- Reads/Writes --> Data_Settings
    F -- Reads/Writes --> Data_Sessions
    P_Stream -- Calls --> Ext_Google
    P_Stream -- Calls --> Ext_Nvidia
    P_Stream -- Calls --> Ext_OpenAI
```

## 核心设计

1.  **后端驱动生成**：所有 AI 生成任务由后端的 `GenerationManager` 服务管理。这意味着即使用户关闭 browser 或断开连接，生成任务也会在服务器上继续运行，直到完成。

2.  **Provider/Model 两级配置**：
    *   **Provider (供应商)**: 定义了如何连接到一个 AI 服务（如 Google, Nvidia）。用户在 `Settings > Providers` 中配置 API Key 和 Base URL 等连接信息。
    *   **Model (模型)**: 定义了要使用的具体模型及其参数（如 `gemini-1.5-pro`, temperature）。每个模型都必须关联一个已配置的供应商实例。这种分离允许用户为同一个供应商配置多个不同的模型参数组合。

3.  **统一 API 客户端**：前端通过 `src/lib/api.ts` 与后端通信。这个模块封装了所有的 REST API 调用和 SSE (Server-Sent Events) 订阅逻辑，为上层组件提供了简洁的接口。

4.  **模块化后端**：后端代码（位于 `server/` 目录）被清晰地划分为不同的职责模块：
    *   `routes/`: 定义 Express API 端点。
    *   `services/`: 包含核心业务逻辑，如 `GenerationManager`。
    *   `providers/`: 封装了与外部 AI API 交互的所有逻辑。

5.  **SSE 实时订阅**：前端使用 `EventSource` API 订阅后端的 `/api/sessions/:id/generation` 端点。后端通过这个长连接实时推送 AI 生成的 `delta` (内容块)、`done` (完成)、`error` (错误) 或 `stopped` (停止) 事件，实现了打字机效果和实时状态更新。

## 性能优化

### 1. 同步标题生成

**实现**: `generateTitleFromMarkdown()` 使用纯 JavaScript 字符串操作，无需异步：
- 使用 `unicodeit` 将 LaTeX 数学公式转换为 Unicode 字符
- 使用 `markdown-to-txt` 清理 Markdown 语法
- 只处理前200个字符，保证处理速度
- 同步执行，生成后直接保存到 session.json，无需 SSE 通知前端

### 2. 多并发生成优化

**后端优化**:
- **防抖写操作 (Debounced Writes)**: 在 `GenerationManager` 中对同一 session 的文件写入进行批处理，减少磁盘 I/O。实现于 `debouncedWrite()`。
- **通知节流 (Throttled Notifications)**: 在 `runGeneration()` 中限制 SSE 通知频率（最多 20 次/秒），防止高频更新压垮客户端。
- **任务清理 (Task Cleanup)**: 生成完成、中止或删除会话（`clearSessionOperations()`）后自动清理 `tasks` Map。
- **中止处理优化**: 正确处理 `AbortController`，中止后发送 `stopped` 事件，不写入最终消息到 session 文件。
- **SSE 稳定性**: 添加 `X-Accel-Buffering: no`，支持指数退避订阅，防止资源泄漏。

**前端优化**:
- **新会话发送防抖**: 在 `App.tsx` 中对新建会话的第一条消息添加 100ms 防抖，避免 race condition。
- **滚动性能优化**: 在 `ChatArea.tsx` 中实现滚动节流（最多 10 次/秒），减少重绘频率。

## 数据存储

- **本地 JSON 文件**: 项目不依赖外部数据库，所有数据都存储在本地 `/data` 目录下的 JSON 文件中。
- **远程模型同步**: 启动时，`server/app.ts` 中的 `syncRemoteModels()` 会根据 `settings.json` 中的 `modelSource` 配置，自动拉取并同步模型列表。

## 数据流：一次完整的消息交互

1.  **用户发送消息**: 用户在 `ChatArea` 输入消息，`App.tsx` 执行乐观更新。
2.  **启动生成**: 后端 `POST /api/sessions/:id/messages` 接收消息，保存文件并触发 `GenerationManager.startGeneration()`。
3.  **SSE 连接**: 前端 `ChatArea` 通过 `api.subscribeGeneration` 订阅 SSE 端点。
4.  **流式响应**: `GenerationManager` 异步调用供应商 API，将 `delta` 事件推送给前端。
5.  **任务结束**: 完成后发送 `done`，前端刷新 Session 状态并清理订阅。

## 消息操作机制

系统提供三种对已生成消息的操作机制：

### 1. Retry (重试)
- **行为**: 找到该消息前面最近的 user 消息，截断后续消息，从该 user 消息开始重新生成。

### 2. Regenerate (重新生成)
- **行为**: 保留当前 model 消息的 `<details>` 思考过程，删除正文，注入 continue 指令让 AI 基于原有思考继续输出。

### 3. Continue (继续)
- **行为**: 在会话末尾添加 user 指令，指导 AI 继续完成未完成的响应（针对网络错误/截断）。

## 核心设计决策
- **服务端代理模式**: 所有 AI 调用通过后端，保护 API Key 安全。
- **思考过程包装**: 统一将 reasoning 内容包装为 `<details>` 标签。
- **上下文限制**: 每次生成只向 AI 发送最近 40 条消息历史（在 `stream.ts` 中过滤）。
- **无注释风格**: 代码应自解释，不添加冗余注释。
- **文档同步规则**: `AGENTS.md` 中规定任何架构修改必须同步更新相关文档。
