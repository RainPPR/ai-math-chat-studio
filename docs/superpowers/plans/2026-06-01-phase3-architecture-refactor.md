# Phase 3: 架构彻底重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目从"前端驱动AI逻辑"重构为"后端驱动、前端薄客户端"的标准 React 架构。所有 AI 调用、tool calling、math 计算、会话持久化均在后端完成。前端仅通过统一 `/api` 接口通信。支持多窗口并发、断线续传。

**Architecture:**

- 后端拆分为模块化结构：`server/` 目录包含 providers、routes、services
- 引入 `GenerationManager` 管理所有活跃的 AI 生成任务，支持 per-session 并发和 SSE 重连
- 前端删除所有 provider-specific 代码（`src/lib/gemini.ts` 等），统一使用 `src/lib/api.ts`
- 使用 EventSource (SSE) 实现实时流式更新，支持断线自动重连

**Tech Stack:** Express, OpenAI SDK, @google/genai, mathjs, nerdamer, React 19, SSE (EventSource)

---

## 新文件结构

```
├── server.ts                          # 入口，启动服务器（精简为 10 行）
├── server/
│   ├── app.ts                         # Express 应用创建和中间件配置
│   ├── providers/
│   │   ├── types.ts                   # Provider 统一接口类型
│   │   ├── registry.ts                # Provider 注册和分发
│   │   ├── gemini.ts                  # Gemini provider
│   │   ├── openai-compatible.ts       # Nvidia/Cloudflare/AIHubMix/Onerouter 共用
│   │   └── poe.ts                     # Poe provider（支持 tool_calls）
│   ├── services/
│   │   ├── math-tools.ts              # mathjs + nerdamer 工具定义和执行
│   │   └── generation-manager.ts      # 管理活跃生成任务，支持并发和重连
│   └── routes/
│       ├── chat.ts                    # /api/chat/* 路由
│       ├── sessions.ts                # /api/sessions/* 路由
│       ├── settings.ts                # /api/settings/* 路由
│       └── models.ts                  # /api/models/* 路由
├── src/
│   ├── App.tsx                        # 精简后的主组件（~200 行）
│   ├── lib/
│   │   ├── api.ts                     # 统一 API 客户端（替代所有 provider 文件）
│   │   └── utils.ts                   # 保留不变
│   ├── components/
│   │   ├── ChatArea.tsx               # 更新：使用 SSE 接收流式响应
│   │   ├── Sidebar.tsx                # 基本不变
│   │   ├── SettingsModal.tsx          # 更新：通过 API 获取模型列表
│   │   └── MarkdownRenderer.tsx       # 不变
│   └── types.ts                       # 更新：添加 GenerationStatus 类型
```

## 统一 API 设计

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/settings` | GET/PUT | 获取/更新设置 |
| `/api/sessions` | GET/POST | 列表/创建会话 |
| `/api/sessions/:id` | GET/PUT/DELETE | 获取/更新/删除单个会话 |
| `/api/sessions/:id/messages` | POST | 发送消息并触发 AI 生成 |
| `/api/sessions/:id/generation` | GET (SSE) | 订阅生成进度（支持断线重连） |
| `/api/sessions/:id/generation` | DELETE | 停止生成 |
| `/api/models/:provider` | GET | 获取指定供应商的模型列表 |

## 关键设计决策

### 1. GenerationManager（核心服务）

```typescript
// 每个 session 的生成任务独立管理
class GenerationManager {
  private tasks: Map<string, GenerationTask>
  
  // 发起生成（异步，不等待完成）
  start(sessionId, messages, settings): void
  
  // 订阅进度（SSE），支持从断点续传
  subscribe(sessionId, lastEventId): SSEStream
  
  // 停止生成
  stop(sessionId): void
  
  // 查询状态
  getStatus(sessionId): GenerationStatus
}
```

### 2. SSE 事件格式

```
event: delta
data: {"type":"reasoning","content":"thinking..."}

event: delta  
data: {"type":"content","content":"answer..."}

