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
| lucide-react | ^1.20.0 |
| motion | ^12.40.0 |
| clsx | ^2.1.1 |
| tailwind-merge | ^3.6.0 |
| uuid | ^14.0.0 |
| pandoc-wasm | ^1.1.0 |

### pandoc-wasm 性能优化

`pandoc-wasm` 是用于标题生成的 Markdown 转 Plain Text 工具。由于 WASM 模块的冷启动特性，首次调用可能延迟 5-20 秒。项目通过以下方式优化：

- **服务端启动预热**：在 `server/app.ts` 中的 `startApp()` 函数内，与 Vite 启动并行执行 `warmPandocWasm()`，预先初始化 WASM 模块
- **异步初始化**：预热操作不阻塞服务器启动流程，确保 HTTP 服务器尽快可用

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
