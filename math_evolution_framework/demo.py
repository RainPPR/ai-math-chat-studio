"""
演示脚本 — 展示 MathEvolution 的完整工作流程

使用方法:
    python demo.py
"""

import json
import os
import sys
import tempfile
from datetime import datetime, timezone

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(__file__))

from evolve import MathEvolution, bootstrap_from_history
from advanced import NarrativeGenerator, GeneMerger, StatsReporter


def create_demo_conversations():
    """创建模拟对话数据"""
    return [
        # === 代数：二次方程 ===
        {
            "id": "conv-001",
            "problem": "解方程 x² - 5x + 6 = 0",
            "solution_steps": [
                "识别为二次方程，a=1, b=-5, c=6",
                "计算判别式 Δ = b² - 4ac = 25 - 24 = 1",
                "Δ > 0，有两个实根",
                "x = (5 ± 1) / 2",
                "x₁ = 3, x₂ = 2"
            ],
            "final_answer": "x = 2 或 x = 3",
            "is_correct": True,
        },
        {
            "id": "conv-002",
            "problem": "解方程 x² + 2x + 5 = 0",
            "solution_steps": [
                "a=1, b=2, c=5",
                "计算 Δ = 4 - 20 = -16",
                "Δ < 0，无实数根"
            ],
            "final_answer": "无实数根",
            "is_correct": True,
        },
        {
            "id": "conv-003",
            "problem": "已知 x₁, x₂ 是 2x² - 6x + 1 = 0 的两根，求 x₁² + x₂²",
            "solution_steps": [
                "a=2, b=-6, c=1",
                "用韦达定理：x₁ + x₂ = 3, x₁x₂ = 0.5",
                "x₁² + x₂² = (x₁ + x₂)² - 2x₁x₂ = 9 - 1 = 8"
            ],
            "final_answer": "8",
            "is_correct": True,
        },
        {
            "id": "conv-004",
            "problem": "解方程 x² - 4x + 4 = 0",
            "solution_steps": [
                "a=1, b=-4, c=4",
                "Δ = 16 - 16 = 0",
                "Δ = 0，有一个重根",
                "x = 4/2 = 2"
            ],
            "final_answer": "x = 2 (重根)",
            "is_correct": True,
        },
        {
            "id": "conv-005",
            "problem": "解方程 x² + 3x + 2 = 0",
            "solution_steps": [
                "a=1, b=3, c=2",
                "Δ = 9 - 8 = 1",
                "x = (-3 ± 1) / 2",
                "x₁ = -1, x₂ = -2"
            ],
            "final_answer": "x = -1 或 x = -2",
            "is_correct": True,
        },
        # 错误案例
        {
            "id": "conv-006",
            "problem": "解方程 2x² - 3x + 1 = 0",
            "solution_steps": [
                "a=2, b=-3, c=1",
                "Δ = (-3)² - 4·2·1 = 9 - 8 = 1",
                "x = (3 ± 1) / 4",  # 错误：应该是 (-b ± √Δ)/2a = (3 ± 1)/4
                "x₁ = 1, x₂ = 0.5"  # 巧合正确
            ],
            "final_answer": "x = 1 或 x = 0.5",
            "is_correct": True,  # 答案正确但过程有瑕疵
        },
        {
            "id": "conv-007",
            "problem": "解方程 x² - 2x + 5 = 0",
            "solution_steps": [
                "Δ = 4 - 20 = -16",
                "因为 Δ < 0，所以 x = (-2 ± √(-16)) / 2",
                "x = (-2 ± 4i) / 2",
                "x = -1 ± 2i"  # 如果题目要求实数解，这是错误
            ],
            "final_answer": "x = -1 ± 2i",
            "is_correct": False,  # 假设题目要求实数解
        },
        # === 代数：不等式 ===
        {
            "id": "conv-008",
            "problem": "解不等式 3x - 7 > 2x + 5",
            "solution_steps": [
                "3x - 7 > 2x + 5",
                "3x - 2x > 5 + 7",
                "x > 12"
            ],
            "final_answer": "x > 12",
            "is_correct": True,
        },
        {
            "id": "conv-009",
            "problem": "解不等式 -2x + 4 > 0",
            "solution_steps": [
                "-2x > -4",
                "x > 2"  # 错误：没反转不等号
            ],
            "final_answer": "x > 2",
            "is_correct": False,
        },
        {
            "id": "conv-010",
            "problem": "解不等式 (x-1)(x-3) < 0",
            "solution_steps": [
                "找零点：x=1, x=3",
                "三个区间：(-∞,1), (1,3), (3,+∞)",
                "测试 x=0: (0-1)(0-3) = 3 > 0 ✗",
                "测试 x=2: (2-1)(2-3) = -1 < 0 ✓",
                "测试 x=4: (4-1)(4-3) = 3 > 0 ✗",
                "解集为 (1, 3)"
            ],
            "final_answer": "1 < x < 3",
            "is_correct": True,
        },
        # === 数列 ===
        {
            "id": "conv-011",
            "problem": "等差数列 {aₙ} 中，a₁=3, d=4，求 S₁₀",
            "solution_steps": [
                "a₁₀ = a₁ + 9d = 3 + 36 = 39",
                "S₁₀ = 10(a₁ + a₁₀)/2 = 10(3+39)/2 = 210"
            ],
            "final_answer": "210",
            "is_correct": True,
        },
        {
            "id": "conv-012",
            "problem": "等比数列 {bₙ} 中，b₁=2, q=3，求前 5 项和",
            "solution_steps": [
                "S₅ = 2(3⁵-1)/(3-1) = 2(243-1)/2 = 242"
            ],
            "final_answer": "242",
            "is_correct": True,
        },
        # === 三角函数 ===
        {
            "id": "conv-013",
            "problem": "求 sin 30° 的值",
            "solution_steps": ["sin 30° = 1/2"],
            "final_answer": "1/2",
            "is_correct": True,
        },
        {
            "id": "conv-014",
            "problem": "已知 sin θ = 3/5，θ 在第一象限，求 cos θ",
            "solution_steps": [
                "sin²θ + cos²θ = 1",
                "cos²θ = 1 - 9/25 = 16/25",
                "θ 在第一象限，cos θ > 0",
                "cos θ = 4/5"
            ],
            "final_answer": "4/5",
            "is_correct": True,
        },
        {
            "id": "conv-015",
            "problem": "求 sin 150° 的值",
            "solution_steps": [
                "sin 150° = sin 30° = 1/2",
                "sin(180°-θ) = sin θ"
            ],
            "final_answer": "1/2",
            "is_correct": True,
        },
    ]