event: delta
data: {"type":"tool_call","name":"evaluate_expression","args":{...},"result":"42"}

event: done
data: {"fullContent":"...","toolCalls":[...]}

event: error
data: {"message":"Error..."}
```

### 3. 前端断线重连

```typescript
// 使用 EventSource 原生支持自动重连
// 通过 Last-Event-ID 从断点继续接收
const es = new EventSource(`/api/sessions/${id}/generation`);
es.onmessage = (e) => { /* 更新 UI */ };
```

---

## Task 1: 创建后端模块化结构 — types 和 math-tools

**Files:**

- Create: `server/providers/types.ts`
- Create: `server/services/math-tools.ts`

- [ ] **Step 1: 创建 server/providers/types.ts**

```typescript
export interface ProviderMessage {
  role: 'user' | 'model' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: any[];
}

export interface ProviderRequest {
  model: string;
  messages: ProviderMessage[];
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  extraBody?: Record<string, any>;
  tools?: any[];
  thinkingLevel?: string;
  disableTools?: boolean;
}

export interface ProviderStreamChunk {
  type: 'reasoning' | 'content' | 'tool_call' | 'error';
  content?: string;
  name?: string;
  args?: any;
  result?: string;
}

export interface ProviderAdapter {
  name: string;
  stream(request: ProviderRequest): AsyncGenerator<ProviderStreamChunk>;
}
```

- [ ] **Step 2: 创建 server/services/math-tools.ts**

将 `src/lib/gemini.ts` 和 `src/lib/poe.ts` 中的 math 工具定义和执行逻辑统一提取到此处。

```typescript
import * as math from 'mathjs';
import nerdamer from 'nerdamer';
import 'nerdamer/Algebra';
import 'nerdamer/Calculus';
import 'nerdamer/Solve';

export const MATH_INSTRUCTIONS = `...`; // 从 gemini.ts 复制

export interface MathToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export const mathToolDefinitions: MathToolDefinition[] = [
  { name: 'evaluate_expression', ... },
  { name: 'solve_equation', ... },
  { name: 'calculate_derivative', ... },
];

export function executeMathTool(name: string, args: any): string {
  // 统一执行逻辑
}
```

- [ ] **Step 3: 运行 TypeScript 检查**

```bash
rtk npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add server/ && git commit -m "feat: add backend module structure - types and math tools"
```

---

## Task 2: 创建 Provider Adapters

**Files:**

- Create: `server/providers/gemini.ts`
- Create: `server/providers/openai-compatible.ts`
- Create: `server/providers/poe.ts`
- Create: `server/providers/registry.ts`

- [ ] **Step 1: 创建 Gemini provider adapter**

将 `src/lib/gemini.ts` 中的 `generateChatResponse` 逻辑迁移到服务端。使用 `@google/genai` SDK，实现 `ProviderAdapter` 接口。

- [ ] **Step 2: 创建 OpenAI-compatible provider adapter**

Nvidia、Cloudflare、AIHubMix、Onerouter 均使用 OpenAI SDK，共用一个 adapter，通过配置 `baseURL` 和 `apiKey` 区分。

- [ ] **Step 3: 创建 Poe provider adapter**

Poe 使用 OpenAI SDK 但支持 tool_calls，单独处理。

- [ ] **Step 4: 创建 provider registry**

```typescript
const providers: Record<string, ProviderAdapter> = {};

export function getProvider(name: string): ProviderAdapter { ... }
export function getProviderModels(name: string): Promise<string[]> { ... }
```

- [ ] **Step 5: TypeScript 检查**

- [ ] **Step 6: Commit**

---

## Task 3: 创建 GenerationManager

**Files:**

- Create: `server/services/generation-manager.ts`

这是整个重构的核心组件。

- [ ] **Step 1: 实现 GenerationManager**

```typescript
interface GenerationTask {
  sessionId: string;
  status: 'running' | 'done' | 'error' | 'stopped';
  accumulatedContent: string;
  toolCalls: ToolCallRecord[];
  subscribers: Set<(event: string, data: any) => void>;
  abortController: AbortController;
  lastEventId: number;
}

