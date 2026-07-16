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

> 用户可自行添加任意数量的 `openai-compatible` 提供商实例。
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

- **`server/providers/stream.ts`** — 流式 API 调用
  - `streamChat()` — 统一入口，根据 `providerType` 分发到三种流式函数
  - `streamGoogle()` — Google Gemini 专用流式调用（使用 `@google/genai`）
  - `streamNvidia()` — Nvidia NIM 流式调用（OpenAI SDK）
  - `streamOpenAICompatible()` — 通用 OpenAI 兼容流式调用，支持 `reasoning_effort` 自动重试机制（若未显式指定级别，会从 `max` -> `xhigh` -> `high` 依次尝试请求，每个级别失败后重试一次。若抛出 401、403、404 等严重配置或不存在错误，则立即停止并向上抛出；若抛出与 `reasoning_effort` 相关的 400 或 422 错误，则立刻停止重试尝试并直接回退调用无 `reasoning_effort` 参数的模型流；若检测到 429 速率限制，也会立即向上抛出错误以提升用户体验）
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
  - Thinking Level 配置（minimal/low/medium/high）
  - `includeThoughts: true` 确保思考过程可见
  - 流式响应 + 思考过程分段（`part.thought` 标记）
```

### AI 供应商集成文档 / Nvidia NIM

```text
- **SDK**：OpenAI SDK
- **Base URL**：`https://integrate.api.nvidia.com/v1`
- **特殊功能**：支持 `extraBody` 透传（如 `chat_template_kwargs`）
- **推理过程**：通过 `delta.reasoning` 或 `delta.reasoning_content` 字段检测
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

    subgraph ChatArea Children
        MessageItem[MessageItem]
    end

    subgraph MessageItem Children
        MarkdownRenderer[MarkdownRenderer.tsx]
    end

    subgraph SettingsModal Children
        ProviderEditor[ProviderEditor]
        ModelEditor[ModelEditor]
    end

    ChatArea --> MessageItem
    MessageItem --> MarkdownRenderer
    SettingsModal --> ProviderEditor
    SettingsModal --> ModelEditor
```

### 组件结构文档 / `App.tsx` — 状态管理中心

```text
**职责**:

*   **状态中心**: 作为整个应用的顶层组件，管理所有核心状态。
*   **数据获取**: 在应用启动时，通过 `api.ts` 从后端获取初始设置和会话数据。
*   **状态管理**: 管理会话列表 (`sessions`)、当前会话 (`currentSessionId`)、用户设置 (`settings`)、以及全局 UI 状态（如 `isSettingsOpen`）。
*   **业务逻辑**: 实现核心业务逻辑，如新建/删除会话、发送/重试消息，并将这些函数作为 props 传递给子组件。
*   **持久化**: 调用 `api.ts` 中的函数将变更（如保存设置、发送消息）持久化到后端。
```

### 组件结构文档 / `Sidebar.tsx` — 左侧栏

```text
**职责**:

*   **会话列表**: 显示所有聊天会话，按更新时间排序。
*   **分类过滤**: 在会话列表上方提供角色选择器，允许用户按 Character 过滤显示的会话。
*   **加星功能 (Starring)**: 允许用户给每个会话进行加星标记，并提供黄、红、蓝、绿、橙五种预设星星颜色。加星数据保存在 `settings.json` 的 `starredSessions` 映射中。
*   **置顶快速访问 (Starred Sections)**: 当有被加星的会话存在时，在侧边栏最顶端显示一个单独的、可折叠的“已加星会话”分组，保证极高的数据查看和切换效率。
*   **用户交互**: 允许用户切换会话、新建会话、复制会话、删除会话、加星会话。
*   **导航**: 提供打开设置模态框的入口。
```

### 组件结构文档 / `ChatArea.tsx` — 聊天主区域

```text
**职责**:

