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
   - 数学工具变更 → `docs/math-tools.md`
   - 文件增删 → `docs/file-structure.md`

**示例**：添加新的 AI 供应商时，需同步更新 `docs/api-providers.md`、`docs/architecture.md`、`docs/file-structure.md`、`AGENTS.md`。

## 项目概述

**AI Math & Chat Studio** 是一个多会话 AI 聊天应用，支持 6 个 AI 供应商（Gemini、Nvidia、Cloudflare、AIHubMix、Poe、Opengateway）+ 自定义供应商，内置数学计算工具（表达式求值、方程求解、求导），并支持 KaTeX 数学公式和 mhchem 化学公式渲染。数据以 JSON 文件形式存储在本地 `/data` 目录。

**文档入口**：`docs/` 目录包含完整的架构、技术栈、组件、数据模型等文档。

## 快速导航

| 需要了解的内容 | 阅读文件 |
|----------------|----------|
| 项目整体架构 | `docs/architecture.md` |
| 技术栈和依赖 | `docs/tech-stack.md` |
| AI 供应商集成方式 | `docs/api-providers.md` |
| 数据模型和存储 | `docs/data-models.md` |
| 组件结构和职责 | `docs/components.md` |
| 数学工具系统 | `docs/math-tools.md` |
| 文件结构 | `docs/file-structure.md` |

## 开发规范

### 代码风格
- **TypeScript 项目**，所有类型定义在 `src/types.ts`
- **React 函数组件**，不使用 class 组件
- **Tailwind CSS** 样式，使用 `cn()` 工具函数（`src/lib/utils.ts`）合并条件样式
- **无注释风格**：代码应自解释，不添加注释（除非必要）
- **ES Module**：项目使用 `"type": "module"`

### 状态管理
- **无外部状态库**：使用 React `useState` + `useEffect` 管理所有状态
- **App.tsx 是状态中心**：所有共享状态和业务逻辑集中在 `App.tsx`
- **乐观更新**：先更新 UI 再通过 `api.settings.save()` / `api.sessions.*` 持久化到服务端 JSON 文件
- **per-session generating**：使用 `Set<string>` 跟踪每个会话的生成状态
- **`isSettingsOpen`**：控制设置弹窗的显示/隐藏
- **`isToolsSidebarOpen`**：控制右侧 Tools Sidebar 的展开/折叠

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

### 1. 添加新的 AI 供应商

遵循以下步骤：

1. **提供商配置**（`server/providers/config.ts`）：
   ```typescript
   // 在 PROVIDERS 数组中添加
   { id: 'newprovider', name: 'New Provider', baseURL: 'https://api.newprovider.com/v1', envKey: 'NEWPROVIDER_API_KEY' }
   ```

2. **流式调用**（`server/providers/stream.ts`）：
   - 如果是 OpenAI 兼容 API，无需额外代码（`streamOpenAI()` 自动处理）
   - 如果需要特殊处理，添加新的流式函数并在 `streamChat()` 中分发

3. **前端自动适配**：
   - `api.providers.list()` 自动获取新供应商
   - SettingsModal 的 Models tab 自动显示新供应商选项
   - 无需修改前端代码

4. **环境变量**：
   - 在 `.env` 和 `.env.example` 中添加新的 API Key

### 2. 思考过程格式统一

所有供应商的 reasoning/thinking 内容统一包装为：
```html
<details>
<summary>Thinking Process</summary>

```text
思考内容...
```

</details>
```

此包装在 `GenerationManager.runGeneration()` 中完成，前端 `ChatArea.tsx` 的 `MessageItem` 负责解析和展示。

### 3. SSE 订阅模式

前端通过 `api.subscribeGeneration()` 订阅生成进度：
```typescript
const unsubscribe = api.subscribeGeneration(sessionId, {
  onDelta: (content) => setStreamingContent(content),
  onToolCall: (name, args, result) => { ... },
  onDone: (content, toolCalls) => { ... },
  onError: (message) => { ... },
  onStopped: () => { ... },
});
return unsubscribe; // useEffect cleanup
```

### 4. Tool Calling 模式