class GenerationManager {
  private tasks: Map<string, GenerationTask> = new Map();

  async startGeneration(sessionId: string, messages: ChatMessage[], settings: UserSettings): Promise<void> {
    // 1. 创建 task
    // 2. 异步执行（不 await）
    // 3. 使用 provider adapter 流式处理
    // 4. 处理 tool calling 循环
    // 5. 完成后更新 session 到磁盘
    // 6. 通知所有 subscribers
  }

  subscribe(sessionId: string): ReadableStream {
    // 返回 SSE 流
    // 如果任务已完成，立即发送完整内容
    // 如果任务进行中，实时转发
  }

  stopGeneration(sessionId: string): void {
    // abort 任务
  }

  getStatus(sessionId: string): GenerationStatus | null { ... }
}
```

- [ ] **Step 2: TypeScript 检查**

- [ ] **Step 3: Commit**

---

## Task 4: 创建后端 Routes

**Files:**

- Create: `server/routes/settings.ts`
- Create: `server/routes/sessions.ts`
- Create: `server/routes/chat.ts`
- Create: `server/routes/models.ts`

- [ ] **Step 1: 创建 settings 路由**

从 `server.ts` 中提取 `/api/data/settings` 逻辑。

- [ ] **Step 2: 创建 sessions 路由**

从 `server.ts` 中提取 `/api/data/sessions` 逻辑，添加 `GET /api/sessions/:id` 单个获取。

- [ ] **Step 3: 创建 chat 路由**

```typescript
// POST /api/sessions/:id/messages
// 接收用户消息，保存到 session，触发 GenerationManager.startGeneration()
router.post('/api/sessions/:id/messages', async (req, res) => {
  const { content } = req.body;
  // 1. 读取 session
  // 2. 添加 user message
  // 3. 保存 session
  // 4. 触发 generation（异步，不等待）
  // 5. 返回 202 Accepted
});

// GET /api/sessions/:id/generation
// SSE 订阅生成进度
router.get('/api/sessions/:id/generation', async (req, res) => {
  // 1. 设置 SSE headers
  // 2. 订阅 GenerationManager
  // 3. 流式发送事件
  // 4. 客户端断开时清理订阅
});

// DELETE /api/sessions/:id/generation
// 停止生成
router.delete('/api/sessions/:id/generation', async (req, res) => {
  generationManager.stopGeneration(req.params.id);
  res.json({ ok: true });
});

