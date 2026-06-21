"""
叙事记忆生成器 + 基因合并引擎 + 统计报告

MathEvolution 的高级功能模块
"""

import json
import os
from datetime import datetime, timezone
from collections import Counter, defaultdict
from evolve import KnowledgeBase, Gene, EvolutionEvent


# ============================================================
# 叙事记忆生成器
# ============================================================

class NarrativeGenerator:
    """
    定期生成叙事记忆，总结进化趋势。
    
    借鉴 EvoMap 的 Narrative Memory 和 Reflection Loop：
    - 每 N 次进化后，LLM 审查最近的进化事件
    - 生成阶段性总结
    - 更新进化原则
    """

    def __init__(self, data_dir: str, llm_client=None):
        self.data_dir = data_dir
        self.llm = llm_client
        self.kb = KnowledgeBase(data_dir)
        self.narrative_path = os.path.join(data_dir, "evolution", "narrative.md")

    def generate(self) -> str:
        """生成/更新叙事记忆"""
        events = self._get_recent_events(50)
        status = self.kb.get_status()

        # 分析趋势
        trends = self._analyze_trends(events)

        narrative = self._build_narrative(status, trends, events)
        self._save_narrative(narrative)

        # 记录事件
        self.kb.log_event(EvolutionEvent(
            timestamp=datetime.now(timezone.utc).isoformat(),
            type="narrative_generated",
            details={"trends": trends},
        ))

        return narrative

    def _get_recent_events(self, n: int) -> list[dict]:
        events_path = os.path.join(self.data_dir, "evolution", "events.jsonl")
        if not os.path.exists(events_path):
            return []
        events = []
        with open(events_path) as f:
            for line in f:
                events.append(json.loads(line))
        return events[-n:]

    def _analyze_trends(self, events: list[dict]) -> dict:
        """分析进化趋势"""
        if not events:
            return {
                "summary": "尚无进化事件",
                "total_events": 0,
                "event_types": {},
                "top_growing_domains": [],
                "declining_domains": [],
                "domain_activity": {},
            }

        # 事件类型统计
        event_types = Counter(e["type"] for e in events)

        # 按领域分析
        domain_activity = defaultdict(lambda: {"created": 0, "strengthened": 0, "weakened": 0, "deprecated": 0})
        for e in events:
            domain = e.get("details", {}).get("domain", "unknown")
            etype = e["type"]
            if "created" in etype:
                domain_activity[domain]["created"] += 1
            elif "strengthened" in etype:
                domain_activity[domain]["strengthened"] += 1
            elif "weakened" in etype:
                domain_activity[domain]["weakened"] += 1
            elif "deprecated" in etype:
                domain_activity[domain]["deprecated"] += 1

        # 找出增长最快和需要关注的领域
        net_growth = {}
        for domain, counts in domain_activity.items():
            net_growth[domain] = counts["created"] + counts["strengthened"] - counts["weakened"] - counts["deprecated"]

        growing = sorted(net_growth.items(), key=lambda x: -x[1])[:3]
        declining = sorted(net_growth.items(), key=lambda x: x[1])[:3]

        return {
            "total_events": len(events),
            "event_types": dict(event_types),
            "top_growing_domains": growing,
            "declining_domains": declining,
            "domain_activity": dict(domain_activity),
        }

    def _build_narrative(self, status: dict, trends: dict, events: list[dict]) -> str:
        """构建叙事记忆"""
        lines = [
            "# 进化叙事记忆",
            f"\n## 更新时间\n{datetime.now(timezone.utc).isoformat()}",
            f"\n## 知识库概况",
            f"- 活跃 Gene: {status['total_genes']}",
            f"- 反模式: {status['total_pitfalls']}",
            f"- 已弃用 Gene: {status['deprecated_genes']}",
            f"\n## 领域统计",
        ]

        for domain, stats in sorted(status.get("domains", {}).items()):
            lines.append(f"- **{domain}**: {stats['genes']} Genes, {stats['pitfalls']} Pitfalls")

        lines.append(f"\n## 近期趋势 ({trends.get('total_events', 0)} 个事件)")

        if trends.get("top_growing_domains"):
            lines.append("\n### 📈 增长最快的领域")
            for domain, score in trends["top_growing_domains"]:
                if score > 0:
                    lines.append(f"- {domain}: +{score}")

        if trends.get("declining_domains"):
            lines.append("\n### ⚠️ 需要关注的领域")
            for domain, score in trends["declining_domains"]:
                if score < 0:
                    lines.append(f"- {domain}: {score}")

        lines.append(f"\n## 进化原则")
        lines.append("（基于近期经验的自动总结）")

        # 如果有 LLM，生成更深入的总结
        if self.llm:
            lines.append("\n> 待 LLM 分析...")
        else:
            lines.append(f"\n- 事件类型分布: {trends.get('event_types', {})}")
            lines.append(f"- 最近 {len(events)} 次进化中，知识库持续增长")

        return "\n".join(lines)

    def _save_narrative(self, content: str):
        os.makedirs(os.path.dirname(self.narrative_path), exist_ok=True)
        with open(self.narrative_path, "w") as f:
            f.write(content)


