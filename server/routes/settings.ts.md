```typescript
import { Router } from 'express';
import fs from 'fs/promises';

export function createSettingsRouter(settingsFile: string) {
  const router = Router();

  router.get('/api/settings', async (_req, res) => {
    try {
      const data = await fs.readFile(settingsFile, 'utf-8');
      res.json(JSON.parse(data));
    } catch {
      res.json(null);
    }
  });

  router.put('/api/settings', async (req, res) => {
    try {
      await fs.writeFile(settingsFile, JSON.stringify(req.body, null, 2));
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}

```