// POST /api/sessions/:id/retry
// 重试某个消息
// POST /api/sessions/:id/continue
// 继续生成
```

- [ ] **Step 4: 创建 models 路由**

```typescript
// GET /api/models/:provider
router.get('/api/models/:provider', async (req, res) => {
  const models = await getProviderModels(req.params.provider);
  res.json(models);
});
```

- [ ] **Step 5: TypeScript 检查**

- [ ] **Step 6: Commit**

---

## Task 5: 重构 server.ts 入口

**Files:**

- Modify: `server.ts`
- Create: `server/app.ts`

- [ ] **Step 1: 创建 server/app.ts**

将 Express 应用创建、中间件配置、路由挂载、Vite 集成全部放入此文件。

- [ ] **Step 2: 精简 server.ts**

```typescript
import { startApp } from './server/app';
startApp();
```

- [ ] **Step 3: 删除旧的 per-provider 路由**

从 `server.ts` 中删除所有 `/api/nvidia/chat`、`/api/cloudflare/chat` 等路由（已被 `server/routes/chat.ts` 替代）。

- [ ] **Step 4: TypeScript 检查**

- [ ] **Step 5: Commit**

---

## Task 6: 创建前端统一 API 客户端

**Files:**

- Create: `src/lib/api.ts`
- Delete: `src/lib/gemini.ts`, `src/lib/nvidia.ts`, `src/lib/cloudflare.ts`, `src/lib/aihubmix.ts`, `src/lib/poe.ts`, `src/lib/Onerouter.ts`

- [ ] **Step 1: 创建 src/lib/api.ts**

```typescript
export async function fetchSettings(): Promise<UserSettings | null> { ... }
export async function saveSettings(settings: UserSettings): Promise<void> { ... }
export async function fetchSessions(): Promise<ChatSession[]> { ... }
export async function fetchSession(id: string): Promise<ChatSession> { ... }
export async function createSession(session: ChatSession): Promise<void> { ... }
export async function updateSession(session: ChatSession): Promise<void> { ... }
export async function deleteSession(id: string): Promise<void> { ... }
export async function sendMessage(sessionId: string, content: string): Promise<void> { ... }
export function subscribeGeneration(sessionId: string, callbacks: {
  onReasoning?: (content: string) => void;
  onContent?: (content: string) => void;
  onToolCall?: (name: string, args: any, result: string) => void;
  onDone?: (fullContent: string, toolCalls: ToolCallRecord[]) => void;
  onError?: (message: string) => void;
}): () => void { ... }  // 返回 unsubscribe 函数
export async function stopGeneration(sessionId: string): Promise<void> { ... }
export async function fetchModels(provider: string): Promise<string[]> { ... }
export async function retryMessage(sessionId: string, messageId: string): Promise<void> { ... }
export async function continueGeneration(sessionId: string): Promise<void> { ... }
```

- [ ] **Step 2: 删除旧的 provider 客户端文件**

- [ ] **Step 3: TypeScript 检查**

- [ ] **Step 4: Commit**

---

## Task 7: 更新 types.ts

**Files:**

- Modify: `src/types.ts`

- [ ] **Step 1: 添加 GenerationStatus 类型**

```typescript
export interface GenerationStatus {
  status: 'idle' | 'running' | 'done' | 'error' | 'stopped';
  accumulatedContent?: string;
  toolCalls?: ToolCallRecord[];
}
```

- [ ] **Step 2: TypeScript 检查**

- [ ] **Step 3: Commit**

---

## Task 8: 重构 App.tsx

**Files:**

- Modify: `src/App.tsx`

这是前端改动最大的文件。需要：

1. 删除所有 provider-specific 导入和逻辑
2. 删除 `runLLM` 函数
3. 使用新的 `api.ts` 替代 `dataService.ts`
4. 简化状态管理

- [ ] **Step 1: 重写 App.tsx**

```typescript
// 核心变化：
// 1. 删除所有 generate* 导入
// 2. 使用 api.ts 中的函数
// 3. sendMessage 只调用 API，不直接处理 SSE
// 4. ChatArea 组件内部通过 subscribeGeneration 接收流式更新
// 5. isGenerating 从全局状态改为 per-session 状态

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [generatingSessions, setGeneratingSessions] = useState<Set<string>>(new Set());

  // 初始化加载
  useEffect(() => { loadData(); }, []);

  // 加载模型列表
  useEffect(() => {
    if (settings.provider) {
      fetchModels(settings.provider).then(setModels);
    }
  }, [settings.provider]);

  const handleSendMessage = async (content: string) => {
    // 1. 确保 session 存在
    // 2. 调用 api.sendMessage(sessionId, content)
    // 3. ChatArea 内部会自动订阅 SSE
  };

  const handleStop = async (sessionId: string) => {
    await api.stopGeneration(sessionId);
  };

  const handleGenerationStart = (sessionId: string) => {
    setGeneratingSessions(prev => new Set(prev).add(sessionId));
  };

  const handleGenerationEnd = (sessionId: string) => {
    setGeneratingSessions(prev => {
      const next = new Set(prev);
      next.delete(sessionId);
      return next;
    });
    // 重新加载 session 数据
    api.fetchSession(sessionId).then(updated => {
      setSessions(prev => prev.map(s => s.id === sessionId ? updated : s));
    });
  };

  // ... 精简后的 JSX
}
```

- [ ] **Step 2: TypeScript 检查**

- [ ] **Step 3: Commit**

---

## Task 9: 重构 ChatArea 组件

**Files:**

- Modify: `src/components/ChatArea.tsx`

- [ ] **Step 1: 更新 ChatArea 使用 SSE 订阅**

```typescript
// 核心变化：
// 1. 组件内部管理 streamingContent 状态
// 2. 当 session 切换时，通过 SSE 订阅获取最新生成状态
// 3. 支持 per-session generating 状态

