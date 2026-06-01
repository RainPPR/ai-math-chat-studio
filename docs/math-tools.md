# 数学工具系统

## 概述

本项目的核心特色之一是内置数学计算工具，允许 AI 在对话中调用数学函数进行精确计算，而非凭"记忆"猜测答案。工具定义和执行统一在服务端 `server/providers/tools.ts` 中。

## 工具列表

### 1. evaluate_expression（表达式求值）
- **库**：math.js
- **功能**：安全计算数学表达式
- **支持**：基本运算、三角函数、对数、矩阵运算等
- **示例**：`sin(pi/4)`, `sqrt(16)`, `2^10`

### 2. solve_equation（方程求解）
- **库**：nerdamer（Algebra + Calculus + Solve 模块）
- **功能**：求解代数方程，返回精确代数解
- **示例**：`x^2 - 4 = 0` → `x = 2, x = -2`

### 3. calculate_derivative（求导）
- **库**：math.js（`derivative` 函数）
- **功能**：计算数学表达式的导数
- **示例**：`x^2 + 2*x` 对 `x` 求导 → `2*x + 2`

## 工具调用机制

### 统一入口（server/providers/stream.ts）

所有供应商的工具调用通过 `streamChat()` 统一处理：

```
streamChat(providerId, request)
  ├── Gemini → streamGemini()
  │     ├── 使用 @google/genai 原生 Function Calling
  │     ├── 检测 functionCalls → executeMathTool() → functionResponse
  │     └── 循环直到无更多工具调用
  └── 其他 → streamOpenAI()
        ├── 使用 OpenAI SDK 的 tools 参数
        ├── 检测 delta.tool_calls → 累积参数
        └── GenerationManager 处理工具执行循环
```

### Gemini（原生 Function Calling）
```
streamGemini() → Google GenAI API（带 functionDeclarations）
     ← functionCall（如 {name: "evaluate_expression", args: {expression: "2+2"}}）
executeMathTool("evaluate_expression", {expression: "2+2"}) → "4"
     → functionResponse（{result: "4"}）
     ← 最终文本响应
```

### OpenAI 兼容供应商（Nvidia/Cloudflare/AIHubMix/Poe/Opengateway）
```
streamOpenAI() → OpenAI API（带 tools 定义）
     ← delta.tool_calls（累积完整参数）
GenerationManager.runGeneration() 执行工具
     → tool 消息（{role: "tool", content: "4"}）
     ← 最终文本响应
```

## 工具配置

### 全局开关
每个 `ModelPoolEntry` 有 `enableTools` 字段控制是否启用工具。

### 选择性禁用
`disabledTools` 数组可禁用具体工具，如 `["solve_equation"]`。

### 工具定义格式
- **Gemini**：`buildGeminiTools()` 生成 `FunctionDeclaration` 格式
- **OpenAI**：`buildOpenAITools()` 生成 `tools` 数组格式

## 系统提示词注入

`MATH_INSTRUCTIONS` 由 `GenerationManager.buildSystemPrompt()` 统一注入到系统提示词中（所有供应商），而非由 `streamGemini()` 单独处理。Gemini 收到的系统提示词 = 用户自定义 systemPrompt + MATH_INSTRUCTIONS（由 GenerationManager 拼接）。

```
CRITICAL INSTRUCTION: You have access to mathematical tools: 
'evaluate_expression', 'solve_equation', and 'calculate_derivative'. 
You MUST use these tools for ANY mathematical calculation...
When outputting math equations, ALWAYS use KaTeX formatting.
For inline math, use single dollar signs: $x^2$.
For block math, use double dollar signs: $$x^2$$.
For chemistry formulas, use the mhchem extension: $\ce{H2O}$
```

> 工具可用性取决于 `enableTools` 配置。Gemini 的工具声明不受 `enableTools` 控制，始终通过 `buildGeminiTools()` 构建。

### ALL_TOOL_NAMES 导出

`tools.ts` 导出 `ALL_TOOL_NAMES` 常量，包含所有工具名称数组（`['evaluate_expression', 'solve_equation', 'calculate_derivative']`），由 `TOOL_SCHEMAS` 的 key 推导而来，用于 `buildOpenAITools()` 和 `buildGeminiTools()`。

## 数学渲染管线

```
AI 输出（含 $...$ 或 $$...$$）
  → remark-math 识别数学节点
  → rehype-katex 调用 KaTeX 渲染
  → mhchem 扩展处理 \ce{} 化学公式
  → 最终 HTML 输出
```

**LaTeX 预处理**：
- `\[...\]` → `$$...$$`（块级数学）
- `\(...)` → `$...$`（行内数学）
