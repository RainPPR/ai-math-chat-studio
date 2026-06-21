"""
MathEvolution — 数学对话软件的轻量进化框架
核心引擎实现

基于 EvoMap (GEP) 和 Hermes Agent (DSPy+GEPA) 的设计理念，
适配为非 Agent 的数学对话场景。
"""

import json
import os
import hashlib
import time
from dataclasses import dataclass, field, asdict
from typing import Optional
from datetime import datetime, timezone

# ============================================================
# 数据结构
# ============================================================

@dataclass
class Gene:
    """基因 — 紧凑的解题经验单元"""
    id: str
    domain: str
    pattern: str
    content: str  # 1-3 句话，不超过 100 字
    type: str     # "heuristic" | "shortcut" | "warning" | "principle"
    source: dict  # {"conversation_ids": [...], "derivation": "..."}
    strength: float = 0.5
    success_count: int = 0
    failure_count: int = 0
    consecutive_failures: int = 0
    last_used: str = ""
    evolution_history: list = field(default_factory=list)
    tags: list = field(default_factory=list)
    deprecated: bool = False

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Gene":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


@dataclass
class Pitfall:
    """反模式 — 常见错误记录"""
    id: str
    domain: str
    pattern: str
    description: str
    frequency: int = 0
    source_conversations: list = field(default_factory=list)
    trigger_conditions: list = field(default_factory=list)
    prevention: str = ""
    severity: str = "medium"  # "low" | "medium" | "high"

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class EvolutionEvent:
    """进化事件 — 审计追踪"""
    timestamp: str
    type: str  # "gene_created" | "gene_strengthened" | "gene_weakened" | "gene_deprecated" | "gene_merged" | "pitfall_added" | "pattern_updated" | "narrative_generated"
    details: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


# ============================================================
# 知识库管理
# ============================================================

class KnowledgeBase:
    """管理所有进化资产：Genes, Patterns, Pitfalls, Events"""

    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.genes_dir = os.path.join(data_dir, "genes")
        self.patterns_dir = os.path.join(data_dir, "patterns")
        self.pitfalls_dir = os.path.join(data_dir, "pitfalls")
        self.evolution_dir = os.path.join(data_dir, "evolution")

        for d in [self.genes_dir, self.patterns_dir, self.pitfalls_dir, self.evolution_dir]:
            os.makedirs(d, exist_ok=True)

        self._genes: dict[str, Gene] = {}
        self._pitfalls: dict[str, Pitfall] = {}
        self._load_all()

    def _load_all(self):
        """加载所有知识库文件"""
        # 加载基因
        for fname in os.listdir(self.genes_dir):
            if fname.endswith(".json"):
                with open(os.path.join(self.genes_dir, fname)) as f:
                    for item in json.load(f):
                        gene = Gene.from_dict(item)
                        self._genes[gene.id] = gene

        # 加载反模式
        for fname in os.listdir(self.pitfalls_dir):
            if fname.endswith(".json"):
                with open(os.path.join(self.pitfalls_dir, fname)) as f:
                    for item in json.load(f):
                        p = Pitfall(**item)
                        self._pitfalls[p.id] = p

    def _save_domain_file(self, directory: str, domain: str, items: list[dict]):
        fpath = os.path.join(directory, f"{domain}.json")
        with open(fpath, "w") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)

    def get_gene(self, gene_id: str) -> Optional[Gene]:
        return self._genes.get(gene_id)

    def get_genes_by_domain(self, domain: str) -> list[Gene]:
        return [g for g in self._genes.values() if g.domain == domain and not g.deprecated]

    def get_genes_by_pattern(self, pattern: str) -> list[Gene]:
        return [g for g in self._genes.values() if g.pattern == pattern and not g.deprecated]

    def get_all_active_genes(self) -> list[Gene]:
        return [g for g in self._genes.values() if not g.deprecated]

    def add_gene(self, gene: Gene):
        gene.id = gene.id or self._generate_id("gene", gene.domain)
        self._genes[gene.id] = gene
        self._persist_domain(self.genes_dir, gene.domain, self.get_genes_by_domain(gene.domain))

    def update_gene(self, gene: Gene):
        self._genes[gene.id] = gene
        self._persist_domain(self.genes_dir, gene.domain, self.get_genes_by_domain(gene.domain))

    def add_pitfall(self, pitfall: Pitfall):
        pitfall.id = pitfall.id or self._generate_id("pitfall", pitfall.domain)
        self._pitfalls[pitfall.id] = pitfall
        domain_pitfalls = [p for p in self._pitfalls.values() if p.domain == pitfall.domain]
        self._persist_domain(self.pitfalls_dir, pitfall.domain, [p.to_dict() for p in domain_pitfalls])

    def log_event(self, event: EvolutionEvent):
        fpath = os.path.join(self.evolution_dir, "events.jsonl")
        with open(fpath, "a") as f:
            f.write(json.dumps(event.to_dict(), ensure_ascii=False) + "\n")

    def _persist_domain(self, directory: str, domain: str, items):
        self._save_domain_file(directory, domain, [i.to_dict() if hasattr(i, 'to_dict') else i for i in items])

    def _generate_id(self, prefix: str, domain: str) -> str:
        timestamp = int(time.time() * 1000)
        short_hash = hashlib.md5(f"{domain}{timestamp}".encode()).hexdigest()[:6]
        return f"{prefix}-{domain}-{short_hash}"

    def get_status(self) -> dict:
        """获取知识库统计信息"""
        domains = {}
        for gene in self._genes.values():
            if gene.domain not in domains:
                domains[gene.domain] = {"genes": 0, "pitfalls": 0}
            if not gene.deprecated:
                domains[gene.domain]["genes"] += 1

        for pitfall in self._pitfalls.values():
            if pitfall.domain not in domains:
                domains[pitfall.domain] = {"genes": 0, "pitfalls": 0}
            domains[pitfall.domain]["pitfalls"] += 1

        return {
            "total_genes": len([g for g in self._genes.values() if not g.deprecated]),
            "total_pitfalls": len(self._pitfalls),
            "deprecated_genes": len([g for g in self._genes.values() if g.deprecated]),
            "domains": domains,
        }


