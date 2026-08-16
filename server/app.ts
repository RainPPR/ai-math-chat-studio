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

async function syncRemoteModels(settingsFile: string) {
  try {
    const settings = await loadSettings(settingsFile);

    let modified = false;
    const syncableProviders = (settings.providers || []).filter(
      (p: any) => (p.type === 'nvidia' || p.type === 'openai-compatible') && p.modelSource
    );

    for (const provider of syncableProviders) {
      if (!provider.modelSource) continue;

      try {
        console.log(`[Sync] Fetching models from ${provider.modelSource} for provider ${provider.name} (${provider.id})`);
        const response = await fetch(provider.modelSource);
        if (!response.ok) {
          console.error(`[Sync] Failed to fetch from ${provider.modelSource}: ${response.status} ${response.statusText}`);
          continue;
        }

        const remoteModels: RemoteModelDef[] = await response.json();
        if (!Array.isArray(remoteModels)) {
          console.error(`[Sync] Invalid response from ${provider.modelSource}: expected array`);
          continue;
        }

        // Validate remote models before making any changes
        if (remoteModels.length === 0) {
          console.warn(`[Sync] Remote source ${provider.modelSource} returned empty model list, skipping`);
          continue;
        }

        // Check if all models have required fields
        const validModels = remoteModels.filter(m => m.id && m.modelId);
        if (validModels.length === 0) {
          console.error(`[Sync] No valid models found in ${provider.modelSource}`);
          continue;
        }

        if (validModels.length < remoteModels.length) {
          console.warn(`[Sync] Filtered out ${remoteModels.length - validModels.length} invalid models from ${provider.modelSource}`);
        }

        // All validations passed - now remove existing models and add new ones
        const originalModelCount = settings.models.length;
        settings.models = settings.models.filter(m => m.providerId !== provider.id);
        const removedCount = originalModelCount - settings.models.length;

        // Add new models from remote source
        const newModels: any[] = validModels.map(remote => ({
          id: remote.id,
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
        }));

        settings.models.push(...newModels);

        // Clear activeModelId if it was removed (checking both models and tempModels)
        if (settings.activeModelId && !settings.models.find((m: any) => m.id === settings.activeModelId) && !settings.tempModels?.find((m: any) => m.id === settings.activeModelId)) {
          settings.activeModelId = undefined;
        }

        modified = true;
        console.log(`[Sync] Provider ${provider.name}: removed ${removedCount} models, added ${newModels.length} models`);
      } catch (err: any) {
        console.error(`[Sync] Error syncing ${provider.modelSource}: ${err.message}`);
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

  app.use(express.json());
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