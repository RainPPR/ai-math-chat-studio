import { Router } from 'express';
import { GenerationManager } from '../services/generation-manager';
import fs from 'fs/promises';

interface Character {
  id: string;
  name: string;
  systemPrompt: string;
}

interface SettingsData {
  activeModelId?: string;
  activeCharacterId?: string;
  providers?: any[];
  models?: any[];
  characters?: Character[];
  systemPrompt?: string;
  injectThinkingTemplate?: boolean;
  [key: string]: any;
}

async function loadSettings(settingsFile: string): Promise<SettingsData> {
  try {
    return JSON.parse(await fs.readFile(settingsFile, 'utf-8'));
  } catch {
    return {};
  }
}

function resolveActiveModel(settings: SettingsData) {
  if (!settings.activeModelId || !settings.models?.length) return null;
  const model = settings.models.find((m: any) => m.id === settings.activeModelId);
  if (!model) return null;
  const provider = settings.providers?.find((p: any) => p.id === model.providerId);
  return { model, provider };
}

function resolveSystemPrompt(settings: SettingsData): string {
  if (settings.activeCharacterId && settings.characters?.length) {
    const character = settings.characters.find((c: any) => c.id === settings.activeCharacterId);
    if (character && character.systemPrompt) {
      return character.systemPrompt;
    }
  }
  return settings.systemPrompt || '';
}

export function createChatRouter(gm: GenerationManager, settingsFile: string) {
  const router = Router();

  router.post('/api/sessions/:id/messages', async (req, res) => {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: 'Empty message' });

    const settings = await loadSettings(settingsFile);
    const result = resolveActiveModel(settings);
    if (!result || !result.model || !result.provider) return res.status(400).json({ error: 'No active model configured' });

    const sessionId = req.params.id;
    await gm.sendMessage(sessionId, content.trim(), result.model, result.provider, resolveSystemPrompt(settings), settings.injectThinkingTemplate, settings.activeCharacterId);
    res.status(202).json({ ok: true });
  });

  router.get('/api/sessions/:id/generation', async (req, res) => {
    const sessionId = req.params.id;
    console.log(`[SSE] Client connected for session ${sessionId}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let unsubscribe: (() => void) | null = null;
    let isClosed = false;

    const cleanup = () => {
      if (isClosed) return;
      isClosed = true;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    const maxWaitTime = 5000;
    const startTime = Date.now();
    let waitTime = 50;

    while (Date.now() - startTime < maxWaitTime) {
      unsubscribe = gm.subscribe(sessionId, (event, data) => {
        if (isClosed) return;
        try {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          if (event === 'done' || event === 'error' || event === 'stopped') {
            console.log(`[SSE] Sending ${event} for session ${sessionId}`);
            setImmediate(() => {
              cleanup();
              res.end();
            });
          }
        } catch (err) {
          cleanup();
        }
      });
      if (unsubscribe) break;
      await new Promise(r => setTimeout(r, waitTime));
      waitTime = Math.min(waitTime * 1.5, 500);
    }

    if (!unsubscribe) {
      console.log(`[SSE] Task not found for session ${sessionId} after 5s`);
      if (!isClosed) {
        try {
          res.write(`event: error\ndata: ${JSON.stringify({ message: 'Generation task not found' })}\n\n`);
          res.end();
        } catch {
          // Client already disconnected
        }
      }
      return;
    }

    req.on('close', () => {
      console.log(`[SSE] Client disconnected for session ${sessionId}`);
      cleanup();
    });

    req.on('error', () => {
      cleanup();
    });
  });

  router.delete('/api/sessions/:id/generation', (req, res) => {
    gm.stop(req.params.id);
    res.json({ ok: true });
  });

  router.get('/api/generation-status', (_req, res) => {
    res.json({ runningSessionIds: gm.getRunningSessionIds() });
  });

  router.post('/api/sessions/:id/retry', async (req, res) => {
    const { messageId } = req.body;
    if (!messageId) return res.status(400).json({ error: 'Missing messageId' });

    const settings = await loadSettings(settingsFile);
    const result = resolveActiveModel(settings);
    if (!result || !result.model || !result.provider) return res.status(400).json({ error: 'No active model configured' });

    try {
      await gm.retryMessage(req.params.id, messageId, result.model, result.provider, resolveSystemPrompt(settings), settings.injectThinkingTemplate);
      res.status(202).json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/api/sessions/:id/continue', async (req, res) => {
    const settings = await loadSettings(settingsFile);
    const result = resolveActiveModel(settings);
    if (!result || !result.model || !result.provider) return res.status(400).json({ error: 'No active model configured' });

    try {
      await gm.continueGeneration(req.params.id, result.model, result.provider, resolveSystemPrompt(settings), settings.injectThinkingTemplate);
      res.status(202).json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/api/sessions/:id/regenerate', async (req, res) => {
    const { messageId } = req.body;
    if (!messageId) return res.status(400).json({ error: 'Missing messageId' });

    const settings = await loadSettings(settingsFile);
    const result = resolveActiveModel(settings);
    if (!result || !result.model || !result.provider) return res.status(400).json({ error: 'No active model configured' });

    try {
      await gm.regenerateMessage(req.params.id, messageId, result.model, result.provider, resolveSystemPrompt(settings), settings.injectThinkingTemplate);
      res.status(202).json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
