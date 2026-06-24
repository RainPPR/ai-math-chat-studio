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

新架构下有两种方式添加供应商：

**方式一：配置 OpenAI 兼容实例（推荐）**
1. 打开 Settings → Providers tab
2. 点击 Add Provider，选择类型 `openai-compatible`
3. 填写名称、Base URL、API Key
4. 在 Models tab 中添加绑定到该提供商的模型

**方式二：添加内置类型（需要代码修改）**
1. **`server/providers/built-in.ts`**：添加新的内置类型定义
   ```typescript
   'new-type': { type: 'new-type', name: 'New Name', defaultBaseURL: '...', defaultEnvKey: 'ENV_KEY' }
   ```
2. **`server/providers/stream.ts`**：添加独立的流式函数
3. **`server/routes/models.ts`**：添加该类型的模型列表获取逻辑
4. 前端自动适配：SettingsModal 无需修改，类型自动出现在下拉框中

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

此包装在 `GenerationManager.runGeneration()` 中完成，前端 `ChatArea.tsx` 的 `MessageItem` 负责解析和展示。

#### 非标准思考格式转录

部分免费 API 平台返回非标准思考格式，以 `Thinking...` 开头，后续连续以 `>` 开头的行为思考内容：

```
Thinking...
> 用户要求比较 $ab, b, e^b$ 的大小...
> 1. $a, b \in \mathbb{R}$
...
```

处理流程：
1. **前端实时检测（补丁式）**：`ChatArea.tsx` 的 `convertNonStandardThinkingForDisplay()` 在消息展示时检测非标准格式，确保流式传输过程中用户看到的也是正确的折叠格式
2. **后端归档转换**：`GenerationManager.convertNonStandardThinking()` 在生成完成后将整个响应转换为标准格式存储到 JSON
3. **存储和展示一致**：刷新页面后从 JSON 读取的内容已经是标准格式，不再需要转换

### 3. SSE 订阅模式

前端通过 `api.subscribeGeneration()` 订阅生成进度：

```typescript
const unsubscribe = api.subscribeGeneration(sessionId, {
  onDelta: (content) => setStreamingContent(content),
  onDone: (content) => { ... },
  onError: (message) => { ... },
  onStopped: () => { ... },
});
return unsubscribe; // useEffect cleanup
```

### 4. SSE 流式协议

前端通过 `EventSource` 订阅 `/api/sessions/:id/generation`，服务端发送以下事件：
- `delta` — 内容更新
- `done` — 生成完成
- `error` — 错误
- `stopped` — 已停止

### 5. Provider + Model + Character 分离架构

用户在 Settings 中分三级配置：

**Providers tab**：
1. 添加/管理提供商实例（Google / Nvidia / OpenAI Compatible）
2. 配置每个提供商的 API Key、Base URL、Env Key Prefix

**Models tab**：
1. 选择关联的提供商实例
2. 配置模型参数（temperature、maxTokens、reasoningEffort 等）
3. 选择活跃模型

**Characters tab**：
1. 创建/管理角色（名称 + 系统提示词）
2. 角色对应不同的 AI 人格和系统级指令

**快捷切换（ChatArea 浮动栏）**：
- 在聊天输入框上方提供浮动栏，可快速切换当前活跃模型和角色
- 切换后即时保存到 `settings.json`

**General tab**：
- 显示当前活跃角色预览
- 控制 UI 开关（自动滚动、折叠思考过程等）

所有参数 "Unset" 时不传给 API（不传默认值）。

### 6. 消息操作架构

三种消息操作的区别和使用场景：

| 操作 | 作用对象 | 行为 | 使用场景 |
|------|----------|------|----------|
| **Retry** | 每条 model 消息 | 找到该消息前面最近的 user 消息，抛弃其后所有内容重新生成 | 对某条回复不满意，完全重来 |
| **Regenerate** | 每条 model 消息 | 保留该消息的 thinking process，删除正文，抛弃其后消息，注入 continue 指令继续生成 | 基于原有思考深化分析、修正正文输出 |
| **Continue** | 仅最后一条 model 消息 | 在会话末尾添加 continue 指令，让 AI 继续被中断的输出 | 网络错误、流中断导致的不完整响应 |

**Regenerate 实现细节**：
- 清洗逻辑：提取 `<details><summary>Thinking Process</summary>` 包裹的内容，删除正文部分
- Prompt 工程：指导 AI 基于原有思考进行批判性检查，识别并填补思考中的缺陷，然后生成完整输出
- 代码位置：`server/services/generation-manager.ts` 中的 `regenerateMessage()`

## 常见修改场景

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
- 服务端路由：`server/routes/settings.ts`、`server/routes/sessions.ts`、`server/routes/chat.ts`、`server/routes/models.ts`
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
bun install          # 安装依赖
bun run dev          # 启动开发服务器（tsx server.ts → Express + Vite 中间件）
bun run lint         # TypeScript 类型检查
```

### 环境变量

```env
GEMINI_API_KEY=          # Google Gemini API Key
NVIDIA_API_KEY=          # Nvidia NIM API Key
OPENAI_API_KEY=          # 通用回退（所有 OpenAI 兼容供应商）
```

> 所有 API Key 通过 dotenv 在 `server.ts` 中加载，前端不暴露任何 Key。
> 优先级：Providers 配置中的 API Key > 配置中的 Env Key 对应的环境变量 > 供应商默认环境变量（如 `GEMINI_API_KEY`）> `OPENAI_API_KEY` 回退。

## 注意事项

1. **不要修改 `vite.config.ts` 中的 HMR 配置**：`DISABLE_HMR` 环境变量用于 AI Studio 环境
2. **路径别名**：`@/*` 映射到项目根目录
3. **上下文限制**：所有供应商只保留最近 40 条消息（在 `stream.ts` 中实现）
4. **AbortController**：`GenerationManager` 支持取消正在进行的生成请求
5. **`server.ts` 是入口文件**：仅 `import 'dotenv/config'` + `startApp()`，实际逻辑在 `server/app.ts`
6. **已删除 topP**：所有位置均不传 topP 参数
7. **所有供应商通过服务端代理**：Gemini 也通过服务端调用（不再前端直连）

## ⚠️ 严禁事项（强制执行）

### 包管理器
- **必须使用 bun**：所有依赖安装、脚本运行必须使用 `bun`，**严禁使用 npm 或 pnpm**
- 正确示例：`bun install express-rate-limit`、`bun run dev`、`bun run lint`
- 错误示例：`npm install express-rate-limit` ❌、`pnpm install express-rate-limit` ❌

### 文档同步更新
- **修改代码后必须同步更新文档**：任何代码变更完成后，必须立即检查并更新相关文档
- **AGENTS.md**：修改影响架构、开发规范、注意事项时必须更新
- **docs/**：根据变更类型更新对应文档（架构→architecture.md、依赖→tech-stack.md、AI供应商→api-providers.md、数据模型→data-models.md、组件→components.md、文件结构→file-structure.md）
- **未更新文档视为任务未完成**
