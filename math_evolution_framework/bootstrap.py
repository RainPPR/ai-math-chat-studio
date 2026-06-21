"""
批量初始化脚本 — 从 200+ 历史对话中一次性提取知识库

使用方法:
    python bootstrap.py --conversations ./my_conversations/ --output ./math_evolution/
"""

import json
import os
import argparse
from collections import defaultdict
from evolve import MathEvolution, Gene, Pitfall, EvolutionEvent, KnowledgeBase
from datetime import datetime, timezone


def load_conversations_from_dir(directory: str) -> list[dict]:
    """支持多种格式加载对话"""
    conversations = []

    if not os.path.isdir(directory):
        print(f"❌ 目录不存在: {directory}")
        return conversations

    files = sorted(os.listdir(directory))
    if not files:
        print(f"⚠️  目录为空: {directory}")
        return conversations

    for fname in files:
        fpath = os.path.join(directory, fname)

        # JSON 文件
        if fname.endswith(".json"):
            with open(fpath) as f:
                data = json.load(f)
                if isinstance(data, list):
                    conversations.extend(data)
                else:
                    conversations.append(data)

        # JSONL 文件
        elif fname.endswith(".jsonl"):
            with open(fpath) as f:
                for line in f:
                    if line.strip():
                        conversations.append(json.loads(line))

        # Markdown 文件（假设每条对话以 ## 分隔）
        elif fname.endswith(".md"):
            with open(fpath) as f:
                content = f.read()
                # 简单解析：## 标题 = 题目，后面的内容 = 解题过程
                sections = content.split("\n## ")
                for section in sections[1:]:  # 跳过第一个空段
                    lines = section.strip().split("\n", 1)
                    problem = lines[0].strip()
                    solution = lines[1].strip() if len(lines) > 1 else ""
                    conversations.append({
                        "id": f"{fname}#{hash(problem) % 10000}",
                        "problem": problem,
                        "solution_steps": [solution],
                        "source_file": fname,
                    })

    return conversations


def normalize_conversation(conv: dict) -> dict:
    """将各种格式的对话统一为标准格式"""
    return {
        "id": conv.get("id", f"conv-{hash(str(conv)) % 100000}"),
        "problem": conv.get("problem", conv.get("question", conv.get("title", ""))),
        "solution_steps": conv.get("solution_steps", conv.get("steps", [conv.get("solution", "")])),
        "final_answer": conv.get("final_answer", conv.get("answer", "")),
        "is_correct": conv.get("is_correct", conv.get("correct", None)),
        "user_feedback": conv.get("user_feedback", conv.get("feedback", "")),
        "source_file": conv.get("source_file", ""),
    }


def group_by_problem_type(conversations: list[dict], analyzer) -> dict:
    """按题型分组"""
    groups = defaultdict(list)
    for conv in conversations:
        ptype = analyzer._classify_problem(conv["problem"])
        groups[ptype].append(conv)
    return dict(groups)


def extract_initial_patterns(groups: dict, output_dir: str):
    """为每个题型生成初始 Pattern 模板"""
    patterns_dir = os.path.join(output_dir, "patterns")
    os.makedirs(patterns_dir, exist_ok=True)

    for ptype, convs in groups.items():
        correct_count = sum(1 for c in convs if c.get("is_correct") is True)
        total = len(convs)

        pattern_content = f"""---
id: pattern-{ptype}
domain: {_infer_domain(ptype)}
category: {ptype}
initialized_from: {len(convs)} conversations
---

# {ptype.replace('_', ' ').title()}

## 统计
- 历史出现次数：{total}
- 历史正确率：{correct_count}/{total} = {correct_count/total*100:.0f}% (如果标注了正确性)

## 典型问题形式
（从历史对话中自动提取，待人工补充）

## 标准解法步骤
（从历史对话中自动提取，待人工补充）

## 常见变体
（待人工补充）

## 易错点
（由进化框架自动填充）

## 相关 Gene
（由进化框架自动关联）
"""
        fpath = os.path.join(patterns_dir, f"{ptype}.md")
        with open(fpath, "w") as f:
            f.write(pattern_content)

    print(f"   📋 生成了 {len(groups)} 个初始 Pattern 模板")