# ============================================================
# 对话分析器
# ============================================================

class ConversationAnalyzer:
    """分析数学对话，提取结构化信息"""

    def __init__(self, llm_client=None):
        self.llm = llm_client

    def analyze(self, conversation: dict) -> dict:
        """
        分析一条对话，返回结构化分析结果。

        对话格式示例:
        {
            "id": "conv-042",
            "problem": "解方程 x² - 5x + 6 = 0",
            "solution_steps": [...],
            "final_answer": "x = 2 或 x = 3",
            "is_correct": true,
            "user_feedback": "..."  # 可选
        }
        """
        # 分类题型
        problem_type = self._classify_problem(conversation["problem"])

        # 判断正确性
        is_correct = conversation.get("is_correct", None)

        # 如果有 LLM，进行深度分析
        if self.llm and not is_correct:
            analysis = self._deep_analyze_error(conversation)
        elif self.llm and is_correct:
            analysis = self._analyze_success(conversation)
        else:
            analysis = {"summary": "基础分析（无 LLM）"}

        return {
            "conversation_id": conversation["id"],
            "problem_type": problem_type,
            "domain": self._infer_domain(problem_type),
            "is_correct": is_correct,
            "analysis": analysis,
        }

    def _classify_problem(self, problem: str) -> str:
        """基于关键词分类题型"""
        # 简化版关键词匹配
        keywords_map = {
            "quadratic_equation": ["二次方程", "x²", "判别式", "求根", "韦达定理"],
            "linear_equation": ["一次方程", "一元一次", "线性方程"],
            "inequality": ["不等式", ">=", "<=", "解集"],
            "function_analysis": ["函数", "定义域", "值域", "单调性", "奇偶性"],
            "sequence": ["数列", "等差", "等比", "通项", "求和"],
            "trigonometry": ["三角", "sin", "cos", "tan", "正弦", "余弦"],
            "geometry": ["几何", "三角形", "圆", "面积", "体积"],
            "calculus": ["导数", "积分", "极限", "微分"],
            "probability": ["概率", "期望", "方差", "组合"],
            "number_theory": ["整除", "质数", "素数", "同余"],
        }

        for ptype, keywords in keywords_map.items():
            if any(kw in problem for kw in keywords):
                return ptype
        return "unknown"

    def _infer_domain(self, problem_type: str) -> str:
        domain_map = {
            "quadratic_equation": "algebra",
            "linear_equation": "algebra",
            "inequality": "algebra",
            "function_analysis": "algebra",
            "sequence": "algebra",
            "trigonometry": "trigonometry",
            "geometry": "geometry",
            "calculus": "calculus",
            "probability": "probability",
            "number_theory": "number_theory",
        }
        return domain_map.get(problem_type, "general")

    def _deep_analyze_error(self, conv: dict) -> dict:
        """使用 LLM 深度分析错误原因"""
        prompt = f"""你是数学教育专家。分析以下数学解题错误：

【题目】{conv['problem']}

【解题过程】{json.dumps(conv.get('solution_steps', []), ensure_ascii=False)}

【最终答案】{conv.get('final_answer', '')}

请以 JSON 格式回答：
{{
    "error_type": "概念错误/计算错误/策略错误/遗漏条件/其他",
    "error_step": "出错的具体步骤",
    "root_cause": "错误的根本原因",
    "candidate_gene": "一条简洁的启发式规则（1-2句话，不超过100字），可以帮助避免此类错误",
    "generalizable": true/false,
    "scope": "这条经验适用的范围"
}}"""
        # 这里调用 LLM API
        return {"prompt": prompt, "note": "需要 LLM API 调用"}

    def _analyze_success(self, conv: dict) -> dict:
        """分析成功案例中的高效策略"""
        prompt = f"""你是数学教育专家。分析以下成功解题：

【题目】{conv['problem']}

【解题过程】{json.dumps(conv.get('solution_steps', []), ensure_ascii=False)}

请以 JSON 格式回答：
{{
    "efficiency": "标准/高效/非常高效",
    "key_insight": "解题的关键洞察",
    "candidate_gene": "一条可泛化的启发式规则（1-2句话，不超过100字）",
    "generalizable": true/false
}}"""
        return {"prompt": prompt, "note": "需要 LLM API 调用"}


