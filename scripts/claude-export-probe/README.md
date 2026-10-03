# Gemini「Import chats」导入失败排查包

> ## ✅ 第二轮结论（2026-10-03：全量包失败、删到只剩前两条就成功）
>
> 整包特征修好后，`All_Conversations.zip` 全量上传仍失败，但手工把 `conversations.json`
> 删到只剩前两条对话就能成功——根因是**数据里混入了孤立代理项（lone surrogate）**：
>
> * 会话标题生成用 `text.slice(0, 50)` 按 UTF-16 码元截断，把 unicodeit 产出的
>   𝐑 / 𝕟 等数学字母数字符号（U+1D400+，双码元代理对）从中间切开，
>   在 7 个会话标题末尾留下孤立的 `\uD835`；
> * `JSON.stringify` 把它序列化成 `"\ud835"` 转义——语法上是合法 JSON，但解码后是
>   非良构 Unicode，Gemini 的严格校验会**拒收整个文件**；中招标题不在前两条对话里，
>   所以「删到只剩前两条」恰好能传；
> * 第一轮自检（下文事实 #5 的「零个孤立代理项」）没查这一项，当时的结论已过时。
>
> 修复（均已落地）：
> 1. `shared/text.ts` 新增 `stripIllFormedUnicode()` / `truncateWellFormed()`；
> 2. `shared/claude-export.ts` 导出前对标题和正文统一清洗（本脚本已同步镜像并重新对拍，
>    1457 个会话逐条字节一致）；
> 3. 标题截断改为代理对安全：`server/services/generation-manager.ts` 与 `src/App.tsx`；
> 4. `data/sessions` 里 7 个中招标题已修复；`validate()` 补上孤立代理项/非法控制符检查。
>
> 以下为第一轮（2026-10-02，整包特征 + text 字段）的排查记录。

> ## ✅ 结论（2026-10-02 实测）
>
> **`01-full-fidelity.zip` 上传成功**，排查到此结束，02 / 03 / 04 不必再测。
>
> 原因是下面第二节的 **A + B 两条同时成立**：Gemini 现在要求「整包特征 + 规范消息 schema」，
> 只放一个 `conversations.json`、消息又缺 `text` 字段，会在**来源识别阶段**直接被拒。
>
> 修复已落地在 `shared/claude-export.ts`（`SettingsModal.tsx` 调用），
> 现在 App 导出的每个子压缩包都和 `01-full-fidelity.zip` 同构，产物逐字节一致：
>
> * 子包根目录 = `conversations.json` + `users.json` + `projects.json`，DEFLATE 压缩
> * 每条消息补齐 `text`（正文被 `<think>` 吃空时回落为思考内容）、`attachments: []`、`files: []`
> * 对话补 `account: { uuid }`，与 `users.json` 对应
>
> 本目录保留作为排查记录与回归工具；`build_probe_zips.py` 是 `shared/claude-export.ts` 的
> Python 镜像实现，改导出字段时两边都要改，并重新对拍。

报错原文：

> **无法导入文件**
> 无法读取上传的文件。请确保该文件来自**受支持的 AI 应用**。你可以换个文件再试一次。

这条文案是**来源识别阶段**就被拒了（连「部分导入 / 0 条对话」都没走到），
所以问题不在某条消息解析不出来，而在「这个 zip 不被认成一个受支持的导出包」。

---

## 一、已经查实的事实

| # | 事实 | 怎么查的 |
|---|------|----------|
| 1 | 你贴的 JSON 对应 `data/sessions/929097a8-b187-4752-8de4-a8ea0f44aff8.json`，标题 / uuid / 两个时间戳 / 消息 uuid 全部一字不差 | 直接比对仓库数据 |
| 2 | 失败的那个 zip 我**按导出代码 1:1 复刻出来了**（你的附件没传到我这边）。把 `formatClaudeDate()` / `extractThinkingBlocks(c,false)` 翻成 Python，再用 Node 跑原始 TS 逻辑对拍，**两边 JSON 字节级完全一致** | `00-current-output.zip` |
| 3 | 导出代码最后一次改动是 **2026-07-25**（`git log -S chat_messages`），9 月之后一行没动 | git 历史 |
| 4 | **不是体积问题**：8/20 成功那次（7/20→8/20 增量）是 400 会话 / 6.9M 字符；9/10 失败那次是 267 会话 / 6.2M 字符，10/2 失败那次只有 186 会话 / 4.0M 字符。**失败的包比成功的包还小** | 按 chunk 边界统计 |
| 5 | **不是数据脏**：1453 会话 / 4254 消息里，零个孤立代理项（lone surrogate）、零个控制字符、UUID 全是合法 v4 且无重复、时间戳全部是 6 位微秒 + `Z`、顶层是数组、`sender` 只有 `human`/`assistant`、根目录无子目录、UTF-8 无 BOM | 脚本内置自检 |
| 6 | **不是 zip 容器问题**：JSZip 生成的是 STORE + 无 data descriptor 的标准包，和 8/20 成功那次用的是同一套代码 | 用 JSZip 在本地复现并解析头部 |

**结论：你这边什么都没变，变的是 Gemini 的识别/校验规则**（9 月初 Claude 把官方导出
换成了「manifest + 多分片 batch zip」，各家解析器都在 9 月重写了 Claude 分支）。