*   **消息显示**: 渲染当前会话的消息列表，包括用户消息和 AI 回复。
*   **SSE 订阅**: 这是处理实时响应的核心。它通过 `api.subscribeGeneration` 订阅后端 SSE 端点，并根据接收到的事件 (`delta`, `done`, `error`, `stopped`) 实时更新 `streamingContent` 状态。
*   **输入处理**: 管理用户输入框，支持 `Ctrl+Enter` 发送和 `Shift+Enter` 换行。
*   **交互操作**: 提供停止生成、导出聊天记录等功能。支持手动修改当前会话绑定的 Character（点击标题下方的角色名称）。
*   **快捷选择栏**: 在输入框上方提供浮动栏，允许用户快速切换当前活跃模型和角色。切换后即时保存到 `settings.json`。
```

### 组件结构文档 / `ChatArea.tsx` — 聊天主区域 / `MessageItem` (子组件)

```text
*   **职责**: 渲染单条消息，包括消息内容、头像、以及操作按钮（复制、查看/全屏预览、重试、重新生成、继续）。
*   **思考过程处理**: 解析并渲染 AI 回复中包含的 `<details>` 思考过程块，并提供折叠/展开功能。
*   **消息操作**:
    *   **Copy（复制）**: 复制消息的正文内容。
    *   **View（查看）**: 鼠标悬浮时在消息左侧/右侧（按钮改成竖着并排展示以防错位）显示 👁️ 图标按钮。点击后在页面顶层覆盖一个最大化（填充整个可视页面）的 Markdown 渲染结果遮罩层。如果查看/打印的是模型消息，会往上找到最近的一个用户消息并一同在渲染层中进行“问题”与“回答”拼接显示。支持关闭将其隐藏，并且大遮罩页面支持单独滚动、不与底层页面冲突。
    *   **Print（纯净打印）**: 在 Markdown 渲染结果遮罩层中支持 Ctrl+P 或点击“打印”按钮，通过构建隐藏的 blank iframe 传入打印命令来实现纯净打印，不带有任何多余的前端 UI 插曲。如果打印模型消息，将同时打印上面找到并拼接的最近用户消息。
    *   **Retry（重试）**: 从当前消息往前找到最近的 user 消息，抛弃其后所有内容重新生成。
    *   **Regenerate（重新生成）**: 保留当前 model 消息的 thinking process，删除正文，抛弃后续消息，注入 continue 指令让 AI 基于原有思考继续输出。
    *   **Continue（继续）**: 仅对最后一条 model 消息显示，在会话末尾添加 continue 指令让 AI 继续被中断的输出。
```

### 组件结构文档 / `MarkdownRenderer.tsx` — Markdown 渲染器

```text
**职责**:

*   **Markdown-to-HTML**: 使用 `react-markdown` 将 Markdown 文本安全地转换为 React 组件。
*   **插件管线**: 集成 `remark-*` 和 `rehype-*` 插件生态，以支持 GFM (GitHub Flavored Markdown)、数学公式、化学方程式等高级功能。
*   **数学渲染**: 通过 `remark-math` 和 `rehype-katex` 插件，将 LaTeX 格式的数学公式（`$...$` 和 `$$...$$`）渲染为 HTML 和 CSS。
*   **安全**: 使用 `rehype-sanitize` 清理 HTML，防止 XSS 攻击，同时通过 `rehype-raw` 允许安全的、用于特定功能的 HTML 标签（如 `<details>`)。
```

### 组件结构文档 / `SettingsModal.tsx` — 设置弹窗

```text
**职责**: 提供一个集中的界面，让用户管理应用的所有配置。它被设计为一个包含四个选项卡的模态框。
```

### 组件结构文档 / `SettingsModal.tsx` — 设置弹窗 / General Tab

```text
*   **活跃模型选择**: 允许用户从所有已配置的模型中选择一个作为当前聊天使用的模型。
*   **活跃角色预览**: 显示当前激活的角色名称及其系统提示词摘要（角色管理已移至 Characters tab）。
*   **UI 开关**: 控制各种前端显示效果，如自动滚动、是否折叠思考过程等。
```

### 组件结构文档 / `SettingsModal.tsx` — 设置弹窗 / Providers Tab

```text
*   **供应商管理**: 允许用户添加、编辑、删除 AI 供应商实例 (ProviderInstance)。
*   **连接配置**: 在 `ProviderEditor` 子组件中，用户可以配置供应商类型（Google, Nvidia, OpenAI Compatible）、API Key、Base URL 等连接信息。
```

### 组件结构文档 / `SettingsModal.tsx` — 设置弹窗 / Models Tab

```text
*   **模型管理**: 允许用户添加、编辑、删除模型实例 (ModelInstance)。
*   **参数配置**: 在 `ModelEditor` 子组件中，用户可以将一个模型绑定到一个供应商，并配置其特定参数，如模型 ID、Temperature、Max Tokens 等。