# ============================================================
# 反思提取器
# ============================================================

class ReflectiveExtractor:
    """从对话分析中提取候选 Gene 和 Pitfall"""

    def __init__(self, llm_client=None):
        self.llm = llm_client

    def extract(self, analyses: list[dict], strategy: str = "balanced") -> dict:
        """
        从分析结果中提取候选知识。

        返回: {
            "candidate_genes": [Gene, ...],
            "candidate_pitfalls": [Pitfall, ...],
            "gene_updates": [(gene_id, strength_delta), ...],
        }
        """
        result = {
            "candidate_genes": [],
            "candidate_pitfalls": [],
            "gene_updates": [],
        }

        # 按题型分组
        by_type = {}
        for a in analyses:
            ptype = a["problem_type"]
            if ptype not in by_type:
                by_type[ptype] = []
            by_type[ptype].append(a)

        for ptype, group in by_type.items():
            errors = [a for a in group if a["is_correct"] is False]
            successes = [a for a in group if a["is_correct"] is True]

            # 从错误中提取 Gene 和 Pitfall
            if errors:
                for err in errors:
                    analysis = err.get("analysis", {})
                    candidate_gene_text = analysis.get("candidate_gene", "")
                    # Fallback: 如果没有 LLM 生成的 gene，用基本分析生成
                    if not candidate_gene_text and analysis.get("prompt"):
                        # 基于错误类型生成基本的 Gene
                        error_hints = {
                            "quadratic_equation": "二次方程注意判别式计算和求根公式符号",
                            "inequality": "不等式两边乘除负数时必须反转不等号方向",
                            "function_analysis": "函数问题先确定定义域，再分析性质",
                            "sequence": "数列问题先判断类型（等差/等比），再套用公式",
                            "trigonometry": "三角函数注意角度范围，选择正确的公式变体",
                        }
                        candidate_gene_text = error_hints.get(err["problem_type"], "仔细检查每一步的计算和符号")
                    if candidate_gene_text:
                        gene = Gene(
                            id="",
                            domain=err["domain"],
                            pattern=ptype,
                            content=candidate_gene_text,
                            type="warning",
                            source={"conversation_ids": [err["conversation_id"]],
                                    "derivation": "从错误中提取"},
                            strength=0.6,
                            tags=[ptype, "error-derived"],
                        )
                        result["candidate_genes"].append(gene)

                    # 提取 Pitfall
                    if analysis.get("error_type"):
                        pitfall = Pitfall(
                            id="",
                            domain=err["domain"],
                            pattern=ptype,
                            description=f"{analysis.get('error_type', '')}: {analysis.get('root_cause', '')}",
                            source_conversations=[err["conversation_id"]],
                            trigger_conditions=[],
                            prevention=analysis.get("candidate_gene", ""),
                            severity="high" if analysis.get("error_type") == "概念错误" else "medium",
                        )
                        result["candidate_pitfalls"].append(pitfall)

            # 从成功中提取 Gene
            if successes:
                for s in successes:
                    analysis = s.get("analysis", {})
                    if analysis.get("efficiency") in ("高效", "非常高效") or not analysis.get("efficiency"):
                        candidate_gene_text = analysis.get("candidate_gene", "")
                        # Fallback for non-LLM mode
                        if not candidate_gene_text:
                            success_hints = {
                                "quadratic_equation": "韦达定理可简化两根关系的计算",
                                "inequality": "二次不等式画数轴辅助判断区间",
                                "sequence": "数列递推先列举前几项找规律",
                                "trigonometry": "利用诱导公式将角转化到锐角范围",
                            }
                            candidate_gene_text = success_hints.get(s["problem_type"], "")
                        if candidate_gene_text:
                            gene = Gene(
                                id="",
                                domain=s["domain"],
                                pattern=ptype,
                                content=candidate_gene_text,
                                type="shortcut",
                                source={"conversation_ids": [s["conversation_id"]],
                                        "derivation": "从高效策略中提取"},
                                strength=0.7,
                                tags=[ptype, "success-derived"],
                            )
                            result["candidate_genes"].append(gene)

        return result


