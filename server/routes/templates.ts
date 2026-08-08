import { Router } from 'express';
import fs from 'fs/promises';
import { existsSync } from 'fs';

const DEFAULT_TEMPLATES = [
  {
    id: 'template-1',
    name: '三角形基础',
    content: '在 $\\triangle ABC$ 中，角 $A,B,C$ 所对的边分别为 $a,b,c$，'
  },
  {
    id: 'template-2',
    name: '锐角三角形',
    content: '在锐角 $\\triangle ABC$ 中，角 $A,B,C$ 所对的边分别为 $a,b,c$，'
  },
  {
    id: 'template-3',
    name: '数列 a',
    content: '已知数列 \\{a_n\\} 的前 $n$ 项和为 $S_n$，'
  },
  {
    id: 'template-4',
    name: '数列 a b',
    content: '已知数列 \\{a_n\\} 的前 $n$ 项和为 $S_n$，数列 \\{b_n\\} 的前 $n$ 项和为 $T_n$，'
  }
];

export function createTemplatesRouter(templatesFile: string) {
  const router = Router();

  router.get('/api/templates', async (_req, res) => {
    try {
      if (!existsSync(templatesFile)) {
        await fs.writeFile(templatesFile, JSON.stringify(DEFAULT_TEMPLATES, null, 2), 'utf-8');
        return res.json(DEFAULT_TEMPLATES);
      }
      const data = await fs.readFile(templatesFile, 'utf-8');
      res.json(JSON.parse(data));
    } catch {
      res.json(DEFAULT_TEMPLATES);
    }
  });

  router.put('/api/templates', async (req, res) => {
    try {
      const templates = req.body;
      if (!Array.isArray(templates)) {
        return res.status(400).json({ error: 'Templates must be an array' });
      }
      // Ensure each template has valid fields
      const validated = templates.map((t: any) => ({
        id: t.id || Math.random().toString(36).substring(2, 11),
        name: String(t.name || ''),
        content: String(t.content || '')
      }));

      await fs.writeFile(templatesFile, JSON.stringify(validated, null, 2), 'utf-8');
      res.json({ ok: true, templates: validated });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to save templates' });
    }
  });

  return router;
}