def generate_initial_narrative(groups: dict, output_dir: str):
    """生成初始叙事记忆"""
    evolution_dir = os.path.join(output_dir, "evolution")
    os.makedirs(evolution_dir, exist_ok=True)

    total_convs = sum(len(v) for v in groups.values())
    total_correct = sum(
        sum(1 for c in convs if c.get("is_correct") is True)
        for convs in groups.values()
    )

    narrative = f"""# 初始叙事记忆

## 生成时间
{datetime.now(timezone.utc).isoformat()}

## 数据概况
从 {total_convs} 条历史对话中初始化知识库。

## 题型分布
{chr(10).join(f"- {ptype}: {len(convs)} 条" for ptype, convs in sorted(groups.items(), key=lambda x: -len(x[1])))}

## 整体表现
- 标注了正确性的对话：{total_correct} 条正确
- 整体正确率：{total_correct}/{total_convs} = {total_correct/total_convs*100:.0f}% (如果标注了正确性)

## 关键发现
（待进化框架运行后自动填充）

## 进化目标
- 重点关注高频题型中的错误模式
- 从成功案例中提取高效策略
- 建立题型间的知识关联
"""
    fpath = os.path.join(evolution_dir, "narrative.md")
    with open(fpath, "w") as f:
        f.write(narrative)

    print(f"   📝 生成了初始叙事记忆")


def _infer_domain(ptype: str) -> str:
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
    return domain_map.get(ptype, "general")


def main():
    parser = argparse.ArgumentParser(description="从历史对话批量初始化 MathEvolution 知识库")
    parser.add_argument("--conversations", required=True, help="历史对话目录")
    parser.add_argument("--output", default="./math_evolution", help="输出目录")
    parser.add_argument("--format", default="auto", help="对话格式: auto, json, jsonl, markdown")
    parser.add_argument("--strategy", default="explore", help="初始化策略: explore (推荐)")
    args = parser.parse_args()

    print("🧬 MathEvolution 批量初始化")
    print(f"   对话目录: {args.conversations}")
    print(f"   输出目录: {args.output}")
    print()

    # 加载对话
    conversations = load_conversations_from_dir(args.conversations)
    print(f"📂 加载了 {len(conversations)} 条对话")

    if not conversations:
        print("❌ 未找到对话数据，请检查目录和格式")
        return

    # 标准化
    conversations = [normalize_conversation(c) for c in conversations]

    # 初始化引擎
    engine = MathEvolution(
        data_dir=args.output,
        config={
            "gene": {"max_length": 100},
            "circuit_breaker": {
                "max_consecutive_failures": 3,
                "max_consecutive_failures_degrade": 5,
                "domain_failure_threshold": 3,
            },
        },
    )

    # 按题型分组
    groups = group_by_problem_type(conversations, engine.analyzer)
    print(f"📊 识别了 {len(groups)} 种题型:")
    for ptype, convs in sorted(groups.items(), key=lambda x: -len(x[1])):
        correct = sum(1 for c in convs if c.get("is_correct") is True)
        print(f"   - {ptype}: {len(convs)} 条对话 (标注正确 {correct})")

    print()

    # 生成初始 Pattern
    extract_initial_patterns(groups, args.output)

    # 生成叙事记忆
    generate_initial_narrative(groups, args.output)

    # 分批进化
    total_accepted_genes = 0
    total_accepted_pitfalls = 0

    for ptype, batch in sorted(groups.items(), key=lambda x: -len(x[1])):
        print(f"🔍 处理 {ptype} ({len(batch)} 条)...")
        result = engine.evolve(batch, strategy=args.strategy)
        total_accepted_genes += result["summary"]["genes_accepted"]
        total_accepted_pitfalls += result["summary"]["pitfalls_accepted"]
        print(f"   ✅ {result['summary']['genes_accepted']} Genes, "
              f"{result['summary']['pitfalls_accepted']} Pitfalls")

    print(f"\n{'='*50}")
    print(f"✅ 初始化完成！")
    print(f"   - 分析对话: {len(conversations)} 条")
    print(f"   - 识别题型: {len(groups)} 种")
    print(f"   - 提取 Gene: {total_accepted_genes} 条")
    print(f"   - 记录 Pitfall: {total_accepted_pitfalls} 个")
    print(f"   - 知识库: {args.output}/")
    print(f"\n💡 下一步:")
    print(f"   python evolve.py --status  # 查看知识库状态")
    print(f"   python evolve.py --conversations new_convs.json  # 日常进化")
    print(f"{'='*50}")


if __name__ == "__main__":
    main()