def demo_basic_flow():
    """演示基本进化流程"""
    print("=" * 60)
    print("  🧬 MathEvolution 演示 — 基本流程")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        data_dir = os.path.join(tmpdir, "math_evolution")
        os.makedirs(data_dir, exist_ok=True)

        # 创建示例基因和反模式（作为种子数据）
        engine = MathEvolution(data_dir)

        # 手动添加种子数据
        from evolve import Gene, Pitfall

        seed_genes = [
            Gene(
                id="seed-001", domain="algebra", pattern="quadratic_equation",
                content="判别式 Δ = b² - 4ac 是判断二次方程根的关键",
                type="heuristic",
                source={"conversation_ids": [], "derivation": "种子数据"},
                strength=0.70, tags=["quadratic", "basic"],
            ),
            Gene(
                id="seed-002", domain="algebra", pattern="inequality",
                content="不等式两边同乘负数时务必反转不等号方向",
                type="warning",
                source={"conversation_ids": [], "derivation": "种子数据"},
                strength=0.90, tags=["inequality", "sign"],
            ),
        ]
        for g in seed_genes:
            engine.knowledge_base.add_gene(g)

        # 加载模拟对话
        conversations = create_demo_conversations()
        print(f"\n📂 准备了 {len(conversations)} 条模拟对话")
        print(f"   - 正确: {sum(1 for c in conversations if c.get('is_correct'))}")
        print(f"   - 错误: {sum(1 for c in conversations if c.get('is_correct') is False)}")
        print(f"   - 未标注: {sum(1 for c in conversations if c.get('is_correct') is None)}")

        # 分批进化
        print(f"\n🔄 开始进化...")
        result = engine.evolve(conversations, strategy="explore")

        # 打印结果
        summary = result["summary"]
        print(f"\n{'─' * 40}")
        print(f"📊 进化结果摘要")
        print(f"   分析对话: {summary['conversations_analyzed']} 条")
        print(f"   策略: {summary['strategy']}")
        print(f"   耗时: {summary['elapsed_seconds']:.2f}s")
        print(f"   接受 Gene: {summary['genes_accepted']}")
        print(f"   拒绝 Gene: {summary['genes_rejected']}")
        print(f"   接受 Pitfall: {summary['pitfalls_accepted']}")
        print(f"   断路器警报: {summary['circuit_breaker_alerts']}")

        if result["accepted_genes"]:
            print(f"\n💡 新接受的 Gene:")
            for g in result["accepted_genes"][:5]:
                print(f"   - {g}")

        if result["rejected_genes"]:
            print(f"\n❌ 被拒绝的候选:")
            for r in result["rejected_genes"][:5]:
                print(f"   - {r}")

        # 知识库状态
        status = engine.get_status()
        print(f"\n📊 知识库状态")
        print(f"   总 Gene: {status['total_genes']}")
        print(f"   总 Pitfall: {status['total_pitfalls']}")
        for domain, stats in sorted(status.get("domains", {}).items()):
            print(f"   {domain}: {stats['genes']}G / {stats['pitfalls']}P")

        print(f"\n✅ 演示完成！知识库在 {data_dir}")


