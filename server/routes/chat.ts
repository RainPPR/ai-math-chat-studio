import { Router } from 'express';
import { GenerationManager } from '../services/generation-manager';
import { loadSettings } from '../lib/settings-helper';
import { Skill } from '../../shared/skills';

interface Character {
  id: string;
  name: string;
  systemPrompt: string;
}

interface SettingsData {
  activeModelId?: string;
  activeCharacterId?: string;
  activeSkillIds?: string[];
  providers?: any[];
  models?: any[];
  characters?: Character[];
  skills?: Skill[];
  systemPrompt?: string;
  injectThinkingTemplate?: boolean;
  [key: string]: any;
}

function buildTempModelPayload(tempModel: any) {
  const model = {
    id: tempModel.id,
    providerId: `temp-${tempModel.id}`,
    providerType: 'openai-compatible',
    modelId: tempModel.modelId,
    displayName: tempModel.name || tempModel.modelId,
    temperature: tempModel.temperature,
    maxTokens: tempModel.maxTokens,
    reasoningEffort: tempModel.reasoningEffort,
    extraBody: tempModel.extraBody,
    injectThinkingTemplate: tempModel.injectThinkingTemplate,
  };
  const provider = {
    type: 'openai-compatible',
    name: tempModel.name || 'Temporary Model',
    baseURL: tempModel.baseURL,
    apiKey: tempModel.apiKey,
  };
  return { model, provider };
}

function resolveActiveModel(settings: SettingsData) {
  const activeModelId = settings.activeModelId;

  // 1. Check if activeModelId corresponds to a TempModel
  if (activeModelId && settings.tempModels?.length) {
    const tempModel = settings.tempModels.find((tm: any) => tm.id === activeModelId);
    if (tempModel) {
      return buildTempModelPayload(tempModel);
    }
  }

  // 2. Check regular models
  if (settings.models?.length) {
    const modelId = activeModelId || settings.models[0].id;
    const model = settings.models.find((m: any) => m.id === modelId) || settings.models[0];
    const provider = settings.providers?.find((p: any) => p.id === model.providerId);
    if (model && provider) {
      return { model, provider };
    }
  }

  // 3. Fallback to first TempModel ONLY if regular models are completely empty
  if (!settings.models?.length && settings.tempModels?.length) {
    return buildTempModelPayload(settings.tempModels[0]);
  }

  return null;
}

function resolveSessionContext(settings: SettingsData, session: any, reqBody?: { characterId?: string; skillIds?: string[] }) {
  let characterId: string | undefined;
  let skillIds: string[];

  if (reqBody?.characterId !== undefined) {
    characterId = reqBody.characterId;
  } else if (session) {
    characterId = session.characterId;
  } else {
    characterId = settings.activeCharacterId;
  }

  if (reqBody?.skillIds !== undefined && Array.isArray(reqBody.skillIds)) {
    skillIds = reqBody.skillIds;
  } else if (session && session.skillIds !== undefined) {
    skillIds = session.skillIds;
  } else {
    skillIds = settings.activeSkillIds || [];
  }

  return { characterId, skillIds };
}

function resolveSystemPrompt(settings: SettingsData, characterId?: string, skillIds?: string[]): string {
  const parts: string[] = [];

  if (skillIds && skillIds.length > 0 && settings.skills?.length) {
    skillIds.forEach(id => {
      const skill = settings.skills?.find((s: any) => s.id === id);
      if (skill && skill.prompt && skill.prompt.trim()) {
        parts.push(`# Skill: ${skill.name}\n${skill.prompt.trim()}`);
      }
    });
  }

  if (characterId && settings.characters?.length) {
    const character = settings.characters.find((c: any) => c.id === characterId);
    if (character && character.systemPrompt && character.systemPrompt.trim()) {
      parts.push(character.systemPrompt.trim());
    }
  }

  return parts.join('\n\n');
}

export function createChatRouter(gm: GenerationManager, settingsFile: string) {
  const router = Router();

  router.post('/api/sessions/:id/messages', async (req, res) => {
    const { content, characterId: reqCharacterId, skillIds: reqSkillIds } = req.body || {};
    if (!content?.trim()) return res.status(400).json({ error: 'Empty message' });

    const settings = await loadSettings(settingsFile);
    const result = resolveActiveModel(settings);
    if (!result?.model || !result.provider) return res.status(400).json({ error: 'No active model configured' });

    const sessionId = req.params.id;
    const session = await gm.readSession(sessionId);
    const { characterId, skillIds } = resolveSessionContext(settings, session, { characterId: reqCharacterId, skillIds: reqSkillIds });

    const injectThinkingTemplate = result.model.injectThinkingTemplate ?? settings.injectThinkingTemplate;
    await gm.sendMessage(sessionId, content.trim(), result.model, result.provider, resolveSystemPrompt(settings, characterId, skillIds), injectThinkingTemplate, characterId, skillIds);
    res.status(202).json({ ok: true });
  });

  router.get('/api/sessions/:id/generation', async (req, res) => {
    const sessionId = req.params.id;

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
            setImmediate(() => {
              cleanup();
              res.end();
            });
          }
        } catch {
          cleanup();
        }
      });
      if (unsubscribe) break;
      await new Promise(r => setTimeout(r, waitTime));
      waitTime = Math.min(waitTime * 1.5, 500);
    }

    if (!unsubscribe) {
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
    if (!result?.model || !result.provider) return res.status(400).json({ error: 'No active model configured' });

    const sessionId = req.params.id;
    const session = await gm.readSession(sessionId);
    const { characterId, skillIds } = resolveSessionContext(settings, session);

    try {
      const injectThinkingTemplate = result.model.injectThinkingTemplate ?? settings.injectThinkingTemplate;
      await gm.retryMessage(sessionId, messageId, result.model, result.provider, resolveSystemPrompt(settings, characterId, skillIds), injectThinkingTemplate);
      res.status(202).json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/api/sessions/:id/continue', async (req, res) => {
    const settings = await loadSettings(settingsFile);
    const result = resolveActiveModel(settings);
    if (!result?.model || !result.provider) return res.status(400).json({ error: 'No active model configured' });

    const sessionId = req.params.id;
    const session = await gm.readSession(sessionId);
    const { characterId, skillIds } = resolveSessionContext(settings, session);

    try {
      const injectThinkingTemplate = result.model.injectThinkingTemplate ?? settings.injectThinkingTemplate;
      await gm.continueGeneration(sessionId, result.model, result.provider, resolveSystemPrompt(settings, characterId, skillIds), injectThinkingTemplate);
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
    if (!result?.model || !result.provider) return res.status(400).json({ error: 'No active model configured' });

    const sessionId = req.params.id;
    const session = await gm.readSession(sessionId);
    const { characterId, skillIds } = resolveSessionContext(settings, session);

    try {
      const injectThinkingTemplate = result.model.injectThinkingTemplate ?? settings.injectThinkingTemplate;
      await gm.regenerateMessage(sessionId, messageId, result.model, result.provider, resolveSystemPrompt(settings, characterId, skillIds), injectThinkingTemplate);
      res.status(202).json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}
