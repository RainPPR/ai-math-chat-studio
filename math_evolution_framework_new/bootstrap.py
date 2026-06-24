import os
import sys
from core.knowledge import KnowledgeManager
from evolve import EvolutionEngine

def bootstrap():
    print("🚀 Starting MathEvolution v2 Bootstrap...")

    # Initialize dirs
    km = KnowledgeManager('.')
    engine = EvolutionEngine('data/sessions', '.')

    # Pre-create capsules
    domains = [
        'general', 'algebra', 'functions', 'geometry_planar',
        'geometry_solid', 'trigonometry', 'calculus',
        'probability', 'number_theory'
    ]
    for d in domains:
        km.get_capsule(d)
        print(f"  Initialized capsule: {d}")

    # Initial scan of all sessions
    print("\n🔍 Scanning 200+ sessions for initial knowledge...")
    sessions = engine.parser.list_sessions()
    print(f"  Found {len(sessions)} sessions.")

    # In bootstrap, we might want to process more aggressively or look for specific patterns
    results = engine.run_evolution_cycle(sessions[:50]) # Sample for bootstrap speed

    print(f"\n✅ Bootstrap complete!")
    print(f"  Extracted {len(results)} initial Genes.")
    print(f"  Knowledge base ready at data/capsules and data/genes.")

if __name__ == "__main__":
    bootstrap()
