import { Router } from 'express';
import { loadSettings, saveSettings } from '../lib/settings-helper';

export function createSettingsRouter(settingsFile: string) {
  const router = Router();

  router.get('/api/settings', async (_req, res) => {
    try {
      const settings = await loadSettings(settingsFile);
      res.json(settings);
    } catch {
      res.json(null);
    }
  });

  router.put('/api/settings', async (req, res) => {
    try {
      await saveSettings(settingsFile, req.body);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
