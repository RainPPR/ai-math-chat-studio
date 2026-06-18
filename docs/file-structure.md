# 文件结构

```
ai-math-chat-studio/
├── .env                      # 环境变量（不提交）
├── .env.example              # 环境变量模板
├── .gitignore
├── AGENTS.md                 # AI 开发指导文件
├── docs/                     # 项目文档
│   ├── architecture.md       # 架构概览
│   ├── api-providers.md      # AI 供应商集成
│   ├── components.md         # 组件结构
│   ├── data-models.md        # 数据模型
│   ├── tech-stack.md         # 技术栈
│   └── file-structure.md     # 本文件
├── data/                     # 本地数据存储（不提交）
│   ├── settings.json         # 用户设置
│   └── sessions/             # 会话数据
├── index.html                # SPA 入口 HTML
├── package.json              # 项目依赖和脚本
├── bun.lockb                 # Bun 依赖锁定文件
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
│       └── generation-manager.ts # GenerationManager：生成任务生命周期、SSE 订阅
├── src/
│   ├── App.tsx               # 主应用组件（状态管理）
│   ├── main.tsx              # React 入口
│   ├── index.css             # Tailwind 导入
│   ├── types.ts              # TypeScript 类型定义
│   ├── vite-env.d.ts         # Vite 类型声明
│   ├── components/
│   │   ├── ChatArea.tsx      # 聊天区域（SSE 订阅 + 消息列表 + 输入框）
│   │   ├── MarkdownRenderer.tsx # Markdown + KaTeX 渲染器
│   │   ├── SettingsModal.tsx # 设置弹窗（3 Tab：General / Providers / Models）
│   │   └── Sidebar.tsx       # 左侧栏（会话列表）
│   └── lib/
│       ├── api.ts            # 统一 API 客户端（REST + SSE 订阅）
│       └── utils.ts          # cn() 样式合并工具
├── tsconfig.json             # TypeScript 配置
└── vite.config.ts            # Vite 构建配置
```

## 关键文件说明

| 文件 | 职责 |
|------|------|
| `server.ts` | 入口文件，`import 'dotenv/config'` + `startApp()` |
| `server/app.ts` | Express 5 应用组装，挂载路由，创建 GenerationManager |
| `server/providers/built-in.ts` | 内置 3 种提供商类型定义（google / nvidia / openai-compatible） |
| `server/providers/config.ts` | 提供商配置解析（apiKey、baseURL、envKey） |
| `server/providers/stream.ts` | 流式 API 调用（Google / Nvidia / OpenAI 兼容） |
| `server/services/generation-manager.ts` | **核心服务**：GenerationManager 管理生成任务生命周期、SSE 订阅、并发、取消。 |
| `server/routes/chat.ts` | POST messages、GET generation（SSE）、DELETE stop、POST retry/continue |
| `server/routes/settings.ts` | `/api/settings` GET/PUT |
| `server/routes/sessions.ts` | `/api/sessions` GET/GET/:id/DELETE |
| `server/routes/models.ts` | GET `/api/providers`、GET `/api/providers/:type/models` |
| `src/App.tsx` | 状态管理、会话 CRUD、per-session generating 状态 |
| `src/lib/api.ts` | 统一 API 客户端，封装 REST 调用和 SSE 订阅逻辑 |
| `src/components/ChatArea.tsx` | 聊天 UI，通过 `api.ts` 订阅 SSE 事件并更新流式内容 |
| `src/components/SettingsModal.tsx` | 3 Tab 设置（General / Providers / Models） |
| `src/components/Sidebar.tsx` | 左侧栏 UI，展示会话列表 |
| `src/components/MarkdownRenderer.tsx` | Markdown 渲染管线，集成 KaTeX 和其他插件 |
| `src/types.ts` | TypeScript 接口定义（ProviderInstance, ModelInstance, UserSettings, ChatSession 等） |
