import { Router } from 'express';
import { listProviderModels, PROVIDERS } from '../providers/config';

export function createModelsRouter() {
  const router = Router();

  router.get('/api/providers', (_req, res) => {
    res.json(PROVIDERS.map(p => ({ id: p.id, name: p.name })));
  });

  router.get('/api/providers/:id/models', async (req, res) => {
    const { baseURL, apiKey } = req.query;
    try {
      const models = await listProviderModels(
        req.params.id,
        baseURL as string | undefined,
        apiKey as string | undefined,
      );
      res.json({ models });
    } catch (e: any) {
      res.status(500).json({ models: [], error: e.message });
    }
  });

  return router;
}
