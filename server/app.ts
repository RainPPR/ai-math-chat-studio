import express from 'express';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { GenerationManager } from './services/generation-manager';
import { createSettingsRouter } from './routes/settings';
import { createSessionRouter } from './routes/sessions';
import { createChatRouter } from './routes/chat';
import { createModelsRouter } from './routes/models';

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

interface ProviderInstance {
  id: string;
  type: string;
  name: string;
  baseURL?: string;
  apiKey?: string;
  envKey?: string;
  extra?: Record<string, any>;
  modelSource?: string;
}

interface ModelInstance {
  id: string;
  providerId: string;
  providerType: string;
  modelId: string;
  displayName?: string;
  temperature?: number;
  maxTokens?: number;
  reasoningEffort?: string;
  thinkingLevel?: string;
  extraBody?: Record<string, any>;
  injectThinkingTemplate?: boolean;
}

interface Character {
  id: string;
  name: string;
  systemPrompt: string;
}

interface UserSettings {
  activeModelId?: string;
  activeCharacterId?: string;
  providers: ProviderInstance[];
  models: ModelInstance[];
  characters: Character[];
  systemPrompt: string;
  renderThinkingAsMarkdown: boolean;
  autoScroll: boolean;
  collapseThinkingFinished: boolean;
  gemmaTrimThinkingSpaces: boolean;
}

async function syncRemoteModels(settingsFile: string) {
  try {
    const content = await readFile(settingsFile, 'utf-8');
    const settings: UserSettings = JSON.parse(content);

    let modified = false;
    const syncableProviders = settings.providers.filter(
      p => (p.type === 'nvidia' || p.type === 'openai-compatible') && p.modelSource
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
        const newModels: ModelInstance[] = validModels.map(remote => ({
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

        // Clear activeModelId if it was removed
        if (settings.activeModelId && !settings.models.find(m => m.id === settings.activeModelId)) {
          settings.activeModelId = undefined;
        }

        modified = true;
        console.log(`[Sync] Provider ${provider.name}: removed ${removedCount} models, added ${newModels.length} models`);
      } catch (err: any) {
        console.error(`[Sync] Error syncing ${provider.modelSource}: ${err.message}`);
      }
    }

    if (modified) {
      await writeFile(settingsFile, JSON.stringify(settings, null, 2), 'utf-8');
      console.log(`[Sync] Settings saved to ${settingsFile}`);
    } else {
      console.log('[Sync] No remote model sources to sync or no changes needed');
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      console.error(`[Sync] Error reading settings: ${err.message}`);
    }
  }
}

export async function startApp() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  const DATA_DIR = path.join(process.cwd(), 'data');
  const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');
  const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

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
