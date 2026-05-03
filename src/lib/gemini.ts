import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import * as math from 'mathjs';
import nerdamer from 'nerdamer';
import 'nerdamer/Algebra';
import 'nerdamer/Calculus';
import 'nerdamer/Solve';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const evaluateExpressionTool: FunctionDeclaration = {
  name: "evaluate_expression",
  description: "Evaluates a mathematical expression safely. Supports basic arithmetic, trigonometry, and other standard math functions.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      expression: {
        type: Type.STRING,
        description: "The mathematical expression to evaluate (e.g., '2 + 2', 'sin(pi/4)', 'sqrt(16)').",
      },
    },
    required: ["expression"],
  },
};

export const solveEquationTool: FunctionDeclaration = {
  name: "solve_equation",
  description: "Solves an algebraic equation for a specific variable. Returns exact algebraic solutions when possible.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      equation: {
        type: Type.STRING,
        description: "The equation to solve (e.g., 'x^2 - 4 = 0', '2*x + y = 10').",
      },
      variable: {
        type: Type.STRING,
        description: "The variable to solve for (e.g., 'x').",
      },
    },
    required: ["equation", "variable"],
  },
};

export const calculateDerivativeTool: FunctionDeclaration = {
  name: "calculate_derivative",
  description: "Calculates the mathematical derivative of an expression with respect to a variable.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      expression: {
        type: Type.STRING,
        description: "The mathematical expression to differentiate (e.g., 'x^2 + 2*x', 'sin(x)').",
      },
      variable: {
        type: Type.STRING,
        description: "The variable to differentiate with respect to (e.g., 'x').",
      },
    },
    required: ["expression", "variable"],
  },
};

export async function fetchModels() {
  const models: string[] = [];
  try {
    const pager = await ai.models.list();
    for await (const m of pager) {
      if (m.supportedActions && m.supportedActions.includes('generateContent')) {
        if (m.name) {
          models.push(m.name.replace('models/', ''));
        }
      }
    }
    return models;
  } catch (error) {
    console.error("Failed to fetch models", error);
    return [];
  }
}

export const getMathInstructions = () => `
CRITICAL INSTRUCTION: You have access to mathematical tools: 'evaluate_expression', 'solve_equation', and 'calculate_derivative'. You MUST use these tools for ANY mathematical calculation, equation solving, or differentiation. 
DO NOT perform calculations or algebraic manipulations in your head. DO NOT guess the answer. Even for simple arithmetic or algebra, you MUST call the appropriate tool to guarantee accuracy. 
Failure to use the tools for math will result in incorrect answers.
When outputting math equations, ALWAYS use KaTeX formatting. 
For inline math, use single dollar signs: $x^2$.
For block math, use double dollar signs: $$x^2$$.
For chemistry formulas, use the mhchem extension syntax inside KaTeX blocks: $\\ce{H2O}$ or $$\\ce{CO2 + C -> 2 CO}$$.
`;

