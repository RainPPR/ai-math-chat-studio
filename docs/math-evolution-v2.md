# MathEvolution Framework v2

## Introduction
The MathEvolution Framework v2 is a specialized knowledge evolution engine integrated directly into the AI Math & Chat Studio. It analyzes "Thinking Process" blocks from chat sessions to extract mathematical heuristics (Genes) and categorizes them into domains (Capsules).

## Architecture

### 1. Data Structure
- **data/capsules/**: Domain-specific containers (e.g., `algebra.json`, `calculus.json`).
- **data/genes/**: Atomic mathematical rules extracted from sessions.

### 2. Core Modules
- **SessionParser**: Extracts reasoning and math from session JSONs.
- **KnowledgeManager**: Manages the CRUD operations for Capsules and Genes.
- **EvolutionEngine**: Analyzes thinking processes to synthesize new knowledge.
- **Prompter**: Generates augmented system instructions based on the strongest Genes.

## How it Works
1. **Extraction**: The engine scans `data/sessions/` for model responses containing `<details><summary>Thinking Process</summary>`.
2. **Analysis**: It identifies mathematical patterns and "Aha!" moments.
3. **Evolution**: New Genes are created or existing ones are strengthened/weakened based on session outcomes.
4. **Injection**: Evolved knowledge is synthesized back into the `MATH_INSTRUCTIONS` sent to the LLM.

## CLI Usage
- **Bootstrap**: `python3 math_evolution_framework_new/bootstrap.py` (Initial scan of historical sessions).
- **Demo**: `python3 math_evolution_framework_new/demo.py` (Run a full evolution cycle on a sample session).

## Integration with AGENTS.md
Developers should ensure that new mathematical domains or common pitfalls are reflected in the Capsule structure.
