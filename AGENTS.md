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
| 代码质量与 Lint 规范 | `docs/linting-and-quality.md` |
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

## ⚠️ 严禁事项（强制执行）

### 包管理器
- **必须使用 bun**：所有依赖安装、脚本运行必须使用 `bun`，**严禁使用 npm 或 pnpm**。

### 文档同步更新
- **修改代码后必须同步更新文档**：任何代码变更完成后，必须立即检查并更新相关文档（AGENTS.md, README.md, docs/*）。

### 代码质量
- **禁止使用三元表达式**：必须使用标准的 `if/else` 块。
- **配置一致性**：不得为了绕过错误而修改 `tsconfig.json` 或 `.eslintrc.json`。
