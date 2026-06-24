# MathEvolution Framework v2 Design

## Overview
This framework is designed to evolve the mathematical intelligence of the AI Math & Chat Studio. Unlike generic evolution engines, v2 is deeply integrated with the project's architecture, specifically the "Thinking Process" extraction and the dual-layer knowledge storage (Capsules & Genes).

## Core Concepts

### 1. The Knowledge Hierarchy
- **Capsules (`data/capsules/`)**: High-level domains of mathematical knowledge.
  - Examples: `general.json`, `algebra.json`, `functions.json`, `geometry_planar.json`, `geometry_solid.json`, `probability.json`.
  - Role: Acts as a container and provides context for related genes.
- **Genes (`data/genes/`)**: Atomic, actionable heuristics or "shortcuts" extracted from successful or corrected reasoning.
  - Format: Compact sentences (e.g., "When solving quadratic inequalities, always check the sign of the leading coefficient first.")
  - Metadata: Strength, success count, failure count, source session ID.

### 2. Feedback Signals
- **Explicit**: User feedback in sessions (if available).
- **Implicit**:
  - "Regenerate" actions: Indicates the original thinking was good but the output was flawed.
  - "Retry" actions: Indicates a complete failure of the logic.
  - LLM-as-Judge: Post-session analysis of logical rigor and KaTeX compliance.

## The Evolution Cycle

### Step 1: Session Parsing
- Extract `<details><summary>Thinking Process</summary>` blocks from `data/sessions/*.json`.
- Identify the problem type and mathematical domain.
- Clean up Markdown and KaTeX for analysis.

### Step 2: Critique & Reflection
- Analyze the thinking process for "Aha!" moments (elegant shortcuts) or "Pitfalls" (common mistakes).
- Verify KaTeX/mhchem syntax usage.
- Cross-reference with existing Genes to identify novelty.

### Step 3: Gene Synthesis
- If a new successful pattern is found: Create a candidate Gene.
- If a mistake is corrected (e.g., in a Regenerate session): Create a "Warning" Gene or update a Pitfall.

### Step 4: Validation Gate
- Consistency check: Does the new Gene contradict existing high-strength Genes?
- Back-testing: Re-run the thinking analysis on similar historical problems using the new Gene as a hint.

### Step 5: Integration
- Update `data/capsules` and `data/genes`.
- Synthesize the "Active Gene Set" into the system prompt via `MATH_INSTRUCTIONS` or a dynamic context injector.

## Implementation Details
- **Language**: Python 3.10+
- **Storage**: Direct JSON manipulation of `data/` files to ensure the main application can eventually read them.
- **LLM Integration**: Uses the same API providers configured in the project (OpenAI/Google/Nvidia).
