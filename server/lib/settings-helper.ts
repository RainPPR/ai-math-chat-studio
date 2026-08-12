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

async function writeIfChanged(filepath: string, newJSON: string): Promise<void> {
  try {
    const existing = await fs.readFile(filepath, 'utf-8');
    if (existing === newJSON) {
      return; // Skip writing if identical
    }
  } catch {
    // File does not exist, proceed
  }
  const tempPath = `${filepath}.tmp`;
  await fs.writeFile(tempPath, newJSON, 'utf-8');
  await fs.rename(tempPath, filepath);
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

  // Load providers from split file with Array.isArray guard
  let providers: any[] = [];
  try {
    const content = await fs.readFile(providersFile, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      providers = parsed;
    }
  } catch {
    // If separate file read fails or isn't array, and settings has providers, migrate
    if (settings.providers && Array.isArray(settings.providers)) {
      providers = settings.providers;
    }
  }

  // Load models from split file with Array.isArray guard
  let models: any[] = [];
  try {
    const content = await fs.readFile(modelsFile, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      models = parsed;
    }
  } catch {
    // If separate file read fails or isn't array, and settings has models, migrate
    if (settings.models && Array.isArray(settings.models)) {
      models = settings.models;
    }
  }

  // Load characters from split file with Array.isArray guard
  let characters: any[] = [];
  try {
    const content = await fs.readFile(charactersFile, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      characters = parsed;
    }
  } catch {
    // If separate file read fails or isn't array, and settings has characters, migrate
    if (settings.characters && Array.isArray(settings.characters)) {
      characters = settings.characters;
    }
  }

  // On-the-fly migration: if keys exist in settings.json, perform the split & save
  const hasProvidersInSettings = settings.providers && Array.isArray(settings.providers);
  const hasModelsInSettings = settings.models && Array.isArray(settings.models);
  const hasCharactersInSettings = settings.characters && Array.isArray(settings.characters);

  if (hasProvidersInSettings || hasModelsInSettings || hasCharactersInSettings) {
    if (hasProvidersInSettings) providers = settings.providers;
    if (hasModelsInSettings) models = settings.models;
    if (hasCharactersInSettings) characters = settings.characters;

    delete settings.providers;
    delete settings.models;
    delete settings.characters;

    try {
      await fs.mkdir(dataDir, { recursive: true });
      if (hasProvidersInSettings) {
        await writeIfChanged(providersFile, JSON.stringify(providers, null, 2));
      }
      if (hasModelsInSettings) {
        await writeIfChanged(modelsFile, JSON.stringify(models, null, 2));
      }
      if (hasCharactersInSettings) {
        await writeIfChanged(charactersFile, JSON.stringify(characters, null, 2));
      }
      if (settingsExist) {
        await writeIfChanged(settingsFile, JSON.stringify(settings, null, 2));
      }
    } catch (err: any) {
      console.warn(`[Settings Migration] Non-blocking failure while saving migrated files: ${err.message}`);
    }
  }

  return {
    ...settings,
    providers,
    models,
    characters,
  };
}

export async function saveSettings(settingsFile: string, settings: UserSettings): Promise<void> {
  const dataDir = path.dirname(settingsFile);
  const providersFile = path.join(dataDir, 'providers.json');
  const modelsFile = path.join(dataDir, 'models.json');
  const charactersFile = path.join(dataDir, 'characters.json');

  const settingsCopy = JSON.parse(JSON.stringify(settings));

  // Extract from incoming settings if they are valid arrays
  const incomingProviders = settingsCopy.providers;
  const incomingModels = settingsCopy.models;
  const incomingCharacters = settingsCopy.characters;

  delete settingsCopy.providers;
  delete settingsCopy.models;
  delete settingsCopy.characters;

  await fs.mkdir(dataDir, { recursive: true });

  // Save general settings
  await writeIfChanged(settingsFile, JSON.stringify(settingsCopy, null, 2));

  // Guard: Only write split files if they were present in settings and are valid arrays
  if (incomingProviders && Array.isArray(incomingProviders)) {
    await writeIfChanged(providersFile, JSON.stringify(incomingProviders, null, 2));
  }
  if (incomingModels && Array.isArray(incomingModels)) {
    await writeIfChanged(modelsFile, JSON.stringify(incomingModels, null, 2));
  }
  if (incomingCharacters && Array.isArray(incomingCharacters)) {
    await writeIfChanged(charactersFile, JSON.stringify(incomingCharacters, null, 2));
  }
}
