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

  if (req.thinkingLevel && req.thinkingLevel !== 'none') {
    const valid = ['minimal', 'low', 'medium', 'high'];
    if (valid.includes(req.thinkingLevel)) {
      config.thinkingConfig = { thinkingLevel: req.thinkingLevel.toUpperCase(), includeThoughts: true };
    }
  }

  if (signal) {
    config.abortSignal = signal;
  }

  // Check abort before starting
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const currentStream = await ai.models.generateContentStream({ model: req.model, contents, config });

  for await (const chunk of currentStream) {
    // Check abort during streaming
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const parts = chunk.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.thought && part.text) yield { type: 'reasoning', content: part.text };
      else if (part.text) yield { type: 'content', content: part.text };
    }
  }
}

// ---- Generic OpenAI SDK helper ----

async function* streamOpenAIHelper(
  req: StreamRequest,
  apiKey: string,
  baseURL: string,
  signal?: AbortSignal,
  disableReasoningEffort = false
): AsyncGenerator<StreamChunk> {
  const client = new OpenAI({ baseURL, apiKey });

  const messages: any[] = [];
  if (req.systemPrompt) {
    messages.push({ role: 'system', content: req.systemPrompt });
  }

  const history = req.messages.length > 40 ? req.messages.slice(-40) : req.messages;
  for (const msg of history) {
    if (msg.role === 'assistant' || msg.role === 'model') {
      messages.push({ role: 'assistant', content: msg.content });
    } else {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  const payload: any = { model: req.model, messages, stream: true };
  if (req.temperature != null) {
    payload.temperature = req.temperature;
  }
  if (req.maxTokens != null) {
    payload.max_tokens = req.maxTokens;
  }
  if (req.injectThinkingTemplate) {
    payload.chat_template_kwargs = { thinking: true };
  }

  const isAbortError = (err: any): boolean => {
    if (!err) {
      return false;
    }
    if (signal) {
      if (signal.aborted) {
        return true;
      }
    }
    if (err instanceof DOMException) {
      if (err.name === 'AbortError') {
        return true;
      }
    }
    if (err instanceof OpenAI.APIUserAbortError) {
      return true;
    }

    const name = err.name;
    const message = err.message;

    if (typeof name === 'string') {
      if (name === 'AbortError') {
        return true;
      }
      if (name === 'APIUserAbortError') {
        return true;
      }
    }

    if (err.code === 'ERR_CANCELED') {
      return true;
    }

    if (typeof message === 'string') {
      const lowerMessage = message.toLowerCase();
      if (lowerMessage.includes('aborted')) {
        return true;
      }
      if (lowerMessage === 'canceled') {
        return true;
      }
      if (lowerMessage === 'cancelled') {
        return true;
      }
      if (lowerMessage.includes('request cancelled')) {
        return true;
      }
      if (lowerMessage.includes('user cancelled')) {
        return true;
      }
      if (lowerMessage.includes('abort')) {
        return true;
      }
    }

    return false;
  };

  async function* runWithReasoningEffort(reasoningEffort: string | undefined): AsyncGenerator<StreamChunk> {
    const finalPayload = { ...payload, ...(req.extraBody || {}) };
    if (reasoningEffort) {
      finalPayload.reasoning_effort = reasoningEffort;
    }

    try {
      const response = await client.chat.completions.create(
        finalPayload,
        { signal }
      ) as any;

      for await (const chunk of response) {
        if (signal) {
          if (signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }
        }
        const delta = chunk.choices?.[0]?.delta;
        if (delta) {
          const reasoning = delta.reasoning || delta.reasoning_content;
          if (reasoning) {
            yield { type: 'reasoning', content: reasoning };
          }
          if (delta.content) {
            yield { type: 'content', content: delta.content };
          }
        }
      }
    } catch (err: any) {
      if (isAbortError(err)) {
        throw new DOMException('Aborted', 'AbortError');
      }
      throw err;
    }
  }

  if (req.reasoningEffort) {
    console.log(`[OpenAI] Requesting model ${req.model} with explicit reasoningEffort=${req.reasoningEffort}`);
    yield* runWithReasoningEffort(req.reasoningEffort);
  } else if (disableReasoningEffort) {
    console.log(`[OpenAI] Requesting model ${req.model} without reasoningEffort (disabled)`);
    yield* runWithReasoningEffort(undefined);
  } else {
    const efforts = ['max', 'xhigh', 'high'];
    let successfulGen: AsyncGenerator<StreamChunk> | null = null;
    let firstResult: IteratorResult<StreamChunk> | null = null;

    let isFallbackToNoReasoning = false;

    for (const effort of efforts) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        if (signal) {
          if (signal.aborted) {
            throw new DOMException('Aborted', 'AbortError');
          }
        }
        try {
          console.log(`[OpenAI] Trial Cascade: Attempting model ${req.model} with reasoningEffort=${effort} (attempt ${attempt}/2)`);
          const gen = runWithReasoningEffort(effort);
          const res = await gen.next();
          firstResult = res;
          successfulGen = gen;
          if (!res.done) {
            console.log(`[OpenAI] Trial Cascade: Successfully connected to model ${req.model} using reasoningEffort=${effort}`);
          } else {
            console.warn(`[OpenAI] Trial Cascade: Model ${req.model} returned no chunks using reasoningEffort=${effort}`);
          }
          break;
        } catch (err: any) {
          if (isAbortError(err)) {
            throw new DOMException('Aborted', 'AbortError');
          }

          const status = err?.status || err?.statusCode;
          if (status === 401 || status === 403 || status === 404) {
            throw err;
          }

          if (status === 400 || status === 422) {
            const errMsg = typeof err?.message === 'string' ? err.message.toLowerCase() : '';
            if (errMsg.includes('reasoning_effort') || errMsg.includes('reasoningeffort')) {
              console.warn(`[OpenAI] Parameter reasoningEffort is unsupported (HTTP ${status}), falling back to no reasoning_effort immediately:`, err);
              isFallbackToNoReasoning = true;
              break;
            } else {
              throw err;
            }
          }

          const isRateLimit = err && (
            err.status === 429 ||
            err.statusCode === 429 ||
            (typeof err.message === 'string' && (
              err.message.includes('429') ||
              err.message.toLowerCase().includes('rate-limit') ||
              err.message.toLowerCase().includes('rate limit') ||
              err.message.includes('请求过快')
            ))
          );
          if (isRateLimit) {
            throw err;
          }
          console.warn(`[OpenAI] Request with reasoningEffort=${effort} (attempt ${attempt}/2) failed, trying fallback:`, err);
        }
      }
      if (isFallbackToNoReasoning) {
        break;
      }
      if (successfulGen) {
        if (firstResult) {
          break;
        }
      }
    }

    if (successfulGen) {
      if (firstResult) {
        if (!firstResult.done) {
          yield firstResult.value;
        }
        yield* successfulGen;
        return;
      }
    }

    console.log(`[OpenAI] Trial Cascade: Falling back to model ${req.model} with no reasoningEffort parameter`);
    yield* runWithReasoningEffort(undefined);
  }
}

// ---- Nvidia ----

async function* streamNvidia(req: StreamRequest, provider: { baseURL?: string; apiKey?: string; envKey?: string; type: string }, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
  const apiKey = resolveApiKey(provider);
  const baseURL = resolveBaseURL(provider);
  if (!apiKey) throw new Error('Nvidia API key is not configured.');
  if (!baseURL) throw new Error('Nvidia Base URL is not configured.');

  yield* streamOpenAIHelper(req, apiKey, baseURL, signal, true);
}

// ---- OpenAI Compatible ----

async function* streamOpenAICompatible(req: StreamRequest, provider: { baseURL?: string; apiKey?: string; envKey?: string; type: string }, signal?: AbortSignal): AsyncGenerator<StreamChunk> {
  const apiKey = resolveApiKey(provider);
  const baseURL = resolveBaseURL(provider);
  if (!apiKey) throw new Error(`API key is not configured for ${provider.baseURL || 'this provider'}.`);
  if (!baseURL) throw new Error(`Base URL is not configured for this provider.`);

  yield* streamOpenAIHelper(req, apiKey, baseURL, signal);
}
