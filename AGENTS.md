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

**AI Math & Chat Studio** 是一个多会话 AI 聊天应用，内置 3 种提供商类型（Google Gemini、Nvidia NIM、OpenAI Compatible），支持提供商 and 模型的分离配置，以及 KaTeX 数学公式和 mhchem 化学公式渲染。数据以 JSON 文件形式存储在本地 `/data` 目录。

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

### 1. 三级架构 (Provider + Model + Character)

用户在 Settings 中分三级配置：

**Providers tab**：
- 添加/管理提供商实例（Google / Nvidia / OpenAI Compatible）。
- 配置每个提供商的 API Key、Base URL、Env Key Prefix。

**Models tab**：
- 选择关联的提供商实例。
- 配置模型参数（temperature、maxTokens、reasoningEffort、thinkingLevel 等）。
  - **OpenAI Compatible**：支持设置 `reasoningEffort` (包括 `max`, `xhigh`, `high`, `medium`, `low`, `minimal`, `none`)。
  - **自动试错机制**：对于 **OpenAI Compatible** 供应商，当 `reasoningEffort` 未指定时，流式生成器会采用级联回退机制，依次尝试以 `max` -> `xhigh` -> `high` 强度调用（每个层级失败后重试一次/最多尝试两次），若均失败，最终退回无 `reasoning_effort` 参数调用。特别地：
    - 若抛出 401、403、404 等严重配置或模型不存在错误，则立即停止并向上抛出。
    - 若抛出与 `reasoning_effort` 相关的 400 或 422 错误，则立刻停止重试尝试并直接回退调用无 `reasoning_effort` 参数的模型流。
    - 若检测到请求过快或速率限制 (429/rate-limit)，为保证效率不进行后面的尝试，直接向用户抛出错误。
  - **Nvidia NIM**：Nvidia NIM 供应商不走 `reasoningEffort` 自动尝试级联机制。在未显式设置时，默认不注入该参数；但若显式指定了 `reasoningEffort`（如 Kimi K2.6），则会直接遵循并注入该配置。

**Characters tab**：
- 创建/管理角色（名称 + 系统提示词）。
- 角色对应不同的 AI 人格和系统级指令。

**快捷切换（ChatArea 浮动栏）**：
- 在聊天输入框上方提供浮动栏，可快速切换当前活跃模型和角色。

### 2. 思考过程格式统一

所有供应商的 reasoning/thinking 内容统一包装为：

```html
<details>
<summary>Thinking Process</summary>

​```text
思考内容...
​```

</details>
```

此包装在 `GenerationManager.runGeneration()` 中完成。

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

### 5. 消息操作架构

| 操作 | 使用场景 |
|------|----------|
| **Retry** | 对某条回复完全不满意，完全重来 |
| **Regenerate** | 基于原有思考深化分析、修正正文输出 |
| **Continue** | 网络错误、流中断导致的不完整响应 |

### 6. 消息查看与纯净打印功能 (Message View & Pure Print Overlay)

- **最大化 Markdown 预览层 (Maximize View Overlay)**: 鼠标悬停在用户消息或 AI 模型消息上时，在“复制”按钮旁边会显示 👁️ (查看) 图标。点击后将展示覆盖整个可视区域的 `bg-gray-950` 底色全屏层，其具有 `prose-lg md:prose-xl text-gray-100` 等放大的字体样式，并锁死底层页面的滚动。
- **劫持系统 Ctrl+P 与纯净打印**: 在预览层中，支持键盘按下 Ctrl+P 或点击“打印”按钮进行打印。系统会拦截默认的 Ctrl+P 行为，动态创建隐藏的 `iframe` 并传入纯净的 blank 页面。将所有的 CSS/KaTeX 样式与要打印的 HTML 片段拷贝至其中并直接执行打印指令。保证打印结果完全干净、无任何不相关的 UI 干扰。

### 7. 动态 KaTeX 数学字体选择 (Dynamic KaTeX Math Font Selection)

- **字体预设与路径**: 系统在 `src/types.ts` 中定义了 `KATEX_FONTS` 数组，支持 Default, Euler Math, Fira Math, 和 Cambria Math。源字体（OTF/TTF）与转换后的 WOFF2 字体资源存放于 `src/fonts/`。
- **动态样式应用**: 活跃的字体类会通过模板字面量 `` `katex-font-${settings.katexFont || 'default'}` `` 动态拼接，并直接应用到 `App.tsx` 根 layout 以及 `ChatArea.tsx` 内的纯净打印 iframe 页面上，以确保更换字体无刷新渲染且打印字体一致。
- **CJK 中文字体优雅降级**: 在自定义数学字体渲染时，为防止中文（`.cjk_fallback` 类）被衬线/无衬线数学符号字体异常覆盖或变畸，在 `src/index.css` 内为各类字体专门追加了高优先级的 `.cjk_fallback` 及它的子元素覆盖处理器，强制它们回退并使用网页正文字体 (`system-ui, sans-serif`)。

### 8. 聊天自动填入模板架构 (Chat Auto-fill Templates)

- **存储路径**: 模板数据不编码在前端中，而是以标准的 JSON 数组格式持久化保存在 `/data/templates.json` 中。
- **API 集成**: 服务端通过 `GET /api/templates` 和 `PUT /api/templates` 路由实现模板数据的读取与存储。前端在 `App` 启动时拉取并注入 `ChatArea` 及设置模态框中。
- **模态框管理 (Templates Tab)**: `SettingsModal.tsx` 提供一个专用的 "Templates" 选项卡，允许用户在图形界面中进行添加、编辑、删除以及在列表中上下移动（Reorder）等完整操作，极大地改善了模板配置的可维护性和易用性。

## ⚠️ 严禁事项（强制执行）

### 包管理器
- **必须使用 bun**：所有依赖安装、脚本运行必须使用 `bun`，**严禁使用 npm 或 pnpm**。

### 文档同步更新
- **修改代码后必须同步更新文档**：任何代码变更完成后，必须立即检查并更新相关文档（AGENTS.md, README.md, docs/*）。

### 代码质量
- **禁止使用三元表达式**：必须使用标准的 `if/else` 块。
- **配置一致性**：不得为了绕过错误而修改 `tsconfig.json`。