*   **危险区域操作**:
    *   **Claude 格式导出**: 将所有会话数据转换为符合 Claude 官方规范的 JSON 格式并下载，自动处理思考过程块和时间戳精度。
    *   **强制清洗数据**: 移除数据中的废弃字段，保持数据整洁。
```

### 组件结构文档 / `SettingsModal.tsx` — 设置弹窗 / Characters Tab

```text
*   **角色管理**: 允许用户添加、编辑、删除角色 (Character)。每个角色包含名称和系统提示词。
*   **系统提示词迁移**: 原有 `systemPrompt` 字段被迁移为默认角色。后端生成时优先使用 `activeCharacterId` 对应的角色的 `systemPrompt`，若不存在则回退到 `systemPrompt` 字段。
```

### 代码质量与 Lint 规范

```text
本项目执行严格的代码质量检查。所有代码必须通过 ESLint、Prettier 和 TypeScript 的严格模式检查。
```

### 代码质量与 Lint 规范 / 检查工具

```text
- **Lint**: `bun run lint` (eslint)
- **Formatting**: `bun run pretty` (prettier --check)
- **Type Check**: `bun run check` (tsc --noEmit --strict)
```

### 代码质量与 Lint 规范 / 修复工具

```text
- **自动修复 Lint**: `bun run lint:fix`
- **自动修复格式**: `bun run pretty:fix`
```

### 代码质量与 Lint 规范 / 严格修复规则

```text
1. **禁止未使用变量**: 所有的 `unused-vars` 必须移除。如果是 catch 子句中不需要 error 对象，使用 `catch { ... }` (ES2019+)。
2. **禁止未使用的表达式**: 严禁将三元运算符或逻辑表达式作为独立语句使用。应使用标准的 `if/else` 语句。
3. **严格类型检查**: TypeScript 必须处于 `--strict` 模式。严禁无故使用 `@ts-ignore` 或 `@ts-expect-error`。如果第三方库缺少类型或存在上游 Bug，必须在注释中说明原因。
4. **文档同步**: 任何逻辑变更必须同步更新 `AGENTS.md` 和 `docs/` 目录下的相关文档。
```

### 代码质量与 Lint 规范 / 最佳实践 (TypeScript)

```text
- **Make Illegal States Unrepresentable**: 使用辨析联合类型 (Discriminated Unions) 确保状态合法。
- **Runtime Validation**: 对外部数据（API 响应、本地存储）使用 Zod 等工具进行运行时验证。
- **Branded Types**: 对 ID 等原始类型使用 Branded Types 以增强区分度。
- **Exhaustive Checks**: 使用 `never` 类型确保 `switch` 语句处理了所有可能的情况。
```

### 技术栈详情

```text

```

### 技术栈详情 / 前端框架

```text
| 技术 | 版本 |
|---|---|
| React | ^19.2.7 |
| TypeScript | ~6.0.3 |
| Vite | ^8.0.16 |
| Tailwind CSS | ^4.3.1 |
| @tailwindcss/typography | ^0.5.20 |
```

### 技术栈详情 / 后端

```text
| 技术 | 版本 |
|---|---|
| Express | ^5.2.1 |
| tsx | ^4.22.4 |
| OpenAI SDK | ^6.44.0 |
| dotenv | ^17.4.2 |
```

### 技术栈详情 / AI/数学库

```text
| 技术 | 版本 |
|---|---|
| @google/genai | ^2.8.0 |
| KaTeX | ^0.17.0 |
```

### 技术栈详情 / Markdown 渲染管线

```text
| 技术 | 版本 |
|---|---|
| react-markdown | ^10.1.0 |
| remark-math | ^6.0.0 |
| remark-gfm | ^4.0.1 |
| remark-breaks | ^4.0.0 |
| remark-cjk-friendly | ^2.2.0 |
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
| lucide-react | ^1.21.0 |
| motion | ^12.40.0 |
| clsx | ^2.1.1 |
| tailwind-merge | ^3.6.0 |
| uuid | ^14.0.1 |
| unicodeit | ^0.7.5 |
| markdown-to-txt | ^2.0.1 |
```

### 技术栈详情 / 其他依赖 / 标题生成

```text
标题生成使用纯 JavaScript 字符串操作，无需异步：

