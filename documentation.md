### 代码质量与格式规范

```text
本项目执行严格的代码质量和格式检查。所有代码必须通过 Prettier 和 TypeScript 的严格模式检查。
```

### 代码质量与格式规范 / 检查工具

```text
- **Formatting**: `bun run pretty` (prettier --check)
- **Type Check**: `bun run check` (tsc --noEmit --strict)
```

### 代码质量与格式规范 / 修复工具

```text
- **自动修复格式**: `bun run pretty:fix`
```

### 代码质量与格式规范 / 严格修复规则

```text
1. **禁止未使用变量**: 所有的未使用变量必须移除。如果是 catch 子句中不需要 error 对象，使用 `catch { ... }` (ES2019+)。
2. **禁止未使用的表达式**: 严禁将三元运算符或逻辑表达式作为独立语句使用。应使用标准的 `if/else` 语句。
3. **严格类型检查**: TypeScript 必须处于 `--strict` 模式。严禁无故使用 `@ts-ignore` 或 `@ts-expect-error`。如果第三方库缺少类型或存在上游 Bug，必须在注释中说明原因。
4. **文档同步**: 任何逻辑变更必须同步更新 `AGENTS.md` 和 `docs/` 目录下的相关文档。
```

### 代码质量与格式规范 / 最佳实践 (TypeScript)

```text
- **Make Illegal States Unrepresentable**: 使用辨析联合类型 (Discriminated Unions) 确保状态合法。
- **Runtime Validation**: 对外部数据（API 响应、本地存储）使用 Zod 等工具进行运行时验证。
- **Branded Types**: 对 ID 等原始类型使用 Branded Types 以增强区分度。
- **Exhaustive Checks**: 使用 `never` 类型确保 `switch` 语句处理了所有可能的情况。
```

### 项目架构概览

```text

```

### 项目架构概览 / 项目名称

```text
**AI Math & Chat Studio** — 一款专注于对话体验的多会话 AI 聊天应用，支持丰富的数学公式渲染和多供应商接入。
```

### 项目架构概览 / 整体架构

```text
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

### 项目架构概览 / 核心设计

```text
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
```

### 项目架构概览 / 性能优化

```text

```

### 项目架构概览 / 性能优化 / 1. 同步标题生成

```text
**实现**: `generateTitleFromMarkdown()` 使用纯 JavaScript 字符串操作，无需异步：
- 将 `\dfrac` 替换为 `\frac`，并全局清除 `\displaystyle` 和 `\scriptstyle` 格式指令以避免标题杂乱
- 使用 `unicodeit` 将块级 `$$...$$` 与行内 `$...$` LaTeX 数学公式转换为 Unicode 字符
- 使用 `markdown-to-txt` 清理 Markdown 语法，合并空白并移除剩余 `$` 与 `\`
- 截断为最多 50 个字符（超出追加 `...`），生成后直接保存到 session.json，无需 SSE 通知前端
```

### 项目架构概览 / 性能优化 / 2. 多并发生成优化

```text
**问题**: 同时运行多个 AI 解题会话时，快速新增或切换对话会导致卡顿，可能存在以下问题：
1. **Race Condition**: 新建会话立即发送消息时，会话未完全创建就开始生成
2. **文件写入冲突**: 频繁写入 session.json 导致磁盘 I/O 瓶颈
3. **通知风暴**: 每个 token 都触发 SSE 通知，压垮客户端
4. **内存泄漏**: 已完成的任务不会自动清理
5. **删除会话冲突**: 删除正在生成的会话时仍会尝试写入文件
6. **SSE 连接资源泄漏**: 客户端断开连接时清理不完善

**解决方案**:
```

### 项目架构概览 / 性能优化 / 2. 多并发生成优化 / 后端优化

```text
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
```

### 项目架构概览 / 性能优化 / 2. 多并发生成优化 / 前端优化

```text
**新会话消息发送防抖**:
- 在 `App.tsx` 中使用 `pendingSendsRef` 跟踪待发送的新会话消息
- 对新建会话后的第一条消息添加 100ms 防抖延迟，避免 race condition

**滚动性能优化**:
- 在 `ChatArea.tsx` 中实现滚动节流，限制为最多 10 次/秒
- 减少布局计算和重绘频率，改善大量内容渲染时的性能
```

### 项目架构概览 / 数据存储