## 二、剩下的两个嫌疑

| 嫌疑 | 说明 | 对应探针 |
|------|------|----------|
| **A. 整包特征不够**：新版识别器可能先看 zip 里有没有 Claude 包的标志文件（`users.json` / `projects.json`），而不是直接去读 `conversations.json` | 真实 Claude 导出永远是多文件；我们只有孤零零一个 `conversations.json`。ChatGPT 包是 `user.json`（单数），Claude 包是 `users.json`（复数），正好是「判断来自哪个 AI 应用」最省事的做法 | 01 / 02 |
| **B. 消息 schema 不合规**：每条消息都**缺少规范要求的 `text` 字段**（你自己的文档第四章第 3 条写了「必须有」），全量数据里还有 91 条消息连 `content` 里的 text 块都是空串 | 老解析器「优先读 content、回退 text」，新解析器很可能以 `text` 为准，于是整包没有一条可读消息 → 直接判定「读不出来」 | 01 / 04 |

其余已排除：体积、CJK/LaTeX、thinking 块（8/20 成功那包里这些全都有）。

## 三、探针包（`out/` 目录，2×2 设计）

|  | 真实数据（12 个会话 / 35 条消息） | 已知可用的最小样例（2 段英文对话） |
|---|---|---|
| **多文件整包**（+`users.json` +`projects.json`） | `01-full-fidelity.zip` 224 KB | `02-control-bundle.zip` 1.3 KB |
| **裸 `conversations.json`** | `00-current-output.zip` 192 KB ← 现状，已知失败 | `03-control-bare.zip` 1.0 KB ← 2026-06 实测可用的结构 |

另外：`04-vanilla-no-thinking.zip`（106 KB）= 真实数据 + 整包特征，但**完全不输出 thinking 块**，
消息只有 `text` + `content:[{type:"text"}]`。

`01` / `04` 相对现状的改动：补 `text`（正文被 `<think>` 吃光时用思考内容兜底，保证没有空消息）、
`thinking` 块补 `start/stop_timestamp`、对话补 `account`、时间戳收敛（对话区间包住所有消息、
消息时间单调不降）、zip 根目录补 `users.json` / `projects.json`。

12 个探针会话覆盖了 thinking 块、未闭合 `<think>`、290 KB 超长 LaTeX 正文、空正文消息、
纯文本会话，足以代表全量数据。

## 四、上传顺序（最多 2 次定位）

```
① 上传 01-full-fidelity.zip
   ├─ 成功 → 嫌疑 A/B 命中。我按 01 的生成逻辑改 SettingsModal.tsx，全量重导一次就行
   └─ 失败 → ② 上传 02-control-bundle.zip（1.3 KB，最干净的标准包）
              ├─ 成功 → Gemini 还收手工包，是我们的真实数据里有东西过不了
              │          → ③ 上传 04-vanilla-no-thinking.zip 判断是不是 thinking 块
              └─ 失败 → 和我们的 JSON 无关：对面门槛变了（新版是 manifest + 分片 batch 包），
                         或账号/区域/配额问题 → 下一轮我按「分片 batch 包」结构再做一包
```

- `00-current-output.zip` **不要上传**，它只是基线复刻件，用来和上面几个做 diff。
- `03-control-bare.zip` 是备用对照：只在「01 成功、但想知道到底是 `users.json` 还是 `text` 起的作用」时才需要。
- 零成本的小手脚：上传前把文件名改成 Claude 官方那种 `data-7c3d41e5-9b02-4a6f-8f14-2d5e6a90c431-20261002-batch-0000.zip`，
  万一对面也看文件名就赚了（不看也没损失）。

反馈时请告诉我：**哪个包成功**；失败的话是**同样这句「无法读取上传的文件」**，还是换了别的文案。

## 五、测出结果后的改法

**A 方案（01 成功）** — 改 `src/components/SettingsModal.tsx` 的 `executeExport()`：
1. 每条消息补 `text`（正文为空时用 thinking 内容兜底）
2. `thinking` 块补 `start_timestamp` / `stop_timestamp`
3. 对话补 `account: { uuid }`（固定一个 UUID 存设置里即可）
4. 每个子 zip 根目录补 `users.json` / `projects.json`
5. 时间戳收敛：对话区间包住所有消息、消息时间单调不降
6. `generateAsync({ type: 'blob', compression: 'DEFLATE' })`：全量包从 ~35 MB 降到 ~8 MB

**B 方案（只有 04 成功）**：在 A 的基础上不再输出 `thinking` 块，思考内容并进正文或丢弃。

**C 方案（01/02 都失败）**：改成模仿新版 Claude 导出的「manifest + `data-<uuid>-<ts>-<hash>-batch-0000.zip` 分片」结构再测。

## 六、重新生成

```bash
python3 scripts/claude-export-probe/build_probe_zips.py          # 12 个探针会话
python3 scripts/claude-export-probe/build_probe_zips.py --all    # 全部 1453 个会话
python3 scripts/claude-export-probe/build_probe_zips.py --out /tmp/probe
```

脚本只用 Python 标准库，内置上传前自检（顶层数组、`sender` 取值、6 位微秒时间戳、
UUID v4 与全局唯一、必填数组字段、`text` 非空、消息时间单调）。
排查结束后整个 `scripts/claude-export-probe/` 目录可以删掉。
