import { Router } from 'express';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { sortTemplates } from '../../shared/sorting';

export function createTemplatesRouter(templatesFile: string) {
  const router = Router();

  router.get('/api/templates', async (_req, res) => {
    try {
      if (!existsSync(templatesFile)) {
        return res.json([]);
      }
      const data = await fs.readFile(templatesFile, 'utf-8');
      res.json(JSON.parse(data));
    } catch {
      res.json([]);
    }
  });

  router.put('/api/templates', async (req, res) => {
    try {
      const templates = req.body;
      if (!Array.isArray(templates)) {
        return res.status(400).json({ error: 'Templates must be an array' });
      }

      // Strict validation of each element's shape
      const isValid = templates.every((t: any) => {
        if (!t || typeof t !== 'object') {
          return false;
        }
        if (typeof t.name !== 'string' || t.name.trim() === '') {
          return false;
        }
        if (t.content !== undefined && typeof t.content !== 'string') {
          return false;
        }
        return true;
      });

      if (!isValid) {
        return res.status(400).json({
          error: 'Each template must be an object with a non-empty name string and content string'
        });
      }

      // Map to validate and pick only allowed fields safely
      const validated = templates.map((t: any) => ({
        id: t.id || Math.random().toString(36).substring(2, 11),
        name: String(t.name || '').trim(),
        content: String(t.content || '')
      }));

      const sorted = sortTemplates(validated);

      await fs.writeFile(templatesFile, JSON.stringify(sorted, null, 2), 'utf-8');
      res.json({ ok: true, templates: sorted });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to save templates' });
    }
  });

  return router;
}