# ============================================================
# 基因合并引擎
# ============================================================

class GeneMerger:
    """
    定期合并相似的 Gene，保持知识库紧凑。
    
    借鉴 EvoMap 的 Skill Distiller：
    - 语义相似度检测
    - 合并为更通用的规则
    - 保留原始 Gene 作为进化历史
    """

    def __init__(self, data_dir: str, llm_client=None):
        self.data_dir = data_dir
        self.llm = llm_client
        self.kb = KnowledgeBase(data_dir)

    def merge_all(self, threshold: float = 0.8) -> list[dict]:
        """扫描所有 Gene，合并相似的"""
        merges = []
        all_genes = self.kb.get_all_active_genes()

        # 按领域分组
        by_domain = defaultdict(list)
        for gene in all_genes:
            by_domain[gene.domain].append(gene)

        for domain, genes in by_domain.items():
            merged = set()
            for i, g1 in enumerate(genes):
                if g1.id in merged:
                    continue
                for j, g2 in enumerate(genes):
                    if j <= i or g2.id in merged:
                        continue
                    similarity = self._compute_similarity(g1, g2)
                    if similarity >= threshold:
                        merged_gene = self._merge_pair(g1, g2)
                        if merged_gene:
                            merges.append({
                                "merged_from": [g1.id, g2.id],
                                "merged_to": merged_gene.id,
                                "similarity": similarity,
                                "content": merged_gene.content,
                            })
                            merged.add(g1.id)
                            merged.add(g2.id)

        return merges

    def _compute_similarity(self, g1: Gene, g2: Gene) -> float:
        """计算两个 Gene 的语义相似度"""
        # 基于字符集的 Jaccard 相似度
        words1 = set(g1.content)
        words2 = set(g2.content)
        if not words1 or not words2:
            return 0.0
        intersection = words1 & words2
        union = words1 | words2
        jaccard = len(intersection) / len(union)

        # 标签重叠加分
        tag_overlap = len(set(g1.tags) & set(g2.tags)) / max(1, len(set(g1.tags) | set(g2.tags)))

        return 0.7 * jaccard + 0.3 * tag_overlap

    def _merge_pair(self, g1: Gene, g2: Gene) -> Gene:
        """合并两个 Gene"""
        # 保留更强的 Gene 作为基础，合并信息
        base = g1 if g1.strength >= g2.strength else g2
        secondary = g2 if base is g1 else g1

        merged = Gene(
            id="",
            domain=base.domain,
            pattern=base.pattern,
            content=f"{base.content}（合并自 {secondary.id}）",
            type=base.type,
            source={
                "conversation_ids": base.source.get("conversation_ids", []) +
                                     secondary.source.get("conversation_ids", []),
                "derivation": f"合并自 {g1.id} 和 {g2.id}",
            },
            strength=(base.strength + secondary.strength) / 2,
            success_count=base.success_count + secondary.success_count,
            failure_count=base.failure_count + secondary.failure_count,
            tags=list(set(base.tags + secondary.tags)),
            evolution_history=base.evolution_history + [{
                "version": len(base.evolution_history) + 1,
                "date": datetime.now(timezone.utc).isoformat(),
                "change": f"与 {secondary.id} 合并",
            }],
        )

        # 标记原始 Gene 为已弃用
        g1.deprecated = True
        g2.deprecated = True
        self.kb.update_gene(g1)
        self.kb.update_gene(g2)

        # 添加合并后的 Gene
        self.kb.add_gene(merged)
        self.kb.log_event(EvolutionEvent(
            timestamp=datetime.now(timezone.utc).isoformat(),
            type="gene_merged",
            details={
                "merged_from": [g1.id, g2.id],
                "merged_to": merged.id,
                "merged_content": merged.content,
            },
        ))

        return merged


