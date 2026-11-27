# AGENTS.md — AI 开发指导文件

## 重要：文档同步更新规则

**当修改项目代码、架构、数据模型、组件结构、API 集成时，必须同步更新以下文档：**

1. **`AGENTS.md`** — 如果变更影响架构模式、开发规范、修改场景指引或注意事项
2. **`docs/`** — 根据变更类型更新对应文档：
   - 架构变更 → `docs/architecture.md`
   - 新增/修改依赖 → `docs/tech-stack.md`
   - AI 供应商变更 → `docs/api-providers.md`
   - 数据模型变更 → `docs/data-models.md`
   - 组件结构变更 → `docs/components.md`
   - 数学渲染变更 → `docs/tech-stack.md`
   - 文件增删 → `docs/file-structure.md`

**示例**：添加新的 AI 供应商时，需同步更新 `docs/api-providers.md`、`docs/architecture.md`、`docs/file-structure.md`、`AGENTS.md`。

## 项目概述

**AI Math & Chat Studio** 是一个多会话 AI 聊天应用，内置 3 种提供商类型（Google Gemini、Nvidia NIM、OpenAI Compatible），支持提供商和模型的分离配置，以及 KaTeX 数学公式和 mhchem 化学公式渲染。数据以 JSON 文件形式存储在本地 `/data` 目录。

**文档入口**：`docs/` 目录包含完整的架构、技术栈、组件、数据模型等文档。

## 快速导航

| 需要了解的内容 | 阅读文件 |
|----------------|----------|
| 项目整体架构 | `docs/architecture.md` |
| 技术栈和依赖 | `docs/tech-stack.md` |
| AI 供应商集成方式 | `docs/api-providers.md` |
| 数据模型和存储 | `docs/data-models.md` |
| 组件结构和职责 | `docs/components.md` |
| 数学公式渲染 | `docs/tech-stack.md` |
| 代码质量规范 | `docs/linting-and-quality.md` |
| 文件结构 | `docs/file-structure.md` |

## 开发规范

### 代码风格

- **TypeScript 项目**，所有类型定义在 `src/types.ts`
- **React 函数组件**，不使用 class 组件
- **Tailwind CSS** 样式，使用 `cn()` 工具函数（`src/lib/utils.ts`）合并条件样式
- **无注释风格**：代码应自解释，不添加注释（除非必要）
- **ES Module**：项目使用 `"type": "module"`
- **严禁使用三元表达式**：根据 `docs/linting-and-quality.md`，严禁使用三元表达式，必须使用 `if/else`。

### 状态管理

- **无外部状态库**：使用 React `useState` + `useEffect` 管理所有状态
- **App.tsx 是状态中心**：所有共享状态和业务逻辑集中在 `App.tsx`
- **乐观更新**：先更新 UI 再通过 `api.settings.save()` / `api.sessions.*` 持久化到服务端 JSON 文件
- **per-session generating**：使用 `Set<string>` 跟踪每个会话的生成状态
- **`isSettingsOpen`**：控制设置弹窗的显示/隐藏

### 命名约定

- 组件文件：`PascalCase.tsx`（如 `ChatArea.tsx`）
- 工具库文件：`camelCase.ts`（如 `api.ts`）
- 组件导出：具名导出 `export const Component`（除 `App.tsx` 使用 `export default`）
- 类型/接口：`PascalCase`（如 `ChatSession`）

### 样式约定

- 暗色主题：`bg-gray-900`、`bg-gray-800`、`text-gray-100`
- 强调色：`blue-600`、`blue-400`
- 错误/危险：`red-600`、`red-400`
- 成功：`green-400`
- 使用 `@tailwindcss/typography` 的 `prose prose-invert` 渲染 Markdown

## 关键架构模式

### 1. 核心提示词与角色/技能架构 (Provider + Model + Character + Skills)

用户在 Settings 中分级配置（配置列表通过 `shared/sorting.ts` 在加载、保存与前端变更时自动排序，无需手动上下移动）：

