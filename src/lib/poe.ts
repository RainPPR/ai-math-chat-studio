import * as math from 'mathjs';
import nerdamer from 'nerdamer';
import 'nerdamer/Algebra';
import 'nerdamer/Calculus';
import 'nerdamer/Solve';

// Math tools for OpenAI format
const TOOLS = [
  {
    type: "function",
    function: {
      name: "evaluate_expression",
      description: "Evaluates a mathematical expression safely. Supports basic arithmetic, trigonometry, and other standard math functions.",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "The mathematical expression to evaluate (e.g., '2 + 2', 'sin(pi/4)', 'sqrt(16)')."
          }
        },
        required: ["expression"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "solve_equation",
      description: "Solves an algebraic equation for a specific variable. Returns exact algebraic solutions when possible.",
      parameters: {
        type: "object",
        properties: {
          equation: {
            type: "string",
            description: "The equation to solve (e.g., 'x^2 - 4 = 0', '2*x + y = 10')."
          },
          variable: {
            type: "string",
            description: "The variable to solve for (e.g., 'x')."
          }
        },
        required: ["equation", "variable"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "calculate_derivative",
      description: "Calculates the mathematical derivative of an expression with respect to a variable.",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description: "The mathematical expression to differentiate (e.g., 'x^2 + 2*x', 'sin(x)')."
          },
          variable: {
            type: "string",
            description: "The variable to differentiate with respect to (e.g., 'x')."
          }
        },
        required: ["expression", "variable"]
      }
    }
  }
];

export const getMathInstructions = () => `
CRITICAL INSTRUCTION: You have access to mathematical tools: 'evaluate_expression', 'solve_equation', and 'calculate_derivative'. You MUST use these tools for ANY mathematical calculation, equation solving, or differentiation. 
DO NOT perform calculations or algebraic manipulations in your head. DO NOT guess the answer. Even for simple arithmetic or algebra, you MUST call the appropriate tool to guarantee accuracy. 
Failure to use the tools for math will result in incorrect answers.
When outputting math equations, ALWAYS use KaTeX formatting. 
For inline math, use single dollar signs: $x^2$.
For block math, use double dollar signs: $$x^2$$.
For chemistry formulas, use the mhchem extension syntax inside KaTeX blocks: $\\ce{H2O}$ or $$\\ce{CO2 + C -> 2 CO}$$.

TOOL CALLING & REASONING CONSTRAINTS:
You MUST call tools either during your thinking process or BEFORE outputting your final response. You MUST deeply think and comprehensively formulate your final answer BEFORE responding. You must finish your entire response at once without interruption.

Reasoning Effort: Absolute maximum with no shortcuts permitted.
You MUST be very thorough in your thinking and comprehensively decompose the problem to resolve the root cause, rigorously stress-testing your logic against all potential paths, edge cases, and adversarial scenarios.
Explicitly write out your entire deliberation process, documenting every intermediate step, considered alternative, and rejected hypothesis to ensure absolutely no assumption is left unchecked.
`;

export async function fetchPoeModels() {
  try {
    const response = await fetch('/api/poe/models');
    if (!response.ok) throw new Error("Failed to fetch Poe models");
    return await response.json();
  } catch (error) {
    console.error("Poe Models fetch error", error);
    return [
      "Claude-Sonnet-4.6"
    ];
  }
}

