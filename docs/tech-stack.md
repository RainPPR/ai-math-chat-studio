# 技术栈详情

## 前端框架
| 技术 | 版本 |
|---|---|
| React | ^19.3.1 |
| TypeScript | ^7.0.2 |
| Vite | ^8.3.8 |
| Tailwind CSS | ^4.3.5 |
| @tailwindcss/typography | ^0.5.20 |

## 后端
| 技术 | 版本 |
|---|---|
| Express | ^5.3.0 |
| tsx | ^4.23.15 |
| OpenAI SDK | ^7.57.0 |
| dotenv | ^18.0.10 |

## AI/数学库
| 技术 | 版本 |
|---|---|
| @google/genai | ^3.3.0 |
| KaTeX | ^0.19.1 (`resolutions`: `^0.18.4`) |

## Markdown 与 AST 渲染管线
| 技术 | 版本 |
|---|---|
| react-markdown | ^10.1.0 |
| unified | ^11.0.5 |
| remark-parse | ^11.0.0 |
| remark-math | ^6.0.0 |
| remark-gfm | ^4.0.1 |
| remark-breaks | ^4.0.0 |
| remark-cjk-friendly | ^2.3.4 |
| remark-squeeze-paragraphs | ^6.0.0 |
| rehype-katex | ^7.0.1 |
| rehype-raw | ^7.0.0 |
| rehype-sanitize | ^6.0.0 |
| rehype-external-links | ^3.0.0 |
| katex/contrib/mhchem | (Bundled with KaTeX) |

## 其他依赖
| 技术 | 版本 |
|---|---|
| lucide-react | ^1.73.0 |
| motion | ^14.14.0 |
| clsx | ^2.1.1 |
| tailwind-merge | ^3.7.0 |
| uuid | ^14.0.3 |
| jszip | ^3.10.2 |
| pandoc-wasm | ^1.1.0 |
| unicodeit | ^0.7.5 |
| markdown-to-txt | ^2.0.1 |

### 标题生成

标题生成使用纯 JavaScript 字符串操作，无需异步：

- **unicodeit**: 将 LaTeX 数学公式转换为 Unicode 字符（如 `\alpha` → `α`）
- **markdown-to-txt**: 清理 Markdown 语法（标题、粗体、链接等）
- 处理流程：替换 `\dfrac` → `\frac` → 全局移除 `\displaystyle` 与 `\scriptstyle` → 处理块级数学 `$$...$$` → 处理行内数学 `$...$` → Markdown 转文本 → 合并空白并移除剩余 `$` 与 `\` → 截断为最多 50 个字符（超出追加 `...`）

## 开发工具
| 工具 | 用途 |
|---|---|
| Bun | 依赖管理、脚本运行、构建 |
| TypeScript (`tsc --noEmit --strict`) | 类型检查 |
| Prettier (`^3.10.1`) | 代码格式检查与格式化（已彻底移除 ESLint） |
| Vite HMR | 热模块替换（可通过 `DISABLE_HMR=true` 禁用） |

## 构建命令

```bash
bun run dev           # 启动开发服务器（tsx server.ts → Express + Vite 中间件）
bun run build         # Vite 生产构建
bun run preview       # 预览生产构建
bun run build:bundle    # 打包服务端代码为单个 bundle
bun run build:compile  # 使用 Bun 编译为可执行文件
bun run check         # TypeScript 严格类型检查
bun run pretty        # Prettier 格式检查
bun run pretty:fix    # Prettier 自动格式化
bun run clean         # 清除 dist、dist-server、dist-compile、release 目录
```

## 路径别名

`@/*` 映射到项目根目录，配置在 `tsconfig.json` 和 `vite.config.ts` 中。

## 数学公式渲染系统 (Math Formula Rendering System)

本应用数学公式渲染统一使用 KaTeX（已移除所有引擎切换开关与自定义数学字体设置）：

### 数学渲染引擎
- **KaTeX**: 基于 `rehype-katex` 同步 AST 渲染；主页面全局样式（`src/index.css`）应用 `1.1em` 字号，纯净打印 iframe（`src/components/ChatArea.tsx`）内应用 `0.9em` 字号与黑色 `.frac-line` 覆盖以保证高对比度。

### 实现细节
1. **统一宏管理 (`src/lib/mathEngine.ts`)**: 管理自定义宏（`\tag`、`\male`、`\female`、`\vec`、`\celsius`、`\SI`）与 KaTeX 渲染选项（`SHARED_KATEX_OPTIONS`）。
2. **默认库字体与中文排版**: 数学符号保持 KaTeX 原生默认字体；`src/fonts/` 保留中文全角引号子集（`FullWidthQuotes`），`.katex .cjk_fallback` 强制回退至 `--font-main`。