```text
- **本地 JSON 文件**: 项目不依赖外部数据库，所有数据都存储在本地 `/data` 目录下的 JSON 文件中。这使得项目易于部署和迁移。
    -   `settings.json` 与分拆配置文件: `settings.json` 存储通用设置，`providers.json`、`models.json`、`temp-models.json`、`characters.json`、`skills.json` 分别独立持久化对应列表，`templates.json` 存储自动填入模板。
    -   `sessions/{id}.json`: 每个聊天会话存储为一个单独的 JSON 文件（`characterId` 始终置于 JSON 最后字段以减少文件 diff）。
    -   `log/*.log`: 运行日志，记录服务器行为和 AI 调用情况。
- **无认证**: 该应用设计为单用户本地工具，不包含用户认证系统。
```

### 项目架构概览 / 数据流：一次完整的消息交互

```text
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
```

### 项目架构概览 / 消息操作机制

```text
系统提供三种对已生成消息的操作机制，每种有不同的适用场景：
```

### 项目架构概览 / 消息操作机制 / 1. Retry（重试）

```text
- **触发方式**: 每条 model 消息上的 "Retry" 按钮
- **实现逻辑**: `GenerationManager.retryMessage()` 找到该消息前面最近的 user 消息，截断从该 user 消息之后的所有消息（包括当前消息），从那个 user 消息开始重新生成
- **适用场景**: 对某条 AI 回复完全不满意，希望完全重新开始
```

### 项目架构概览 / 消息操作机制 / 2. Regenerate（重新生成）

```text
- **触发方式**: 每条 model 消息上的 "Regenerate" 按钮
- **实现逻辑**: `GenerationManager.regenerateMessage()` 执行以下操作：
  1. 清洗当前消息：保留 `<think>...</think>` 包裹的思考过程，删除正文输出部分
  2. 截断该消息之后的所有消息
  3. 直接基于保留的思考过程原地触发流式续写，不注入额外提示词或用户指令
- **适用场景**: AI 的思考过程有价值，但正文输出不完善或需要修正，希望在保留思考基础上直接继续输出
```

### 项目架构概览 / 消息操作机制 / 3. Continue（继续）

```text
- **触发方式**: 仅最后一条 model 消息上的 "Continue" 按钮
- **实现逻辑**: `GenerationManager.continueGeneration()` 验证末尾为 `model` 消息后直接原地触发流式续写（若末尾存在未闭合的 `<think>` 标签则继续以思考态拼接，并通过 `mergeConsecutiveThinking` 合并相邻 `<think>` 块），不向会话注入额外用户指令
- **适用场景**: 网络错误、流中断或 AI 输出被意外截断，需要继续完成未完成的响应
```

### 项目架构概览 / 核心设计决策

```text
-   **服务端代理模式**: 所有对外部 AI API 的调用都通过 Express 后端进行。这确保了 API 密钥永远不会暴露给前端，增强了应用的安全性。
-   **四级解耦架构 (Provider + Model + Character + Skills)**: 解耦了 API 连接信息、模型参数、角色人格与可多选技能指令，极大地提高了灵活性。所有生成调用始终以全局 `settings.json` 为准，会话自身的 `characterId` 仅服务于侧边栏筛选与 ChatGPT 导出。
-   **思考过程统一包装**: 所有供应商的推理过程在 `GenerationManager` 中统一包装为 `<think>\n...\n</think>` 标签（`openai-compatible` 额外兼容转换 `Thinking...\n> ...`），前端 UI 将其渲染为可折叠卡片。
-   **上下文窗口限制**: 为控制成本和 API 请求大小，每次生成只向 AI 模型发送最近的 40 条消息历史记录，并裁剪开头非 `user` 轮次以确保交替对话合法。
-   **文档同步规则**: `AGENTS.md` 中明确规定，任何对代码、架构或数据模型的修改都必须同步更新相关的文档，以保持其准确性。
```

### 文件结构

```text
ai-math-chat-studio/
├── .env                      # 环境变量（不提交）
├── .env.example              # 环境变量模板
├── .github/
│   └── workflows/
│       ├── bun.yml           # TypeScript/Prettier 检查与 bundle/exe 构建工作流
│       └── deploy.yml        # 推送 desktop 时同步 context7 与 main 分支
├── .gitignore
├── .gitignore-main-append    # sync-main.ts 合并到 main 分支 .gitignore 的附加规则
├── .prettierignore           # Prettier 忽略文件
├── AGENTS.md                 # AI 开发指导文件
├── docs/                     # 项目文档
│   ├── architecture.md       # 架构概览
│   ├── api-providers.md      # AI 供应商集成
│   ├── components.md         # 组件结构
│   ├── data-models.md        # 数据模型
│   ├── tech-stack.md         # 技术栈
│   ├── linting-and-quality.md # 代码质量指南
│   └── file-structure.md     # 本文件
├── data/                     # 本地数据存储（不提交至 main）
│   ├── settings.json         # 用户通用设置
│   ├── providers.json        # 提供商数据
│   ├── models.json           # 模型数据
│   ├── temp-models.json      # 临时模型数据（已 Git 忽略）
│   ├── characters.json       # 角色数据
│   ├── skills.json           # 技能数据
│   ├── templates.json        # 聊天自动填入模板设置
│   ├── sessions/             # 会话数据
│   └── log/                  # 日志数据 (YYYY-MM-DD.log)
├── index.html                # SPA 入口 HTML
├── scripts/                  # 构建与辅助脚本
│   ├── build-bundle.ts       # 打包构建
│   ├── build-bun-compile.ts  # bun compile 可执行文件构建
│   ├── create-server-entry.ts # 生成服务端入口
│   ├── prepare-context7.ts   # Context7 预处理
│   ├── sync-context7.ts      # Context7 同步至 context7 分支
│   └── sync-main.ts          # 同步仓库状态至 main 分支（作者 RainPPR + GitHub Actions bot 协作）
├── package.json              # 项目依赖和脚本
├── bun.lock                  # Bun 依赖锁定文件
├── server.ts                 # 入口文件（import 'dotenv/config' + startApp()）
├── server/                   # 后端模块
│   ├── app.ts                # Express 5 应用组装，启动模型同步与路由挂载
│   ├── vite-helper.ts        # Vite 开发服务器辅助
│   ├── lib/
│   │   └── settings-helper.ts # 分拆设置加载、透明迁移与原子保存
│   ├── providers/            # AI 供应商相关
│   │   ├── built-in.ts       # 内置提供商类型定义
│   │   ├── config.ts         # 提供商配置解析（apiKey、baseURL）
│   │   └── stream.ts         # 流式 API 调用（Google / Nvidia / OpenAI 兼容）
│   ├── routes/               # API 路由
│   │   ├── settings.ts       # /api/settings GET/PUT
│   │   ├── templates.ts      # /api/templates GET/PUT
│   │   ├── sessions.ts       # /api/sessions CRUD、duplicate、clean
│   │   ├── chat.ts           # /api/sessions/:id/messages, generation, retry, continue, regenerate
│   │   └── models.ts         # /api/providers, POST /api/providers/:type/models
│   └── services/             # 核心服务
│       ├── generation-manager.ts # GenerationManager：生成任务生命周期、SSE 订阅
│       └── logger.ts         # 日志服务：拦截 console 输出并持久化到 data/log/
├── shared/                   # 前后端共享的纯函数模块
│   ├── chatgpt-export.ts     # ChatGPT 导出包构造（conversations.json / user.json / export_manifest.json）
│   ├── skills.ts             # 技能定义与默认技能
│   ├── sorting.ts            # 通用按名称/模型 ID 自动排序工具
│   ├── system-prompt.ts      # 系统提示词拼装与 FORMAT_INSTRUCTIONS
│   └── thinking.ts           # <think> 块解析、剥离与搜索归一化工具
├── src/
│   ├── App.tsx               # 主应用组件（状态管理中心）
│   ├── main.tsx              # React 入口
│   ├── index.css             # Tailwind 导入与 KaTeX / CJK 字体回退样式
│   ├── types.ts              # TypeScript 类型定义
│   ├── vite-env.d.ts         # Vite 类型声明
│   ├── fonts/                # 中文排版子集字体（Noto Sans SC / Noto Serif SC）
│   ├── components/
│   │   ├── BatchExportModal.tsx # 批量多选会话导出为 .md/.txt ZIP 弹窗
│   │   ├── ChatArea.tsx      # 聊天区域（SSE 订阅 + 消息列表 + 输入/编辑/打印弹窗）
│   │   ├── MarkdownRenderer.tsx # Markdown + KaTeX + TOC 锚点渲染器
│   │   ├── SettingsModal.tsx # 设置弹窗（General / Providers / Models / Characters / Skills / Templates）
│   │   ├── Sidebar.tsx       # 左侧栏（会话列表、全文检索、批量导出、加星）
│   │   └── TOCSidebar.tsx    # 右侧可调宽目录导航栏
│   └── lib/
│       ├── api.ts            # 统一 API 客户端（REST + SSE 订阅）
│       ├── mathEngine.ts     # KaTeX 共享选项与中央宏定义
│       ├── toc.ts            # 基于 unified/remark 的 Markdown AST 目录提取
│       └── utils.ts          # cn() 样式合并工具
├── tsconfig.json             # TypeScript 配置
└── vite.config.ts            # Vite 构建配置
```

### 文件结构 / 关键文件说明

```text
| 文件 | 职责 |
|------|------|
| `server.ts` | 入口文件，`import 'dotenv/config'` + `startApp()` |
| `server/app.ts` | Express 5 应用组装，执行 `syncRemoteModels`，挂载路由，创建 `GenerationManager` |
| `server/lib/settings-helper.ts` | 设置文件分拆读写（`settings.json` 与 5 个列表 JSON）、旧字段迁移及原子写入 |
| `server/providers/built-in.ts` | 内置 3 种提供商类型定义（google / nvidia / openai-compatible） |
| `server/providers/config.ts` | 提供商配置解析（apiKey、baseURL、envKey） |
| `server/providers/stream.ts` | 流式 API 调用（Google / Nvidia / OpenAI 兼容） |
| `server/services/generation-manager.ts` | **核心服务**：`GenerationManager` 管理生成任务生命周期、SSE 订阅、并发、取消 |
| `server/services/logger.ts` | **日志服务**：拦截 console 输出并持久化到 `data/log/` |
| `server/routes/chat.ts` | POST messages、GET generation（SSE）、DELETE stop、POST retry/continue/regenerate |
| `server/routes/settings.ts` | `/api/settings` GET/PUT |
| `server/routes/templates.ts` | `/api/templates` GET/PUT |
| `server/routes/sessions.ts` | `/api/sessions` GET/GET/:id/PATCH/:id/DELETE/:id/duplicate/clean |
| `server/routes/models.ts` | GET `/api/providers`、POST `/api/providers/:type/models` |
| `shared/chatgpt-export.ts` | ChatGPT 导出包构造器（`buildChatGPTConversation`、`buildChatGPTBundleFiles`） |
| `shared/sorting.ts` | 配置列表自动排序函数（`sortByName`、`sortModels` 等） |
| `shared/system-prompt.ts` | 系统提示词组合与 `FORMAT_INSTRUCTIONS` |
| `shared/thinking.ts` | `<think>` 提取、剥离与搜索归一化工具 |
| `src/App.tsx` | 状态管理、未保存会话追踪、`settingsSaveQueue` 同步、per-session generating 状态 |
| `src/lib/api.ts` | 统一 API 客户端，封装 REST 调用和 SSE 订阅逻辑 |
| `src/lib/mathEngine.ts` | KaTeX `SHARED_KATEX_OPTIONS` 与 `CENTRAL_MACROS` |
| `src/lib/toc.ts` | 基于 Markdown AST 的标题提取与清理 |
| `src/components/ChatArea.tsx` | 聊天 UI、草稿存储、放大编辑弹窗、分块编辑、目录联动与纯净打印 |
| `src/components/TOCSidebar.tsx` | 目录导航栏，支持层级过滤、滚动高亮联动与移动端抽屉 |
| `src/components/BatchExportModal.tsx` | 多选会话打包导出 `.md` / `.txt` 压缩包 |
| `src/components/SettingsModal.tsx` | 设置弹窗（General / Providers / Models / Characters / Skills / Templates） |
| `src/components/Sidebar.tsx` | 左侧栏 UI，支持角色过滤、全文搜索、批量导出与会话加星 |
| `src/components/MarkdownRenderer.tsx` | Markdown 渲染管线，集成 KaTeX 与 `rehypeTocHeadingIds` |
| `src/types.ts` | TypeScript 接口定义（`ProviderInstance`, `ModelInstance`, `TempModel`, `UserSettings`, `ChatSession` 等） |
```

### 数据模型与存储

```text

```

### 数据模型与存储 / TypeScript 类型定义

```text

```

### 数据模型与存储 / TypeScript 类型定义 / ProviderInstance（提供商实例）

```text
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

> **特殊行为**：
> - `nvidia` 类型的 `baseURL` 固定为 `https://integrate.api.nvidia.com/v1`，无法覆盖
> - `google` 类型不支持 `modelSource`（模型列表通过 API 获取）
```

### 数据模型与存储 / TypeScript 类型定义 / ModelInstance（模型实例）

```text
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

### 数据模型与存储 / TypeScript 类型定义 / TempModel（临时模型实例）

```text
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

### 数据模型与存储 / TypeScript 类型定义 / Character（角色）

```text
interface Character {
  id: string;            // UUID
  name: string;          // 角色名称
  systemPrompt: string;  // 系统提示词
}

> **设计意图**：角色是系统提示词的容器。用户可在设置中创建多个角色（如"数学导师"、"代码助手"），每个角色携带不同的 `systemPrompt`。发送消息时，后端根据 `activeCharacterId` 查找对应角色的 `systemPrompt` 注入请求。
```

### 数据模型与存储 / TypeScript 类型定义 / Skill（技能）

```text
interface Skill {
  id: string;            // UUID / 唯一标识符
  name: string;          // 技能名称（如 "Assistant"）
  prompt: string;        // 技能提示词内容
}

> **设计意图**：技能是独立于角色的可多选提示词模块。默认系统包含 "Assistant" 技能。发送消息时，后端通过 `shared/system-prompt.ts` 依次拼接活跃 Character 系统提示词（或回退 `systemPrompt`）、选中的 Skills 块（`# Skill: ${name}\n${prompt}`），并在末尾追加 KaTeX/Markdown 格式指令（`FORMAT_INSTRUCTIONS`）。
```

### 数据模型与存储 / TypeScript 类型定义 / Template（自动填入模板）

```text
interface Template {
  id: string;            // UUID / 唯一标识符
  name: string;          // 模板名称（显示在菜单中）
  content: string;       // 模板具体内容（支持 LaTeX，可自动追加到输入框）
}

> **设计意图**：聊天自动填入模板是一个独立的数据模型。用户可以在设置中配置三角形、数列等高频填入的数学句式，并在聊天中一键快捷 append 到输入框中，避免重复输入。
```

### 数据模型与存储 / TypeScript 类型定义 / UserSettings（用户设置）

```text
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

### 数据模型与存储 / TypeScript 类型定义 / ChatMessage（聊天消息）

```text
interface ChatMessage {
  id: string;                       // UUID
  role: 'user' | 'model';          // 角色
  content: string;                   // 消息内容（含 Markdown 和思考过程包装）
  createdAt: string;                // ISO 时间戳
 }
```

### 数据模型与存储 / TypeScript 类型定义 / ChatSession（聊天会话）

```text
interface ChatSession {
  id: string;               // UUID
  title: string;            // 会话标题
  messages: ChatMessage[];  // 消息列表
  characterId?: string;    // 创建时使用的角色 ID（仅记录首次）
  createdAt: string;        // ISO 时间戳
  updatedAt: string;        // ISO 时间戳
}
```

### 数据模型与存储 / TypeScript 类型定义 / 服务端类型（GenerationManager 内部）

```text
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

### 数据模型与存储 / 存储方案

```text

```

### 数据模型与存储 / 存储方案 / 本地 JSON 文件存储

```text
数据通过 Express 服务端 REST API 读写本地 JSON 文件；`server/lib/settings-helper.ts` 负责将配置列表分拆存储到独立 JSON 文件（仅写入内容发生变更的文件，并通过 `.tmp-` 与 `.bak-` 实现多文件事务写入与回滚），并在启动/加载时透明执行旧版单文件字段及 `claudeChunks` → `chatgptChunks` 的迁移：

**文件结构**：

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
```

### 数据模型与存储 / 默认设置

```text
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

> **设计要点**：所有参数（temperature、maxTokens 等）为 "Unset" 时不传给 API，由供应商使用默认值。已删除 `topP` 参数。
```

### 数据模型与存储 / ChatGPT 导出包（`shared/chatgpt-export.ts`）

```text
「导出为 ChatGPT 格式」生成的每个子压缩包都采用 OpenAI ChatGPT 官方导出包结构，由 `buildChatGPTConversation()` 与 `buildChatGPTBundleFiles()` 集中构造：

All_Conversations.zip / <角色名>.zip
├── conversations.json     # ChatGPTConversation[]
├── user.json              # ChatGPTUser
└── export_manifest.json   # ChatGPTExportManifest（记录文件字节大小与分片信息）

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

> **处理细节**：
> - `assistant`（本地 `model`）消息在导出前通过 `extractThinkingBlocks(rawContent, false).mainContent` 剥离已闭合的 `<think>...</think>` 思考过程（`allowUnclosed = false` 以避免未闭合标签误删正文）。
> - 分片时间过滤支持基于 `settings.chatgptChunks` 仅导出更新于指定 ISO 时间戳及之后的会话，并忽略无会话命中的角色子压缩包；导出成功后自动追加新分片时间戳。
```

### AI 供应商集成文档

```text

```

### AI 供应商集成文档 / 供应商总览

```text
本项目内置 3 种提供商类型，均通过服务端代理调用：

| 类型 | ID | 默认 Base URL | 默认 Env Key |
|------|-------------|----------|----------|
| Google Gemini | `google` | generativelanguage.googleapis.com/v1beta | `GEMINI_API_KEY` |
| Nvidia NIM | `nvidia` | integrate.api.nvidia.com/v1 | `NVIDIA_API_KEY` |
| OpenAI Compatible | `openai-compatible` | 用户配置 | `OPENAI_API_KEY` |

> 用户可自行添加任意数量的 `openai-compatible` 提供商实例，也可以在 Settings 中独立配置不依赖 Provider 实体、只支持 OpenAI 兼容 API 的“临时模型 (Temp Models)”。
```

### AI 供应商集成文档 / 架构

```text

```

### AI 供应商集成文档 / 架构 / 服务端模块

```text
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
```

### AI 供应商集成文档 / 架构 / 前端统一客户端

```text
- **`src/lib/api.ts`** — 统一 API 客户端
  - `api.settings` — 设置读写
  - `api.sessions` — 会话 CRUD
  - `api.chat` — 消息发送、停止、重试、继续
  - `api.providers` — 获取内置提供商类型列表和模型列表
  - `api.subscribeGeneration()` — SSE 订阅生成进度
```

### AI 供应商集成文档 / Google Gemini

```text
- **SDK**：`@google/genai`
- **特殊功能**：
  - Thinking Level 配置（minimal/low/medium/high/xhigh）
  - `includeThoughts: true` 确保思考过程可见
  - 流式响应 + 思考过程分段（`part.thought` 标记）
```

### AI 供应商集成文档 / Nvidia NIM

```text
- **SDK**：OpenAI SDK
- **Base URL**：`https://integrate.api.nvidia.com/v1`
- **特殊功能**：支持 `extraBody` 透传（如 `chat_template_kwargs`）
- **推理过程**：通过 `delta.reasoning` 或 `delta.reasoning_content` 字段检测
- **推理强度配置**：不启用 `reasoning_effort` 级联回退机制或自动参数注入。在未显式设置 `reasoning_effort` 时，默认进行无 `reasoning_effort` 参数的请求；若用户显式配置了 `reasoning_effort`（例如 Kimi K2.6），则依然会直接遵循该显式配置发出请求。
```

### AI 供应商集成文档 / OpenAI Compatible

```text
- **SDK**：OpenAI SDK
- **用途**：支持任意 OpenAI 兼容 API 端点
- **配置方式**：在 Settings → Providers tab 中手动填写名称、Base URL、API Key、Env Key Prefix
```

### AI 供应商集成文档 / SSE 流式协议

```text
前端通过 `EventSource` 订阅 `/api/sessions/:id/generation`，服务端发送以下事件：

event: delta
data: {"content": "完整内容（含思考过程包装）"}

event: done
data: {"content": "最终内容"}

event: error
data: {"message": "错误信息"}

event: stopped
data: {}

**标题生成**：当新建会话时，服务端同步生成标题（使用 `unicodeit` + `markdown-to-txt` 转换 Markdown 为 Plain Text）。标题生成后立即保存到 session.json。
```

### AI 供应商集成文档 / 环境变量汇总

```text
GEMINI_API_KEY=          # Google Gemini
NVIDIA_API_KEY=          # Nvidia NIM
OPENAI_API_KEY=          # 通用回退（所有 OpenAI 兼容供应商）

> 所有 API Key 均在服务端读取（通过 dotenv），前端不暴露任何 Key。
> API Key 解析优先级：Providers 配置中的 API Key > 配置中的 Env Key 对应的环境变量 > 供应商默认环境变量（如 `GEMINI_API_KEY`）> `OPENAI_API_KEY` 回退。
```

### 技术栈详情

```text

```

### 技术栈详情 / 前端框架

```text
| 技术 | 版本 |
|---|---|
| React | ^19.3.1 |
| TypeScript | ^7.0.2 |
| Vite | ^8.3.8 |
| Tailwind CSS | ^4.3.5 |
| @tailwindcss/typography | ^0.5.20 |
```

### 技术栈详情 / 后端

```text
| 技术 | 版本 |
|---|---|
| Express | ^5.3.0 |
| tsx | ^4.23.15 |
| OpenAI SDK | ^7.57.0 |
| dotenv | ^18.0.10 |
```

### 技术栈详情 / AI/数学库

```text
| 技术 | 版本 |
|---|---|
| @google/genai | ^3.3.0 |
| KaTeX | ^0.19.1 (`resolutions`: `^0.18.4`) |
```

### 技术栈详情 / Markdown 与 AST 渲染管线

```text
| 技术 | 版本 |
|---|---|
| react-markdown | ^10.1.0 |
| unified | ^11.0.5 |
| remark-parse | ^11.0.0 |
| remark-math | ^6.0.0 |
| remark-gfm | ^4.0.1 |
| remark-breaks | ^4.0.0 |
| remark-cjk-friendly | ^2.3.4 |
| remark-squeeze-paragraphs | ^6.0.0 |
| rehype-katex | ^7.0.1 |
| rehype-raw | ^7.0.0 |
| rehype-sanitize | ^6.0.0 |
| rehype-external-links | ^3.0.0 |
| katex/contrib/mhchem | (Bundled with KaTeX) |
```

### 技术栈详情 / 其他依赖

```text
| 技术 | 版本 |
|---|---|
| lucide-react | ^1.73.0 |
| motion | ^14.14.0 |
| clsx | ^2.1.1 |
| tailwind-merge | ^3.7.0 |
| uuid | ^14.0.3 |
| jszip | ^3.10.2 |
| pandoc-wasm | ^1.1.0 |
| unicodeit | ^0.7.5 |
| markdown-to-txt | ^2.0.1 |
```

### 技术栈详情 / 其他依赖 / 标题生成

```text
标题生成使用纯 JavaScript 字符串操作，无需异步：

- **unicodeit**: 将 LaTeX 数学公式转换为 Unicode 字符（如 `\alpha` → `α`）
- **markdown-to-txt**: 清理 Markdown 语法（标题、粗体、链接等）
- 处理流程：替换 `\dfrac` → `\frac` → 全局移除 `\displaystyle` 与 `\scriptstyle` → 处理块级数学 `$$...$$` → 处理行内数学 `$...$` → Markdown 转文本 → 合并空白并移除剩余 `$` 与 `\` → 截断为最多 50 个字符（超出追加 `...`）
```

### 技术栈详情 / 开发工具

```text
| 工具 | 用途 |
|---|---|
| Bun | 依赖管理、脚本运行、构建 |
| TypeScript (`tsc --noEmit --strict`) | 类型检查 |
| Prettier (`^3.10.1`) | 代码格式检查与格式化（已彻底移除 ESLint） |
| Vite HMR | 热模块替换（可通过 `DISABLE_HMR=true` 禁用） |
```

### 技术栈详情 / 构建命令

```text
bun run dev           # 启动开发服务器（tsx server.ts → Express + Vite 中间件）
bun run build         # Vite 生产构建
bun run preview       # 预览生产构建
bun run build:bundle    # 打包服务端代码为单个 bundle
bun run build:compile  # 使用 Bun 编译为可执行文件
bun run check         # TypeScript 严格类型检查
bun run pretty        # Prettier 格式检查
bun run pretty:fix    # Prettier 自动格式化
bun run clean         # 清除 dist、dist-server、dist-compile、release 目录
```

### 技术栈详情 / 路径别名

```text
`@/*` 映射到项目根目录，配置在 `tsconfig.json` 和 `vite.config.ts` 中。
```

### 技术栈详情 / 数学公式渲染系统 (Math Formula Rendering System)

```text
本应用数学公式渲染统一使用 KaTeX（已移除所有引擎切换开关与自定义数学字体设置）：
```

### 技术栈详情 / 数学公式渲染系统 (Math Formula Rendering System) / 数学渲染引擎

```text
- **KaTeX**: 基于 `rehype-katex` 同步 AST 渲染；主页面全局样式（`src/index.css`）应用 `1.1em` 字号，纯净打印 iframe（`src/components/ChatArea.tsx`）内应用 `0.9em` 字号与黑色 `.frac-line` 覆盖以保证高对比度。
```

### 技术栈详情 / 数学公式渲染系统 (Math Formula Rendering System) / 实现细节

```text
1. **统一宏管理 (`src/lib/mathEngine.ts`)**: 管理自定义宏（`\tag`、`\male`、`\female`、`\vec`、`\celsius`、`\SI`）与 KaTeX 渲染选项（`SHARED_KATEX_OPTIONS`）。
2. **默认库字体与中文排版**: 数学符号保持 KaTeX 原生默认字体；`src/fonts/` 保留中文全角引号子集（`FullWidthQuotes`），`.katex .cjk_fallback` 强制回退至 `--font-main`。
```

### 组件结构文档

```text

```

### 组件结构文档 / 组件树

```text
graph TD
    App[App.tsx]
    subgraph App Children
        Sidebar[Sidebar.tsx]
        ChatArea[ChatArea.tsx]
        SettingsModal[SettingsModal.tsx]
    end

    App --> Sidebar
    App --> ChatArea
    App --> SettingsModal

    subgraph Sidebar Children
        BatchExportModal[BatchExportModal.tsx]
    end

    subgraph ChatArea Children
        MessageItem[MessageItem]
        TOCSidebar[TOCSidebar.tsx]
    end

    subgraph MessageItem Children
        MarkdownRenderer[MarkdownRenderer.tsx]
    end

    subgraph SettingsModal Children
        ActiveModelDropdown[ActiveModelDropdown]
        ProviderEditor[ProviderEditor]
        ModelEditor[ModelEditor]
        TempModelEditor[TempModelEditor]
    end

    Sidebar --> BatchExportModal
    ChatArea --> MessageItem
    ChatArea --> TOCSidebar
    MessageItem --> MarkdownRenderer
    SettingsModal --> ActiveModelDropdown
    SettingsModal --> ProviderEditor
    SettingsModal --> ModelEditor
    SettingsModal --> TempModelEditor
```

### 组件结构文档 / `App.tsx` — 状态管理中心

```text
**职责**:

*   **状态中心**: 作为整个应用的顶层组件，管理所有核心状态，包括 `sessions`、`currentSessionId`、`unsavedSessionIds`、`settings`、`templates`、`isSettingsOpen`、per-session `generatingSessions` 与 `stoppingSessions`。
*   **数据获取**: 启动时并行拉取 `sessions`、`settings`、`templates` 与正在运行的生成任务列表（`getRunningSessions`）。
*   **未保存会话管理**: 使用 `unsavedSessionIds` Set 跟踪本地尚未发送消息的新建会话，`handleNewChat` 复用既有未保存会话；`handleDeleteChat` 会停止生成流（`api.chat.stop(id)`），对已落盘会话调用 `api.sessions.delete(id)`，并清理本地草稿与加星记录。
*   **设置持久化与生成同步**: 共享状态变更通过 `updateGlobalSettings` 串行进入 `settingsSaveQueue`；在发起任何生成操作（`handleSendMessage`、`handleRetry`、`handleContinue`、`handleRegenerate`）前调用 `awaitSettledSettingsSave()`，确保最新设置已完整写入磁盘再由后端解析。
*   **角色过继同步**: `handleSaveSettings` 在保存设置后重新拉取服务端会话列表，同时保留本地未保存会话并根据 `characterReassignments`（或回退到 `activeCharacterId`）更新其 `characterId`。
*   **关闭拦截**: 注册全局 `window` `beforeunload` 监听器，在关闭标签页或刷新浏览器前提示确认。
*   **左侧栏宽度记忆**: 桌面端拖拽调整左侧栏宽度（`180px`–`480px`，默认 `256px`）后，自动记忆至 `localStorage`（`chat_sidebar_width`）。
```

### 组件结构文档 / `Sidebar.tsx` — 左侧栏

```text
**职责**:

*   **会话列表与分组**: 按更新时间倒序展示并按日期分组（今天 / 昨天 / 近7天日期 / 最近一个月 / 过去一年 / 更早）。
*   **分类过滤**: 在会话列表上方提供角色选择器，允许用户按 `session.characterId` 过滤会话。
*   **常规与全文搜索**:
    *   默认实时按标题或会话 ID 过滤（忽略空白与大小写）。
    *   点击输入框内的全文搜索按钮（或非空输入回车）进入全文搜索模式，调用 `normalizeForSearch`（忽略大小写、所有空白及 `<think>` 块）异步分批检索所有会话正文，显示进度条并锁定输入；通过 `activeSearchIdRef` 使过期的异步扫描失效，关闭/退出全文搜索时弹出确认弹窗。
*   **批量导出模式**: 切换批量选择模式后可多选会话并打开 `BatchExportModal.tsx` 导出压缩包。
*   **加星功能 (Starring)**: 支持黄、红、蓝、绿、橙五种预设颜色（`settings.starredSessions`），有加星会话时在顶部展示可折叠的「已加星会话」分组。
*   **用户交互**: 切换、新建、复制、删除、加星会话，以及打开设置模态框。
```

### 组件结构文档 / `BatchExportModal.tsx` — 批量导出弹窗

```text
**职责**:

*   **多选打包导出**: 接收 `selectedSessionIds`，逐一通过 `api.sessions.get(id)`（失败回退内存列表）拉取完整会话并使用 `JSZip` 打包为 `batch_export_YYYYMMDD_HHMMSS.zip`。
*   **格式与思考开关**: 支持 Markdown（`.md`，含 `# 标题` 与 `### User/AI`）和纯文本（`.txt`，无 `#`/`###` 标题符号，使用 `[User]`/`[AI]`），并支持选择保留或通过 `stripThinking` 移除 `<think>` 块。
*   **完整性校验**: 收集拉取失败的会话 ID，若存在失败项则中止打包并提示错误，避免生成不完整的导出包。
```

### 组件结构文档 / `ChatArea.tsx` — 聊天主区域

```text
**职责**:

*   **消息显示与续写平滑更新**: 渲染会话消息列表，订阅 SSE (`delta`、`done`、`error`、`stopped`)。当处于生成中且末尾已存在 `model` 消息（Continue / Regenerate 场景）时，直接原地更新最后一条消息内容，避免重复块或布局跳动。
*   **草稿持久化**: 将未发送的输入内容以 500ms 防抖保存至 `localStorage` 的 `chat_drafts`（7 天过期）；New Chat 与未保存会话使用专用键 `NEW_CHAT_DRAFT_KEY = '__new_chat_draft__'`。在组件卸载/会话切换时立即 flush，在发送消息或删除会话时清除。
*   **输入与放大编辑弹窗**:
    *   主输入框支持 `Ctrl+Enter` 发送、`Enter`/`Shift+Enter` 换行，并显示估算 Token 与字符数。默认与最小高度均为 `44px`（单行高度），不随输入内容自动伸缩；鼠标指向输入框顶部边缘即可上下拖动调整高度（上限 `60vh`），松手后自动记忆至 `localStorage`（`chat_input_height`）。
    *   点击 `Maximize2` 按钮打开左右分栏放大编辑弹窗（左侧代码/Markdown `textarea`，右侧经 `useDeferredValue` 延迟优化的 `MarkdownRenderer` 实时预览）。文本框内按 `Tab` 插入两个空格（优先使用 `document.execCommand('insertText')` 并提供手动选区回退）；弹窗内其它可聚焦元素使用 `Tab` 焦点陷阱，`Esc` 或 `Minimize2` 关闭后焦点恢复至打开按钮；弹窗内禁止直接发送消息以防长内容误发。
*   **会话级编辑与角色标记**:
    *   顶栏展示并允许修改当前会话的 `characterId`（通过 `onUpdateSessionCharacter` 更新会话本身，与全局 `settings.activeCharacterId` 完全解耦）。
    *   支持打开分块编辑弹窗（`parseMessagesToBlocks` / `compileBlocksToMessages`），将消息拆分为可上/下移动、修改类型、删除、新增的 `input` / `thinking` / `output` 块（文本框 `rows={6}`、`min-h-[160px]`），保存时调用 `PATCH /api/sessions/:id`。
*   **快捷选择栏与 System Prompt 预览**:
    *   **Model 下拉框**: 跨提供商子串模糊搜索（`normalizeSearchString` 忽略空格、换行、横杠、中英文逗号、句点、下划线与大小写），左侧显示 `displayName`、右侧 CSS 截断显示 `modelId` 并带原生 `title={modelId}` 提示；打开或关闭时清空搜索词，支持 `Escape` 关闭与 `Enter` 选中首个匹配项并把焦点归还至 `modelToggleBtnRef`，打开时将当前活跃模型滚入可视区域（`scrollIntoView({ block: 'nearest' })`）。
    *   **Character 下拉框**: 切换全局 `activeCharacterId`。
    *   **System Prompt 预览弹窗**: 点击 toolbar 的 `System Prompt` 按钮以无障碍弹窗（`role="dialog"`、`aria-modal="true"`）展示 `buildConstructedSystemPrompt` 生成的完整提示词并支持复制。
    *   **Skills 下拉框**: 绑定 `settings.activeSkillIds` 的多选菜单，使用响应式宽度（`w-80 sm:w-[26rem] min-w-[300px] max-w-[90vw]`）和自适应对齐（`left-0 sm:left-auto sm:right-0`）完整展示长技能名。
    *   **Templates 下拉框**: 拉取并追加 `/api/templates` 的模板内容至输入框并聚焦输入框。
*   **目录侧栏集成**: 集成 `TOCSidebar.tsx`，支持桌面端鼠标拖拽调宽（`200px`–`600px`，默认 `288px`，自动记忆至 `localStorage` 的 `chat_toc_width`）、默认展开到 `H6`、监听 `#chat-scroll-container` 滚动计算当前活跃标题，并将桌面端目录显隐状态自动记忆至 `localStorage`（`chat_toc_open`）。
*   **纯净 PDF 打印 (`executePrint`)**:
    *   支持单条预览打印（自动前置 `<h1>Session ID: [id]</h1>`）与顶栏全会话打印（通过 `isPrintingAll` 惰性渲染 `#print-all-session-content` 以避免流式阶段额外开销）。
    *   统一在隐藏 `iframe` 中注入全局打印样式（无 `@media print` 嵌套）：强制浅色模式（`color-scheme: light !important`）、`.katex { font-size: 0.9em; }`、`.katex .frac-line` 强制黑框黑字，确保打印对比度。
```

### 组件结构文档 / `ChatArea.tsx` — 聊天主区域 / `MessageItem` (子组件)

```text
*   **职责**: 渲染单条消息、折叠/展开 `<think>` 思考过程，以及悬停操作按钮（View、Copy、Retry、Regenerate、Continue）。
*   **Copy（复制）**: 同时写入纯文本与富文本 HTML（`ClipboardItem`），不包含 `<think>` 思考过程。
*   **View（查看）**: 点击 👁️ 按钮弹出全屏预览层（模型消息会附带最近一条用户问题），锁定底层滚动并支持 `Ctrl+P` 打印或 `Esc` 关闭。
*   **Retry / Regenerate / Continue**: 分别触发对应生成操作（均通过后端 `GenerationManager` 原地处理）。
```

### 组件结构文档 / `TOCSidebar.tsx` — 目录导航侧栏

```text
**职责**:

*   **AST 标题提取**: 调用 `src/lib/toc.ts`（`unified` + `remark-parse` + `remark-gfm` + `remark-math`）解析每条消息的 Markdown 标题，递归提取纯文本并剔除 `<think>` 块及非正文元素。
*   **层级筛选与折叠**: 支持 `H1`–`H6` 层级过滤（默认 `H6`）、全部展开/折叠、按消息卡片分组展示（附带角色标签与正文摘要）。
*   **联动定位**: 随 `#chat-scroll-container` 滚动自动展开当前活跃消息卡片、折叠非活跃卡片，并将当前活跃标题项自动滚入 TOC 可视区域；窄屏（`<768px`）下切换为滑出抽屉遮罩层。
```

### 组件结构文档 / `MarkdownRenderer.tsx` — Markdown 渲染器

```text
**职责**:

*   **Markdown-to-HTML**: 使用 `react-markdown` 将 Markdown 文本安全地转换为 React 组件。
*   **插件管线**: 集成 `remark-gfm`、`remark-math`、`remark-breaks`、`remark-squeeze-paragraphs`、`remark-cjk-friendly` 及 `rehype-raw`、`rehype-sanitize`、`rehype-katex`、`rehype-external-links`。
*   **数学渲染**: 将 `\[...\]` / `\(...\)` 规范化为 `$$...$$` / `$...$`，统一使用 `rehype-katex` 配合 `src/lib/mathEngine.ts` 的 `SHARED_KATEX_OPTIONS` 进行同步渲染。
*   **TOC 锚点插件**: 通过自定义 `rehypeTocHeadingIds` 插件在 rehype AST 阶段按文档顺序为标题注入确定性锚点 ID（`toc-msg-${messageId}-h-${index}`）。
```

### 组件结构文档 / `SettingsModal.tsx` — 设置弹窗

```text
**职责**: 提供一个集中界面管理所有配置，并在存在未保存子表单编辑（Provider、Model、TempModel、Character、Skill、Template 或便利贴）时通过确认弹窗拦截关闭或主保存操作（`hasUnsavedEdits`）。
```

### 组件结构文档 / `SettingsModal.tsx` — 设置弹窗 / General Tab

```text
*   **活跃模型选择 (`ActiveModelDropdown`)**: 从常规模型（按 Provider 分组）及临时模型中选择当前活跃模型。
*   **活跃角色预览**: 显示当前激活的角色名称及其系统提示词摘要。
*   **选项开关**: 控制 `autoScroll`、`collapseThinkingFinished`、`renderThinkingAsMarkdown`、`trimThinkingSpaces`（仅影响前端展示的思考前导空格清理）、`stripThinkingForApi`（向 API 隐藏历史思考块）以及 `userAsSystem`（以 `role: 'user'` + `<system>` 包装发送系统提示词）。
*   **全局便利贴 (`stickyNotes`)**: 采用拟真胶带纸张卡片样式的便签面板，支持新增、编辑与删除，持久化至 `settings.json`。
*   **危险区域操作**:
    *   **导出为 ChatGPT 格式**: 通过分片时间弹窗（`chatgptChunks`）过滤目标更新时间之后的会话并支持编辑各时间点备注（`chatgptChunkRemarks`）；调用 `shared/chatgpt-export.ts` 生成 `All_Conversations.zip` 及各非空角色子压缩包（每个均含 `conversations.json`、`user.json`、`export_manifest.json`），导出成功后自动追加当前时间分片。
    *   **强制清洗数据**: 调用 `/api/sessions/clean` 规范化所有会话数据。
```

### 组件结构文档 / `SettingsModal.tsx` — 设置弹窗 / Providers Tab

```text
*   **供应商管理**: 通过 `ProviderEditor` 添加、编辑、删除 `ProviderInstance`（配置类型、Base URL、API Key、Env Key、Extra Config JSON 及模型同步模式 `modelSyncType`: `none` / `json` / `v1_models`）。
```

### 组件结构文档 / `SettingsModal.tsx` — 设置弹窗 / Models Tab

```text
*   **临时模型 (Temp Models)**: 置顶区域管理独立于 Provider 的临时模型（`TempModelEditor`，强制限制 `temperature` 范围为 `0`–`2`、`maxTokens` 范围为 `1`–`1000000`）。
*   **常规模型**: 手动配置模型按 Provider 直接展示；通过 `json` 或 `/v1/models` 同步的模型分别放入默认折叠的手风琴面板中。
*   **底部吸底栏**: `Add Temp Model` 与 `Add Model` 按钮固定吸底停靠并预留底部留白，避免遮挡长列表末尾项。
```

### 组件结构文档 / `SettingsModal.tsx` — 设置弹窗 / Characters Tab

```text
*   **角色管理**: 添加、编辑、删除 `Character`。删除角色时弹出过继确认框，要求选择剩余角色（或置空）接管其关联会话并维护链式重映射（`characterReassignments`），主保存时通过 `api.sessions.update` 逐会话更新（带容错统计）。
```

### 组件结构文档 / `SettingsModal.tsx` — 设置弹窗 / Skills Tab

```text
*   **技能管理**: 添加、编辑、删除独立于角色的技能提示词 (`Skill`)，默认包含 `"Assistant"` 技能。
```

### 组件结构文档 / `SettingsModal.tsx` — 设置弹窗 / Templates Tab

```text
*   **模板管理**: 添加、编辑、删除聊天自动填入模板；列表按名称自动排序（`sortTemplates`），保存后通过 `/api/templates` 持久化到 `data/templates.json`。
```

