import { Router } from 'express';
import { GenerationManager, ModelPoolEntry } from '../services/generation-manager';
import fs from 'fs/promises';

interface SettingsData {
  activeModelId?: string;
  modelPool?: ModelPoolEntry[];
  systemPrompt?: string;
  [key: string]: any;
}

async function loadSettings(settingsFile: string): Promise<SettingsData> {
  try {
    return JSON.parse(await fs.readFile(settingsFile, 'utf-8'));
  } catch {
    return {};
  }
}

function resolveActiveModel(settings: SettingsData): ModelPoolEntry | null {
  if (!settings.activeModelId || !settings.modelPool?.length) return null;
  return settings.modelPool.find(m => m.id === settings.activeModelId) || null;
}

export function createChatRouter(gm: GenerationManager, settingsFile: string) {
  const router = Router();

  router.post('/api/sessions/:id/messages', async (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Empty message' });

    const settings = await loadSettings(settingsFile);
    const model = resolveActiveModel(settings);
    if (!model) return res.status(400).json({ error: 'No active model configured' });

    const sessionId = req.params.id;
    await gm.sendMessage(sessionId, content.trim(), model, settings.systemPrompt || '');
    res.status(202).json({ ok: true });
  });

  router.get('/api/sessions/:id/generation', async (req, res) => {
    const sessionId = req.params.id;
    console.log(`[SSE] Client connected for session ${sessionId}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let unsubscribe: (() => void) | null = null;

    for (let i = 0; i < 50; i++) {
      unsubscribe = gm.subscribe(sessionId, (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        if (event === 'done' || event === 'error' || event === 'stopped') {
          console.log(`[SSE] Sending ${event} for session ${sessionId}`);
          setTimeout(() => { res.end(); }, 100);
        }
      });
      if (unsubscribe) break;
      await new Promise(r => setTimeout(r, 100));
    }

    if (!unsubscribe) {
      console.log(`[SSE] Task not found for session ${sessionId} after 5s`);
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'Generation task not found' })}\n\n`);
      res.end();
      return;
    }

    req.on('close', () => {
      console.log(`[SSE] Client disconnected for session ${sessionId}`);
      if (unsubscribe) unsubscribe();
    });
  });

  router.delete('/api/sessions/:id/generation', (req, res) => {
    gm.stop(req.params.id);
    res.json({ ok: true });
  });

  router.post('/api/sessions/:id/retry', async (req, res) => {
    const { messageId } = req.body;
    if (!messageId) return res.status(400).json({ error: 'Missing messageId' });

    const settings = await loadSettings(settingsFile);
    const model = resolveActiveModel(settings);
    if (!model) return res.status(400).json({ error: 'No active model configured' });

    await gm.retryMessage(req.params.id, messageId, model, settings.systemPrompt || '');
    res.status(202).json({ ok: true });
  });

  router.post('/api/sessions/:id/continue', async (req, res) => {
    const settings = await loadSettings(settingsFile);
    const model = resolveActiveModel(settings);
    if (!model) return res.status(400).json({ error: 'No active model configured' });

    await gm.continueGeneration(req.params.id, model, settings.systemPrompt || '');
    res.status(202).json({ ok: true });
  });

  return router;
}
