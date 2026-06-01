import OpenAI from 'openai';

export interface ProviderConfig {
  id: string;
  name: string;
  baseURL: string;
  envKey: string;
}

export const PROVIDERS: ProviderConfig[] = [
  { id: 'nvidia',       name: 'Nvidia',                  baseURL: 'https://integrate.api.nvidia.com/v1',          envKey: 'NVIDIA_API_KEY' },
  { id: 'cloudflare',   name: 'Cloudflare Workers AI',   baseURL: '',                                              envKey: 'CLOUDFLARE_API_KEY' },
  { id: 'aihubmix',     name: 'AIHubMix',                baseURL: 'https://aihubmix.com/v1',                       envKey: 'AIHUBMIX_API_KEY' },
  { id: 'opengateway',  name: 'Gitlawb Opengateway',     baseURL: 'https://opengateway.gitlawb.com/v1',            envKey: 'OPENGATEWAY_API_KEY' },
  { id: 'poe',          name: 'Poe',                     baseURL: 'https://api.poe.com/v1',                        envKey: 'POE_API_KEY' },
  { id: 'gemini',       name: 'Google Gemini',           baseURL: 'https://generativelanguage.googleapis.com/v1beta', envKey: 'GEMINI_API_KEY' },
];

export function getProviderById(id: string): ProviderConfig | undefined {
  return PROVIDERS.find(p => p.id === id);
}

export function resolveBaseURL(p: ProviderConfig): string {
  if (p.id === 'cloudflare') {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    return p.baseURL || (accountId ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1` : '');
  }
  return p.baseURL;
}

export function resolveApiKey(p: ProviderConfig): string | undefined {
  if (p.id === 'opengateway') return process.env.OPENGATEWAY_API_KEY || process.env.OPENAI_API_KEY;
  return process.env[p.envKey] || process.env.OPENAI_API_KEY;
}

export async function listProviderModels(providerId: string, overrideBaseURL?: string, overrideApiKey?: string): Promise<string[]> {
  const p = getProviderById(providerId);
  if (!p) throw new Error(`Unknown provider: ${providerId}`);

  const baseURL = overrideBaseURL || resolveBaseURL(p);
  const apiKey = overrideApiKey || resolveApiKey(p);
  if (!apiKey) throw new Error(`${p.envKey} is not set. Set it in .env or provide an API key in the model entry.`);
  if (!baseURL && providerId === 'cloudflare') throw new Error('CLOUDFLARE_ACCOUNT_ID is not set and no Base URL provided.');

  if (providerId === 'gemini') {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const models: string[] = [];
    const pager = await ai.models.list();
    for await (const m of pager) {
      if (m.supportedActions?.includes('generateContent') && m.name) {
        models.push(m.name.replace('models/', ''));
      }
    }
    if (models.length === 0) throw new Error('Gemini returned 0 models. Check your API key.');
    return models;
  }

  if (providerId === 'cloudflare') {
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID is not set.');
    const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/models/search`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await resp.json();
    if (!data.success) throw new Error(data.errors?.[0]?.message || 'Cloudflare API error');
    return data.result.filter((m: any) => m.task.name === 'Text Generation').map((m: any) => m.name);
  }

  const client = new OpenAI({ baseURL, apiKey });
  const list = await client.models.list();
  const models: string[] = [];
  for await (const m of list) {
    models.push((m as any).id);
  }
  if (models.length === 0) throw new Error('Provider returned 0 models. Check your API key and Base URL.');
  return models.sort();
}
