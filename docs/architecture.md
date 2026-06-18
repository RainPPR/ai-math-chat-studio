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

1.  **后端驱动生成**：所有 AI 生成任务由后端的 `GenerationManager` 服务管理。这意味着即使用户关闭浏览器或断开连接，生成任务也会在服务器上继续运行，直到完成。

2.  **Provider/Model 两级配置**：
    *   **Provider (供应商)**: 定义了如何连接到一个 AI 服务（如 Google, Nvidia）。用户在 `Settings > Providers` 中配置 API Key 和 Base URL 等连接信息。
    *   **Model (模型)**: 定义了要使用的具体模型及其参数（如 `gemini-1.5-pro`, temperature）。每个模型都必须关联一个已配置的供应商实例。这种分离允许用户为同一个供应商配置多个不同的模型参数组合。

3.  **统一 API 客户端**：前端通过 `src/lib/api.ts` 与后端通信。这个模块封装了所有的 REST API 调用和 SSE (Server-Sent Events) 订阅逻辑，为上层组件提供了简洁的接口。

4.  **模块化后端**：后端代码（位于 `server/` 目录）被清晰地划分为不同的职责模块：
    *   `routes/`: 定义 Express API 端点。
    *   `services/`: 包含核心业务逻辑，如 `GenerationManager`。
    *   `providers/`: 封装了与外部 AI API 交互的所有逻辑。

5.  **SSE 实时订阅**：前端使用 `EventSource` API 订阅后端的 `/api/sessions/:id/generation` 端点。后端通过这个长连接实时推送 AI 生成的 `delta` (内容块)、`done` (完成)、`error` (错误) 或 `stopped` (停止) 事件，实现了打字机效果和实时状态更新。

## 数据存储

- **本地 JSON 文件**: 项目不依赖外部数据库，所有数据都存储在本地 `/data` 目录下的 JSON 文件中。这使得项目易于部署和迁移。
    -   `settings.json`: 存储所有用户配置，包括供应商、模型和通用设置。
    -   `sessions/{id}.json`: 每个聊天会话存储为一个单独的 JSON 文件。
- **无认证**: 该应用设计为单用户本地工具，不包含用户认证系统。

## 数据流：一次完整的消息交互

1.  **用户发送消息**: 用户在 `ChatArea` 组件的输入框中输入消息，按下 `Ctrl+Enter`。
2.  **前端乐观更新**: `App.tsx` 中的 `handleSendMessage` 被调用。它立即将用户的消息添加到当前会话的 `messages` 数组中，并更新 UI，提供即时反馈。
3.  **API 调用**: `api.ts` 中的 `sendMessage` 函数被调用，向后端 `POST /api/sessions/:id/messages` 发送请求。
4.  **后端接收**: `server/routes/chat.ts` 中的路由处理器接收到请求。
5.  **启动生成**: 后端将用户消息保存到对应的 `session.json` 文件中，然后调用 `GenerationManager` 来启动一个新的 AI 生成任务。
6.  **SSE 连接**: 与此同时，前端的 `ChatArea` 组件通过 `useEffect` 自动订阅 `/api/sessions/:id/generation` 的 SSE 端点。
7.  **流式响应**: `GenerationManager` 通过 `stream.ts` 调用相应的 AI Provider API。获取到的数据块被包装成 `delta` 事件，通过 SSE 连接实时发送回前端。
8.  **前端渲染**: `ChatArea` 接收到 `delta` 事件，并将其内容追加到当前正在生成的回复中，用户看到平滑的打字机效果。
9.  **任务结束**: 当 AI 完成生成时，后端发送 `done` 事件。前端接收到后，将最终的完整消息保存到状态中，并清理订阅。

## 核心设计决策

-   **服务端代理模式**: 所有对外部 AI API 的调用都通过 Express 后端进行。这确保了 API 密钥永远不会暴露给前端，增强了应用的安全性。
-   **两级架构 (Provider + Model)**: 解耦了 API 连接信息和模型参数，提高了配置的灵活性和复用性。
-   **思考过程包装**: 为了在 UI 中统一展示不同模型的“思考过程”(reasoning)，所有此类信息在 `GenerationManager` 中被统一包装成一个可折叠的 `<details>` HTML 标签。
-   **上下文窗口限制**: 为控制成本和 API 请求大小，每次生成只向 AI 模型发送最近的 40 条消息历史记录。
-   **文档同步规则**: `AGENTS.md` 中明确规定，任何对代码、架构或数据模型的修改都必须同步更新相关的文档，以保持其准确性。
