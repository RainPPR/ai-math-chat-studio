# 技术栈详情

## 前端框架
| 技术 | 版本 |
|---|---|
| React | ^19.2.7 |
| TypeScript | ~6.0.3 |
| Vite | ^8.0.16 |
| Tailwind CSS | ^4.3.1 |
| @tailwindcss/typography | ^0.5.20 |

## 后端
| 技术 | 版本 |
|---|---|
| Express | ^5.2.1 |
| tsx | ^4.22.4 |
| OpenAI SDK | ^6.44.0 |
| dotenv | ^17.4.2 |

## AI/数学库
| 技术 | 版本 |
|---|---|
| @google/genai | ^2.8.0 |
| KaTeX | ^0.17.0 |

## Markdown 渲染管线
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

## 其他依赖
| 技术 | 版本 |
|---|---|
| lucide-react | ^1.21.0 |
| motion | ^12.40.0 |
| clsx | ^2.1.1 |
| tailwind-merge | ^3.6.0 |
| uuid | ^14.0.1 |
| unicodeit | ^0.7.5 |
| markdown-to-txt | ^2.0.1 |

### 标题生成

标题生成使用纯 JavaScript 字符串操作，无需异步：

- **unicodeit**: 将 LaTeX 数学公式转换为 Unicode 字符（如 `\alpha` → `α`)
- **markdown-to-txt**: 清理 Markdown 语法（标题、粗体、链接等）
- 处理流程：替换 `\dfrac` → `\frac` → 处理块级数学 `$$...$$` → 处理行内数学 `$...$` → Markdown 转文本 → 移除剩余 `$` 和 `\`
- 只处理前200个字符，保证极快的处理速度

## 开发工具
| 工具 | 用途 |
|---|---|
| Bun | 依赖管理、脚本运行、构建 |
| TypeScript (`tsc --noEmit`) | 类型检查 (`bun run lint`) |
| Vite HMR | 热模块替换 |

## 构建命令

```bash
bun run dev           # 启动开发服务器（tsx server.ts → Express + Vite 中间件）
bun run build         # Vite 生产构建
bun run preview       # 预览生产构建
bun run build:bundle    # 打包服务端代码为单个 bundle
bun run build:compile  # 使用 Bun 编译为可执行文件
bun run lint          # TypeScript 类型检查
bun run clean         # 清除 dist、dist-server、dist-compile、release 目录
```

## 路径别名

`@/*` 映射到项目根目录，配置在 `tsconfig.json` 和 `vite.config.ts` 中。
