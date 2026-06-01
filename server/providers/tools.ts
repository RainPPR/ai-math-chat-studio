import * as math from 'mathjs';
import nerdamer from 'nerdamer';
import 'nerdamer/Algebra';
import 'nerdamer/Calculus';
import 'nerdamer/Solve';

export function executeMathTool(name: string, args: Record<string, any>): string {
  try {
    if (name === 'evaluate_expression') return String(math.evaluate(args.expression));
    if (name === 'solve_equation') return (nerdamer as any).solveEquations(args.equation, args.variable).toString();
    if (name === 'calculate_derivative') return math.derivative(args.expression, args.variable).toString();
    return 'Unknown tool.';
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

export const MATH_INSTRUCTIONS = `
CRITICAL INSTRUCTION: You have access to mathematical tools: 'evaluate_expression', 'solve_equation', and 'calculate_derivative'. You MUST use these tools for ANY mathematical calculation, equation solving, or differentiation. 
DO NOT perform calculations or algebraic manipulations in your head. DO NOT guess the answer. Even for simple arithmetic or algebra, you MUST call the appropriate tool to guarantee accuracy. 
Failure to use the tools for math will result in incorrect answers.
When outputting math equations, ALWAYS use KaTeX formatting. 
For inline math, use single dollar signs: $x^2$.
For block math, use double dollar signs: $$x^2$$.
For chemistry formulas, use the mhchem extension syntax inside KaTeX blocks: $\\ce{H2O}$ or $$\\ce{CO2 + C -> 2 CO}$$.

TOOL CALLING & REASONING CONSTRAINTS:
You MUST call tools either during your thinking process or BEFORE outputting your final response. You MUST deeply think and comprehensively formulate your final answer BEFORE responding. You must finish your entire response at once without interruption.
`;

const TOOL_SCHEMAS = {
  evaluate_expression: {
    description: 'Evaluates a mathematical expression safely. Supports basic arithmetic, trigonometry, and other standard math functions.',
    properties: {
      expression: { type: 'string', description: "The mathematical expression to evaluate (e.g., '2 + 2', 'sin(pi/4)', 'sqrt(16)')." },
    },
    required: ['expression'],
  },
  solve_equation: {
    description: 'Solves an algebraic equation for a specific variable. Returns exact algebraic solutions when possible.',
    properties: {
      equation: { type: 'string', description: "The equation to solve (e.g., 'x^2 - 4 = 0', '2*x + y = 10')." },
      variable: { type: 'string', description: "The variable to solve for (e.g., 'x')." },
    },
    required: ['equation', 'variable'],
  },
  calculate_derivative: {
    description: 'Calculates the mathematical derivative of an expression with respect to a variable.',
    properties: {
      expression: { type: 'string', description: "The mathematical expression to differentiate (e.g., 'x^2 + 2*x', 'sin(x)')." },
      variable: { type: 'string', description: "The variable to differentiate with respect to (e.g., 'x')." },
    },
    required: ['expression', 'variable'],
  },
};

export const ALL_TOOL_NAMES = Object.keys(TOOL_SCHEMAS) as (keyof typeof TOOL_SCHEMAS)[];

export function buildOpenAITools(disabledTools: string[] = []): any[] {
  return ALL_TOOL_NAMES
    .filter(name => !disabledTools.includes(name))
    .map(name => ({
      type: 'function',
      function: { name, ...TOOL_SCHEMAS[name], parameters: { type: 'object', properties: TOOL_SCHEMAS[name].properties, required: TOOL_SCHEMAS[name].required } },
    }));
}

export function buildGeminiTools(disabledTools: string[] = []): any[] {
  return ALL_TOOL_NAMES
    .filter(name => !disabledTools.includes(name))
    .map(name => ({
      name,
      description: TOOL_SCHEMAS[name].description,
      parameters: {
        type: 'OBJECT',
        properties: Object.fromEntries(
          Object.entries(TOOL_SCHEMAS[name].properties).map(([k, v]) => [k, { type: 'STRING', description: v.description }])
        ),
        required: TOOL_SCHEMAS[name].required,
      },
    }));
}
