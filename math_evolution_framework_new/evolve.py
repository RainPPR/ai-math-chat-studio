import os
import json
from typing import List, Dict
from core.parser import SessionParser
from core.knowledge import KnowledgeManager

class EvolutionEngine:
    """Orchestrates the analysis and evolution of mathematical knowledge."""

    def __init__(self, sessions_dir: str, data_dir: str):
        self.parser = SessionParser(sessions_dir)
        self.km = KnowledgeManager(data_dir)

    def run_evolution_cycle(self, session_ids: List[str] = None):
        """Runs a full evolution cycle on specified or all sessions."""
        if not session_ids:
            session_ids = self.parser.list_sessions()

        results = []
        for sid in session_ids:
            try:
                parsed = self.parser.parse_session(sid)
                for turn in parsed['turns']:
                    if turn['thinking']:
                        # In a real scenario, this would call an LLM to critique the thinking
                        # and extract genes. For now, we simulate this or use a prompt-based approach.
                        gene_candidates = self.critique_thinking(turn['user_prompt'], turn['thinking'])
                        for candidate in gene_candidates:
                            gid = self.km.add_gene(
                                domain=candidate['domain'],
                                content=candidate['content'],
                                source_session=sid,
                                type=candidate['type']
                            )
                            results.append({"session": sid, "gene_id": gid, "content": candidate['content']})
            except Exception as e:
                print(f"Error evolving session {sid}: {e}")

        return results

    def critique_thinking(self, prompt: str, thinking: str) -> List[Dict]:
        """
        Analyzes thinking process to extract insights.
        In production, this would be an LLM call.
        """
        # Placeholder for LLM-based extraction logic
        # For the demo, we'll return an empty list or a hardcoded example
        # if the thinking contains certain keywords.
        candidates = []
        if "不动点" in thinking or "fixed point" in thinking.lower():
            candidates.append({
                "domain": "functions",
                "content": "For functional equations like f(x)=f(g(x)), analyze the fixed points and orbits of g(x).",
                "type": "heuristic"
            })
        return candidates

class Prompter:
    """Synthesizes evolved knowledge into system prompts."""

    def __init__(self, data_dir: str):
        self.km = KnowledgeManager(data_dir)

    def generate_augmented_instructions(self, domain: str = None) -> str:
        """Generates a string of math instructions enriched with high-strength genes."""
        genes = self.km.list_genes(domain)
        # Sort by strength and take top performers
        sorted_genes = sorted(genes, key=lambda x: x.get('strength', 0), reverse=True)
        top_genes = [g['content'] for g in sorted_genes[:10]]

        base_instructions = "When outputting math equations, ALWAYS use KaTeX formatting.\n"
        if top_genes:
            base_instructions += "\nSpecific Mathematical Heuristics:\n"
            for i, content in enumerate(top_genes, 1):
                base_instructions += f"{i}. {content}\n"

        return base_instructions

if __name__ == "__main__":
    engine = EvolutionEngine('data/sessions', '.')
    # Test with a specific session known to have fixed point thinking
    # From previous cat, 8dd09afd... has it.
    results = engine.run_evolution_cycle(['8dd09afd-9df0-4c48-9691-97a2d6b3b070'])
    print(f"Evolution results: {json.dumps(results, indent=2, ensure_ascii=False)}")

    prompter = Prompter('.')
    print("\nGenerated Instructions:")
    print(prompter.generate_augmented_instructions())