**Providers tab**：
- 添加/管理提供商实例（Google / Nvidia / OpenAI Compatible）。
- 配置每个提供商的 API Key、Base URL、Env Key Prefix 与模型同步模式 `modelSyncType`（`'none' | 'json' | 'v1_models'`，服务端启动时自动同步并过滤非文本生成模型，保留既有模型 UUID 与用户参数）。

**Models tab**：
- 顶部独立配置 **临时模型 (Temp Models)**（持久化至 `/data/temp-models.json` 且已 `.gitignore`，不依赖 Provider 实例，支持显式 `baseURL` 与 `apiKey`）。
- 下方管理关联提供商的常规模型（`json` 与 `/v1/models` 同步模型置于默认折叠的分组手风琴中），配置模型参数（`temperature`、`maxTokens`、`reasoningEffort`、`thinkingLevel`、`extraBody`、`injectThinkingTemplate` 等）。
  - **OpenAI Compatible**：支持设置 `reasoningEffort` (包括 `max`, `xhigh`, `high`, `medium`, `low`, `minimal`, `none`)。
  - **自动试错机制**：对于 **OpenAI Compatible** 供应商，当 `reasoningEffort` 未指定时，流式生成器会采用级联回退机制，依次尝试以 `max` -> `xhigh` -> `high` 强度调用（每个层级失败后重试一次/最多尝试两次），若均失败，最终退回无 `reasoning_effort` 参数调用。特别地：
    - 若抛出 401、403、404 等严重配置或模型不存在错误，则立即停止并向上抛出。
    - 若抛出与 `reasoning_effort` 相关的 400 或 422 错误，则立刻停止重试尝试并直接回退调用无 `reasoning_effort` 参数的模型流。
    - 若检测到请求过快或速率限制 (429/rate-limit)，为保证效率不进行后面的尝试，直接向用户抛出错误。
  - **Nvidia NIM**：Nvidia NIM 供应商不走 `reasoningEffort` 自动尝试级联机制。在未显式设置时，默认不注入该参数；但若显式指定了 `reasoningEffort`（如 Kimi K2.6），则会直接遵循并注入该配置。
- 活跃模型解析（`server/routes/chat.ts`）优先检查 `activeModelId` 是否匹配 TempModel 或常规 Model；仅当没有任何常规模型（`!settings.models?.length`）时才默认回退到首个 TempModel。

**Characters tab**：
- 创建/管理角色（名称 + 系统提示词）。删除角色时通过确认弹窗将原属会话过继给选定目标角色。
- 所有生成请求（send / retry / continue / regenerate）均无条件从全局 `settings.json` 解析 `activeModelId`、`activeCharacterId` 与 `activeSkillIds`；会话自身的 `characterId` 仅作为创建快照（可在 ChatArea 标题处独立修改），用于侧边栏筛选和 ChatGPT 导出。

**Skills tab**：
- 创建/管理独立的技能提示词（`shared/skills.ts` 定义 `Skill` 与默认 `"Assistant"` 技能）。
- 系统提示词构建逻辑集中在 `shared/system-prompt.ts`（`buildSystemPromptBase` / `buildConstructedSystemPrompt`）：首先拼接当前活跃 Character 的 `systemPrompt`（若无则回退到 `settings.systemPrompt`），其次按选中的 `activeSkillIds` 顺序追加 `# Skill: ${skill.name}\n${skill.prompt}`，最后在末尾追加全局格式约束 `FORMAT_INSTRUCTIONS`（强制 KaTeX 语法及块级公式 `$$` 独立成行）。
- 支持在 `userAsSystem` 开启时于 `server/providers/stream.ts` 中将系统提示词包装为 `<system>...</system>` 作为 `role: 'user'` 消息置于消息数组开头发送。

**快捷切换（ChatArea 浮动栏）**：
- 在聊天输入框上方提供浮动栏，可快速切换当前活跃模型（带关键字搜索与键盘辅助）、角色、勾选多选 Skills、查看构建后的完整 System Prompt 弹窗，以及追加自动填入模板。

### 2. 思考过程格式与工具 (`shared/thinking.ts`)