def demo_advanced_features():
    """演示高级功能"""
    print("\n" + "=" * 60)
    print("  🧬 MathEvolution 演示 — 高级功能")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        data_dir = os.path.join(tmpdir, "math_evolution")

        # 初始化引擎并添加种子数据
        engine = MathEvolution(data_dir)
        conversations = create_demo_conversations()
        engine.evolve(conversations, strategy="explore")

        # 1. 叙事记忆
        print(f"\n📝 生成叙事记忆...")
        gen = NarrativeGenerator(data_dir)
        narrative = gen.generate()
        print(f"   ✅ 叙事记忆已生成")
        for line in narrative.split("\n")[:10]:
            print(f"   {line}")

        # 2. Gene 合并
        print(f"\n🔗 检查可合并的 Gene...")
        merger = GeneMerger(data_dir)
        merges = merger.merge_all(threshold=0.6)
        if merges:
            print(f"   合并了 {len(merges)} 对 Gene")
            for m in merges:
                print(f"   {m['merged_from']} → {m['merged_to']}")
        else:
            print(f"   无可合并的 Gene（相似度 < 0.6）")

        # 3. 统计报告
        print(f"\n📊 生成统计报告...")
        reporter = StatsReporter(data_dir)
        print(reporter.full_report())


def demo_circuit_breaker():
    """演示失败断路器"""
    print("\n" + "=" * 60)
    print("  🧬 MathEvolution 演示 — 失败断路器")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        data_dir = os.path.join(tmpdir, "math_evolution")
        engine = MathEvolution(data_dir)

        from evolve import Gene

        # 创建一个会连续失败的 Gene
        bad_gene = Gene(
            id="test-bad-001",
            domain="algebra",
            pattern="quadratic_equation",
            content="【错误规则】判别式 Δ 为正时，方程一定有两个正根",
            type="heuristic",
            source={"conversation_ids": ["test"], "derivation": "测试数据"},
            strength=0.8,
            failure_count=0,
            consecutive_failures=0,
            tags=["test"],
        )
        engine.knowledge_base.add_gene(bad_gene)
        print(f"\n📌 创建了测试 Gene: '{bad_gene.content}'")
        print(f"   初始强度: {bad_gene.strength}")

        # 模拟连续失败
        from evolve import FailureCircuitBreaker
        breaker = FailureCircuitBreaker({
            "circuit_breaker": {
                "max_consecutive_failures": 3,
                "max_consecutive_failures_degrade": 5,
                "domain_failure_threshold": 3,
            }
        })

        for i in range(6):
            gene = engine.knowledge_base.get_gene("test-bad-001")
            gene.consecutive_failures = i + 1
            gene.failure_count = i + 1
            gene.strength = max(0.1, gene.strength - 0.1)
            engine.knowledge_base.update_gene(gene)

            alerts = breaker.check(engine.knowledge_base)
            if alerts:
                print(f"\n   第 {i+1} 次失败后:")
                for alert in alerts:
                    print(f"   🚨 [{alert['level']}] {alert['message']}")

                breaker.apply(engine.knowledge_base, alerts)

        # 最终状态
        gene = engine.knowledge_base.get_gene("test-bad-001")
        print(f"\n   最终状态: deprecated={gene.deprecated}, strength={gene.strength:.2f}")
        print(f"   ✅ 断路器成功阻止了错误经验的固化")


def demo_bootstrap():
    """演示从文件初始化"""
    print("\n" + "=" * 60)
    print("  🧬 MathEvolution 演示 — 批量初始化")
    print("=" * 60)

    with tempfile.TemporaryDirectory() as tmpdir:
        conv_dir = os.path.join(tmpdir, "conversations")
        output_dir = os.path.join(tmpdir, "math_evolution")

        # 创建模拟对话文件
        os.makedirs(conv_dir)
        conversations = create_demo_conversations()

        # 保存为 JSONL
        jsonl_path = os.path.join(conv_dir, "demo_conversations.jsonl")
        with open(jsonl_path, "w") as f:
            for conv in conversations:
                f.write(json.dumps(conv, ensure_ascii=False) + "\n")

        print(f"\n📂 创建了模拟对话文件: {jsonl_path}")
        print(f"   包含 {len(conversations)} 条对话")

        # 初始化
        print(f"\n🔄 从对话文件初始化知识库...")
        engine = bootstrap_from_history(conv_dir, output_dir)

        status = engine.get_status()
        print(f"\n📊 初始化后知识库状态")
        print(f"   Gene: {status['total_genes']}")
        print(f"   Pitfall: {status['total_pitfalls']}")
        for domain, stats in sorted(status.get("domains", {}).items()):
            print(f"   {domain}: {stats['genes']}G / {stats['pitfalls']}P")


if __name__ == "__main__":
    print("🧬 MathEvolution 演示套件")
    print("   这个演示使用临时目录，不会影响你的实际数据")
    print()

    demo_basic_flow()
    demo_advanced_features()
    demo_circuit_breaker()
    demo_bootstrap()

    print("\n" + "=" * 60)
    print("  🎉 所有演示完成！")
    print("=" * 60)
    print("""
下一步：
  1. 准备你的实际对话数据
  2. 运行: python bootstrap.py --conversations ./your_conversations/ --output ./math_evolution/
  3. 日常进化: python evolve.py --conversations new_convs.json
  4. 查看状态: python evolve.py --status
  5. 生成报告: python advanced.py --report
""")