- **Gemini**：`streamGemini()` 内部处理原生 `functionDeclarations` + `functionCalls` + `functionResponse`
- **OpenAI 兼容供应商**：`streamOpenAI()` 返回 `tool_call_delta`，`GenerationManager` 累积参数并执行工具
- **工具执行**：统一在 `server/providers/tools.ts` 的 `executeMathTool()` 中

### 5. 模型池架构

用户在 Settings → Models tab 配置模型：
1. 添加 provider + model → 创建 `ModelPoolEntry`
2. 配置参数（temperature、maxTokens、reasoningEffort 等）
3. 配置工具权限（enableTools、disabledTools）
4. 在 General tab 选择活跃模型

所有参数 "Unset" 时不传给 API（不传默认值）。

## 常见修改场景

### 修改数学工具
- 工具声明和执行：`server/providers/tools.ts`
- 工具配置 UI：`src/components/SettingsModal.tsx`（Tools tab + Models tab 中的工具开关）
- 工具展示：`src/App.tsx` 中的 Tools Sidebar 部分（App.tsx 内联实现，非独立组件）

### 修改 Markdown 渲染
- 渲染管线：`src/components/MarkdownRenderer.tsx`
- 预处理逻辑：同上文件中的 `processedContent` 替换
- KaTeX 配置：`rehype-katex` 选项

### 修改 UI 布局
- 整体布局：`src/App.tsx` 的 `return` 部分（flex 布局）
- 左侧栏：`src/components/Sidebar.tsx`
- 聊天区域：`src/components/ChatArea.tsx`
- 设置弹窗：`src/components/SettingsModal.tsx`

### 修改数据存储
- 数据服务：`src/lib/api.ts`（统一 API 客户端）
- 服务端路由：`server/routes/settings.ts`、`server/routes/sessions.ts`
- 生成管理：`server/services/generation-manager.ts`
- 数据文件：`/data/settings.json`、`/data/sessions/*.json`

### 修改供应商行为
- 提供商配置：`server/providers/config.ts`
- 流式调用逻辑：`server/providers/stream.ts`
- API 路由：`server/routes/chat.ts`、`server/routes/models.ts`

### 修改生成流程
- 核心服务：`server/services/generation-manager.ts`
- SSE 路由：`server/routes/chat.ts`（`GET /api/sessions/:id/generation`）
- 前端订阅：`src/lib/api.ts`（`subscribeGeneration()`）+ `src/components/ChatArea.tsx`

## 环境配置

### 开发
```bash
npm install          # 安装依赖
npm run dev          # 启动开发服务器（tsx server.ts → Express + Vite 中间件）
npm run lint         # TypeScript 类型检查
```

### 环境变量
```env
GEMINI_API_KEY=          # Gemini API Key
NVIDIA_API_KEY=          # 可选，Nvidia API
CLOUDFLARE_API_KEY=      # 可选，Cloudflare
CLOUDFLARE_ACCOUNT_ID=   # 可选，Cloudflare
AIHUBMIX_API_KEY=        # 可选，AIHubMix
POE_API_KEY=             # 可选，Poe
OPENGATEWAY_API_KEY=     # 可选，Opengateway
OPENAI_API_KEY=          # 可选，所有供应商的 API Key 回退
```

> 所有 API Key 通过 dotenv 在 `server.ts` 中加载，前端不暴露任何 Key。
> 当某个供应商的专用 Key 未设置时，会回退到 `OPENAI_API_KEY`。

## 注意事项

1. **不要修改 `vite.config.ts` 中的 HMR 配置**：`DISABLE_HMR` 环境变量用于 AI Studio 环境
2. **路径别名**：`@/*` 映射到项目根目录
3. **上下文限制**：所有供应商只保留最近 40 条消息（在 `stream.ts` 中实现）
4. **AbortController**：`GenerationManager` 支持取消正在进行的生成请求
5. **`server.ts` 是入口文件**：仅 `import 'dotenv/config'` + `startApp()`，实际逻辑在 `server/app.ts`
6. **已删除 topP**：所有位置均不传 topP 参数
7. **所有供应商通过服务端代理**：Gemini 也通过服务端调用（不再前端直连）
