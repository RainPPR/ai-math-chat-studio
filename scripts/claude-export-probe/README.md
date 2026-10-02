# Gemini「Import chats」导入失败排查包

> 结论先行：**当前导出的 `conversations.json` 里，每条消息都缺少 Claude 规范要求的 `text` 字段**，
> 这是 9 月起导入失败的头号嫌疑。下面给了 3 个只在格式维度上不同的 zip，按顺序上传即可定位。

---

## 一、我做了什么

1. 你贴的那段 JSON 对应的会话是 `data/sessions/929097a8-b187-4752-8de4-a8ea0f44aff8.json`
   （标题、uuid、两个时间戳、消息 uuid 全部一字不差）。你附件里的 zip 没有传到我这边，
   所以我**用仓库里的真实会话数据 + `SettingsModal.tsx` 的导出逻辑重新复刻了那个失败的 zip**。
2. 复刻方式是把 `formatClaudeDate()` / `extractThinkingBlocks(content, false)` 逐行翻译成 Python，
   再用 Node 跑一遍原始 TS 逻辑做对拍：**两边生成的 JSON 字节级完全一致**，所以复刻可信。
3. 对照 `RainPPR/claude-export-document` 的规范，以及 Claude 2026-09 换成
   「manifest + 分片 batch zip」新版导出之后、各家第三方解析器（chatlore #5、
   claude-conversation-viewer #2 等）在 9 月集中做的适配改动，逐条比对差异。

## 二、当前导出产物与 Claude 官方规范的差异

| # | 项目 | 规范要求 | 本项目现状 | 嫌疑 |
|---|------|----------|------------|------|
| 1 | `chat_messages[].text` | **必填**（文档第四章第 3 条、你自己的 schema 也写了 `text: string`） | **完全没有输出** | ⭐⭐⭐⭐⭐ |
| 2 | 空正文消息 | `text` 至少是 `""`，正常情况下有内容 | 全量数据里有 **91 条**消息只剩 `{"type":"text","text":""}`（正文被 `<think>` 吃光），既无 `text` 又无可读 `content` | ⭐⭐⭐⭐ |
| 3 | `thinking` 块 | 允许 `start_timestamp` / `stop_timestamp` | 只有 `{type, thinking}` | ⭐⭐⭐ |
| 4 | 对话 `account` | 可选，但真实导出一定有 | 没有 | ⭐⭐ |
| 5 | zip 内其它文件 | 真实导出还有 `users.json` / `projects.json`（新版更是多文件分片包） | zip 里只有一个 `conversations.json` | ⭐⭐ |
| 6 | 压缩方式 | 任意 | JSZip 默认 **STORE 不压缩**（全量导出会是 ~35 MB 裸文件） | ⭐ |
| 7 | 其余（顶层数组、`human`/`assistant`、6 位微秒 + `Z`、UUID v4 唯一性、根目录无子目录、UTF-8 无 BOM） | — | **全部合规**，1453 个会话 / 4254 条消息零违规 | — |

为什么「以前能传、9 月开始不行」能和第 1 条对上：你的导出代码最后一次改动是 2026-07-25
（`git log -S chat_messages`），**自己这边没变**；变的是对面——Claude 9 月换了新版导出格式，
各家解析器（包括 Gemini 的 ingest）都在 9 月重写了 Claude 分支。
老解析器「优先读 `content`、读不到再回退 `text`」，新解析器很可能反过来以 `text` 为准，
于是「只有 content、没有 text」的包就整包没有可读消息了。

## 三、三个测试包（在 `out/` 目录）

| 文件 | 和现状的差异 | 用途 |
|------|--------------|------|
| `00-current-output.zip` | 无（现状 1:1 复刻） | **不要上传**，只是基线，用来和下面几个 diff |
| `01-full-fidelity.zip` | 补 `text`；空正文消息用思考内容兜底；`thinking` 块补 start/stop 时间戳；对话补 `account`；zip 根再放 `users.json` + `projects.json` | **第一个传这个** |
| `02-vanilla-text.zip` | 最保守老式结构：只有 `conversations.json`，消息只有 `text` + `content:[{type:"text"}]`，**完全不出现 thinking 块** | 备用 |
| `03-control-sample.zip` | 和你的数据无关：2026-06 实测可导入的英文最小样例（2 段对话，1 KB） | 对照组 |

4 个包里的会话是同一批 12 个真实会话（35 条消息），覆盖了 thinking 块、未闭合 `<think>`、
290 KB 的超长 LaTeX 正文、空正文消息、纯文本会话，足以代表全量数据。
它们都是根目录直接放 `conversations.json`，无子目录、无 `__MACOSX`、UTF-8 无 BOM。

## 四、上传顺序（最多 2 次就能定位）

```
上传 01-full-fidelity.zip
├── 成功 → 原因在 JSON 字段层面。按 01 的生成逻辑改 SettingsModal.tsx 即可（见第五节 A 方案）
└── 失败 → 上传 03-control-sample.zip（1 KB 对照组）
          ├── 03 成功 → Gemini 仍收手工 zip，但不吃我们的结构/数据
          │            → 再传 02-vanilla-text.zip 判断是不是 thinking 块/体积的问题
          └── 03 失败 → 和我们的 JSON 无关：对面的门槛变了（新版 Claude 导出是
                       manifest + 多分片 batch 包），或者是账号/区域/当日配额问题
                       → 下一轮我按「manifest + 分片」的新版结构再做一包
```

上传后请告诉我：**哪个包成功、失败时 Gemini 的原话是什么**（是立刻弹错误，
还是导入条目出现但显示 0 条/部分对话）。这两种现象指向完全不同的原因。

## 五、测出结果后的改法

**A 方案（01 成功）**：改 `src/components/SettingsModal.tsx` 的 `executeExport()`
- 每条消息补 `text`（正文为空时用 thinking 内容兜底，保证不出现空消息）
- `thinking` 块补 `start_timestamp` / `stop_timestamp`
- 每个对话补 `account: { uuid }`
- 每个子 zip 根目录补 `users.json` / `projects.json`
- `generateAsync({ type: 'blob', compression: 'DEFLATE' })`，全量包从 ~35 MB 降到 ~8 MB

**B 方案（只有 02 成功）**：在 A 的基础上把 thinking 内容并进正文（或直接丢弃），
不再输出 `thinking` 块。

**C 方案（01/02/03 全失败）**：问题在 zip 容器/平台侧，改成模仿新版 Claude 导出：
`manifest.json` + `data-<uuid>-<ts>-<hash>-batch-0000.zip` 分片命名，再测一轮。

## 六、重新生成

```bash
python3 scripts/claude-export-probe/build_probe_zips.py            # 12 个探针会话
python3 scripts/claude-export-probe/build_probe_zips.py --all      # 全部 1453 个会话
python3 scripts/claude-export-probe/build_probe_zips.py --out /tmp/probe
```

脚本只用 Python 标准库，内置上传前自检（顶层数组、sender 取值、时间戳 6 位微秒、
UUID v4 与唯一性、必填数组字段）。排查结束后整个 `scripts/claude-export-probe/` 目录可以删掉。
