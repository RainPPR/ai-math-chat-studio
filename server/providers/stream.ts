import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { resolveBaseURL, resolveApiKey } from './config';
import { executeMathTool, buildOpenAITools, buildGeminiTools, MATH_INSTRUCTIONS } from './tools';

export interface StreamRequest {
  model: string;
  messages: { role: string; content: string; tool_call_id?: string; tool_calls?: any[] }[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: string;
  extraBody?: Record<string, any>;
  thinkingLevel?: string;
  enableTools: boolean;
  disabledTools: string[];
  injectThinkingTemplate?: boolean;
}

export interface StreamChunk {
  type: 'reasoning' | 'content' | 'tool_call_delta' | 'tool_call';
  content?: string;
  name?: string;
  args?: string;
  result?: string;
  toolCallId?: string;
  toolCallIndex?: number;
}

export async function* streamChat(
  providerType: string,
  provider: { baseURL?: string; apiKey?: string; envKey?: string; type: string },
  req: StreamRequest
): AsyncGenerator<StreamChunk> {
  switch (providerType) {
    case 'google':
      yield* streamGoogle(req);
      break;
    case 'nvidia':
      yield* streamNvidia(req, provider);
      break;
    case 'openai-compatible':
    default:
      yield* streamOpenAICompatible(req, provider);
  }
}

// ---- Google Gemini ----

async function* streamGoogle(req: StreamRequest): AsyncGenerator<StreamChunk> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set.');

  const ai = new GoogleGenAI({ apiKey });

  const history = req.messages.length > 40 ? req.messages.slice(-40) : req.messages;
  const contents: any[] = history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : msg.role,
    parts: [{ text: msg.content }],
  }));

  const config: any = {};
  config.systemInstruction = req.systemPrompt || MATH_INSTRUCTIONS;

  if (req.thinkingLevel && req.thinkingLevel !== 'none') {
    const valid = ['minimal', 'low', 'medium', 'high'];
    if (valid.includes(req.thinkingLevel)) {
      config.thinkingConfig = { thinkingLevel: req.thinkingLevel.toUpperCase(), includeThoughts: true };
    }
  }

  const geminiTools = buildGeminiTools(req.disabledTools);
  if (geminiTools.length) config.tools = [{ functionDeclarations: geminiTools }];

  let currentStream = await ai.models.generateContentStream({ model: req.model, contents, config });

  let keepResolving = true;
  while (keepResolving) {
    let functionCalls: any[] = [];
    let modelParts: any[] = [];

    for await (const chunk of currentStream) {
      if (chunk.functionCalls?.length) functionCalls.push(...chunk.functionCalls);
      const parts = chunk.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        modelParts.push(part);
        if (part.thought && part.text) yield { type: 'reasoning', content: part.text };
        else if (part.text) yield { type: 'content', content: part.text };
      }
    }

    if (functionCalls.length > 0 && req.enableTools) {
      const toolResponses: any[] = [];
      for (const call of functionCalls) {
        const args = call.args as any;
        const result = executeMathTool(call.name, args);
        yield { type: 'tool_call', name: call.name, args: JSON.stringify(args), result };
        toolResponses.push({ functionResponse: { name: call.name, response: { result } } });
      }
      contents.push({ role: 'model', parts: modelParts });
      contents.push({ role: 'user', parts: toolResponses });
      currentStream = await ai.models.generateContentStream({ model: req.model, contents, config });
    } else {
      keepResolving = false;
    }
  }
}

// ---- Generic OpenAI SDK helper ----

async function* streamOpenAIHelper(req: StreamRequest, apiKey: string, baseURL: string): AsyncGenerator<StreamChunk> {
  const client = new OpenAI({ baseURL, apiKey });

  const messages: any[] = [];
  if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });

  const history = req.messages.length > 40 ? req.messages.slice(-40) : req.messages;
  for (const msg of history) {
    if (msg.role === 'tool') {
      messages.push({ role: 'tool', content: msg.content, tool_call_id: msg.tool_call_id });
    } else if (msg.role === 'assistant' || msg.role === 'model') {
      messages.push({ role: 'assistant', content: msg.content, ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}) });
    } else {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  const payload: any = { model: req.model, messages, stream: true };
  if (req.temperature != null) payload.temperature = req.temperature;
  if (req.maxTokens != null) payload.max_tokens = req.maxTokens;
  if (req.reasoningEffort) payload.reasoning_effort = req.reasoningEffort;
  if (req.enableTools) payload.tools = buildOpenAITools(req.disabledTools);
  if (req.injectThinkingTemplate) payload.chat_template_kwargs = { thinking: true };

  const response = await client.chat.completions.create({ ...payload, ...(req.extraBody || {}) } as any) as any;

  for await (const chunk of response) {
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) continue;
    const reasoning = (delta as any).reasoning || (delta as any).reasoning_content;
    if (reasoning) yield { type: 'reasoning', content: reasoning };
    if (delta.content) yield { type: 'content', content: delta.content };
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        yield { type: 'tool_call_delta', toolCallIndex: tc.index, toolCallId: tc.id, name: tc.function?.name, args: tc.function?.arguments };
      }
    }
  }
}

// ---- Nvidia ----

async function* streamNvidia(req: StreamRequest, provider: { baseURL?: string; apiKey?: string; envKey?: string; type: string }): AsyncGenerator<StreamChunk> {
  const apiKey = resolveApiKey(provider);
  const baseURL = resolveBaseURL(provider);
  if (!apiKey) throw new Error('Nvidia API key is not configured.');
  if (!baseURL) throw new Error('Nvidia Base URL is not configured.');

  yield* streamOpenAIHelper(req, apiKey, baseURL);
}

// ---- OpenAI Compatible ----

async function* streamOpenAICompatible(req: StreamRequest, provider: { baseURL?: string; apiKey?: string; envKey?: string; type: string }): AsyncGenerator<StreamChunk> {
  const apiKey = resolveApiKey(provider);
  const baseURL = resolveBaseURL(provider);
  if (!apiKey) throw new Error(`API key is not configured for ${provider.baseURL || 'this provider'}.`);
  if (!baseURL) throw new Error(`Base URL is not configured for this provider.`);

  yield* streamOpenAIHelper(req, apiKey, baseURL);
}