# ============================================================
# 统计报告
# ============================================================

class StatsReporter:
    """生成知识库统计报告"""

    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self.kb = KnowledgeBase(data_dir)

    def full_report(self) -> str:
        """生成完整报告"""
        status = self.kb.get_status()
        events = self._get_events()

        lines = [
            "=" * 60,
            "  🧬 MathEvolution 知识库报告",
            "=" * 60,
            f"\n生成时间: {datetime.now(timezone.utc).isoformat()}",
            f"\n📊 总体统计",
            f"  活跃 Gene:    {status['total_genes']}",
            f"  反模式:       {status['total_pitfalls']}",
            f"  已弃用 Gene:  {status['deprecated_genes']}",
            f"\n📋 领域分布",
        ]

        for domain, stats in sorted(status.get("domains", {}).items()):
            bar = "█" * min(stats['genes'], 20)
            lines.append(f"  {domain:<15} {bar} {stats['genes']}G / {stats['pitfalls']}P")

        # Top Gene（按强度排序）
        all_genes = self.kb.get_all_active_genes()
        top_genes = sorted(all_genes, key=lambda g: g.strength, reverse=True)[:10]

        lines.append(f"\n🌟 Top 10 Gene (按强度)")
        for i, gene in enumerate(top_genes, 1):
            icon = "🟢" if gene.strength >= 0.8 else "🟡" if gene.strength >= 0.5 else "🔴"
            lines.append(f"  {i:2}. {icon} [{gene.domain}] {gene.content[:70]}... ({gene.strength:.2f})")

        # 最近事件
        if events:
            lines.append(f"\n📜 最近进化事件")
            for e in events[-10:]:
                etype = e["type"]
                ts = e["timestamp"][:19]
                lines.append(f"  {ts} | {etype}")

        lines.append(f"\n{'=' * 60}")
        return "\n".join(lines)

    def _get_events(self) -> list[dict]:
        events_path = os.path.join(self.data_dir, "evolution", "events.jsonl")
        if not os.path.exists(events_path):
            return []
        events = []
        with open(events_path) as f:
            for line in f:
                events.append(json.loads(line))
        return events


# ============================================================
# CLI 扩展
# ============================================================

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="MathEvolution 高级功能")
    parser.add_argument("--data-dir", default="./math_evolution", help="知识库目录")
    parser.add_argument("--narrative", action="store_true", help="生成叙事记忆")
    parser.add_argument("--merge", action="store_true", help="合并相似 Gene")
    parser.add_argument("--report", action="store_true", help="生成完整报告")
    parser.add_argument("--merge-threshold", type=float, default=0.8, help="合并阈值")

    args = parser.parse_args()

    if args.narrative:
        gen = NarrativeGenerator(args.data_dir)
        narrative = gen.generate()
        print("✅ 叙事记忆已生成")
        print(narrative[:500] + "..." if len(narrative) > 500 else narrative)

    if args.merge:
        merger = GeneMerger(args.data_dir)
        merges = merger.merge_all(args.merge_threshold)
        print(f"✅ 合并了 {len(merges)} 对 Gene")
        for m in merges:
            print(f"   {m['merged_from']} → {m['merged_to']} (相似度: {m['similarity']:.2f})")

    if args.report:
        reporter = StatsReporter(args.data_dir)
        print(reporter.full_report())

    if not any([args.narrative, args.merge, args.report]):
        parser.print_help()