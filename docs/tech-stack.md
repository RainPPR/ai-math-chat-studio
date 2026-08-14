# 技术栈详情

## 前端框架
| 技术 | 版本 |
|---|---|
| React | ^19.2.8 |
| TypeScript | ^7.0.2 |
| Vite | ^8.2.1 |
| Tailwind CSS | ^4.3.3 |
| @tailwindcss/typography | ^0.5.20 |

## 后端
| 技术 | 版本 |
|---|---|
| Express | ^5.2.1 |
| tsx | ^4.23.12 |
| OpenAI SDK | ^7.4.0 |
| dotenv | ^17.4.2 |

## AI/数学库
| 技术 | 版本 |
|---|---|
| @google/genai | ^2.17.1 |
| KaTeX | ^0.18.4 |

## Markdown 渲染管线
| 技术 | 版本 |
|---|---|
| react-markdown | ^10.1.0 |
| remark-math | ^6.0.0 |
| remark-gfm | ^4.0.1 |
| remark-breaks | ^4.0.0 |
| remark-cjk-friendly | ^2.3.1 |
| remark-squeeze-paragraphs | ^6.0.0 |
| rehype-katex | ^7.0.1 |
| rehype-raw | ^7.0.0 |
| rehype-sanitize | ^6.0.0 |
| rehype-external-links | ^3.0.0 |
| katex/contrib/mhchem | (Bundled with KaTeX) |

## 其他依赖
| 技术 | 版本 |
|---|---|
| lucide-react | ^1.31.0 |
| motion | ^13.1.0 |
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
| TypeScript (`tsc --noEmit`) | 类型检查 |
| Vite HMR | 热模块替换 |

## 构建命令

```bash
bun run dev           # 启动开发服务器（tsx server.ts → Express + Vite 中间件）
bun run build         # Vite 生产构建
bun run preview       # 预览生产构建
bun run build:bundle    # 打包服务端代码为单个 bundle
bun run build:compile  # 使用 Bun 编译为可执行文件
bun run check         # TypeScript 类型检查
bun run clean         # 清除 dist、dist-server、dist-compile、release 目录
```

## 路径别名

`@/*` 映射到项目根目录，配置在 `tsconfig.json` 和 `vite.config.ts` 中。

## KaTeX 数学字体选择 (KaTeX Math Fonts)

本应用支持动态 KaTeX 数学字体选择，允许用户在设置（SettingsModal.tsx）中切换不同的数学渲染字体：
- **Default**: KaTeX 默认自带字体。
- **Euler Math**: 典雅的 Euler 数学字体 (Euler-Math.woff2 / Euler-Math.otf)。
- **Fira Math**: 现代的 Fira 数学无衬线字体 (FiraMath-Regular.woff2 / FiraMath-Regular.otf)。
- **Cambria Math**: 经典的 Cambria 数学衬线字体 (Cambria Math.woff2 / Cambria Math.ttf)。

### 字体实现细节
1. **源字体与 WOFF2 转换**: 字体文件存放于 `src/fonts/` 下，转换使用标准的 `woff2_compress` 压缩技术将 OTF/TTF 转换为体积更小的 WOFF2 格式。
2. **CSS 导入与覆盖**: 字体导入和样式覆盖定义在 `src/index.css`。通过给根 div (`App.tsx`) 或打印容器 (`ChatArea.tsx` 的 iframe `body`) 动态绑定 `.katex-font-${settings.katexFont || 'default'}` 样式类来实现。
3. **CJK/中文优雅回退**: 避免定制数学字体对数学公式内的中文（如 `\text{中文}` 或 `.cjk_fallback`）造成非预期的强制覆盖，系统在 `src/index.css` 增加了高优先级的非冲突 CJK 回退处理器，强制使 `.cjk_fallback` 及它的子元素回退并使用网页正文字体 (`system-ui, sans-serif`)。
