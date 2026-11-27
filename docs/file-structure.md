# 文件结构

```
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

## 关键文件说明

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