export const ChatArea: React.FC<ChatAreaProps> = ({
  session, onSendMessage, settings, onStop, onRetry, onContinue,
  generatingSessions, onGenerationStart, onGenerationEnd
}) => {
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCallRecord[]>([]);
  const isGenerating = session ? generatingSessions.has(session.id) : false;

  // 订阅生成进度
  useEffect(() => {
    if (!session || !isGenerating) {
      setStreamingContent('');
      setStreamingToolCalls([]);
      return;
    }

    const unsubscribe = api.subscribeGeneration(session.id, {
      onContent: (content) => setStreamingContent(content),
      onReasoning: (content) => setStreamingContent(prev => prev + content),
      onToolCall: (name, args, result) => {
        setStreamingToolCalls(prev => [...prev, { name, args, result }]);
      },
      onDone: () => {
        setStreamingContent('');
        setStreamingToolCalls([]);
        onGenerationEnd(session.id);
      },
      onError: () => {
        setStreamingContent('');
        onGenerationEnd(session.id);
      },
    });

    return unsubscribe;
  }, [session?.id, isGenerating]);

  // 渲染时，如果正在生成，显示 streamingContent 作为最后一条消息
  // ...
};
```

- [ ] **Step 2: TypeScript 检查**

- [ ] **Step 3: Commit**

---

## Task 10: 重构 SettingsModal 组件

**Files:**

- Modify: `src/components/SettingsModal.tsx`

- [ ] **Step 1: 更新模型列表获取方式**

删除所有 `fetchNvidiaModels`、`fetchCloudflareModels` 等导入，统一使用 `api.fetchModels(provider)`。

- [ ] **Step 2: TypeScript 检查**

- [ ] **Step 3: Commit**

---

## Task 11: 清理旧代码和更新配置

**Files:**

- Delete: `src/lib/dataService.ts`
- Modify: `package.json`（如果需要）
- Modify: `vite.config.ts`（删除 `process.env.GEMINI_API_KEY` define，因为不再需要在前端暴露）

- [ ] **Step 1: 删除 dataService.ts**

- [ ] **Step 2: 更新 vite.config.ts**

移除 `define: { 'process.env.GEMINI_API_KEY': ... }`，因为 Gemini 调用现在完全在后端。

- [ ] **Step 3: 验证所有导入正确**

- [ ] **Step 4: TypeScript 检查**

- [ ] **Step 5: Commit**

---

## Task 12: 端到端测试和修复

- [ ] **Step 1: 启动开发服务器，验证所有功能**

```bash
npm run dev
```

测试清单：

- [ ] 创建新对话
- [ ] 发送消息（Gemini provider）
- [ ] 观察流式响应
- [ ] 验证 tool calling（数学工具）
- [ ] 切换到其他 provider
- [ ] 保存/加载设置
- [ ] 多窗口同时使用
- [ ] 刷新页面后生成继续
- [ ] 停止生成
- [ ] 重试/继续功能
- [ ] 删除对话

- [ ] **Step 2: 修复发现的问题**

- [ ] **Step 3: TypeScript 检查**

```bash
rtk npx tsc --noEmit
```

- [ ] **Step 4: 最终 Commit**

---

## 实现顺序

1. **Task 1-2**: 后端基础设施（types, math-tools, providers）
2. **Task 3**: GenerationManager（核心）
3. **Task 4-5**: 后端 routes 和 app 组装
4. **Task 6-7**: 前端 API 客户端和类型
5. **Task 8-10**: 前端组件重构
6. **Task 11-12**: 清理和测试

每个 Task 完成后都应该能独立编译通过。
