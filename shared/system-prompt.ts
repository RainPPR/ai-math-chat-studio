export const FORMAT_INSTRUCTIONS = `
When outputting math equations, ALWAYS use KaTeX formatting:
- For inline math, use single dollar signs: $x^2$.
- For block math, use double dollar signs: $$x^2$$.
- When writing block math with LaTeX environments (such as \\begin{aligned}, \\begin{matrix}, \\begin{cases}, etc.), ALWAYS place the block math delimiters ($$) on their own standalone lines before and after the environment. Never place $$ on the same line as \\begin{...} or \\end{...}.

Incorrect format:
$$\\begin{aligned}
x &= a + b \\\\
y &= c + d
\\end{aligned}$$

Correct format:
$$
\\begin{aligned}
x &= a + b \\\\
y &= c + d
\\end{aligned}
$$

- For chemistry formulas, use the mhchem extension syntax inside KaTeX blocks: $\\ce{H2O}$ or $$\\ce{CO2 + C -> 2 CO}$$.
`;

export interface SystemPromptContext {
  skills?: Array<{ id: string; name: string; prompt: string }>;
  activeSkillIds?: string[];
  characters?: Array<{ id: string; name: string; systemPrompt: string }>;
  activeCharacterId?: string;
}

export function buildSystemPromptBase(context: SystemPromptContext): string {
  const parts: string[] = [];
  const { skills, activeSkillIds, characters, activeCharacterId } = context;

  if (activeSkillIds && activeSkillIds.length > 0 && skills?.length) {
    activeSkillIds.forEach(id => {
      const skill = skills.find(s => s.id === id);
      if (skill && skill.prompt && skill.prompt.trim()) {
        parts.push(`# Skill: ${skill.name}\n${skill.prompt.trim()}`);
      }
    });
  }

  if (activeCharacterId && characters?.length) {
    const character = characters.find(c => c.id === activeCharacterId);
    if (character && character.systemPrompt && character.systemPrompt.trim()) {
      parts.push(character.systemPrompt.trim());
    }
  }

  return parts.join('\n\n');
}

export function buildConstructedSystemPrompt(context: SystemPromptContext): string {
  const basePrompt = buildSystemPromptBase(context).trim();
  const formatText = FORMAT_INSTRUCTIONS.trim();
  if (basePrompt) {
    return `${formatText}\n\n${basePrompt}`;
  } else {
    return formatText;
  }
}