- **统一存储格式**：`GenerationManager.runGeneration()` 将所有供应商的 `reasoning` 块统一包装为 `<think>\n...\n</think>\n\n`（对 `openai-compatible` 还会将旧式 `Thinking...\n> ...` 转换为 `<think>` 格式，并通过 `mergeConsecutiveThinking` 在流式传输、保存及清洗时合并相邻仅隔空白的 `<think>` 块）。前端 `MessageItem` 解析 `<think>` 渲染为可折叠 UI。
- **共享工具函数**（`shared/thinking.ts`）：集中提供 `THINK_REGEX`（含未闭合标签）、`CLOSED_THINK_REGEX`（仅闭合标签）、`stripThinking`、`normalizeForSearch`（移除思考块与全部空白并转小写）和 `extractThinkingBlocks(content, allowUnclosed)`。
- **显示与 API 过滤开关**：
  - `trimThinkingSpaces`：仅在前端 `parseMessageContent` 渲染阶段去除思考内容每行前导空格，不改动磁盘数据或会话分块编辑内容。
  - `stripThinkingForApi`：在 `GenerationManager.runGeneration()` 构造请求时过滤历史模型消息（`idx < session.messages.length - 1`）的 `<think>` 块，保留最后一条目标消息以支持 Continue / Regenerate。

### 3. SSE 流式协议

前端通过 `EventSource` 订阅 `/api/sessions/:id/generation`，服务端发送以下事件：
- `delta` — 内容更新
- `done` — 生成完成
- `error` — 错误
- `stopped` — 已停止

### 4. 日志保留功能

系统通过 `server/services/logger.ts` 初始化日志功能：
- **存储路径**：`data/log/YYYY-MM-DD.log`（UTC 时间）。
- **初始化**：在 `server/app.ts` 的 `startApp()` 最开始调用。
- **分级约定**：外部 AI 供应商 API 异常或流式重连错误使用 `console.warn` 记录，以区分外部网络/配额问题与内部程序 Bug。

### 5. 消息操作架构

| 操作 | 使用场景 | 实现要点 |
|------|----------|----------|
| **Retry** | 对某条回复完全不满意，完全重来 | 截断至最近一条 `user` 消息后重新生成 |
| **Regenerate** | 保留原有思考、修正正文输出 | 保留 `<think>...</think>` 块并清除正文，截断后续消息后直接原地流式续写 |
| **Continue** | 网络错误、流中断导致的不完整响应 | 直接基于末尾 `model` 消息原地继续流式生成，不注入额外用户指令 |

> `server/providers/stream.ts` 会将发送给 API 的消息历史裁剪为最多最近 40 条，并剥离开头非 `user` 角色的消息以符合交替对话约束。

### 6. 消息查看、目录导航与纯净打印功能

- **最大化 Markdown 预览层**：悬停消息显示查看（👁️）图标，点击弹出全屏 `bg-gray-950` 预览层（若为模型消息则附带最近一条用户问题），锁定底层滚动。
- **统一打印管线 (`executePrint`)**：预览层支持 `Ctrl+P` 或点击打印（单条消息打印，自动前置 `<h1>Session ID: [id]</h1>`），顶栏支持全会话打印（通过 `isPrintingAll` 惰性渲染 `#print-all-session-content`）。两者共用 `executePrint` 创建隐藏 blank `iframe`，注入全局样式（无 `@media print` 嵌套）：强制浅色模式（`color-scheme: light !important`）、KaTeX 缩放到 `0.9em`、分数线 `.katex .frac-line` 强制黑框黑字，保证 PDF 清晰度。
- **目录导航 (`TOCSidebar.tsx` + `src/lib/toc.ts`)**：通过 `unified` (`remark-parse` + `remark-gfm` + `remark-math`) 解析 Markdown AST 提取标题，配合 `MarkdownRenderer.tsx` 中的 `rehypeTocHeadingIds` 注入确定性锚点 `toc-msg-${messageId}-h-${index}`。

### 7. KaTeX 数学公式渲染

- **唯一数学引擎**：统一使用 KaTeX（`rehype-katex` + `src/lib/mathEngine.ts` 的 `SHARED_KATEX_OPTIONS` 与 `CENTRAL_MACROS`），无引擎切换开关与自定义数学字体（`katexFont` 已移除）。
- **字号与字体回退**：页面全局 `.katex` 字号为 `1.1em`（`src/index.css`），打印 iframe 内为 `0.9em`；`src/fonts/` 仅保留中文排版子集字体（如 `FullWidthQuotes` 引号子集），`.katex .cjk_fallback` 强制回退至 `--font-main`。

