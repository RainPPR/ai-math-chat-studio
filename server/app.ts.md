```typescript
import express from 'express';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { GenerationManager } from './services/generation-manager';
import { createSettingsRouter } from './routes/settings';
import { createSessionRouter } from './routes/sessions';
import { createChatRouter } from './routes/chat';
import { createModelsRouter } from './routes/models';
import { createTemplatesRouter } from './routes/templates';
import { initLogger } from './services/logger';
import { loadSettings, saveSettings, sortModels } from './lib/settings-helper';

interface RemoteModelDef {
  id: string;
  modelId: string;
  displayName?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: string;
  thinkingLevel?: string;
  extraBody?: Record<string, any>;
  injectThinkingTemplate?: boolean;
  [key: string]: any;
}

function isTextGenerationModel(modelObj: any): boolean {
  const modelId = String(modelObj.modelId || modelObj.id || '').trim();
  const displayName = String(modelObj.displayName || modelObj.display_name || modelObj.name || '').trim();
  if (!modelId) return false;

  const lowerId = modelId.toLowerCase();
  const lowerName = displayName.toLowerCase();

  // Exclude non-text endpoints if endpoints array is specified
  if (Array.isArray(modelObj.endpoints) && modelObj.endpoints.length > 0) {
    const textEndpoints = ['chat/completions', 'completions', 'messages', 'responses'];
    const hasTextEndpoint = modelObj.endpoints.some((ep: any) =>
      textEndpoints.some(te => String(ep).toLowerCase().includes(te))
    );
    if (!hasTextEndpoint) return false;
  }

  // Exclude object/type/mode
  const objType = String(modelObj.object || modelObj.type || modelObj.mode || '').toLowerCase();
  if (['embedding', 'image', 'tts', 'audio', 'speech', 'moderation', 'rerank'].includes(objType)) {
    return false;
  }

  // Keywords to exclude
  const excludedKeywords = [
    'embed', 'embedding', 'bge-', 'e5-', 'text-embedding',
    'dall-e', 'dalle', 'stable-diffusion', 'sdxl', 'midjourney', 'flux', 'imagen', 'sd3', 'text-to-image', 'tti', 'diffusion', 'image-edit', 'image_edit', 't2i', 'i2i',
    'whisper', 'tts', 'text-to-speech', 'speech-', 'audio',
    'moderation', 'rerank', 'reranker'
  ];

  if (excludedKeywords.some(kw => lowerId.includes(kw) || lowerName.includes(kw))) {
    return false;
  }

  return true;
}

function getProviderAbbreviation(providerName: string): string {
  const name = providerName.trim();
  if (name === 'ModelScope') return 'MS';
  if (name.startsWith('AMD')) return 'AMD';
  if (name.startsWith('FreeTheAI')) return 'FTAI';
  const uppers = name.match(/[A-Z]/g);
  if (uppers && uppers.length >= 2) {
    return uppers.join('');
  }
  return name;
}

function deriveDisplayName(modelId: string, rawName?: string, providerName?: string): string {
  let nameStr = (rawName && String(rawName).trim()) ? String(rawName).trim() : modelId.trim();

  // If name contains a/b, take only b
  if (nameStr.includes('/')) {
    const parts = nameStr.split('/');
    nameStr = parts[parts.length - 1];
  }

  if (providerName) {
    const abbr = getProviderAbbreviation(providerName);
    return `${nameStr} (${abbr})`;
  }

  return nameStr;
}

function buildV1ModelsUrl(provider: any): string | null {
  if (provider.type === 'nvidia') {
    return 'https://integrate.api.nvidia.com/v1/models';
  }
  if (!provider.baseURL || !provider.baseURL.trim()) {
    return null;
  }
  const base = provider.baseURL.trim().replace(/\/+$/, '');
  if (base.endsWith('/models')) {
    return base;
  }
  return `${base}/models`;
}

function buildProviderHeaders(provider: any): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(provider.extra || {}),
  };

  let apiKey = provider.apiKey;
  if (!apiKey && provider.envKey) {
    apiKey = process.env[provider.envKey];
  }
  if (!apiKey) {
    if (provider.type === 'nvidia') {
      apiKey = process.env.NVIDIA_API_KEY;
    }
  }

  if (apiKey && apiKey !== 'none') {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  return headers;
}

async function syncRemoteModels(settingsFile: string) {
  try {
    const settings = await loadSettings(settingsFile);

    let modified = false;
    const syncableProviders = (settings.providers || []).filter(
      (p: any) => (p.type === 'nvidia' || p.type === 'openai-compatible')
    );

    for (const provider of syncableProviders) {
      let syncType = provider.modelSyncType;
      if (!syncType) {
        if (provider.modelSource) {
          syncType = 'json';
        } else {
          syncType = 'none';
        }
      }

      if (syncType === 'none') continue;

      try {
        let rawRemoteModels: any[] = [];

        if (syncType === 'json' && provider.modelSource) {
          console.log(`[Sync] Fetching models from JSON URL: ${provider.modelSource} for provider ${provider.name} (${provider.id})`);
          const response = await fetch(provider.modelSource);
          if (!response.ok) {
            console.error(`[Sync] Failed to fetch JSON from ${provider.modelSource}: ${response.status} ${response.statusText}`);
            continue;
          }
          const json = await response.json();
          if (Array.isArray(json)) {
            rawRemoteModels = json;
          } else if (Array.isArray(json.data)) {
            rawRemoteModels = json.data;
          } else {
            rawRemoteModels = [];
          }
        } else if (syncType === 'v1_models') {
          const url = buildV1ModelsUrl(provider);
          if (!url) {
            console.warn(`[Sync] Cannot sync /v1/models for ${provider.name}: Base URL is missing.`);
            continue;
          }
          const headers = buildProviderHeaders(provider);
          console.log(`[Sync] Fetching models from /v1/models: ${url} for provider ${provider.name} (${provider.id})`);
          const response = await fetch(url, { headers });
          if (!response.ok) {
            console.error(`[Sync] Failed to fetch /v1/models from ${url}: ${response.status} ${response.statusText}`);
            continue;
          }
          const json = await response.json();
          if (Array.isArray(json)) {
            rawRemoteModels = json;
          } else if (Array.isArray(json.data)) {
            rawRemoteModels = json.data;
          } else {
            rawRemoteModels = [];
          }
        } else {
          continue;
        }

        const filteredRemoteModels = rawRemoteModels.filter(isTextGenerationModel);

        const parsedRemoteModels: RemoteModelDef[] = filteredRemoteModels.map(item => {
          const modelId = String(item.modelId || item.id || '').trim();
          let rawName = item.displayName;
          if (!rawName) rawName = item.display_name;
          if (!rawName) rawName = item.name;
          if (!rawName) rawName = item.title;
          if (!rawName) rawName = item.metadata?.display_name;
          const displayName = deriveDisplayName(modelId, rawName, provider.name);

          let re = item.reasoningEffort;
          if (!re) re = item.reasoning_effort;

          return {
            id: item.id || crypto.randomUUID(),
            modelId,
            displayName,
            temperature: item.temperature,
            maxTokens: item.maxTokens,
            reasoningEffort: re,
            thinkingLevel: item.thinkingLevel,
            extraBody: item.extraBody,
            injectThinkingTemplate: item.injectThinkingTemplate,
          };
        }).filter(m => m.modelId);

        if (parsedRemoteModels.length === 0) {
          console.warn(`[Sync] No valid text models found for provider ${provider.name} (${provider.id})`);
          continue;
        }

        // Merge & preserve existing models (supporting multiple instances per modelId)
        const existingForProvider = settings.models.filter((m: any) => m.providerId === provider.id);
        const existingByModelId = new Map<string, any[]>();
        for (const existing of existingForProvider) {
          const list = existingByModelId.get(existing.modelId) || [];
          list.push(existing);
          existingByModelId.set(existing.modelId, list);
        }

        const otherModels = settings.models.filter((m: any) => m.providerId !== provider.id);

        const newModelsForProvider: any[] = [];
        const processedModelIds = new Set<string>();

        for (const remote of parsedRemoteModels) {
          processedModelIds.add(remote.modelId);
          const existingList = existingByModelId.get(remote.modelId);

          if (existingList && existingList.length > 0) {
            // REUSE existing local instances (preserving all distinct instances)
            for (const existing of existingList) {
              const defaultDerivedName = deriveDisplayName(existing.modelId, existing.modelId, provider.name);
              let isRawName = false;
              if (!existing.displayName || existing.displayName === existing.modelId || existing.displayName.includes('/') || existing.displayName === defaultDerivedName) {
                isRawName = true;
              }

              let finalDisplayName = existing.displayName;
              if (isRawName) {
                finalDisplayName = remote.displayName;
              }

              let tempVal = existing.temperature;
              if (tempVal === undefined) tempVal = remote.temperature;

              let maxTokVal = existing.maxTokens;
              if (maxTokVal === undefined) maxTokVal = remote.maxTokens;

              let reVal = existing.reasoningEffort;
              if (!reVal) reVal = remote.reasoningEffort;

              let tlVal = existing.thinkingLevel;
              if (!tlVal) tlVal = remote.thinkingLevel;

              let ebVal = existing.extraBody;
              if (!ebVal) ebVal = remote.extraBody;

              let ittVal = existing.injectThinkingTemplate;
              if (ittVal === undefined) ittVal = remote.injectThinkingTemplate;

              newModelsForProvider.push({
                ...existing,
                providerType: provider.type,
                displayName: finalDisplayName,
                temperature: tempVal,
                maxTokens: maxTokVal,
                reasoningEffort: reVal,
                thinkingLevel: tlVal,
                extraBody: ebVal,
                injectThinkingTemplate: ittVal,
              });
            }
          } else {
            // New model from remote
            newModelsForProvider.push({
              id: crypto.randomUUID(),
              providerId: provider.id,
              providerType: provider.type,
              modelId: remote.modelId,
              displayName: remote.displayName,
              temperature: remote.temperature,
              maxTokens: remote.maxTokens,
              reasoningEffort: remote.reasoningEffort,
              thinkingLevel: remote.thinkingLevel,
              extraBody: remote.extraBody,
              injectThinkingTemplate: remote.injectThinkingTemplate,
            });
          }
        }

        // Keep existing models that were not in remote list IF user configured custom settings or custom display name
        for (const existing of existingForProvider) {
          if (!processedModelIds.has(existing.modelId)) {
            const defaultDerivedName = deriveDisplayName(existing.modelId, existing.modelId, provider.name);
            const hasCustomDisplayName = Boolean(
              existing.displayName &&
              existing.displayName !== existing.modelId &&
              !existing.displayName.includes('/') &&
              existing.displayName !== defaultDerivedName
            );

            const hasCustomizations =
              hasCustomDisplayName ||
              existing.temperature !== undefined ||
              existing.maxTokens !== undefined ||
              existing.reasoningEffort !== undefined ||
              existing.thinkingLevel !== undefined ||
              existing.extraBody !== undefined ||
              existing.injectThinkingTemplate !== undefined;

            if (hasCustomizations) {
              newModelsForProvider.push(existing);
            }
          }
        }

        settings.models = [...otherModels, ...newModelsForProvider];

        // Clear activeModelId if it was removed (checking both models and tempModels)
        if (settings.activeModelId && !settings.models.find((m: any) => m.id === settings.activeModelId) && !settings.tempModels?.find((m: any) => m.id === settings.activeModelId)) {
          settings.activeModelId = undefined;
        }

        modified = true;
        console.log(`[Sync] Provider ${provider.name}: updated to ${newModelsForProvider.length} models`);
      } catch (err: any) {
        console.error(`[Sync] Error syncing ${provider.name}: ${err.message}`);
      }
    }

    // Ensure all models are sorted on startup
    const sorted = sortModels(settings.models, settings.providers);
    const orderChanged = JSON.stringify(settings.models.map((m: any) => m.id)) !== JSON.stringify(sorted.map((m: any) => m.id));
    if (orderChanged) {
      settings.models = sorted;
      modified = true;
    }

    if (modified) {
      await saveSettings(settingsFile, settings);
      console.log(`[Sync] Settings saved to ${settingsFile}`);
    } else {
      console.log('[Sync] No remote model sources to sync or no changes needed');
    }
  } catch (err: any) {
    console.error(`[Sync] Error syncing settings: ${err.message}`);
  }
}

export async function startApp() {
  const DATA_DIR = path.join(process.cwd(), 'data');
  const LOG_DIR = path.join(DATA_DIR, 'log');

  // Initialize logger first
  initLogger(LOG_DIR);

  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
  const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
  const TEMPLATES_FILE = path.join(DATA_DIR, 'templates.json');

  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });

  // Sync remote model sources before starting server
  await syncRemoteModels(SETTINGS_FILE);

  const gm = new GenerationManager(SESSIONS_DIR);

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(createSettingsRouter(SETTINGS_FILE));
  app.use(createSessionRouter(gm));
  app.use(createChatRouter(gm, SETTINGS_FILE));
  app.use(createModelsRouter());
  app.use(createTemplatesRouter(TEMPLATES_FILE));

  if (process.env.NODE_ENV !== 'production') {
    const { createViteServer } = await import('./vite-helper');
    const vite = await createViteServer();
    app.use(vite.middlewares);
  } else {
    const distPath = process.env.DIST_DIR || path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('{*path}', (_req, res) => { res.sendFile(path.join(distPath, 'index.html')); });
  }

  return new Promise<import('net').Server>((resolve) => {
    const server = app.listen(PORT, '127.0.0.1', () => {
      const addr = server.address();
      const actualPort = typeof addr === 'string' ? addr : addr?.port;
      console.log(`Server running on http://localhost:${actualPort}`);
      resolve(server);
    });
  });
}
```