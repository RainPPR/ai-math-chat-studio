import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { sortProviders, sortModels } from '../../shared/sorting';

export { sortProviders, sortModels };

export interface UserSettings {
  activeModelId?: string;
  activeCharacterId?: string;
  activeSkillIds?: string[];
  providers: any[];
  models: any[];
  tempModels?: any[];
  characters: any[];
  skills?: any[];
  systemPrompt: string;
  renderThinkingAsMarkdown: boolean;
  autoScroll: boolean;
  collapseThinkingFinished: boolean;
  trimThinkingSpaces: boolean;
  starredSessions?: Record<string, string>;
  claudeChunks?: string[];
  claudeChunkRemarks?: Record<string, string>;
  stickyNotes?: any[];
  [key: string]: any;
}

const DEFAULT_SKILLS = [
  {
    id: 'default-assistant',
    name: 'Assistant',
    prompt: '你是一个有用、专业、诚实且无害的人工智能助手。请以礼貌、清晰和准确的方式回答用户的每一个问题。',
  },
];

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
  const tempModelsFile = path.join(dataDir, 'temp-models.json');
  const charactersFile = path.join(dataDir, 'characters.json');
  const skillsFile = path.join(dataDir, 'skills.json');

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

  // Load tempModels from split file with Array.isArray guard
  let tempModels: any[] = [];
  let tempModelsLoaded = false;
  try {
    const content = await fs.readFile(tempModelsFile, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      tempModels = parsed;
      tempModelsLoaded = true;
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

  // Load skills from split file with Array.isArray guard
  let skills: any[] = [];
  let skillsLoaded = false;
  try {
    const content = await fs.readFile(skillsFile, 'utf-8');
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      skills = parsed;
      skillsLoaded = true;
    }
  } catch {
    // ignore
  }

  // On-the-fly migration check
  const hasProvidersInSettings = settings.providers && Array.isArray(settings.providers);
  const hasModelsInSettings = settings.models && Array.isArray(settings.models);
  const hasTempModelsInSettings = settings.tempModels && Array.isArray(settings.tempModels);
  const hasCharactersInSettings = settings.characters && Array.isArray(settings.characters);
  const hasSkillsInSettings = settings.skills && Array.isArray(settings.skills);

  if (hasProvidersInSettings || hasModelsInSettings || hasTempModelsInSettings || hasCharactersInSettings || hasSkillsInSettings) {
    let needWriteProviders = false;
    let needWriteModels = false;
    let needWriteTempModels = false;
    let needWriteCharacters = false;
    let needWriteSkills = false;

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
    if (hasTempModelsInSettings) {
      if (!tempModelsLoaded) {
        tempModels = settings.tempModels;
        needWriteTempModels = true;
      }
      delete settings.tempModels;
    }
    if (hasCharactersInSettings) {
      if (!charactersLoaded) {
        characters = settings.characters;
        needWriteCharacters = true;
      }
      delete settings.characters;
    }
    if (hasSkillsInSettings) {
      if (!skillsLoaded) {
        skills = settings.skills;
        needWriteSkills = true;
      }
      delete settings.skills;
    }

    try {
      await fs.mkdir(dataDir, { recursive: true });
      if (needWriteProviders) {
        await writeIfChanged(providersFile, JSON.stringify(providers, null, 2));
      }
      if (needWriteModels) {
        await writeIfChanged(modelsFile, JSON.stringify(models, null, 2));
      }
      if (needWriteTempModels) {
        await writeIfChanged(tempModelsFile, JSON.stringify(tempModels, null, 2));
      }
      if (needWriteCharacters) {
        await writeIfChanged(charactersFile, JSON.stringify(characters, null, 2));
      }
      if (needWriteSkills) {
        await writeIfChanged(skillsFile, JSON.stringify(skills, null, 2));
      }
      if (settingsExist) {
        await writeIfChanged(settingsFile, JSON.stringify(settings, null, 2));
      }
    } catch (err: any) {
      console.warn(`[Settings Migration] Non-blocking failure while saving migrated files: ${err.message}`);
    }
  }

  if (!skillsLoaded && skills.length === 0) {
    skills = DEFAULT_SKILLS;
    try {
      await fs.mkdir(dataDir, { recursive: true });
      await writeIfChanged(skillsFile, JSON.stringify(skills, null, 2));
    } catch {}
  }

  return {
    ...settings,
    providers,
    models,
    tempModels,
    characters,
    skills,
  };
}

export async function saveSettings(settingsFile: string, settings: UserSettings): Promise<void> {
  const dataDir = path.dirname(settingsFile);
  const providersFile = path.join(dataDir, 'providers.json');
  const modelsFile = path.join(dataDir, 'models.json');
  const tempModelsFile = path.join(dataDir, 'temp-models.json');
  const charactersFile = path.join(dataDir, 'characters.json');
  const skillsFile = path.join(dataDir, 'skills.json');

  const settingsCopy = JSON.parse(JSON.stringify(settings));

  let incomingProviders = settingsCopy.providers;
  if (incomingProviders && Array.isArray(incomingProviders)) {
    incomingProviders = sortProviders(incomingProviders);
  }
  let incomingModels = settingsCopy.models;
  if (incomingModels && Array.isArray(incomingModels)) {
    incomingModels = sortModels(incomingModels, incomingProviders || []);
  }
  const incomingTempModels = settingsCopy.tempModels;
  const incomingCharacters = settingsCopy.characters;
  const incomingSkills = settingsCopy.skills;

  delete settingsCopy.providers;
  delete settingsCopy.models;
  delete settingsCopy.tempModels;
  delete settingsCopy.characters;
  delete settingsCopy.skills;

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
  if (incomingTempModels && Array.isArray(incomingTempModels)) {
    await addIfChanged(tempModelsFile, JSON.stringify(incomingTempModels, null, 2));
  }
  if (incomingCharacters && Array.isArray(incomingCharacters)) {
    await addIfChanged(charactersFile, JSON.stringify(incomingCharacters, null, 2));
  }
  if (incomingSkills && Array.isArray(incomingSkills)) {
    await addIfChanged(skillsFile, JSON.stringify(incomingSkills, null, 2));
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