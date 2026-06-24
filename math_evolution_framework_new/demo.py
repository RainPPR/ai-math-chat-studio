import os
import json
from evolve import EvolutionEngine, Prompter

def run_demo():
    print("="*60)
    print("  🧬 MathEvolution v2 Demo")
    print("="*60)

    engine = EvolutionEngine('data/sessions', '.')
    prompter = Prompter('.')

    # 1. Show existing status
    print("\n[Step 1] Current Augmented Instructions:")
    print("-" * 40)
    print(prompter.generate_augmented_instructions())
    print("-" * 40)

    # 2. Pick a session and evolve
    session_id = '8dd09afd-9df0-4c48-9691-97a2d6b3b070'
    print(f"\n[Step 2] Evolving from session: {session_id}...")
    results = engine.run_evolution_cycle([session_id])

    if results:
        print(f"  ✅ Extracted {len(results)} new Genes.")
        for res in results:
            print(f"     - {res['content']}")
    else:
        print("  ℹ️ No new knowledge extracted from this session.")

    # 3. Show updated status
    print("\n[Step 3] Updated Augmented Instructions:")
    print("-" * 40)
    print(prompter.generate_augmented_instructions())
    print("-" * 40)

    print("\n✅ Demo finished successfully.")

if __name__ == "__main__":
    run_demo()
