import { Router } from 'express';
import OpenAI from 'openai';
import { BUILT_IN_PROVIDERS } from '../providers/built-in';

export function createModelsRouter() {
  const router = Router();

  router.get('/api/providers', (_req, res) => {
    res.json([
      { id: 'google', name: 'Google Gemini' },
      { id: 'nvidia', name: 'Nvidia NIM' },
      { id: 'openai-compatible', name: 'OpenAI Compatible' },
    ]);
  });

  router.post('/api/providers/:type/models', async (req, res) => {
    const { type } = req.params;
    const { baseURL, apiKey, envKey } = req.body;

    try {
      let models: string[] = [];

      if (type === 'google') {
        const key = process.env.GEMINI_API_KEY;
        if (!key) return res.status(500).json({ models: [], error: 'GEMINI_API_KEY is not set' });
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: key });
        const pager = await ai.models.list();
        for await (const m of pager) {
          if (m.supportedActions?.includes('generateContent') && m.name) {
            models.push(m.name.replace('models/', ''));
          }
        }
        if (models.length === 0) throw new Error('Gemini returned 0 models. Check your API key.');
        res.json({ models });
        return;
      }

      // For nvidia and openai-compatible, need baseURL and apiKey
      let resolvedBaseURL = (baseURL as string | undefined) || BUILT_IN_PROVIDERS[type]?.defaultBaseURL;
      // Nvidia baseURL is fixed and cannot be overridden
      if (type === 'nvidia') {
        resolvedBaseURL = BUILT_IN_PROVIDERS.nvidia.defaultBaseURL;
      }
      let resolvedApiKey = (apiKey as string | undefined);
      if (!resolvedApiKey) {
        const envVarKey = (envKey as string | undefined) || BUILT_IN_PROVIDERS[type]?.defaultEnvKey;
        if (envVarKey) resolvedApiKey = process.env[envVarKey];
      }
      if (!resolvedBaseURL || !resolvedApiKey) {
        return res.status(400).json({
          models: [],
          error: 'baseURL and apiKey are required for this provider type (or provider type not found)',
        });
      }
      const client = new OpenAI({ baseURL: resolvedBaseURL, apiKey: resolvedApiKey });
      const list = await client.models.list();
      for await (const m of list) {
        models.push((m as any).id);
      }
      if (models.length === 0) throw new Error('Provider returned 0 models. Check your API key and Base URL.');
      res.json({ models });
    } catch (e: any) {
      res.status(500).json({ models: [], error: e.message });
    }
  });

  return router;
}
