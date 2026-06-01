import { Router } from 'express';
import { GenerationManager } from '../services/generation-manager';

export function createSessionRouter(gm: GenerationManager) {
  const router = Router();

  router.get('/api/sessions', async (_req, res) => {
    try {
      res.json(await gm.listSessions());
    } catch {
      res.json([]);
    }
  });

  router.get('/api/sessions/:id', async (req, res) => {
    const session = await gm.readSession(req.params.id);
    if (!session) return res.status(404).json({ error: 'Not found' });
    res.json(session);
  });

  router.delete('/api/sessions/:id', async (req, res) => {
    gm.stop(req.params.id);
    await gm.deleteSession(req.params.id);
    res.json({ ok: true });
  });

  return router;
}
