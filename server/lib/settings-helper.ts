import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

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
  const tempPath = `${filepath}.tmp-${crypto.randomUUID()}`;
  try {
    await fs.writeFile(tempPath, newJSON, 'utf-8');
    await fs.rename(tempPath, filepath);
  } catch (err) {
    try {
      await fs.unlink(tempPath);
    } catch {}
    throw err;
  }
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
  let providersLoaded = false;
  try {
    const content = await fs.readFile(providersFile, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      providers = parsed;
      providersLoaded = true;
    }
  } catch {
    // ignore
  }

  // Load models from split file with Array.isArray guard
  let models: any[] = [];
  let modelsLoaded = false;
  try {
    const content = await fs.readFile(modelsFile, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      models = parsed;
      modelsLoaded = true;
    }
  } catch {
    // ignore
  }

  // Load characters from split file with Array.isArray guard
  let characters: any[] = [];
  let charactersLoaded = false;
  try {
    const content = await fs.readFile(charactersFile, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      characters = parsed;
      charactersLoaded = true;
    }
  } catch {
    // ignore
  }

  // On-the-fly migration check
  const hasProvidersInSettings = settings.providers && Array.isArray(settings.providers);
  const hasModelsInSettings = settings.models && Array.isArray(settings.models);
  const hasCharactersInSettings = settings.characters && Array.isArray(settings.characters);

  if (hasProvidersInSettings || hasModelsInSettings || hasCharactersInSettings) {
    let needWriteProviders = false;
    let needWriteModels = false;
    let needWriteCharacters = false;

    if (hasProvidersInSettings) {
      if (!providersLoaded) {
        providers = settings.providers;
        needWriteProviders = true;
      }
      delete settings.providers;
    }
    if (hasModelsInSettings) {
      if (!modelsLoaded) {
        models = settings.models;
        needWriteModels = true;
      }
      delete settings.models;
    }
    if (hasCharactersInSettings) {
      if (!charactersLoaded) {
        characters = settings.characters;
        needWriteCharacters = true;
      }
      delete settings.characters;
    }

    try {
      await fs.mkdir(dataDir, { recursive: true });
      if (needWriteProviders) {
        await writeIfChanged(providersFile, JSON.stringify(providers, null, 2));
      }
      if (needWriteModels) {
        await writeIfChanged(modelsFile, JSON.stringify(models, null, 2));
      }
      if (needWriteCharacters) {
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

  const incomingProviders = settingsCopy.providers;
  const incomingModels = settingsCopy.models;
  const incomingCharacters = settingsCopy.characters;

  delete settingsCopy.providers;
  delete settingsCopy.models;
  delete settingsCopy.characters;

  await fs.mkdir(dataDir, { recursive: true });

  const filesToWrite: { filepath: string; content: string }[] = [];

  const addIfChanged = async (filepath: string, content: string) => {
    try {
      const existing = await fs.readFile(filepath, 'utf-8');
      if (existing === content) {
        return;
      }
    } catch {
      // File missing
    }
    filesToWrite.push({ filepath, content });
  };

  await addIfChanged(settingsFile, JSON.stringify(settingsCopy, null, 2));

  if (incomingProviders && Array.isArray(incomingProviders)) {
    await addIfChanged(providersFile, JSON.stringify(incomingProviders, null, 2));
  }
  if (incomingModels && Array.isArray(incomingModels)) {
    await addIfChanged(modelsFile, JSON.stringify(incomingModels, null, 2));
  }
  if (incomingCharacters && Array.isArray(incomingCharacters)) {
    await addIfChanged(charactersFile, JSON.stringify(incomingCharacters, null, 2));
  }

  if (filesToWrite.length === 0) {
    return;
  }

  // Transactional multi-file temporary writes with rollback capability
  const writtenOps: { tempPath: string; filepath: string }[] = [];
  const backupOps: { backupPath: string; filepath: string }[] = [];

  try {
    // 1. Write all new contents to temporary files (and track them immediately to prevent leaks)
    for (const op of filesToWrite) {
      const tempPath = `${op.filepath}.tmp-${crypto.randomUUID()}`;
      writtenOps.push({ tempPath, filepath: op.filepath });
      await fs.writeFile(tempPath, op.content, 'utf-8');
    }

    // 2. Back up existing target files (rename target to backupPath if it exists)
    for (const op of filesToWrite) {
      try {
        await fs.access(op.filepath);
        const backupPath = `${op.filepath}.bak-${crypto.randomUUID()}`;
        await fs.rename(op.filepath, backupPath);
        backupOps.push({ backupPath, filepath: op.filepath });
      } catch {
        // Target does not exist, no backup needed
      }
    }

    // 3. Rename all temporary files to targets
    for (const op of writtenOps) {
      await fs.rename(op.tempPath, op.filepath);
    }

    // 4. Everything succeeded! Clean up backup files
    for (const op of backupOps) {
      try {
        await fs.unlink(op.backupPath);
      } catch {}
    }
  } catch (err: any) {
    // 5. Failure occurred: Roll back completed renames
    for (const op of backupOps) {
      try {
        await fs.rename(op.backupPath, op.filepath);
      } catch {}
    }
    // Clean up temporary files
    for (const op of writtenOps) {
      try {
        await fs.unlink(op.tempPath);
      } catch {}
    }
    throw err;
  }
}
