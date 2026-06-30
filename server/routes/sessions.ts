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

  router.patch('/api/sessions/:id', async (req, res) => {
    try {
      const { title, characterId } = req.body || {};
      const updates: any = {};
      if (title !== undefined) updates.title = title;
      if (characterId !== undefined) updates.characterId = characterId;

      const updated = await gm.updateSession(req.params.id, updates);
      if (!updated) {
        return res.status(404).json({ error: 'Session not found' });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Update failed' });
    }
  });

  router.delete('/api/sessions/:id', async (req, res) => {
    gm.stop(req.params.id);
    await gm.deleteSession(req.params.id);
    res.json({ ok: true });
  });

  router.post('/api/sessions/clean', async (req, res) => {
    try {
      const result = await gm.cleanSessions();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Clean failed' });
    }
  });

  return router;
}
