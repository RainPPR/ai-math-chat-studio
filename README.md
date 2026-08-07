# AI Math & Chat Studio

一款专注于对话体验的多会话 AI 聊天应用。支持多种 AI 供应商接入以及丰富的数学公式渲染能力。

## 核心特性

### 🤖 多供应商 AI 支持

- **Google Gemini** - 原生 Function Calling 支持
- **Nvidia NIM** - 模型推理服务
- **OpenAI 兼容 API** - 支持任意 OpenAI 格式 API 端点

### 📐 Provider + Model + Character 分离架构

- **Providers Tab**：配置 API 连接信息（Base URL、API Key、环境变量）
- **Models Tab**：配置模型参数（temperature、maxTokens、推理努力程度等）
- **Characters Tab**：创建/管理角色（系统提示词），轻松切换不同的 AI 人格
- **快捷切换浮动栏**：在输入框上方快速切换当前活跃模型和角色
- 支持同一供应商下多个模型实例
- 支持远程模型列表自动同步

### 🧙‍♂️ 角色系统

- **灵活角色管理**：在设置中创建多个角色，每个角色配备独享的系统提示词
- **会话级角色标记**：每个会话记录创建时使用的角色，后续方便追溯
- **快捷切换**：输入框上方浮动栏一键切换当前活跃角色
- **角色名称显示**：会话标题处以小字标注当前角色，方便区分不同人格的对话

### 📈 数学公式渲染

- **KaTeX** 渲染 - 支持行内 $\...$ 和块级 $$\...$$
- **mhchem** 扩展 - 支持化学公式 \ce{H2O}
- 自动转换 \[[...\] 和 \(...\) 为标准 KaTeX 格式

### 🚀 SSE 流式响应

- 实时显示 AI 生成过程
- 支持思考过程展示（可折叠/展开）

### 🔄 消息操作

- **Retry（重试）**: 从当前消息往前找到最近的用户消息，抛弃其后所有内容重新生成
- **Continue（继续）**: 在当前会话末尾添加指令，让 AI 继续被中断的输出
- **Regenerate（重新生成）**: 针对模型回复，保留其思考过程，抛弃正文，让 AI 基于原有思考继续输出

### 📥 数据导出

- **Claude 格式导出**：支持将所有会话导出为 Claude 官方 `conversations.json` 格式
- **Markdown 导出**：支持将会话导出为纯文本 Markdown 格式

### 💡 后端驱动架构

- **GenerationManager** 管理生成任务生命周期
- **Logger Service** 提供日志记录功能 (`data/log/YYYY-MM-DD.log`)
- 前端关闭不影响后端继续生成
- 页面刷新后自动恢复生成状态
- 支持取消正在进行的生成请求

### 📁 数据持久化

- 本地 JSON 文件存储（无需外部数据库）
- `/data/settings.json` - 用户设置
- `/data/sessions/*.json` - 会话数据
- `/data/log/*.log` - 运行日志

## 技术栈

### 前端

| 技术                    | 版本    |
| ----------------------- | ------- |
| React                   | ^19.2.7 |
| TypeScript              | ~6.0.3  |
| Vite                    | ^8.0.16 |
| Tailwind CSS            | ^4.3.1  |
| @tailwindcss/typography | ^0.5.20 |

### 后端

| 技术          | 版本    |
| ------------- | ------- |
| Express       | ^5.2.1  |
| tsx           | ^4.22.4 |
| @google/genai | ^2.8.0  |
| OpenAI SDK    | ^6.44.0 |

## 快速开始

### 环境要求

- Bun

### 安装

```bash
bun install
cp .env.example .env
```

### 启动开发服务器

```bash
bun run dev
```

访问 <http://localhost:3000>

## 文档

详细文档位于 `docs/` 目录：

- [architecture.md](docs/architecture.md) - 架构概览
- [api-providers.md](docs/api-providers.md) - AI 供应商集成
- [components.md](docs/components.md) - 组件结构
- [data-models.md](docs/data-models.md) - 数据模型
- [tech-stack.md](docs/tech-stack.md) - 技术栈详情
- [file-structure.md](docs/file-structure.md) - 文件结构
- [linting-and-quality.md](docs/linting-and-quality.md) - 质量指南

## 许可证

MIT License
