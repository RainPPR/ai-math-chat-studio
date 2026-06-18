# 技术栈详情

## 前端框架
| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.x | UI 框架 |
| TypeScript | ~6.0 | 类型系统 |
| Vite | 8.x | 构建工具 + 开发服务器 |
| Tailwind CSS | 4.x | 样式系统 |
| @tailwindcss/typography | 0.5.x | Markdown 排版 |

## 后端
| 技术 | 版本 | 用途 |
|------|------|------|
| Express | 5.x | API 服务器 |
| tsx | 4.x | TypeScript 直接运行 |
| OpenAI SDK | 6.x | 统一调用 OpenAI 兼容 API |
| dotenv | 17.x | 环境变量加载 |

## AI/数学库
| 技术 | 版本 | 用途 |
|------|------|------|
| @google/genai | 2.x | Google Gemini API 客户端 |

## Markdown 渲染管线
| 技术 | 用途 |
|------|------|
| react-markdown | Markdown 解析渲染 |
| remark-math | 识别 `$...$` 和 `$$...$$` 数学公式 |
| remark-gfm | GitHub 风格 Markdown（表格、任务列表等） |
| remark-breaks | 换行符转 `<br>` |
| remark-cjk-friendly | CJK 字符友好断行 |
| remark-squeeze-paragraphs | 压缩多余段落 |
| rehype-katex | KaTeX 数学公式渲染 |
| rehype-raw | 支持原始 HTML（如 `<details>`） |
| rehype-sanitize | HTML 消毒，防止 XSS |
| rehype-external-links | 外部链接自动 `target="_blank"` |
| katex | 数学公式渲染引擎 |
| katex/contrib/mhchem | 化学公式支持（`\ce{H2O}`） |

## 其他依赖
| 技术 | 用途 |
|------|------|
| lucide-react | 图标库 |
| motion | 动画（已安装，未大量使用） |
| clsx + tailwind-merge | 条件样式合并（`cn()` 工具函数） |
| uuid | 生成唯一 ID |

## 开发工具
| 工具 | 用途 |
|------|------|
| TypeScript (`tsc --noEmit`) | 类型检查（`npm run lint`） |
| Vite HMR | 热模块替换 |

## 构建命令
```bash
npm run dev           # 启动开发服务器（tsx server.ts → Express + Vite 中间件）
npm run build         # Vite 生产构建
npm run preview       # 预览生产构建
npm run build:bundle    # 打包服务端代码为单个 bundle
npm run build:bun-compile  # 使用 Bun 编译为可执行文件
npm run lint          # TypeScript 类型检查
npm run clean         # 清除 dist、dist-server、dist-compile、release 目录
```

## 路径别名
`@/*` 映射到项目根目录，配置在 `tsconfig.json` 和 `vite.config.ts` 中。
