# 🧬 MathEvolution — 数学对话软件的轻量进化框架

> 基于 EvoMap (GEP Protocol) 和 Hermes Agent (DSPy+GEPA) 的深度研究，为非 Agent 的数学对话软件设计。

---

## 目录

1. [研究总结：两大进化框架的核心洞察](#1-研究总结两大进化框架的核心洞察)
2. [框架设计哲学](#2-框架设计哲学)
3. [核心数据结构](#3-核心数据结构)
4. [进化流水线](#4-进化流水线)
5. [实现指南](#5-实现指南)
6. [使用示例](#6-使用示例)
7. [与现有框架的对比](#7-与现有框架的对比)

---

## 1. 研究总结：两大进化框架的核心洞察

### 1.1 EvoMap / Evolver — GEP (Genome Evolution Protocol)

**核心论文**: [From Procedural Skills to Strategy Genes: Towards Experience-Driven Test-Time Evolution](https://arxiv.org/abs/2604.15097)

**最重要的发现**（4,590 次对照试验）：
- **紧凑的 Gene 表示 > 冗长的 Skill 文档**：文档化的 Skill 包提供的控制信号不稳定且稀疏，而紧凑的 Gene 表示提供了最强的整体性能
- **表示形式本身是第一要素**：失败信息在被提炼为紧凑警告时最有用，而不是简单地追加
- 在 CritPt 上，Gene 进化系统将基础模型从 9.1% 提升到 18.57%，从 17.7% 提升到 27.14%

**核心架构**：

```
三层记忆系统：
├── Causal Memory Graph（因果记忆图）  — 进化事件的因果关系追踪
├── Anti-pattern Memory（反模式记忆）  — 失败的 Capsule 自动进入学习管道
└── Narrative Memory（叙事记忆）      — 跨周期的长期反思总结

GEP 资产模型：
├── Gene（基因）    — 紧凑的、控制导向的、可进化的经验单元
├── Capsule（胶囊）  — 可重用的、经过验证的技能包
└── EvolutionEvent  — 审计追踪，每个进化步骤都记录在案
```

**关键机制**：
- **Failure Circuit Breaker**（失败断路器）：检测失败连续，阻止有害进化
- **Signal De-duplication**（信号去重）：检测停滞模式，防止修复循环
- **Strategy Presets**（策略预设）：balanced / innovate / harden / repair-only
- **Skill Distiller**（技能蒸馏器）：跨周期经验蒸馏，将多次经验提炼为精华
- **Reflection Loop**（反思循环）：LLM 审查 → 进化原则更新 → 叙事记忆积累

**EvoMap 的教训**（来自 [Behind EvoMap 论文](https://arxiv.org/abs/2605.25815)）：
- 98% 的资产从未被重用 → 进化需要质量筛选，不是越多越好
- 自报指标可以被操纵 → 需要可验证的评估信号
- 84% 的资产用空测试绕过验证 → 需要真正的执行验证

### 1.2 Hermes Agent Self-Evolution — DSPy + GEPA

**核心论文**: [GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning](https://arxiv.org/abs/2507.19457) (ICLR 2026 Oral)

**核心发现**：
- GEPA 比 GRPO（强化学习）平均高 6pp，最多高 19pp，同时使用少 35 倍的 rollout
- GEPA 比 MIPROv2（贝叶斯优化）高 13% 聚合性能
- 关键：**读取执行轨迹来理解为什么失败**，而不是只知道失败

**GEPA 算法核心**：

```
1. 遗传进化（Genetic）：
   - 维护提示候选的种群
   - LLM 引导的变异（基于失败分析，而非随机）
   - 交叉操作（合并来自不同谱系的改进）

2. 反思反馈（Reflective）：
   - 读取完整执行轨迹（推理、工具调用、输出）
   - 用自然语言诊断问题
   - 提出有针对性的改进

3. 帕累托选择（Pareto）：
   - 维护帕累托前沿（每个实例上最佳候选的集合）
   - 随机采样，加权于领先更多实例的候选
   - 防止过早收敛到局部最优
```

**Hermes 的五阶段计划**：

| 阶段 | 目标 | 引擎 | 风险 |
|------|------|------|------|
| Phase 1 | Skill 文件 (SKILL.md) | DSPy+GEPA | 低 |
| Phase 2 | 工具描述 | DSPy+GEPA | 低 |
| Phase 3 | 系统提示词 | DSPy+GEPA | 中 |
| Phase 4 | 工具代码 | Darwinian Evolver | 高 |
| Phase 5 | 持续自进化循环 | 自动化流水线 | 中 |

**关键约束机制**：
- 完整测试套件必须 100% 通过
- 字符/Token 限制（防止进化膨胀）
- 缓存兼容性（不在对话中途热替换）
- 语义保留（进化不偏离原始目的）
- 所有变更通过 PR 部署（从不直接 commit）

### 1.3 对我们场景的启示

| 概念 | Agent 场景 | 数学对话场景（我们的适配） |
|------|-----------|--------------------------|
| Skill / Capsule | 可重用的操作流程 | 题型模板 + 解法策略 |
| Gene | 紧凑的控制信号 | 关键启发式规则 / 解题技巧 |
| Execution Trace | 工具调用和输出 | 推理步骤和错误分析 |
| Fitness (benchmark) | 测试用例通过率 | 同类题目的正确率 |
| Pareto Frontier | 多样化候选技能 | 覆盖不同题型的多种解法 |
| Failure Circuit Breaker | 防止有害修复 | 防止错误经验固化 |
| Skill Distiller | 跨周期经验蒸馏 | 多题经验提炼为通用策略 |
| Anti-pattern Memory | 失败的 Capsule 学习 | 错题本 / 易错点库 |

---

## 2. 框架设计哲学

### 核心原则

1. **紧凑优于冗长**（来自 EvoMap 论文核心发现）
   - 经验应该被编码为紧凑的"基因"而非冗长的文档
   - 一条好的经验一句话就够了

2. **反思优于计数**（来自 GEPA 论文核心发现）
   - 理解"为什么错"比知道"错了多少次"重要得多
   - 用 LLM 分析错误原因，而非仅记录对错

3. **帕累托优于贪心**（来自 GEPA 的 Pareto 选择）
   - 保留多样化的解题策略，而非只保留"当前最优"
   - 不同题型可能需要不同策略

4. **渐进验证优于一次性评估**（来自 Hermes 的约束门控）
   - 新经验必须经过验证才能入库
   - 设置多重门控，逐级过滤

5. **审计追踪优于黑盒进化**（来自 EvoMap 的 EvolutionEvent）
   - 每次经验更新都记录：从哪来、为什么改、效果如何

---

## 3. 核心数据结构

### 3.1 文件结构

```
math_evolution/
├── genes/                    # 🔬 基因库 — 紧凑的解题经验
│   ├── algebra.json         # 代数类基因
│   ├── geometry.json        # 几何类基因
│   ├── calculus.json        # 微积分类基因
│   ├── probability.json     # 概率统计类基因
│   └── number_theory.json   # 数论类基因
│
├── patterns/                 # 📋 题型库 — 问题类型模板
│   ├── equation_solving.md  # 方程求解
│   ├── inequality.md        # 不等式
│   ├── function_analysis.md # 函数分析
│   ├── sequence.md          # 数列
│   ├── geometry_proof.md    # 几何证明
│   └── ...                  # 更多题型
│
├── pitfalls/                 # ⚠️ 错题本 — 反模式记忆
│   ├── common_mistakes.json # 常见错误
│   └── edge_cases.json      # 边界情况
│
├── evolution/                # 📜 进化追踪
│   ├── events.jsonl         # 进化事件日志
│   ├── memory_graph.json    # 因果记忆图
│   └── narrative.md         # 叙事记忆（长期反思）
│
├── conversations/            # 💬 原始对话（只读）
│   └── (你的 200+ 对话数据)
│
├── config.yaml              # 进化配置
└── evolve.py                # 进化引擎入口
```

### 3.2 Gene（基因）— 核心经验单元

```json
{
  "id": "gene-algebra-001",
  "domain": "algebra",
  "pattern": "quadratic_equation",
  "content": "遇到二次方程先判断判别式 Δ，如果 Δ<0 直接回答无实根，不要展开计算",
  "type": "heuristic",
  "source": {
    "conversation_ids": ["conv-042", "conv-078", "conv-156"],
    "derivation": "从 3 次对话中提取的共同模式"
  },
  "strength": 0.87,
  "success_count": 12,
  "failure_count": 2,
  "last_used": "2026-06-15",
  "evolution_history": [
    {"version": 1, "date": "2026-05-01", "change": "初始版本"},
    {"version": 2, "date": "2026-06-10", "change": "增加了 '不要展开计算' 的提示"}
  ],
  "tags": ["quadratic", "discriminant", "shortcut"]
}
```

**Gene 的设计原则**（来自 EvoMap 论文）：
- 每条约 1-3 句话，不超过 100 字
- 包含一个可操作的启发式规则
- 记录来源（可追溯）
- 有强度评分（基于成功率）
- 有进化历史（可审计）

### 3.3 Pattern（题型模板）

```markdown
---
id: pattern-quadratic-equation
domain: algebra
category: equation_solving
difficulty: [easy, medium, hard]
gene_refs: [gene-algebra-001, gene-algebra-007]
---

# 二次方程求解

## 典型问题形式
- 标准型：ax² + bx + c = 0
- 含参型：x² + px + q = 0（含参数 p, q）
- 应用题：面积/运动/利润最值问题

## 标准解法步骤
1. 整理为标准形式
2. 计算判别式 Δ = b² - 4ac
3. 根据 Δ 判断根的情况
4. 使用求根公式：x = (-b ± √Δ) / 2a

## 常见变体
- 韦达定理：x₁ + x₂ = -b/a, x₁x₂ = c/a
- 配方法
- 因式分解法

## 易错点
- 忘记 a≠0 的前提
- 判别式符号判断错误
- 开方时遗漏负号

## 历史表现
- 出现次数：34
- 正确率：82%
- 最常见错误：判别式计算错误（占错误的 45%）
```

### 3.4 Pitfall（反模式/错题本）

```json
{
  "id": "pitfall-003",
  "domain": "algebra",
  "pattern": "quadratic_equation",
  "description": "判别式 Δ = b² - 4ac 中，忘记 4ac 的负号，写成 b² + 4ac",
  "frequency": 8,
  "source_conversations": ["conv-042", "conv-078"],
  "trigger_conditions": ["计算判别式时", "a 或 c 为负数时"],
  "prevention": "在计算 Δ 时，明确写出 b² - 4ac，然后代入数值，分步计算",
  "severity": "high"
}
```

### 3.5 EvolutionEvent（进化事件）

```jsonl
{"timestamp": "2026-06-15T14:30:00Z", "type": "gene_created", "gene_id": "gene-algebra-001", "source": "conversation_analysis", "conversation_ids": ["conv-042", "conv-078"]}
{"timestamp": "2026-06-16T09:00:00Z", "type": "gene_strengthened", "gene_id": "gene-algebra-001", "reason": "在新对话中成功应用", "strength_change": "0.80 → 0.85"}
{"timestamp": "2026-06-18T11:00:00Z", "type": "gene_weakened", "gene_id": "gene-algebra-001", "reason": "连续 2 次失败", "strength_change": "0.85 → 0.75"}
{"timestamp": "2026-06-20T08:00:00Z", "type": "gene_merged", "gene_id": "gene-algebra-001", "merged_from": "gene-algebra-007", "reason": "两条基因覆盖相同场景，合并为更通用的规则"}
```

---

## 4. 进化流水线

### 4.1 总体流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    🔄 MathEvolution 进化流水线                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────────┐  │
│  │ 1. 分析  │───▶│ 2. 反思提取  │───▶│ 3. 候选生成           │  │
│  │ 对话日志 │    │ 失败模式     │    │ 新 Gene / 更新 Pattern │  │
│  └──────────┘    └──────────────┘    └───────────┬───────────┘  │
│                                                  │              │
│                                                  ▼              │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────────┐  │
│  │ 6. 记录  │◀───│ 5. 入库      │◀───│ 4. 验证               │  │
│  │ 进化事件 │    │ 更新知识库   │    │ LLM-as-Judge 评分     │  │
│  └──────────┘    └──────────────┘    └───────────────────────┘  │
│                                                                 │
│  触发条件：                                                      │
│  - 每 N 次新对话后（默认 10 次）                                 │
│  - 某类题型正确率低于阈值（默认 60%）                            │
│  - 手动触发                                                      │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 详细步骤

#### Step 1: 对话分析 (Conversation Analyzer)

分析新对话，提取结构化信息：

```
输入：原始对话 JSON
输出：结构化分析报告

对每条对话：
├── 识别题目类型（分类到已有 Pattern）
├── 提取解题步骤
├── 判断正确性（LLM-as-Judge）
├── 如果错误 → 定位错误步骤 + 分析错误原因
├── 如果正确 → 识别高效策略 + 提取启发式
└── 标记新题型（未匹配到已有 Pattern 的）
```

#### Step 2: 反思提取 (Reflective Extractor)

**核心启发来自 GEPA**：不只看"对还是错"，而是理解"为什么错"。

```
对每个错误案例：
├── 读取完整推理过程
├── LLM 分析：
│   ├── 错误类型：概念错误 / 计算错误 / 策略错误 / 遗漏条件
│   ├── 根本原因：哪个步骤导致了错误？
│   └── 预防建议：下次如何避免？
├── 生成候选 Gene（1-3 句话的启发式规则）
└── 更新 Pitfall 数据库

对每个成功案例：
├── 识别高效策略（比标准解法更快的路径）
├── 提取可泛化的技巧
└── 生成候选 Gene
```

**反思 Prompt 模板**：

```
你是一位数学教育专家。请分析以下数学解题对话：

【题目】
{problem}

【学生解答过程】
{solution_steps}

【最终结果】
{final_result}

【正确性】{correct_or_not}

请分析：
1. 如果错误，根本原因是什么？（概念混淆/计算粗心/策略不当/遗漏条件）
2. 从这次经验中，可以提炼出什么简洁的启发式规则？（1-2 句话）
3. 这个经验是否可以推广到其他类似题目？
4. 这条经验的适用范围是什么？

输出格式：
{
  "error_type": "...",
  "root_cause": "...",
  "candidate_gene": "...",
  "generalizable": true/false,
  "scope": "..."
}
```

#### Step 3: 候选生成与合并 (Candidate Generation & Merging)

**核心启发来自 GEPA 的 Pareto 选择 + EvoMap 的 Gene 合并**：

```
候选 Gene 池：
├── 新提取的候选 Gene
├── 已有 Gene 的变体（基于新失败案例的改进）
└── 合并候选（两个相似 Gene 的合并版本）

合并策略：
├── 语义相似度 > 0.8 的 Gene 进行合并
├── 合并后更紧凑、更通用
└── 保留原始 Gene 作为历史版本
```

#### Step 4: 验证 (Validation Gate)

**核心启发来自 Hermes 的约束门控**：

```
Gate 1: 格式验证
├── Gene 不超过 100 字
├── Pattern 结构完整
└── 所有引用正确

Gate 2: 一致性验证
├── 新 Gene 不与已有 Gene 矛盾
├── 新 Pitfall 不与已有 Pitfall 重复
└── 语义相似度检查（避免重复）

Gate 3: 回顾测试 (Retrospective Test)
├── 用新 Gene 重新评估历史对话
├── 如果当时有这条 Gene，结果会更好吗？
└── 评分：改善率 > 0 才通过

Gate 4: 前瞻测试 (Prospective Test)
├── 用新 Gene 解决 3 道同类新题
├── LLM-as-Judge 评分
└── 平均分 > 当前基准才通过
```

#### Step 5: 入库 (Knowledge Base Update)

```
更新操作：
├── 新 Gene → 加入对应领域的 genes/*.json
├── Gene 强化 → 增加 strength，更新 success_count
├── Gene 削弱 → 降低 strength，增加 failure_count
│   └── 如果 strength < 0.3 → 标记为 deprecated
├── Pattern 更新 → 更新易错点、历史表现统计
├── Pitfall 更新 → 增加或更新条目
└── 叙事记忆更新 → 每 10 次进化后生成反思总结
```

#### Step 6: 记录 (Evolution Event Logging)

```
记录内容：
├── 时间戳
├── 事件类型
├── 涉及的 Gene/Pattern
├── 变更内容
├── 触发原因
└── 验证结果
```

### 4.3 失败断路器 (Failure Circuit Breaker)

**直接借鉴 EvoMap 的机制**：

```
当一条 Gene 连续失败 3 次 → 自动暂停，标记为待审查
当一条 Gene 连续失败 5 次 → 自动降级，移出活跃库
当同一领域 3 条 Gene 同时失败 → 触发领域级审查

信号去重：如果同一错误模式反复出现 → 停止生成相同 Gene → 升级为更根本的问题
```

### 4.4 策略预设 (Strategy Presets)

**借鉴 EvoMap 的策略预设**：

| 策略 | 探索 | 优化 | 修复 | 使用场景 |
|------|------|------|------|----------|
| `balanced` (默认) | 50% | 30% | 20% | 日常进化 |
| `explore` | 80% | 15% | 5% | 初期大量对话，快速建立知识库 |
| `optimize` | 20% | 60% | 20% | 知识库较丰富，精细化优化 |
| `repair` | 10% | 20% | 70% | 某领域正确率骤降，紧急修复 |

---

## 5. 实现指南

### 5.1 技术栈

- **Python 3.10+**：主语言
- **JSON**：Gene 和 Pitfall 存储
- **Markdown**：Pattern 题型模板
- **JSONL**：进化事件日志
- **YAML**：配置文件
- **LLM API**：分析和反思（支持任何 LLM API）

### 5.2 核心模块

```python
# evolve.py — 进化引擎入口

class MathEvolution:
    def __init__(self, config):
        self.analyzer = ConversationAnalyzer(config.llm)
        self.extractor = ReflectiveExtractor(config.llm)
        self.validator = ValidationGate(config.llm)
        self.knowledge_base = KnowledgeBase(config.data_dir)
        self.event_logger = EventLogger(config.data_dir)
    
    def evolve(self, strategy="balanced"):
        """执行一次完整的进化循环"""
        # 1. 获取未分析的新对话
        new_convs = self.knowledge_base.get_unanalyzed_conversations()
        
        # 2. 分析对话
        analyses = [self.analyzer.analyze(conv) for conv in new_convs]
        
        # 3. 反思提取
        candidates = self.extractor.extract(analyses, strategy)
        
        # 4. 验证
        validated = self.validator.validate(candidates)
        
        # 5. 入库
        self.knowledge_base.apply(validated)
        
        # 6. 记录
        self.event_logger.log(validated)
        
        return validated
```

### 5.3 配置示例

```yaml
# config.yaml
llm:
  provider: "openai"  # or "anthropic", "local"
  model: "gpt-4o"
  api_key_env: "OPENAI_API_KEY"

data:
  conversations_dir: "./conversations/"
  genes_dir: "./genes/"
  patterns_dir: "./patterns/"
  pitfalls_dir: "./pitfalls/"
  evolution_dir: "./evolution/"

evolution:
  trigger:
    min_new_conversations: 10      # 最少新对话数触发进化
    min_error_rate: 0.4            # 某题型错误率超过此值触发
    max_genes_per_domain: 50       # 每个领域最多 Gene 数
    max_pitfalls_per_domain: 30    # 每个领域最多 Pitfall 数
  
  gene:
    max_length: 100                # Gene 最大字符数
    min_strength: 0.3              # 低于此强度标记为 deprecated
    merge_threshold: 0.8           # 语义相似度超过此值触发合并
  
  circuit_breaker:
    max_consecutive_failures: 3    # 连续失败次数触发暂停
    max_consecutive_failures_degrade: 5  # 连续失败次数触发降级
    domain_failure_threshold: 3    # 同一领域 Gene 同时失败数
  
  validation:
    retrospective_sample_size: 10  # 回顾测试的样本数
    prospective_sample_size: 3     # 前瞻测试的样本数
    min_improvement: 0.0           # 最小改善率

  narrative:
    reflection_interval: 10        # 每 N 次进化生成叙事反思
```

### 5.4 从历史对话中批量初始化

```python
# bootstrap.py — 从 200+ 历史对话中初始化知识库

def bootstrap_from_history(conversations_dir: str, output_dir: str):
    """
    从历史对话中批量提取初始知识库。
    
    1. 扫描所有对话
    2. 按题型聚类
    3. 提取每个题型的典型模式
    4. 分析错误，生成初始 Gene 和 Pitfall
    5. 生成初始叙事记忆
    """
    convs = load_all_conversations(conversations_dir)
    
    # 聚类：按题型分组
    clusters = cluster_by_problem_type(convs)
    
    # 对每个题型：
    for problem_type, cluster in clusters.items():
        # 提取 Pattern 模板
        pattern = extract_pattern_template(cluster)
        save_pattern(pattern, output_dir)
        
        # 分析错误，提取 Gene
        errors = [c for c in cluster if not c.is_correct]
        for error_batch in group_similar_errors(errors):
            gene = extract_gene_from_errors(error_batch)
            save_gene(gene, output_dir)
        
        # 提取成功策略
        successes = [c for c in cluster if c.is_correct and c.is_efficient]
        for success_batch in group_similar_successes(successes):
            gene = extract_gene_from_successes(success_batch)
            save_gene(gene, output_dir)
    
    # 生成初始叙事记忆
    narrative = generate_initial_narrative(clusters)
    save_narrative(narrative, output_dir)
```

---

## 6. 使用示例

### 场景 1：从 200 个历史对话中初始化

```bash
# 初始化知识库
python bootstrap.py \
  --conversations ./conversations/ \
  --output ./math_evolution/

# 输出：
# ✅ 分析了 200 条对话
# ✅ 识别了 15 种题型
# ✅ 提取了 47 条初始 Gene
# ✅ 记录了 23 个常见错误
# ✅ 生成了叙事记忆
```

### 场景 2：日常进化

```bash
# 运行进化（默认 balanced 策略）
python evolve.py

# 输出：
# 🔄 MathEvolution v1.0
# 📊 发现 12 条新对话
# 🔍 分析中...
#   - 二次方程: 5 条 (正确率 80%)
#   - 三角函数: 3 条 (正确率 33% ⚠️)
#   - 数列: 4 条 (正确率 100%)
# 
# 💡 提取了 3 条候选 Gene:
#   1. [三角函数] 先判断角度范围再选择公式 (strength: 0.75)
#   2. [二次方程] 韦达定理可替代求根公式简化计算 (strength: 0.82)
#   3. [数列] 递推关系先写前 5 项找规律 (strength: 0.90)
#
# ✅ 验证通过：3/3 条候选
# 📝 已入库，事件已记录
```

### 场景 3：紧急修复模式

```bash
# 三角函数正确率骤降，触发修复
python evolve.py --strategy repair --domain trigonometry

# 输出：
# 🚨 修复模式启动
# 📊 三角函数当前正确率: 33%
# 🔍 深入分析 6 条失败对话...
# 
# ⚠️ 发现根本问题：角度制/弧度制混淆
# 💡 生成修复 Gene: "所有三角函数题先检查角度单位，统一转换为弧度"
# ⚡ 强化已有 Gene: "特殊角三角函数值直接记忆，不要推导"
# 
# 📈 回顾测试：应用修复后历史正确率 33% → 67%
# ✅ 修复已入库
```

### 场景 4：查看进化状态

```bash
python evolve.py --status

# 输出：
# 🧬 MathEvolution 知识库状态
# 
# ┌─────────────┬────────┬────────┬──────────┬──────────┐
# │ 领域        │ Genes  │Patterns│ Pitfalls │ 平均正确率│
# ├─────────────┼────────┼────────┼──────────┼──────────┤
# │ 代数        │   12   │   4    │    5     │   85%    │
# │ 几何        │    8   │   3    │    4     │   78%    │
# │ 微积分      │    6   │   2    │    3     │   72%    │
# │ 概率统计    │    5   │   2    │    2     │   90%    │
# │ 数论        │    4   │   1    │    1     │   88%    │
# ├─────────────┼────────┼────────┼──────────┼──────────┤
# │ 总计        │   35   │  12    │   15     │   82%    │
# └─────────────┴────────┴────────┴──────────┴──────────┘
# 
# 📜 最近进化事件:
#   2026-06-20: gene-trig-003 强化 (strength 0.70 → 0.85)
#   2026-06-18: gene-algebra-001 削弱 (strength 0.85 → 0.75)
#   2026-06-15: 新增 pattern-sequence-02 (数列求和)
# 
# 🔄 叙事记忆最后更新: 2026-06-10
#    摘要: "近两周三角函数和数列有明显进步，但微积分中积分技巧仍需加强..."
```

---

## 7. 与现有框架的对比

| 维度 | EvoMap/Evolver | Hermes Agent | MathEvolution (本框架) |
|------|---------------|--------------|------------------------|
| **目标场景** | Agent 自我进化 | Agent 技能/提示词进化 | 数学对话软件知识进化 |
| **核心引擎** | GEP Protocol | DSPy + GEPA | 自定义轻量引擎 |
| **经验表示** | Gene (紧凑) + Capsule (完整) | SKILL.md (Markdown) | Gene (紧凑) + Pattern (题型) |
| **反馈信号** | 执行日志 + 信号检测 | 执行轨迹 + Benchmark | 解题正确性 + LLM 分析 |
| **选择机制** | 信号匹配 + 策略预设 | Pareto 前沿 + 遗传算法 | 强度评分 + 策略预设 |
| **验证机制** | validation 命令 + 沙箱 | 测试套件 + Benchmark | 回顾测试 + 前瞻测试 |
| **安全机制** | Failure Circuit Breaker | 约束门控 + PR 审查 | Failure Circuit Breaker + 强度阈值 |
| **记忆系统** | 因果图 + 反模式 + 叙事 | SessionDB (FTS5) | 进化事件 + 叙事记忆 |
| **依赖** | Node.js + Git | Python + DSPy + GEPA | 纯 Python + LLM API |
| **复杂度** | 高 (8.7k stars, 93 releases) | 中高 (4.2k stars) | 低 (单文件核心 ~500 行) |
| **部署模式** | CLI + 守护进程 | Python CLI | Python CLI + 可选的定时任务 |

---

## 8. 总结：为什么这个设计适合你

1. **非 Agent，无需执行轨迹**：我们用解题正确性和 LLM 分析替代执行轨迹，反馈信号来源是对话中的推理过程评估。

2. **200 个历史对话是巨大优势**：这两个框架的"冷启动"问题对你来说不存在。通过 `bootstrap.py` 一次性提取，可以建立非常丰富的初始知识库。

3. **紧凑设计，易于维护**：Gene（1-3 句话）比完整的 SKILL.md 更适合数学场景——数学启发式规则天然就是短小精悍的。

4. **三层记忆对应数学学习**：
   - 因果记忆图 → 追踪"哪些经验在什么题型上有效"
   - 反模式记忆 → 错题本
   - 叙事记忆 → 阶段性学习总结

5. **失败断路器防止错误固化**：数学中最怕错误经验被当成正确经验反复使用，这个机制直接解决了这个问题。

6. **渐进式部署**：先从 `bootstrap.py` 初始化 → 手动审查 → 日常进化 → 自动化，可以逐步建立信任。