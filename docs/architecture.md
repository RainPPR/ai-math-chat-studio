# 项目架构概览

## 项目名称

**AI Math & Chat Studio** — 一款专注于对话体验的多会话 AI 聊天应用，支持丰富的数学公式渲染和多供应商接入。

## 整体架构

```mermaid
graph TD
    subgraph Frontend (React SPA)
        A[Sidebar] --> |Manages sessions| App
        B[ChatArea] --> |Displays messages, handles input| App
        B --> TOC[TOCSidebar]
        A --> BE[BatchExportModal]
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
            R_Templates[templates.ts]
        end

        subgraph Core Services (server/services/)
            S_GenMan[generation-manager.ts]
            S_Logger[logger.ts]
            S_Settings[lib/settings-helper.ts]
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
        F --> R_Templates
        F -- Initializes --> S_Logger
        F -- Syncs models & loads settings --> S_Settings

        R_Settings --> S_Settings
        R_Chat --> S_GenMan
        R_Chat --> S_Settings
        S_GenMan --> P_Stream
        P_Stream --> P_Config
        P_Config --> P_BuiltIn
    end

    subgraph Shared Modules (shared/)
        SH_Prompt[system-prompt.ts]
        SH_Think[thinking.ts]
        SH_Sort[sorting.ts]
        SH_Skills[skills.ts]
        SH_Export[chatgpt-export.ts]
    end

    subgraph Data Layer
        subgraph Local Storage (data/)
            Data_Settings[settings.json / *.json]
            Data_Templates[templates.json]
            Data_Sessions[sessions/*.json]
            Data_Logs[log/*.log]
        end
    end

    subgraph External Services
        Ext_Google[Google Gemini API]
        Ext_Nvidia[Nvidia NIM API]
        Ext_OpenAI[OpenAI Compatible API]
    end

    S_Settings -- Reads/Writes --> Data_Settings
    R_Templates -- Reads/Writes --> Data_Templates
    S_GenMan -- Reads/Writes --> Data_Sessions
    S_Logger -- Writes --> Data_Logs
    P_Stream -- Calls --> Ext_Google
    P_Stream -- Calls --> Ext_Nvidia
    P_Stream -- Calls --> Ext_OpenAI
```

## 核心设计

1.  **后端驱动生成**：所有 AI 生成任务由后端的 `GenerationManager` 服务管理。这意味着即使用户关闭浏览器或断开连接，生成任务也会在服务器上继续运行，直到完成。

2.  **核心提示词与角色/技能架构 (Provider + Model + Character + Skills)**：
    *   **Provider (供应商)**: 定义了如何连接到一个 AI 服务（如 Google, Nvidia）。用户在 `Settings > Providers` 中配置 API Key、Base URL 与模型同步模式（`modelSyncType`）。
    *   **Model (模型)**: 定义了要使用的具体模型及其参数（如 `gemini-3.5-flash`, temperature）。常规模型关联供应商实例；临时模型 (TempModel) 独立配置显式 `baseURL` / `apiKey`。
    *   **Character (角色)**: 定义了系统提示词 (System Prompt)。用户可以在 `Settings > Characters` 中创建多个角色（如"代码专家"、"数学导师"），并在聊天时灵活切换。
    *   **Skill (技能)**: 定义了独立的模块化技能提示词（如 "Assistant"）。用户可在 `Settings > Skills` 中定义，在 ChatArea 浮动栏中多选。后端通过 `shared/system-prompt.ts` 按 `Character System Prompt (或回退 systemPrompt)` -> `Selected Skills` -> `FORMAT_INSTRUCTIONS` 的顺序组合系统提示词。

3.  **统一 API 客户端**：前端通过 `src/lib/api.ts` 与后端通信。这个模块封装了所有的 REST API 调用和 SSE (Server-Sent Events) 订阅逻辑，为上层组件提供了简洁的接口。

4.  **模块化后端**：后端代码（位于 `server/` 目录）被清晰地划分为不同的职责模块：
    *   `routes/`: 定义 Express API 端点。
    *   `services/`: 包含核心业务逻辑，如 `GenerationManager` 和 `logger`。
    *   `providers/`: 封装了与外部 AI API 交互的所有逻辑。
    *   `lib/settings-helper.ts`: 管理设置文件的分拆读写、透明迁移与多文件原子写入。

5.  **实时日志系统**：系统通过 `server/services/logger.ts` 拦截 `console` 方法（log, info, warn, error），并将日志持久化到 `data/log/`。日志文件名采用 `YYYY-MM-DD.log` 格式，使用 UTC 时间。外部 AI 供应商 API 错误使用 `console.warn` 记录。