# ============================================================
# 验证门控
# ============================================================

class ValidationGate:
    """验证候选知识是否应该入库"""

    def __init__(self, llm_client=None, config: dict = None):
        self.llm = llm_client
        self.config = config or {}

    def validate(self, candidates: dict, knowledge_base: KnowledgeBase) -> dict:
        """
        验证候选知识。

        返回: {
            "accepted_genes": [Gene, ...],
            "rejected_genes": [{"gene": Gene, "reason": str}, ...],
            "accepted_pitfalls": [Pitfall, ...],
            "rejected_pitfalls": [{"pitfall": Pitfall, "reason": str}, ...],
        }
        """
        result = {
            "accepted_genes": [],
            "rejected_genes": [],
            "accepted_pitfalls": [],
            "rejected_pitfalls": [],
        }

        max_length = self.config.get("gene", {}).get("max_length", 100)

        for gene in candidates.get("candidate_genes", []):
            reject_reason = None

            # Gate 1: 长度检查
            if len(gene.content) > max_length:
                reject_reason = f"Gene 过长 ({len(gene.content)} > {max_length})"

            # Gate 2: 重复检查（包括已入库的和本轮已接受的）
            if not reject_reason:
                # 检查已入库的
                existing = knowledge_base.get_genes_by_pattern(gene.pattern)
                for existing_gene in existing:
                    similarity = self._text_similarity(gene.content, existing_gene.content)
                    if similarity > 0.8:
                        reject_reason = f"与已有 Gene '{existing_gene.id}' 高度相似 ({similarity:.2f})"
                        break
                # 检查本轮已接受的
                if not reject_reason:
                    for accepted in result["accepted_genes"]:
                        if self._text_similarity(gene.content, accepted.content) > 0.8:
                            reject_reason = f"与本轮已接受的 Gene 重复"
                            break

            # Gate 3: 矛盾检查
            if not reject_reason:
                for existing_gene in knowledge_base.get_all_active_genes():
                    if self._is_contradictory(gene.content, existing_gene.content):
                        reject_reason = f"与已有 Gene '{existing_gene.id}' 可能矛盾"
                        break

            if reject_reason:
                result["rejected_genes"].append({"gene": gene, "reason": reject_reason})
            else:
                result["accepted_genes"].append(gene)

        # Pitfall 验证
        for pitfall in candidates.get("candidate_pitfalls", []):
            reject_reason = None

            # 重复检查
            for existing_id, existing_p in knowledge_base._pitfalls.items():
                if existing_p.domain == pitfall.domain:
                    similarity = self._text_similarity(pitfall.description, existing_p.description)
                    if similarity > 0.8:
                        reject_reason = f"与已有 Pitfall '{existing_id}' 高度相似"
                        # 不拒绝，而是增加频率
                        existing_p.frequency += 1
                        break

            if reject_reason:
                result["rejected_pitfalls"].append({"pitfall": pitfall, "reason": reject_reason})
            else:
                result["accepted_pitfalls"].append(pitfall)

        return result

    def _text_similarity(self, a: str, b: str) -> float:
        """简单的文本相似度（基于字符bigram + 词重叠）"""
        # Bigram similarity (character-level)
        def bigrams(s):
            return set(s[i:i+2] for i in range(len(s)-1))
        bg_a = bigrams(a)
        bg_b = bigrams(b)
        if not bg_a or not bg_b:
            return 0
        bigram_sim = len(bg_a & bg_b) / len(bg_a | bg_b)
        # Word overlap
        words_a = set(a)
        words_b = set(b)
        word_sim = len(words_a & words_b) / max(1, len(words_a | words_b))
        return 0.5 * bigram_sim + 0.5 * word_sim

    def _is_contradictory(self, text_a: str, text_b: str) -> bool:
        """简单的矛盾检测（基于关键词）"""
        contradiction_pairs = [
            (["必须", "一定要"], ["不要", "避免", "不应"]),
            (["先", "首先"], ["后", "然后", "最后"]),
        ]
        # 简化实现：如果两条 gene 使用了相反的指令词，标记为可能矛盾
        for pos_words, neg_words in contradiction_pairs:
            a_pos = any(w in text_a for w in pos_words)
            a_neg = any(w in text_a for w in neg_words)
            b_pos = any(w in text_b for w in pos_words)
            b_neg = any(w in text_b for w in neg_words)
            if (a_pos and b_neg) or (a_neg and b_pos):
                return True
        return False


