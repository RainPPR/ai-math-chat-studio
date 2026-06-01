# 项目架构概览

## 项目名称
**AI Math & Chat Studio** — 多会话 AI 聊天工具，支持数学计算、KaTeX 渲染和多供应商接入。

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React SPA)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Sidebar  │  │ ChatArea │  │ Settings │  │ Markdown│ │
│  │          │  │          │  │  Modal   │  │ Renderer│ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│         │              │              │                  │
│  ┌──────────────────────────────────────────────────┐   │
│  │              App.tsx (状态管理中心)                │   │
│  └──────────────────────────────────────────────────┘   │
│         │                                               │
│  ┌──────────────────┐                                   │
│  │   src/lib/api.ts  │  统一 API 客户端                  │
│  │  (REST + SSE)     │                                   │
│  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────┐
│           Express 5 Server (server/app.ts)                │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Routes:                                            │ │
│  │  GET/PUT    /api/settings                           │ │
│  │  GET/DELETE /api/sessions, /api/sessions/:id        │ │
│  │  POST       /api/sessions/:id/messages              │ │
│  │  GET(SSE)   /api/sessions/:id/generation            │ │
│  │  DELETE      /api/sessions/:id/generation (stop)     │ │
│  │  POST       /api/sessions/:id/retry                 │ │
│  │  POST       /api/sessions/:id/continue              │ │
│  │  GET        /api/providers                          │ │
│  │  GET        /api/providers/:id/models               │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │  Services:                                          │ │
│  │  GenerationManager — 生成任务生命周期管理             │ │
│  ├─────────────────────────────────────────────────────┤ │
│  │  Providers:                                         │ │
│  │  config.ts — 提供商配置、环境变量解析、模型列表       │ │
│  │  stream.ts — 流式 API 调用（OpenAI 兼容 + Gemini）   │ │
│  │  tools.ts  — 数学工具定义与执行                      │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────┐
│   /data/ 目录         │
│  - settings.json     │
│  - sessions/*.json   │
└──────────────────────┘
         │
         ▼
┌──────────────────────┐
│   外部 AI 供应商 API   │
│  - Google Gemini     │
│  - Nvidia            │
│  - Cloudflare        │
│  - AIHubMix          │
│  - Poe               │
│  - Opengateway       │
└──────────────────────┘
```

## 核心设计变化（Phase 3 重构）

1. **后端驱动生成**：所有生成任务由 `GenerationManager` 管理，前端关闭不影响后台生成
2. **Provider/Model 分离**：用户配置模型池（ModelPool），选择活跃模型，所有参数随模型存储
3. **统一 API 客户端**：`src/lib/api.ts` 替代了所有旧的供应商客户端文件
4. **模块化后端**：`server/` 目录分离 providers、routes、services
5. **SSE 订阅**：前端通过 `EventSource` 订阅生成进度，支持断线重连

## 数据存储

- 数据通过 Express 服务端 REST API 读写本地 JSON 文件
- 设置存储在 `/data/settings.json`
- 会话存储在 `/data/sessions/{id}.json`（每个会话一个文件）
- 无认证，单用户本地应用

## 数据流

### 消息发送流程
```
用户输入 → handleSendMessage()
  ├── 创建/更新 ChatSession（乐观更新 UI）
  ├── POST /api/sessions/:id/messages（后端接收）
  │     ├── GenerationManager.sendMessage()
  │     ├── 写入用户消息到 JSON 文件
  │     └── startGeneration() 启动生成任务
  └── 前端 SSE 订阅 /api/sessions/:id/generation
        ├── delta 事件 → 实时更新流式内容
        ├── tool_call 事件 → 显示工具调用
        └── done/error/stopped 事件 → 刷新会话数据
```

### Tool Calling 循环
```
1. GenerationManager 调用 streamChat()
2. stream.ts 根据 providerId 选择 Gemini 或 OpenAI 兼容模式
3. AI 返回 tool_call（如 evaluate_expression）
4. server/providers/tools.ts 执行数学计算
5. 结果作为 tool message 返回给 AI
6. AI 继续生成直到无更多工具调用
7. 最终内容保存到 JSON 文件，通知所有 SSE 订阅者
```

## 核心设计决策

1. **服务端代理模式**：所有供应商通过 Express 服务端代理，避免前端暴露 API Key
2. **后端驱动生成**：`GenerationManager` 管理任务生命周期，支持并发、断线续传
3. **SSE 订阅机制**：前端通过 `EventSource` 实时接收生成进度
4. **思考过程包装**：所有供应商的 reasoning/thinking 内容统一包装为 `<details>` HTML 标签
5. **上下文窗口限制**：保留最近 40 条消息以控制 token 消耗
6. **模型池架构**：用户可配置多个模型，每个模型独立设置参数和工具权限
7. **文档同步**：修改代码/架构时必须同步更新 `docs/` 和 `AGENTS.md`（详见 AGENTS.md 顶部规则）
