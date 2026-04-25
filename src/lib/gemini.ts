import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import * as math from 'mathjs';

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
CRITICAL INSTRUCTION: You have access to the 'evaluate_expression' tool which uses the mathjs library. You MUST use this tool for ANY mathematical calculation, equation solving, or numerical logic. 
DO NOT perform calculations in your head. DO NOT guess the answer. Even for simple arithmetic, you MUST call 'evaluate_expression' to guarantee accuracy. 
Failure to use the tool for math will result in incorrect answers.
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
  onToolCall?: (toolCall: { name: string; args: any; result: string }) => void
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
    tools: [{ functionDeclarations: [evaluateExpressionTool] }],
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
    let functionCalls: any[] = [];
    let modelParts: any[] = [];

    for await (const chunk of currentStream) {
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