# ============================================================
# 失败断路器
# ============================================================

class FailureCircuitBreaker:
    """防止错误经验固化"""

    def __init__(self, config: dict = None):
        self.config = config or {}
        self.max_consecutive = self.config.get("circuit_breaker", {}).get("max_consecutive_failures", 3)
        self.max_consecutive_degrade = self.config.get("circuit_breaker", {}).get("max_consecutive_failures_degrade", 5)
        self.domain_threshold = self.config.get("circuit_breaker", {}).get("domain_failure_threshold", 3)

    def check(self, knowledge_base: KnowledgeBase) -> list[dict]:
        """检查并返回需要处理的警报"""
        alerts = []

        for gene in knowledge_base.get_all_active_genes():
            if gene.consecutive_failures >= self.max_consecutive_degrade:
                alerts.append({
                    "level": "critical",
                    "gene_id": gene.id,
                    "message": f"Gene '{gene.id}' 连续失败 {gene.consecutive_failures} 次，建议降级",
                    "action": "degrade",
                })
            elif gene.consecutive_failures >= self.max_consecutive:
                alerts.append({
                    "level": "warning",
                    "gene_id": gene.id,
                    "message": f"Gene '{gene.id}' 连续失败 {gene.consecutive_failures} 次，建议暂停",
                    "action": "pause",
                })

        # 领域级检查
        domain_failures = {}
        for gene in knowledge_base.get_all_active_genes():
            if gene.consecutive_failures >= self.max_consecutive:
                domain_failures[gene.domain] = domain_failures.get(gene.domain, 0) + 1

        for domain, count in domain_failures.items():
            if count >= self.domain_threshold:
                alerts.append({
                    "level": "critical",
                    "domain": domain,
                    "message": f"领域 '{domain}' 有 {count} 条 Gene 同时失败，建议领域级审查",
                    "action": "domain_review",
                })

        return alerts

    def apply(self, knowledge_base: KnowledgeBase, alerts: list[dict]):
        """应用断路器动作"""
        for alert in alerts:
            if alert["action"] == "degrade":
                gene = knowledge_base.get_gene(alert["gene_id"])
                if gene:
                    gene.deprecated = True
                    gene.evolution_history.append({
                        "version": len(gene.evolution_history) + 1,
                        "date": datetime.now(timezone.utc).isoformat(),
                        "change": f"断路器自动降级：连续失败 {gene.consecutive_failures} 次",
                    })
                    knowledge_base.update_gene(gene)
                    knowledge_base.log_event(EvolutionEvent(
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        type="gene_deprecated",
                        details={"gene_id": gene.id, "reason": "circuit_breaker", "consecutive_failures": gene.consecutive_failures},
                    ))

            elif alert["action"] == "pause":
                gene = knowledge_base.get_gene(alert["gene_id"])
                if gene:
                    # 标记为待审查（不弃用，但降低强度）
                    gene.strength = max(0.1, gene.strength - 0.3)
                    knowledge_base.update_gene(gene)