export async function generateChatResponse(
  model: string,
  systemPrompt: string,
  thinkingLevel: string,
  history: { role: 'user' | 'model', content: string }[],
  newMessage: string,
  onUpdate: (text: string) => void,
  onToolCall?: (toolCall: { name: string; args: any; result: string }) => void,
  options?: { signal?: AbortSignal }
) {
  // Context management: keep only the last 40 messages to save tokens and prevent bloat.
  let activeHistory = history;
  if (activeHistory.length > 40) {
    activeHistory = activeHistory.slice(-40);
  }

  const contents: any[] = activeHistory.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));
  
  // Prepend timestamp to the message so the AI knows the time
  const utcNow = new Date().toISOString();
  const enhancedNewMessage = `【Timestamp: ${utcNow}】\n\n${newMessage}`;

  contents.push({
    role: 'user',
    parts: [{ text: enhancedNewMessage }]
  });

  const config: any = {
    systemInstruction: systemPrompt ? systemPrompt + '\n\n' + getMathInstructions() : getMathInstructions(),
    tools: [{ functionDeclarations: [evaluateExpressionTool, solveEquationTool, calculateDerivativeTool] }],
  };

  if (thinkingLevel && thinkingLevel !== 'DEFAULT' && thinkingLevel !== 'none') {
    // Ensure we only pass valid thinking levels
    const validLevels = ['minimal', 'low', 'medium', 'high'];
    if (validLevels.includes(thinkingLevel)) {
      config.thinkingConfig = { thinkingLevel: thinkingLevel.toUpperCase() };
    }
  }

  let isThinking = false;
  let fullText = "";
  let lastUpdateTime = 0;
  const throttledUpdate = (text: string) => {
    const now = Date.now();
    if (now - lastUpdateTime > 50) {
      onUpdate(text);
      lastUpdateTime = now;
    }
  };

  let currentStream = await ai.models.generateContentStream({
    model,
    contents,
    config
  });

  let keepResolving = true;

  while (keepResolving) {
    if (options?.signal?.aborted) break;

    let functionCalls: any[] = [];
    let modelParts: any[] = [];

    for await (const chunk of currentStream) {
      if (options?.signal?.aborted) break;

      if (chunk.functionCalls && chunk.functionCalls.length > 0) {
        functionCalls.push(...chunk.functionCalls);
      }
      
      const parts = chunk.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        modelParts.push(part);
        if (part.thought && part.text) {
          if (!isThinking) {
            isThinking = true;
            fullText += "<details open>\n<summary>Thinking Process</summary>\n\n```text\n";
          }
          fullText += part.text;
        } else if (part.text) {
          if (isThinking) {
            isThinking = false;
            fullText += "\n```\n\n</details>\n\n";
          }
          fullText += part.text;
        }
      }
      throttledUpdate(fullText);
    }

    if (isThinking) {
      fullText += "\n```\n\n</details>\n\n";
      isThinking = false;
    }
    onUpdate(fullText);

    if (functionCalls.length > 0) {
      const toolResponses = functionCalls.map(call => {
        if (call.name === 'evaluate_expression') {
          const args = call.args as any;
          
          let result;
          try {
            result = math.evaluate(args.expression);
          } catch (e: any) {
            result = `Error: ${e.message}`;
          }
          
          if (onToolCall) {
            onToolCall({
              name: call.name,
              args,
              result: String(result)
            });
          }

          return {
            functionResponse: {
              name: call.name,
              response: { result: String(result) }
            }
          };
        } else if (call.name === 'solve_equation') {
          const args = call.args as any;
          
          let result;
          try {
            const solutions = (nerdamer as any).solveEquations(args.equation, args.variable);
            result = solutions.toString();
          } catch (e: any) {
            result = `Error: ${e.message}`;
          }
          
          if (onToolCall) {
            onToolCall({
              name: call.name,
              args,
              result: String(result)
            });
          }

          return {
            functionResponse: {
              name: call.name,
              response: { result: String(result) }
            }
          };
        } else if (call.name === 'calculate_derivative') {
          const args = call.args as any;
          
          let result;
          try {
            result = math.derivative(args.expression, args.variable).toString();
          } catch (e: any) {
            result = `Error: ${e.message}`;
          }
          
          if (onToolCall) {
            onToolCall({
              name: call.name,
              args,
              result: String(result)
            });
          }

          return {
            functionResponse: {
              name: call.name,
              response: { result: String(result) }
            }
          };
        }
        return null;
      }).filter(Boolean);

      if (toolResponses.length > 0) {
        contents.push({
          role: 'model',
          parts: modelParts
        });
        contents.push({
          role: 'user',
          parts: toolResponses
        });

        currentStream = await ai.models.generateContentStream({
          model,
          contents,
          config
        });
      } else {
        keepResolving = false;
      }
    } else {
      keepResolving = false;
    }
  }

  fullText = fullText.replace(/<details open>/g, '<details>');
  onUpdate(fullText);
  return fullText;
}
