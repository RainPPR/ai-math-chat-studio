import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import OpenAI from 'openai';
import * as math from 'mathjs';
import { UserSettings } from '../types';

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

export async function fetchModels(settings?: UserSettings) {
  if (settings?.provider === 'custom') {
    try {
      const openai = new OpenAI({
        baseURL: settings.customBaseUrl || 'https://openrouter.ai/api/v1',
        apiKey: settings.customApiKey || 'dummy',
        dangerouslyAllowBrowser: true
      });
      const response = await openai.models.list();
      return response.data.map(m => m.id);
    } catch (e) {
      console.error("Failed to fetch custom models", e);
      return settings.customModel ? [settings.customModel] : [];
    }
  }

  const models: string[] = [];
  try {
    const apiKey = settings?.geminiApiKey || process.env.GEMINI_API_KEY;
    const ai = new GoogleGenAI({ apiKey });
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
You have access to the 'evaluate_expression' tool. Use it whenever you need to perform mathematical calculations to ensure accuracy.
When outputting math equations, ALWAYS use KaTeX formatting. 
For inline math, use single dollar signs: $x^2$.
For block math, use double dollar signs: $$x^2$$.
For chemistry formulas, use the mhchem extension syntax inside KaTeX blocks: $\\ce{H2O}$ or $$\\ce{CO2 + C -> 2 CO}$$.
`;

export async function generateChatResponse(
  settings: UserSettings,
  history: { role: 'user' | 'model', content: string }[],
  newMessage: string,
  onUpdate: (text: string) => void
) {
  if (settings.provider === 'custom') {
    return generateCustomChatResponse(settings, history, newMessage, onUpdate);
  } else {
    return generateGeminiChatResponse(settings, history, newMessage, onUpdate);
  }
}

async function generateCustomChatResponse(
  settings: UserSettings,
  history: { role: 'user' | 'model', content: string }[],
  newMessage: string,
  onUpdate: (text: string) => void
) {
  const openai = new OpenAI({
    baseURL: settings.customBaseUrl || 'https://openrouter.ai/api/v1',
    apiKey: settings.customApiKey || 'dummy',
    dangerouslyAllowBrowser: true
  });

  const messages: any[] = [];
  if (settings.systemPrompt) {
    messages.push({ role: 'system', content: settings.systemPrompt + '\n\n' + getMathInstructions() });
  } else {
    messages.push({ role: 'system', content: getMathInstructions() });
  }

  history.forEach(msg => {
    messages.push({ role: msg.role === 'model' ? 'assistant' : 'user', content: msg.content });
  });
  messages.push({ role: 'user', content: newMessage });

  const customParams: Record<string, any> = {};
  if (settings.customParameters) {
    settings.customParameters.forEach(p => {
      if (p.key) {
        try {
          customParams[p.key] = JSON.parse(p.value);
        } catch {
          customParams[p.key] = p.value;
        }
      }
    });
  }

  const req: any = {
    model: settings.customModel || 'openai/gpt-4o',
    messages,
    stream: true,
    ...customParams
  };

  if (settings.reasoningEffort && settings.reasoningEffort !== 'none') {
    req.reasoning_effort = settings.reasoningEffort;
  }

  let fullText = "";
  let isThinking = false;

  try {
    const stream = await openai.chat.completions.create(req) as any;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      const reasoning = (delta as any).reasoning_content || (delta as any).reasoning;
      
      if (reasoning) {
        if (!isThinking) {
          isThinking = true;
          fullText += "<details open>\n<summary>Thinking Process</summary>\n\n";
        }
        fullText += reasoning;
      } else if (delta.content) {
        if (isThinking) {
          isThinking = false;
          fullText += "\n\n</details>\n\n";
        }
        fullText += delta.content;
      }
      onUpdate(fullText);
    }
  } catch (e: any) {
    console.error("Custom provider error", e);
    fullText += `\n\n**Error:** ${e.message}`;
    onUpdate(fullText);
  }

  if (isThinking) {
    fullText += "\n\n</details>\n\n";
  }
  
  fullText = fullText.replace(/<details open>/g, '<details>');
  onUpdate(fullText);
  return fullText;
}

async function generateGeminiChatResponse(
  settings: UserSettings,
  history: { role: 'user' | 'model', content: string }[],
  newMessage: string,
  onUpdate: (text: string) => void
) {
  const apiKey = settings.geminiApiKey || process.env.GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  const contents: any[] = history.map(msg => ({
    role: msg.role,
    parts: [{ text: msg.content }]
  }));
  
  contents.push({
    role: 'user',
    parts: [{ text: newMessage }]
  });

  const config: any = {
    systemInstruction: settings.systemPrompt ? settings.systemPrompt + '\n\n' + getMathInstructions() : getMathInstructions(),
    tools: [{ functionDeclarations: [evaluateExpressionTool] }],
  };

  if (settings.thinkingLevel && settings.thinkingLevel !== 'DEFAULT') {
    config.thinkingConfig = { thinkingLevel: settings.thinkingLevel };
  }
  
  if (settings.customParameters) {
    settings.customParameters.forEach(p => {
      if (p.key) {
        try {
          config[p.key] = JSON.parse(p.value);
        } catch {
          config[p.key] = p.value;
        }
      }
    });
  }

  let responseStream = await ai.models.generateContentStream({
    model: settings.model,
    contents,
    config
  });

  let fullText = "";
  let isThinking = false;
  let functionCalls: any[] = [];

  for await (const chunk of responseStream) {
    if (chunk.functionCalls && chunk.functionCalls.length > 0) {
      functionCalls.push(...chunk.functionCalls);
    }
    
    const parts = chunk.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.thought && part.text) {
        if (!isThinking) {
          isThinking = true;
          fullText += "<details open>\n<summary>Thinking Process</summary>\n\n";
        }
        fullText += part.text;
      } else if (part.text) {
        if (isThinking) {
          isThinking = false;
          fullText += "\n\n</details>\n\n";
        }
        fullText += part.text;
      }
    }
    onUpdate(fullText);
  }

  if (isThinking) {
    fullText += "\n\n</details>\n\n";
    isThinking = false;
  }

  if (functionCalls.length > 0) {
    const toolResponses = functionCalls.map(call => {
      if (call.name === 'evaluate_expression') {
        const args = call.args as any;
        
        fullText += `\n\n> **Tool Call:** \`${call.name}\`\n> **Arguments:** \`${JSON.stringify(args)}\`\n\n`;
        onUpdate(fullText);

        let result;
        try {
          result = math.evaluate(args.expression);
        } catch (e: any) {
          result = `Error: ${e.message}`;
        }
        
        fullText += `> **Result:** \`${String(result)}\`\n\n`;
        onUpdate(fullText);

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
        parts: functionCalls.map(call => ({ functionCall: call }))
      });
      contents.push({
        role: 'user',
        parts: toolResponses
      });

      const followUpStream = await ai.models.generateContentStream({
        model: settings.model,
        contents,
        config
      });

      for await (const chunk of followUpStream) {
        const parts = chunk.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.thought && part.text) {
            if (!isThinking) {
              isThinking = true;
              fullText += "<details open>\n<summary>Thinking Process</summary>\n\n";
            }
            fullText += part.text;
          } else if (part.text) {
            if (isThinking) {
              isThinking = false;
              fullText += "\n\n</details>\n\n";
            }
            fullText += part.text;
          }
        }
        onUpdate(fullText);
      }
      
      if (isThinking) {
        fullText += "\n\n</details>\n\n";
        isThinking = false;
      }
    }
  }

  fullText = fullText.replace(/<details open>/g, '<details>');
  onUpdate(fullText);
  return fullText;
}