# ============================================================
# 进化引擎
# ============================================================

class MathEvolution:
    """主进化引擎"""

    def __init__(self, data_dir: str, llm_client=None, config: dict = None):
        self.data_dir = data_dir
        self.llm = llm_client
        self.config = config or {}

        self.knowledge_base = KnowledgeBase(data_dir)
        self.analyzer = ConversationAnalyzer(llm_client)
        self.extractor = ReflectiveExtractor(llm_client)
        self.validator = ValidationGate(llm_client, config)
        self.circuit_breaker = FailureCircuitBreaker(config or {})

        self.strategy_weights = {
            "balanced": {"explore": 0.5, "optimize": 0.3, "repair": 0.2},
            "explore": {"explore": 0.8, "optimize": 0.15, "repair": 0.05},
            "optimize": {"explore": 0.2, "optimize": 0.6, "repair": 0.2},
            "repair": {"explore": 0.1, "optimize": 0.2, "repair": 0.7},
        }

    def evolve(self, conversations: list[dict], strategy: str = "balanced") -> dict:
        """
        执行一次完整进化循环。

        参数:
            conversations: 新对话列表
            strategy: 进化策略 ("balanced" | "explore" | "optimize" | "repair")

        返回: 进化结果摘要
        """
        start_time = datetime.now(timezone.utc)

        # Step 1: 分析对话
        analyses = [self.analyzer.analyze(conv) for conv in conversations]

        # Step 2: 反思提取
        candidates = self.extractor.extract(analyses, strategy)

        # Step 3: 验证
        validated = self.validator.validate(candidates, self.knowledge_base)

        # Step 4: 入库
        for gene in validated["accepted_genes"]:
            self.knowledge_base.add_gene(gene)
            self.knowledge_base.log_event(EvolutionEvent(
                timestamp=datetime.now(timezone.utc).isoformat(),
                type="gene_created",
                details={"gene_id": gene.id, "content": gene.content, "source": gene.source},
            ))

        for pitfall in validated["accepted_pitfalls"]:
            self.knowledge_base.add_pitfall(pitfall)
            self.knowledge_base.log_event(EvolutionEvent(
                timestamp=datetime.now(timezone.utc).isoformat(),
                type="pitfall_added",
                details={"pitfall_id": pitfall.id, "description": pitfall.description},
            ))

        # Step 5: 断路器检查
        alerts = self.circuit_breaker.check(self.knowledge_base)
        self.circuit_breaker.apply(self.knowledge_base, alerts)

        # 汇总
        elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
        return {
            "summary": {
                "conversations_analyzed": len(conversations),
                "strategy": strategy,
                "elapsed_seconds": elapsed,
                "genes_accepted": len(validated["accepted_genes"]),
                "genes_rejected": len(validated["rejected_genes"]),
                "pitfalls_accepted": len(validated["accepted_pitfalls"]),
                "pitfalls_rejected": len(validated["rejected_pitfalls"]),
                "circuit_breaker_alerts": len(alerts),
            },
            "accepted_genes": [g.content for g in validated["accepted_genes"]],
            "rejected_genes": [r["reason"] for r in validated["rejected_genes"]],
            "alerts": alerts,
            "status": self.knowledge_base.get_status(),
        }

    def get_status(self) -> dict:
        """获取知识库状态"""
        return self.knowledge_base.get_status()

    def get_recent_events(self, n: int = 20) -> list[dict]:
        """获取最近 n 条进化事件"""
        events_path = os.path.join(self.data_dir, "evolution", "events.jsonl")
        if not os.path.exists(events_path):
            return []
        events = []
        with open(events_path) as f:
            for line in f:
                events.append(json.loads(line))
        return events[-n:]


# ============================================================
# 历史对话批量初始化
# ============================================================