export async function generatePoeChatResponse(
  model: string,
  systemPrompt: string,
  history: { role: 'user' | 'model' | 'tool', content: string | any[] }[],
  newMessage: string,
  disableTools: boolean,
  temperature: number | undefined,
  topP: number | undefined,
  maxTokens: number | undefined,
  extraBody: any,
  onUpdate: (text: string) => void,
  onToolCall?: (toolCall: { name: string; args: any; result: string }) => void,
  options?: { signal?: AbortSignal }
) {
  let activeHistory = history;
  if (activeHistory.length > 40) {
    activeHistory = activeHistory.slice(-40);
  }

  let finalSystemPrompt = systemPrompt;
  if (!disableTools) {
    finalSystemPrompt = finalSystemPrompt ? finalSystemPrompt + '\n\n' + getMathInstructions() : getMathInstructions();
  }

  const messages: any[] = [];
  if (finalSystemPrompt) {
    messages.push({ role: 'system', content: finalSystemPrompt });
  }

  for (const msg of activeHistory) {
    if (msg.role === 'tool') {
      // Not typically supported out of the box in this simplistic proxy if we don't store tool_calls in history well,
      // but let's push it as it is or map it
      messages.push({ role: 'tool', content: msg.content as any });
    } else {
      messages.push({
        role: msg.role === 'model' ? 'assistant' : 'user',
        content: msg.content as any
      });
    }
  }

  messages.push({
    role: 'user',
    content: newMessage
  });

  let fullText = "";
  let isThinking = false;
  let keepResolving = true;
  let lastUpdateTime = 0;
  
  const throttledUpdate = (text: string) => {
    const now = Date.now();
    if (now - lastUpdateTime > 50) {
      onUpdate(text);
      lastUpdateTime = now;
    }
  };

  while (keepResolving) {
    if (options?.signal?.aborted) break;

    const reqBody: any = {
      model,
      messages,
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
      extra_body: extraBody,
    };
    if (!disableTools) {
      reqBody.tools = TOOLS;
    }

    const response = await fetch('/api/poe/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: options?.signal,
      body: JSON.stringify(reqBody),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || "Failed to generate Poe response");
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let activeToolCalls: { [index: number]: any } = {};

    while (true) {
      if (options?.signal?.aborted) {
        reader.cancel();
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;

      const chunkStr = decoder.decode(value, { stream: true });
      const lines = chunkStr.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.tool_calls) {
              for (const tc of data.tool_calls) {
                if (!activeToolCalls[tc.index]) {
                  activeToolCalls[tc.index] = { id: tc.id, type: "function", function: { name: tc.function?.name || "", arguments: "" } };
                }
                if (tc.function?.arguments) {
                  activeToolCalls[tc.index].function.arguments += tc.function.arguments;
                }
              }
            } else {
              if (data.reasoning) {
                if (!isThinking) {
                  isThinking = true;
                  fullText += "<details open>\n<summary>Thinking Process</summary>\n\n```text\n";
                }
                fullText += data.reasoning;
              }
              if (data.content) {
                if (isThinking) {
                  isThinking = false;
                  fullText += "\n```\n\n</details>\n\n";
                }
                fullText += data.content;
              }
              throttledUpdate(fullText);
            }
          } catch (e) {
            console.error("Parse error stream chunk", e, line);
          }
        }
      }
    }

    // Finished a stream round
    const toolCallArray = Object.values(activeToolCalls);
    if (toolCallArray.length > 0) {
      // Append the assistant message with tool calls
      messages.push({
        role: "assistant",
        content: fullText ? fullText : null,
        tool_calls: toolCallArray
      });

      // Execute tool calls
      for (const tc of toolCallArray) {
        let args;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch (e) {
          args = {};
        }
        
        let result = "";
        try {
          if (tc.function.name === 'evaluate_expression') {
            result = String(math.evaluate(args.expression));
          } else if (tc.function.name === 'solve_equation') {
            const solutions = (nerdamer as any).solveEquations(args.equation, args.variable);
            result = solutions.toString();
          } else if (tc.function.name === 'calculate_derivative') {
            result = math.derivative(args.expression, args.variable).toString();
          } else {
            result = "Unknown tool or not implemented.";
          }
        } catch (e: any) {
          result = "Error: " + e.message;
        }

        if (onToolCall) {
          onToolCall({
            name: tc.function.name,
            args,
            result
          });
        }

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result
        });
      }
    } else {
      keepResolving = false;
    }
  }

  if (isThinking) {
    fullText += "\n```\n\n</details>\n\n";
  }
  
  fullText = fullText.replace(/<details open>/g, '<details>');
  onUpdate(fullText);
  return fullText;
}