### 8. 配置分拆持久化、模板与自动排序

- **分拆持久化 (`server/lib/settings-helper.ts`)**：通用设置保存在 `/data/settings.json`，列表配置独立存储为 `/data/providers.json`、`/data/models.json`、`/data/temp-models.json`、`/data/characters.json`、`/data/skills.json`，并在启动时自动执行旧版单文件或字段（如 `claudeChunks` -> `chatgptChunks`）迁移及基于 `.tmp-`/`.bak-` 的多文件原子写入。
- **会话键顺序**：`server/services/generation-manager.ts` 在创建、复制、更新与清洗 `ServerChatSession` 时始终将 `characterId` 置于 JSON 最后字段，减少无意义文件 diff。
- **聊天自动填入模板**：模板存储在 `/data/templates.json`，通过 `GET/PUT /api/templates`（`server/routes/templates.ts`）校验并经 `sortTemplates` 自动按名称排序；`SettingsModal.tsx` 的 Templates Tab 支持添加、编辑、删除。
- **前端数据保障**：`App.tsx` 在发起生成请求前调用 `awaitSettledSettingsSave()` 确保 `settingsSaveQueue` 已落盘；草稿通过 `chat_drafts` 保存在 `localStorage`（7 天过期）。

### 9. ChatGPT 导出包与批量导出架构

- **ChatGPT 导出 (`shared/chatgpt-export.ts`)**：`SettingsModal.tsx` 调用 `buildChatGPTConversation` 与 `buildChatGPTBundleFiles` 生成官方兼容导出包，包含 `conversations.json`（以 `client-created-root` 为根节点的 `mapping` 树、Unix 浮点时间戳，并通过 `extractThinkingBlocks(..., false)` 移除闭合 `<think>` 块）、`user.json` 与 `export_manifest.json`（DEFLATE 压缩）。支持基于 `chatgptChunks` 的分片时间过滤导出及 `chatgptChunkRemarks` 备注。
- **批量文本/Markdown 导出 (`BatchExportModal.tsx`)**：侧边栏批量导出模式支持多选会话打包为 `.zip`（`.md` 或 `.txt`，可选保留或通过 `stripThinking` 移除思考块）。

### 10. 构建、开发与部署工作流

- **Vite HMR 控制**：设置环境变量 `DISABLE_HMR=true` 可禁用 HMR（`vite.config.ts`），防止自动化修改文件时浏览器频繁刷新闪烁。
- **代码质量检查**：使用 `bun run check`（`tsc --noEmit --strict`）与 `bun run pretty` / `bun run pretty:fix`（ESLint 已彻底移除）。
- **CI/CD**：`.github/workflows/bun.yml` 执行类型/格式检查与 bundle/exe 构建；`.github/workflows/deploy.yml` 在推送 `desktop` 分支时触发 `scripts/prepare-context7.ts` + `scripts/sync-context7.ts` 部署文档产物至 `context7` 分支，并触发 `scripts/sync-main.ts`（合并 `.gitignore-main-append`、排除 `data/`、以 `RainPPR <PPR2125773894@163.com>` 为 author 且 GitHub Actions bot 为 co-author）同步至 `main` 分支。



## ⚠️ 严禁事项（强制执行）

### 包管理器
- **必须使用 bun**：所有依赖安装、脚本运行必须使用 `bun`，**严禁使用 npm 或 pnpm**。

### 文档同步更新
- **修改代码后必须同步更新文档**：任何代码变更完成后，必须立即检查并更新相关文档（AGENTS.md, README.md, docs/*）。
- **严格代码-文档分离**：当任务仅要求基于代码分析更新文档时，未经明确许可不得修改任何源代码文件。

### 代码质量
- **禁止使用三元表达式**：必须使用标准的 `if/else` 块。
- **配置一致性**：不得为了绕过错误而修改 `tsconfig.json`。