6.  **SSE 实时订阅**：前端使用 `EventSource` API 订阅后端的 `/api/sessions/:id/generation` 端点。后端通过这个长连接实时推送 AI 生成的 `delta` (内容块)、`done` (完成)、`error` (错误) 或 `stopped` (停止) 事件，实现了打字机效果和实时状态更新。

## 性能优化

### 1. 同步标题生成

**实现**: `generateTitleFromMarkdown()` 使用纯 JavaScript 字符串操作，无需异步：
- 将 `\dfrac` 替换为 `\frac`，并全局清除 `\displaystyle` 和 `\scriptstyle` 格式指令以避免标题杂乱
- 使用 `unicodeit` 将块级 `$$...$$` 与行内 `$...$` LaTeX 数学公式转换为 Unicode 字符
- 使用 `markdown-to-txt` 清理 Markdown 语法，合并空白并移除剩余 `$` 与 `\`
- 截断为最多 50 个字符（超出追加 `...`），生成后直接保存到 session.json，无需 SSE 通知前端

### 2. 多并发生成优化

**问题**: 同时运行多个 AI 解题会话时，快速新增或切换对话会导致卡顿，可能存在以下问题：
1. **Race Condition**: 新建会话立即发送消息时，会话未完全创建就开始生成
2. **文件写入冲突**: 频繁写入 session.json 导致磁盘 I/O 瓶颈
3. **通知风暴**: 每个 token 都触发 SSE 通知，压垮客户端
4. **内存泄漏**: 已完成的任务不会自动清理
5. **删除会话冲突**: 删除正在生成的会话时仍会尝试写入文件
6. **SSE 连接资源泄漏**: 客户端断开连接时清理不完善

**解决方案**:

#### 后端优化

**防抖写操作（Debounced Writes）**: 
- 实现 `debouncedWrite()` 方法，对同一 session 的文件写入进行批处理
- 减少频繁的磁盘 I/O 操作，避免写操作堆积导致的性能问题
- 删除会话时通过 `deletedSessions` Set 跟踪，防止向已删除的会话写入

**通知节流（Throttled Notifications）**:
- 在 `runGeneration()` 中实现通知节流机制，限制为最多 20 次/秒
- 防止高频内容更新压垮客户端，提升整体响应性

**任务清理（Task Cleanup）**:
- 生成完成或中止时自动清理 `tasks` Map
- `deleteSession()` 方法中调用 `clearSessionOperations()` 完整清理

**生成器启动优化**:
- `startGeneration()` 改为 async 方法，在启动新生成前等待旧任务清理（50ms）
- 防止旧任务的最终写入与新任务冲突

**中止处理优化**:
- `runGeneration()` 检测 `stopped` 状态后发送 `stopped` 事件而非 `done`
- 中止后不写入最终消息到 session 文件

**SSE 连接健壮性增强**:
- 添加 `X-Accel-Buffering: no` 头部，禁用 Nginx 等代理的缓冲
- 实现指数退避策略（exponential backoff）替代固定轮询等待任务
- 使用 `isClosed` 标志防止双重清理
- 添加 `req.on('error')` 处理异常连接

#### 前端优化

**新会话消息发送防抖**:
- 在 `App.tsx` 中使用 `pendingSendsRef` 跟踪待发送的新会话消息
- 对新建会话后的第一条消息添加 100ms 防抖延迟，避免 race condition

**滚动性能优化**:
- 在 `ChatArea.tsx` 中实现滚动节流，限制为最多 10 次/秒
- 减少布局计算和重绘频率，改善大量内容渲染时的性能

## 数据存储

- **本地 JSON 文件**: 项目不依赖外部数据库，所有数据都存储在本地 `/data` 目录下的 JSON 文件中。这使得项目易于部署和迁移。
    -   `settings.json` 与分拆配置文件: `settings.json` 存储通用设置，`providers.json`、`models.json`、`temp-models.json`、`characters.json`、`skills.json` 分别独立持久化对应列表，`templates.json` 存储自动填入模板。
    -   `sessions/{id}.json`: 每个聊天会话存储为一个单独的 JSON 文件（`characterId` 始终置于 JSON 最后字段以减少文件 diff）。
    -   `log/*.log`: 运行日志，记录服务器行为和 AI 调用情况。
- **无认证**: 该应用设计为单用户本地工具，不包含用户认证系统。

## 数据流：一次完整的消息交互

1.  **用户发送消息**: 用户在 `ChatArea` 组件的输入框中输入消息，按下 `Ctrl+Enter`。
2.  **前端乐观更新与设置落盘**: `App.tsx` 中的 `handleSendMessage` 被调用，立即将用户消息添加到当前会话并更新 UI；在调用后端生成端点（Send / Retry / Continue / Regenerate）前会先执行 `awaitSettledSettingsSave()` 确保 `settingsSaveQueue` 已完整写入磁盘。
3.  **API 调用**: `api.ts` 中的 `sendMessage` 函数被调用，向后端 `POST /api/sessions/:id/messages` 发送请求。
4.  **后端接收**: `server/routes/chat.ts` 中的路由处理器接收到请求，无条件从全局 `settings.json` 解析 `activeModelId`、`activeCharacterId` 与 `activeSkillIds`。
5.  **启动生成**: 后端将用户消息保存到对应的 `session.json` 文件中（首次发送若会话尚无 `characterId` 则记录当前快照，已有则保留），然后调用 `GenerationManager` 来启动一个新的 AI 生成任务。
    *   **提示词注入**: 后端使用 `shared/system-prompt.ts` 依次拼接活跃 Character 系统提示词（或回退 `settings.systemPrompt`）、Selected Skills 块 (`# Skill: ${name}\n${prompt}`)，并在末尾追加 `FORMAT_INSTRUCTIONS` 格式约束；若开启 `stripThinkingForApi`，则在构造请求时过滤历史模型消息（`idx < messages.length - 1`）的 `<think>` 块。
6.  **SSE 连接**: 与此同时，前端的 `ChatArea` 组件通过 `useEffect` 自动订阅 `/api/sessions/:id/generation` 的 SSE 端点。
7.  **流式响应**: `GenerationManager` 通过 `stream.ts` 调用相应的 AI Provider API，并将推理流包装为 `<think>\n...\n</think>`，通过 `mergeConsecutiveThinking` 合并相邻思考块，再以 `delta` 事件通过 SSE 实时发送回前端。
8.  **前端渲染**: `ChatArea` 接收到 `delta` 事件并更新流式内容（续写/重新生成时原地更新末尾 `model` 消息以避免布局跳动），用户看到平滑的打字机效果。
9.  **任务结束**: 当 AI 完成生成时，后端发送 `done` 事件。前端接收到后，刷新完整会话状态并清理订阅。

## 消息操作机制

系统提供三种对已生成消息的操作机制，每种有不同的适用场景：

### 1. Retry（重试）

- **触发方式**: 每条 model 消息上的 "Retry" 按钮
- **实现逻辑**: `GenerationManager.retryMessage()` 找到该消息前面最近的 user 消息，截断从该 user 消息之后的所有消息（包括当前消息），从那个 user 消息开始重新生成
- **适用场景**: 对某条 AI 回复完全不满意，希望完全重新开始

### 2. Regenerate（重新生成）

- **触发方式**: 每条 model 消息上的 "Regenerate" 按钮
- **实现逻辑**: `GenerationManager.regenerateMessage()` 执行以下操作：
  1. 清洗当前消息：保留 `<think>...</think>` 包裹的思考过程，删除正文输出部分
  2. 截断该消息之后的所有消息
  3. 直接基于保留的思考过程原地触发流式续写，不注入额外提示词或用户指令
- **适用场景**: AI 的思考过程有价值，但正文输出不完善或需要修正，希望在保留思考基础上直接继续输出

### 3. Continue（继续）

- **触发方式**: 仅最后一条 model 消息上的 "Continue" 按钮
- **实现逻辑**: `GenerationManager.continueGeneration()` 验证末尾为 `model` 消息后直接原地触发流式续写（若末尾存在未闭合的 `<think>` 标签则继续以思考态拼接，并通过 `mergeConsecutiveThinking` 合并相邻 `<think>` 块），不向会话注入额外用户指令
- **适用场景**: 网络错误、流中断或 AI 输出被意外截断，需要继续完成未完成的响应

## 核心设计决策

-   **服务端代理模式**: 所有对外部 AI API 的调用都通过 Express 后端进行。这确保了 API 密钥永远不会暴露给前端，增强了应用的安全性。
-   **四级解耦架构 (Provider + Model + Character + Skills)**: 解耦了 API 连接信息、模型参数、角色人格与可多选技能指令，极大地提高了灵活性。所有生成调用始终以全局 `settings.json` 为准，会话自身的 `characterId` 仅服务于侧边栏筛选与 ChatGPT 导出。
-   **思考过程统一包装**: 所有供应商的推理过程在 `GenerationManager` 中统一包装为 `<think>\n...\n</think>` 标签（`openai-compatible` 额外兼容转换 `Thinking...\n> ...`），前端 UI 将其渲染为可折叠卡片。
-   **上下文窗口限制**: 为控制成本和 API 请求大小，每次生成只向 AI 模型发送最近的 40 条消息历史记录，并裁剪开头非 `user` 轮次以确保交替对话合法。
-   **文档同步规则**: `AGENTS.md` 中明确规定，任何对代码、架构或数据模型的修改都必须同步更新相关的文档，以保持其准确性。
