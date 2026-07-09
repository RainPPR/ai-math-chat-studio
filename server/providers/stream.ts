import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';
import { resolveBaseURL, resolveApiKey, MATH_INSTRUCTIONS } from './config';

export interface StreamRequest {
  model: string;
  messages: { role: string; content: string }[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: string;
  extraBody?: Record<string, any>;
  thinkingLevel?: string;
  injectThinkingTemplate?: boolean;
  signal?: AbortSignal;
}

export interface StreamChunk {
  type: 'reasoning' | 'content';
  content?: string;
}

export async function* streamChat(
  providerType: string,
  provider: { baseURL?: string; apiKey?: string; envKey?: string; type: string },
  req: StreamRequest,
  signal?: AbortSignal
): AsyncGenerator<StreamChunk> {
  switch (providerType) {
    case 'google':
      yield* streamGoogle(req, provider, signal);
      break;
    case 'nvidia':
      yield* streamNvidia(req, provider, signal);
      break;
    case 'openai-compatible':
    default:
      yield* streamOpenAICompatible(req, provider, signal);
  }
}

// ---- Google Gemini ----

async function* streamGoogle(req: StreamRequest, provider: { baseURL?: string; apiKey?: string; envKey?: string; type: string }, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
  const apiKey = resolveApiKey(provider);
  if (!apiKey) throw new Error('Gemini API key is not configured. Please set it in the provider settings or use the GEMINI_API_KEY environment variable.');

  const ai = new GoogleGenAI({ apiKey });

  const history = req.messages.length > 40 ? req.messages.slice(-40) : req.messages;
  const contents: any[] = history.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : msg.role,
    parts: [{ text: msg.content }],
  }));

  const config: any = {};
  config.systemInstruction = req.systemPrompt || MATH_INSTRUCTIONS;

  // Check abort before starting
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  async function* runWithConfig(cfg: any): AsyncGenerator<StreamChunk> {
    const currentStream = await ai.models.generateContentStream({ model: req.model, contents, config: cfg });
    for await (const chunk of currentStream) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const parts = chunk.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.thought && part.text) yield { type: 'reasoning', content: part.text };
        else if (part.text) yield { type: 'content', content: part.text };
      }
    }
  }

  if (!req.thinkingLevel) {
    // thinkingLevel is unset. Try high first.
    try {
      const highConfig = {
        ...config,
        thinkingConfig: { thinkingLevel: 'HIGH', includeThoughts: true }
      };
      const gen = runWithConfig(highConfig);
      const firstResult = await gen.next();
      if (!firstResult.done) {
        yield firstResult.value;
        for await (const chunk of gen) {
          yield chunk;
        }
        return;
      }
    } catch (err) {
      console.warn('[Gemini] Request with thinkingLevel=high failed, falling back to original unset behavior:', err);
    }
    // Fallback: original unset behavior (no thinkingConfig)
    yield* runWithConfig(config);
  } else {
    const activeConfig = { ...config };
    if (req.thinkingLevel !== 'none') {
      const valid = ['minimal', 'low', 'medium', 'high'];
      if (valid.includes(req.thinkingLevel)) {
        activeConfig.thinkingConfig = { thinkingLevel: req.thinkingLevel.toUpperCase(), includeThoughts: true };
      }
    }
    yield* runWithConfig(activeConfig);
  }
}

// ---- Generic OpenAI SDK helper ----

async function* streamOpenAIHelper(req: StreamRequest, apiKey: string, baseURL: string, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
  const client = new OpenAI({ baseURL, apiKey });

  const messages: any[] = [];
  if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });

  const history = req.messages.length > 40 ? req.messages.slice(-40) : req.messages;
  for (const msg of history) {
    if (msg.role === 'assistant' || msg.role === 'model') {
      messages.push({ role: 'assistant', content: msg.content });
    } else {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  const payload: any = { model: req.model, messages, stream: true };
  if (req.temperature != null) payload.temperature = req.temperature;
  if (req.maxTokens != null) payload.max_tokens = req.maxTokens;
  if (req.injectThinkingTemplate) payload.chat_template_kwargs = { thinking: true };

  async function* runWithReasoningEffort(reasoningEffort: string | undefined): AsyncGenerator<StreamChunk> {
    const finalPayload = { ...payload, ...(req.extraBody || {}) };
    if (reasoningEffort) {
      finalPayload.reasoning_effort = reasoningEffort;
    }
    const response = await client.chat.completions.create(
      finalPayload,
      { signal }
    ) as any;

    for await (const chunk of response) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;
      const reasoning = (delta).reasoning || (delta).reasoning_content;
      if (reasoning) yield { type: 'reasoning', content: reasoning };
      if (delta.content) yield { type: 'content', content: delta.content };
    }
  }

  if (!req.reasoningEffort) {
    // reasoningEffort is unset. Try high first.
    try {
      const gen = runWithReasoningEffort('high');
      const firstResult = await gen.next();
      if (!firstResult.done) {
        yield firstResult.value;
        for await (const chunk of gen) {
          yield chunk;
        }
        return;
      }
    } catch (err) {
      console.warn('[OpenAI] Request with reasoningEffort=high failed, falling back to original unset behavior:', err);
    }
    // Fallback: original unset behavior (no reasoning_effort passed)
    yield* runWithReasoningEffort(undefined);
  } else {
    yield* runWithReasoningEffort(req.reasoningEffort);
  }
}

// ---- Nvidia ----

async function* streamNvidia(req: StreamRequest, provider: { baseURL?: string; apiKey?: string; envKey?: string; type: string }, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
  const apiKey = resolveApiKey(provider);
  const baseURL = resolveBaseURL(provider);
  if (!apiKey) throw new Error('Nvidia API key is not configured.');
  if (!baseURL) throw new Error('Nvidia Base URL is not configured.');

  yield* streamOpenAIHelper(req, apiKey, baseURL, signal);
}

// ---- OpenAI Compatible ----

async function* streamOpenAICompatible(req: StreamRequest, provider: { baseURL?: string; apiKey?: string; envKey?: string; type: string }, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
  const apiKey = resolveApiKey(provider);
  const baseURL = resolveBaseURL(provider);
  if (!apiKey) throw new Error(`API key is not configured for ${provider.baseURL || 'this provider'}.`);
  if (!baseURL) throw new Error(`Base URL is not configured for this provider.`);

  yield* streamOpenAIHelper(req, apiKey, baseURL, signal);
}
