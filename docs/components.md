# 组件结构文档

## 组件树

```
App.tsx
├── Sidebar（左侧栏）
├── ChatArea（聊天主区域）
│   └── MessageItem（单条消息）
│       └── MarkdownRenderer（Markdown 渲染）
├── Tools Sidebar（右侧工具调用面板，App.tsx 内联实现）
└── SettingsModal（设置弹窗）
    └── ModelEntryEditor（模型编辑器子组件）
```

## App.tsx — 状态管理中心

**职责**：
- 会话 CRUD 操作（新建、删除、切换）
- 用户设置持久化（通过 `api.settings`）
- 消息发送/重试/继续（通过 `api.chat`）
- per-session generating 状态管理

**核心状态**：
- `sessions` — 所有聊天会话
- `currentSessionId` — 当前选中会话
- `settings` — 用户设置
- `generatingSessions` — Set<string>，正在生成的会话 ID 集合
- `isReady` — 初始化完成标记
- `isSettingsOpen` — 设置弹窗显示状态
- `isToolsSidebarOpen` — Tools Sidebar 展开/折叠状态

**核心函数**：
- `handleSendMessage()` — 发送消息，调用 `api.chat.send()`，触发后端生成
- `handleStop()` — 停止生成，调用 `api.chat.stop()`
- `handleRetry()` — 重试某条消息，调用 `api.chat.retry()`
- `handleContinue()` — 继续生成，调用 `api.chat.continue()`
- `handleSaveSettings()` — 保存设置到 /data/settings.json（通过 `api.settings.save()`）
- `refreshSession()` — 从服务端刷新单个会话数据
- `markGenerating()` — 更新 per-session 生成状态

## Sidebar.tsx — 左侧栏

**Props**：
- `sessions` — 会话列表
- `currentSessionId` — 当前会话 ID
- `onSelectSession` / `onNewChat` / `onDeleteChat` — 回调
- `onOpenSettings` — 打开设置弹窗

**功能**：
- 新建聊天按钮
- 会话列表（按 `updatedAt` 降序）
- 悬停显示删除按钮
- 设置入口

## ChatArea.tsx — 聊天主区域

**Props**：
- `session` — 当前会话
- `onSendMessage` / `onStop` / `onRetry` / `onContinue` — 回调
- `isGenerating` — 生成状态
- `settings` — 用户设置
- `onGenerationEnd` — 生成结束回调（刷新会话数据）

**功能**：
- **SSE 订阅**：通过 `api.subscribeGeneration()` 实时接收流式内容
  - `delta` 事件 → 更新 `streamingContent`
  - `tool_call` 事件 → 累积 `streamingToolCalls`
  - `done` / `error` / `stopped` 事件 → 清理状态，触发 `onGenerationEnd`
- 消息列表渲染（通过 `MessageItem` 子组件）
- 流式消息拼接：`streamingContent` 作为临时消息追加到消息列表
- 输入框（自动扩展高度，Enter 发送，Shift+Enter 换行）
- Token 估算显示（ASCII 4 字符/token，非 ASCII 约 0.8 字符/token）
- 导出聊天为 Markdown 文件
- 自动滚动到底部（可配置）

### MessageItem 子组件

**思考过程处理**：
- 使用正则 `/<details(?: open)?>\n<summary>Thinking Process<\/summary>\n\n```text\n([\s\S]*?)(?:\n```\n\n<\/details>|$)/g` 提取思考内容
- 思考过程可折叠/展开
- 完成后自动折叠（`collapseThinkingFinished` 设置）
- Gemma 系列可去除前导空格（`gemmaTrimThinkingSpaces`）

**操作按钮**：
- 复制消息内容
- 重试（删除该消息及后续，重新生成）
- 继续（仅最后一条 AI 消息显示）

## MarkdownRenderer.tsx — Markdown 渲染

**特性**：
- `React.memo` 优化渲染性能
- 预处理：将 `\[...\]` 转为 `$$...$$`，`\(...)` 转为 `$...$`
- 完整的 remark/rehype 插件管线（见 tech-stack.md）
- KaTeX 全局注入 + mhchem 化学公式支持
- `rehype-raw` + `rehype-sanitize` 组合：允许安全的 HTML（如 `<details>`）

## SettingsModal.tsx — 设置弹窗

**Props**：
- `settings: UserSettings` — 当前用户设置
- `onSave: (settings: UserSettings) => void` — 保存回调
- `onClose: () => void` — 关闭回调

**3 Tab 设计**：

### General Tab
- 活跃模型选择（下拉列表，从模型池中选择）
- 系统提示词
- 显示开关：自动滚动、折叠思考、渲染思考为 Markdown、Gemma 去空格

### Models Tab
- 模型池列表（显示每个模型的 provider、温度、maxTokens）
- 添加/编辑/删除模型条目
- ModelEntryEditor 子组件：
  - Display Name（可选）
  - Provider 选择（6 个预设 + Custom）
  - Base URL / API Key（Custom 或自定义覆盖时显示）
  - Model 选择（datalist + Fetch 按钮获取远程列表）
  - Temperature / Max Tokens
  - Reasoning Effort（low/medium/high/Unset）
  - Thinking Level（Gemini 专用：none/minimal/low/medium/high/Unset）
  - Enable Math Tools + 选择性禁用具体工具
  - Extra Body JSON

### Tools Tab
- 显示 3 个内置数学工具列表
- 提示在 Models tab 中按模型配置工具权限

## Tools Sidebar — 右侧工具面板

**功能**：
- 显示当前会话中所有 Tool Call 记录
- 按消息分组显示
- 特殊展示 `evaluate_expression` 的输入和结果
- 通用展示其他工具的 JSON 参数和结果
- 可折叠（默认展开 320px 宽度）
- 展开/折叠按钮位于聊天区域右上角，图标为扳手（Wrench）

> 注意：Tools Sidebar 在 `App.tsx` 中内联实现，不是独立组件文件。