def bootstrap_from_history(conversations_dir: str, output_dir: str, llm_client=None):
    """
    从历史对话中批量初始化知识库。

    参数:
        conversations_dir: 历史对话目录
        output_dir: 进化框架输出目录
        llm_client: LLM 客户端（可选）
    """
    # 加载所有对话
    conversations = []
    for fname in sorted(os.listdir(conversations_dir)):
        fpath = os.path.join(conversations_dir, fname)
        if fname.endswith(".json"):
            with open(fpath) as f:
                data = json.load(f)
                if isinstance(data, list):
                    conversations.extend(data)
                else:
                    conversations.append(data)
        elif fname.endswith(".jsonl"):
            with open(fpath) as f:
                for line in f:
                    if line.strip():
                        conversations.append(json.loads(line))
        elif fname.endswith(".md"):
            with open(fpath) as f:
                content_md = f.read()
                sections = content_md.split("\n## ")
                for section in sections[1:]:
                    lines = section.strip().split("\n", 1)
                    problem = lines[0].strip()
                    solution = lines[1].strip() if len(lines) > 1 else ""
                    conversations.append({
                        "id": f"{fname}#{hash(problem) % 10000}",
                        "problem": problem,
                        "solution_steps": [solution],
                    })

    print(f"📂 加载了 {len(conversations)} 条历史对话")

    # 初始化进化引擎
    engine = MathEvolution(
        data_dir=output_dir,
        llm_client=llm_client,
        config={
            "gene": {"max_length": 100},
            "circuit_breaker": {"max_consecutive_failures": 3, "max_consecutive_failures_degrade": 5, "domain_failure_threshold": 3},
        },
    )

    # 按题型分组，分批处理
    # 先按 problem_type 分组
    by_type = {}
    for conv in conversations:
        ptype = engine.analyzer._classify_problem(conv.get("problem", conv.get("question", "")))
        if ptype not in by_type:
            by_type[ptype] = []
        by_type[ptype].append(conv)

    print(f"📊 识别了 {len(by_type)} 种题型")

    total_results = []
    for ptype, batch in by_type.items():
        print(f"  🔍 处理 {ptype} ({len(batch)} 条)...")
        result = engine.evolve(batch, strategy="explore")
        total_results.append(result)

    # 汇总
    total_genes = sum(r["summary"]["genes_accepted"] for r in total_results)
    total_pitfalls = sum(r["summary"]["pitfalls_accepted"] for r in total_results)

    print(f"\n✅ 初始化完成！")
    print(f"   - 提取了 {total_genes} 条 Gene")
    print(f"   - 记录了 {total_pitfalls} 个 Pitfall")
    print(f"   - 知识库保存在 {output_dir}")

    return engine


# ============================================================
# CLI 入口
# ============================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="MathEvolution — 数学对话进化框架")
    parser.add_argument("--data-dir", default="./math_evolution", help="知识库目录")
    parser.add_argument("--conversations", help="新对话文件路径 (JSON)")
    parser.add_argument("--bootstrap", help="从历史对话目录初始化")
    parser.add_argument("--strategy", default="balanced",
                        choices=["balanced", "explore", "optimize", "repair"])
    parser.add_argument("--status", action="store_true", help="显示知识库状态")

    args = parser.parse_args()

    if args.status:
        engine = MathEvolution(args.data_dir)
        status = engine.get_status()
        print("🧬 MathEvolution 知识库状态")
        print(f"   Total Genes: {status['total_genes']}")
        print(f"   Total Pitfalls: {status['total_pitfalls']}")
        print(f"   Deprecated Genes: {status['deprecated_genes']}")
        print(f"   Domains: {json.dumps(status['domains'], ensure_ascii=False, indent=2)}")
        events = engine.get_recent_events(10)
        if events:
            print(f"\n📜 最近进化事件:")
            for e in events[-5:]:
                print(f"   {e['timestamp']}: {e['type']}")

    elif args.bootstrap:
        bootstrap_from_history(args.bootstrap, args.data_dir)

    elif args.conversations:
        with open(args.conversations) as f:
            conversations = json.load(f)
        if not isinstance(conversations, list):
            conversations = [conversations]

        engine = MathEvolution(args.data_dir)
        result = engine.evolve(conversations, args.strategy)
        print(json.dumps(result["summary"], ensure_ascii=False, indent=2))
        if result["accepted_genes"]:
            print("\n💡 新 Gene:")
            for g in result["accepted_genes"]:
                print(f"   - {g}")

    else:
        parser.print_help()