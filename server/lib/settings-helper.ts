import fs from 'fs/promises';
import path from 'path';

export interface UserSettings {
  activeModelId?: string;
  activeCharacterId?: string;
  providers: any[];
  models: any[];
  characters: any[];
  systemPrompt: string;
  renderThinkingAsMarkdown: boolean;
  autoScroll: boolean;
  collapseThinkingFinished: boolean;
  gemmaTrimThinkingSpaces: boolean;
  starredSessions?: Record<string, string>;
  claudeChunks?: string[];
  claudeChunkRemarks?: Record<string, string>;
  stickyNotes?: any[];
  [key: string]: any;
}

export async function loadSettings(settingsFile: string): Promise<UserSettings> {
  const dataDir = path.dirname(settingsFile);
  const providersFile = path.join(dataDir, 'providers.json');
  const modelsFile = path.join(dataDir, 'models.json');
  const charactersFile = path.join(dataDir, 'characters.json');

  let settings: any = {};
  let settingsExist = false;
  try {
    const content = await fs.readFile(settingsFile, 'utf-8');
    settings = JSON.parse(content);
    settingsExist = true;
  } catch {
    settings = {};
  }

  // Load providers
  let providers: any[] = [];
  let providersMigrated = false;
  try {
    const content = await fs.readFile(providersFile, 'utf-8');
    providers = JSON.parse(content);
  } catch {
    // If separate file is missing but exists in settings.json, we migrate it
    if (settings.providers) {
      providers = settings.providers;
      providersMigrated = true;
    }
  }

  // Load models
  let models: any[] = [];
  let modelsMigrated = false;
  try {
    const content = await fs.readFile(modelsFile, 'utf-8');
    models = JSON.parse(content);
  } catch {
    // If separate file is missing but exists in settings.json, we migrate it
    if (settings.models) {
      models = settings.models;
      modelsMigrated = true;
    }
  }

  // Load characters
  let characters: any[] = [];
  let charactersMigrated = false;
  try {
    const content = await fs.readFile(charactersFile, 'utf-8');
    characters = JSON.parse(content);
  } catch {
    // If separate file is missing but exists in settings.json, we migrate it
    if (settings.characters) {
      characters = settings.characters;
      charactersMigrated = true;
    }
  }

  // If any key was migrated, write them down so they are separated right now
  if (providersMigrated) {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(providersFile, JSON.stringify(providers, null, 2), 'utf-8');
  }
  if (modelsMigrated) {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(modelsFile, JSON.stringify(models, null, 2), 'utf-8');
  }
  if (charactersMigrated) {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(charactersFile, JSON.stringify(characters, null, 2), 'utf-8');
  }

  // Remove keys from root settings object to prevent redundancy
  delete settings.providers;
  delete settings.models;
  delete settings.characters;

  // If migration occurred, we should rewrite settings.json without these three keys
  if (settingsExist && (providersMigrated || modelsMigrated || charactersMigrated)) {
    await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2), 'utf-8');
  }

  return {
    ...settings,
    providers,
    models,
    characters
  };
}

export async function saveSettings(settingsFile: string, settings: UserSettings): Promise<void> {
  const dataDir = path.dirname(settingsFile);
  const providersFile = path.join(dataDir, 'providers.json');
  const modelsFile = path.join(dataDir, 'models.json');
  const charactersFile = path.join(dataDir, 'characters.json');

  // Deep clone to avoid mutating the original object passed by the caller
  const settingsCopy = JSON.parse(JSON.stringify(settings));

  const providers = settingsCopy.providers || [];
  const models = settingsCopy.models || [];
  const characters = settingsCopy.characters || [];

  delete settingsCopy.providers;
  delete settingsCopy.models;
  delete settingsCopy.characters;

  await fs.mkdir(dataDir, { recursive: true });

  await fs.writeFile(settingsFile, JSON.stringify(settingsCopy, null, 2), 'utf-8');
  await fs.writeFile(providersFile, JSON.stringify(providers, null, 2), 'utf-8');
  await fs.writeFile(modelsFile, JSON.stringify(models, null, 2), 'utf-8');
  await fs.writeFile(charactersFile, JSON.stringify(characters, null, 2), 'utf-8');
}