- **unicodeit**: 将 LaTeX 数学公式转换为 Unicode 字符（如 `\alpha` → `α`)
- **markdown-to-txt**: 清理 Markdown 语法（标题、粗体、链接等）
- 处理流程：替换 `\dfrac` → `\frac` → 处理块级数学 `$$...$$` → 处理行内数学 `$...$` → Markdown 转文本 → 移除剩余 `$` 和 `\`
- 只处理前200个字符，保证极快的处理速度
```

### 技术栈详情 / 开发工具

```text
| 工具 | 用途 |
|---|---|
| Bun | 依赖管理、脚本运行、构建 |
| TypeScript (`tsc --noEmit`) | 类型检查 (`bun run lint`) |
| Vite HMR | 热模块替换 |
```

### 技术栈详情 / 构建命令

```text
bun run dev           # 启动开发服务器（tsx server.ts → Express + Vite 中间件）
bun run build         # Vite 生产构建
bun run preview       # 预览生产构建
bun run build:bundle    # 打包服务端代码为单个 bundle
bun run build:compile  # 使用 Bun 编译为可执行文件
bun run lint          # TypeScript 类型检查
bun run clean         # 清除 dist、dist-server、dist-compile、release 目录
```

### 技术栈详情 / 路径别名

```text
`@/*` 映射到项目根目录，配置在 `tsconfig.json` 和 `vite.config.ts` 中。
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
  thinkingLevel?: string;           // 思考级别（Gemini 专用）
  extraBody?: Record<string, any>;  // 额外请求体（JSON 对象，合并到 API 请求中）
  injectThinkingTemplate?: boolean; // 注入 chat_template_kwargs thinking（Nvidia 用）
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

### 数据模型与存储 / TypeScript 类型定义 / UserSettings（用户设置）

```text
interface UserSettings {
  activeModelId?: string;           // 当前活跃模型的 ModelInstance.id
  activeCharacterId?: string;       // 当前活跃角色的 Character.id
  providers: ProviderInstance[];    // 提供商实例列表
  models: ModelInstance[];          // 模型实例列表
  characters: Character[];          // 角色列表
  systemPrompt: string;             // 全局回退系统提示词（向后兼容）
  renderThinkingAsMarkdown: boolean;
  autoScroll: boolean;
  collapseThinkingFinished: boolean;
  gemmaTrimThinkingSpaces: boolean;
  starredSessions?: Record<string, string>; // 加星会话映射（会话 ID => 星星颜色 ID）
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
数据通过 Express 服务端 REST API 读写本地 JSON 文件：

**文件结构**：

/data/
  settings.json           # UserSettings（单文件）
  sessions/{sessionId}.json  # ChatSession（每会话一个文件）
  log/                    # 日志文件（YYYY-MM-DD.log）

**API 端点**：

- `GET /api/settings` — 读取设置
- `PUT /api/settings` — 写入设置
- `GET /api/sessions` — 列出所有会话
- `GET /api/sessions/:id` — 获取单个会话
- `DELETE /api/sessions/:id` — 删除会话
- `PATCH /api/sessions/:id` — 更新会话元数据（如 characterId）
- `POST /api/sessions/:id/messages` — 发送消息并触发生成
- `GET /api/sessions/:id/generation` — SSE 订阅生成进度
- `DELETE /api/sessions/:id/generation` — 停止生成
- `GET /api/generation-status` — 获取正在运行的会话 ID 列表（页面刷新后恢复状态用）
- `POST /api/sessions/:id/retry` — 重试消息
- `POST /api/sessions/:id/continue` — 继续生成
- `GET /api/providers` — 获取内置提供商类型列表
- `POST /api/providers/:type/models` — 获取指定类型的模型列表（POST 避免在 URL 中传递敏感信息）
```

### 数据模型与存储 / 默认设置

```text
const DEFAULT_SETTINGS: UserSettings = {
  providers: [],
  models: [],
  characters: [],
  systemPrompt: '',
  renderThinkingAsMarkdown: false,
  autoScroll: true,
  collapseThinkingFinished: true,
  gemmaTrimThinkingSpaces: false,
  starredSessions: {},
};

> **设计要点**：所有参数（temperature、maxTokens 等）为 "Unset" 时不传给 API，由供应商使用默认值。已删除 `topP` 参数。
```

### 文件结构

```text
ai-math-chat-studio/
├── .env                      # 环境变量（不提交）
├── .env.example              # 环境变量模板
├── .gitignore
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
├── data/                     # 本地数据存储（不提交）
│   ├── settings.json         # 用户设置
│   ├── sessions/             # 会话数据
│   └── log/                  # 日志数据 (YYYY-MM-DD.log)
├── index.html                # SPA 入口 HTML
├── package.json              # 项目依赖和脚本
├── bun.lock                  # Bun 依赖锁定文件
├── eslint.config.mjs         # ESLint 配置
├── server.ts                 # 入口文件（import 'dotenv/config' + startApp()）
├── server/                   # 后端模块
│   ├── app.ts                # Express 5 应用组装，挂载所有路由
│   ├── vite-helper.ts        # Vite 开发服务器辅助
│   ├── providers/            # AI 供应商相关
│   │   ├── built-in.ts       # 内置提供商类型定义
│   │   ├── config.ts         # 提供商配置解析（apiKey、baseURL）
│   │   └── stream.ts         # 流式 API 调用（Google / Nvidia / OpenAI 兼容）
│   ├── routes/               # API 路由
│   │   ├── settings.ts       # /api/settings GET/PUT
│   │   ├── sessions.ts       # /api/sessions GET/GET/:id/DELETE
│   │   ├── chat.ts           # /api/sessions/:id/messages, generation, retry, continue
│   │   └── models.ts         # /api/providers, /api/providers/:type/models
│   └── services/             # 核心服务
│       ├── generation-manager.ts # GenerationManager：生成任务生命周期、SSE 订阅
│       └── logger.ts             # 日志服务：拦截 console 输出并持久化到 data/log/
├── src/
│   ├── App.tsx               # 主应用组件（状态管理）
│   ├── main.tsx              # React 入口
│   ├── index.css             # Tailwind 导入
│   ├── types.ts              # TypeScript 类型定义
│   ├── vite-env.d.ts         # Vite 类型声明
│   ├── components/
│   │   ├── ChatArea.tsx      # 聊天区域（SSE 订阅 + 消息列表 + 输入框）
│   │   ├── MarkdownRenderer.tsx # Markdown + KaTeX 渲染器
│   │   ├── SettingsModal.tsx # 设置弹窗（4 Tab：General / Providers / Models / Characters）
│   │   └── Sidebar.tsx       # 左侧栏（会话列表）
│   └── lib/
│       ├── api.ts            # 统一 API 客户端（REST + SSE 订阅）
│       └── utils.ts          # cn() 样式合并工具
├── tsconfig.json             # TypeScript 配置
└── vite.config.ts            # Vite 构建配置
```

### 文件结构 / 关键文件说明

```text
| 文件 | 职责 |
|------|------|
| `server.ts` | 入口文件，`import 'dotenv/config'` + `startApp()` |
| `server/app.ts` | Express 5 应用组装，挂载路由，创建 GenerationManager |
| `server/providers/built-in.ts` | 内置 3 种提供商类型定义（google / nvidia / openai-compatible） |
| `server/providers/config.ts` | 提供商配置解析（apiKey、baseURL、envKey） |
| `server/providers/stream.ts` | 流式 API 调用（Google / Nvidia / OpenAI 兼容） |
| `server/services/generation-manager.ts` | **核心服务**：GenerationManager 管理生成任务生命周期、SSE 订阅、并发、取消。 |
| `server/services/logger.ts` | **日志服务**：拦截 console 输出并持久化到 `data/log/`。 |
| `server/routes/chat.ts` | POST messages、GET generation（SSE）、DELETE stop、POST retry/continue |
| `server/routes/settings.ts` | `/api/settings` GET/PUT |
| `server/routes/sessions.ts` | `/api/sessions` GET/GET/:id/DELETE |
| `server/routes/models.ts` | GET `/api/providers`、GET `/api/providers/:type/models` |
| `src/App.tsx` | 状态管理、会话 CRUD、per-session generating 状态 |
| `src/lib/api.ts` | 统一 API 客户端，封装 REST 调用和 SSE 订阅逻辑 |
| `src/components/ChatArea.tsx` | 聊天 UI，通过 `api.ts` 订阅 SSE 事件并更新流式内容 |
| `src/components/SettingsModal.tsx` | 4 Tab 设置（General / Providers / Models / Characters） |
| `src/components/Sidebar.tsx` | 左侧栏 UI，展示会话列表 |
| `src/components/MarkdownRenderer.tsx` | Markdown 渲染管线，集成 KaTeX 和其他插件 |
| `src/types.ts` | TypeScript 接口定义（ProviderInstance, ModelInstance, UserSettings, ChatSession 等） |
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
            S_Logger[logger.ts]
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
        F -- Initializes --> S_Logger

        R_Chat --> S_GenMan
        S_GenMan --> P_Stream
        P_Stream --> P_Config
        P_Config --> P_BuiltIn
    end

    subgraph Data Layer
        subgraph Local Storage (data/)
            Data_Settings[settings.json]
            Data_Sessions[sessions/*.json]
            Data_Logs[log/*.log]
        end
    end

    subgraph External Services
        Ext_Google[Google Gemini API]
        Ext_Nvidia[Nvidia NIM API]
        Ext_OpenAI[OpenAI Compatible API]
    end

    F -- Reads/Writes --> Data_Settings
    F -- Reads/Writes --> Data_Sessions
    F -- Writes --> Data_Logs
    P_Stream -- Calls --> Ext_Google
    P_Stream -- Calls --> Ext_Nvidia
    P_Stream -- Calls --> Ext_OpenAI
```

### 项目架构概览 / 核心设计

```text
1.  **后端驱动生成**：所有 AI 生成任务由后端的 `GenerationManager` 服务管理。这意味着即使用户关闭浏览器或断开连接，生成任务也会在服务器上继续运行，直到完成。

2.  **三级架构 (Provider + Model + Character)**：
    *   **Provider (供应商)**: 定义了如何连接到一个 AI 服务（如 Google, Nvidia）。用户在 `Settings > Providers` 中配置 API Key 和 Base URL 等连接信息。
    *   **Model (模型)**: 定义了要使用的具体模型及其参数（如 `gemini-1.5-pro`, temperature）。每个模型都必须关联一个已配置的供应商实例。
    *   **Character (角色)**: 定义了系统提示词 (System Prompt)。用户可以在 `Settings > Characters` 中创建多个角色（如"代码专家"、"数学导师"），并在聊天时灵活切换。

3.  **统一 API 客户端**：前端通过 `src/lib/api.ts` 与后端通信。这个模块封装了所有的 REST API 调用和 SSE (Server-Sent Events) 订阅逻辑，为上层组件提供了简洁的接口。

4.  **模块化后端**：后端代码（位于 `server/` 目录）被清晰地划分为不同的职责模块：
    *   `routes/`: 定义 Express API 端点。
    *   `services/`: 包含核心业务逻辑，如 `GenerationManager`。
    *   `providers/`: 封装了与外部 AI API 交互的所有逻辑。

5.  **实时日志系统**：系统通过 `server/services/logger.ts` 拦截 `console` 方法（log, info, warn, error），并将日志持久化到 `data/log/`。日志文件名采用 `YYYY-MM-DD.log` 格式，使用 UTC 时间。

6.  **SSE 实时订阅**：前端使用 `EventSource` API 订阅后端的 `/api/sessions/:id/generation` 端点。后端通过这个长连接实时推送 AI 生成的 `delta` (内容块)、`done` (完成)、`error` (错误) 或 `stopped` (停止) 事件，实现了打字机效果和实时状态更新。
```

### 项目架构概览 / 性能优化

```text

```

### 项目架构概览 / 性能优化 / 1. 同步标题生成

```text
**实现**: `generateTitleFromMarkdown()` 使用纯 JavaScript 字符串操作，无需异步：
- 使用 `unicodeit` 将 LaTeX 数学公式转换为 Unicode 字符
- 使用 `markdown-to-txt` 清理 Markdown 语法
- 只处理前200个字符，保证处理速度
- 同步执行，生成后直接保存到 session.json，无需 SSE 通知前端
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
    -   `settings.json`: 存储所有用户配置，包括供应商、模型和通用设置。
    -   `sessions/{id}.json`: 每个聊天会话存储为一个单独的 JSON 文件。
    -   `log/*.log`: 运行日志，记录服务器行为和 AI 调用情况。
- **无认证**: 该应用设计为单用户本地工具，不包含用户认证系统。
```

### 项目架构概览 / 数据流：一次完整的消息交互

```text
1.  **用户发送消息**: 用户在 `ChatArea` 组件的输入框中输入消息，按下 `Ctrl+Enter`。
2.  **前端乐观更新**: `App.tsx` 中的 `handleSendMessage` 被调用。它立即将用户的消息添加到当前会话的 `messages` 数组中，并更新 UI，提供即时反馈。
3.  **API 调用**: `api.ts` 中的 `sendMessage` 函数被调用，向后端 `POST /api/sessions/:id/messages` 发送请求。
4.  **后端接收**: `server/routes/chat.ts` 中的路由处理器接收到请求。
5.  **启动生成**: 后端将用户消息保存到对应的 `session.json` 文件中，然后调用 `GenerationManager` 来启动一个新的 AI 生成任务。
    *   **角色注入**: `GenerationManager` 根据 `activeCharacterId` 获取对应的 `systemPrompt`，并将其作为 System Message 注入到 AI 请求的首位。
6.  **SSE 连接**: 与此同时，前端的 `ChatArea` 组件通过 `useEffect` 自动订阅 `/api/sessions/:id/generation` 的 SSE 端点。
7.  **流式响应**: `GenerationManager` 通过 `stream.ts` 调用相应的 AI Provider API。获取到的数据块被包装成 `delta` 事件，通过 SSE 连接实时发送回前端。
8.  **前端渲染**: `ChatArea` 接收到 `delta` 事件，并将其内容追加到当前正在生成的回复中，用户看到平滑的打字机效果。
9.  **任务结束**: 当 AI 完成生成时，后端发送 `done` 事件。前端接收到后，将最终的完整消息保存到状态中，并清理订阅。
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
  1. 清洗当前消息：保留 `<details><summary>Thinking Process</summary>` 包裹的思考过程，删除正文输出部分
  2. 截断该消息之后的所有消息
  3. 添加 user 指令提示 AI 基于原有思考进行批判性检查并延伸分析，然后生成完整输出
- **适用场景**: AI 的思考过程有价值，但正文输出不完善或需要修正，希望在保留思考基础上深化分析
```

### 项目架构概览 / 消息操作机制 / 3. Continue（继续）

```text
- **触发方式**: 仅最后一条 model 消息上的 "Continue" 按钮
- **实现逻辑**: `GenerationManager.continueGeneration()` 在会话末尾添加 user 指令，明确告知 AI 这是由于网络错误或流中断导致的，并指导 AI 根据当前状态（已开始输出 vs 仍在思考）采取相应行动
- **适用场景**: 网络错误、流中断或 AI 输出被意外截断，需要继续完成未完成的响应
```

### 项目架构概览 / 核心设计决策

```text
-   **服务端代理模式**: 所有对外部 AI API 的调用都通过 Express 后端进行。这确保了 API 密钥永远不会暴露给前端，增强了应用的安全性。
-   **三级架构 (Provider + Model + Character)**: 解耦了 API 连接信息、模型参数和角色指令，极大地提高了灵活性。
-   **思考过程包装**: 为了在 UI 中统一展示不同模型的“思考过程”(reasoning)，所有此类信息在 `GenerationManager` 中被统一包装成一个可折叠的 `<details>` HTML 标签。
-   **上下文窗口限制**: 为控制成本和 API 请求大小，每次生成只向 AI 模型发送最近的 40 条消息历史记录。
-   **文档同步规则**: `AGENTS.md` 中明确规定，任何对代码、架构或数据模型的修改都必须同步更新相关的文档，以保持其准确性。
```

