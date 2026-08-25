import JSZip from "jszip";
import React, { useState, useEffect, useRef } from 'react';
import { UserSettings, ProviderInstance, ModelInstance, TempModel, Character, Skill, BuiltInProviderType, DEFAULT_SETTINGS, KATEX_FONTS, Template } from '../types';
import { api } from '../lib/api';
import { X, Plus, Trash2, Save, ChevronDown, Pencil, Check, AlertTriangle, Download, ArrowUp, ArrowDown } from 'lucide-react';
import { sortProviders, sortModels } from '../../shared/sorting';


function formatClaudeDate(dateStr: string) {
  const d = new Date(dateStr);
  const iso = d.toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  return iso.replace(/\.(\d+)Z$/, (match, p1) => {
    return '.' + p1.padEnd(6, '0') + 'Z';
  });
}


interface SettingsModalProps {
  settings: UserSettings;
  onSave: (settings: UserSettings) => void;
  templates: Template[];
  onSaveTemplates: (templates: Template[]) => Promise<void>;
  onClose: () => void;
}

type Tab = 'general' | 'providers' | 'models' | 'tempModels' | 'characters' | 'skills' | 'templates';

// ===== Active Model Dropdown Component =====

interface ActiveModelDropdownProps {
  models: ModelInstance[];
  providers: ProviderInstance[];
  tempModels?: TempModel[];
  activeModelId?: string;
  onChange: (id: string) => void;
}

const ActiveModelDropdown: React.FC<ActiveModelDropdownProps> = ({
  models,
  providers,
  tempModels = [],
  activeModelId,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, []);

  // Group models by provider
  const modelsByProvider = new Map<string, ModelInstance[]>();
  const modelsWithoutProvider: ModelInstance[] = [];

  models.forEach(m => {
    const provider = providers.find(p => p.id === m.providerId);
    if (provider) {
      const list = modelsByProvider.get(provider.id) || [];
      list.push(m);
      modelsByProvider.set(provider.id, list);
    } else {
      modelsWithoutProvider.push(m);
    }
  });

  const activeModel = models.find(m => m.id === activeModelId);
  const activeTempModel = !activeModel ? tempModels.find(m => m.id === activeModelId) : undefined;
  const activeProvider = activeModel && providers.find(p => p.id === activeModel.providerId);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => { setIsOpen(!isOpen); }}
        className="w-full bg-gray-800 border border-gray-700 hover:border-gray-600 text-white rounded-lg p-3 pr-10 focus:outline-none focus:border-blue-500 transition-colors text-left flex items-center justify-between"
      >
        {activeModel ? (
          <div className="flex items-center justify-between w-full min-w-0">
            <span className="truncate">{activeModel.displayName || activeModel.modelId}</span>
            <span className="text-xs text-gray-500 ml-2 shrink-0">
              {activeProvider?.name}
            </span>
          </div>
        ) : activeTempModel ? (
          <div className="flex items-center justify-between w-full min-w-0">
            <span className="truncate">{activeTempModel.name || activeTempModel.modelId}</span>
            <span className="text-xs text-purple-400 ml-2 shrink-0">
              临时模型
            </span>
          </div>
        ) : (
          <span className="text-gray-500">-- Select a model --</span>
        )}
      </button>
      <ChevronDown
        className={`absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`}
        size={18}
      />

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-80 overflow-auto">
          {/* Grouped by Provider */}
          {providers.map(provider => {
            const providerModels = modelsByProvider.get(provider.id) || [];
            if (providerModels.length === 0) return null;

            return (
              <div key={provider.id} className="border-b border-gray-700/50 last:border-b-0">
                {/* Provider Header */}
                <div className="px-3 py-2 bg-gray-800/80 sticky top-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400">{provider.name}</span>
                    <span className="text-xs text-gray-600">{providerModels.length} models</span>
                  </div>
                </div>
                {/* Models */}
                <div>
                  {providerModels.map(m => {
                    const isSelected = m.id === activeModelId;

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          onChange(m.id);
                          setIsOpen(false);
                        }}
                        className={`w-full px-3 py-2.5 flex items-center justify-between hover:bg-gray-700/50 transition-colors text-left ${
                          isSelected ? 'bg-blue-600/20 hover:bg-blue-600/30' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {isSelected && <Check size={14} className="text-blue-400 shrink-0" />}
                          <span className={`text-sm truncate ${isSelected ? 'text-blue-300' : 'text-gray-300'}`}>
                            {m.displayName || m.modelId}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Grouped Temp Models */}
          {tempModels.length > 0 && (
            <div className="border-b border-gray-700/50 last:border-b-0">
              <div className="px-3 py-2 bg-gray-800/80 sticky top-0 flex items-center justify-between">
                <span className="text-xs font-medium text-purple-400">临时模型</span>
                <span className="text-xs text-gray-600">{tempModels.length} models</span>
              </div>
              <div>
                {tempModels.map(m => {
                  const isSelected = m.id === activeModelId;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onChange(m.id);
                        setIsOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 flex items-center justify-between hover:bg-gray-700/50 transition-colors text-left ${
                        isSelected ? 'bg-purple-600/20 hover:bg-purple-600/30' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isSelected && <Check size={14} className="text-purple-400 shrink-0" />}
                        <span className={`text-sm truncate ${isSelected ? 'text-purple-300' : 'text-gray-300'}`}>
                          {m.name || m.modelId}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Models without provider (orphaned) */}
          {modelsWithoutProvider.length > 0 && (
            <div className="border-b border-gray-700/50 last:border-b-0">
              <div className="px-3 py-2 bg-gray-800/80 sticky top-0">
                <span className="text-xs font-medium text-yellow-600">Unknown Provider</span>
              </div>
              {modelsWithoutProvider.map(m => {
                const isSelected = m.id === activeModelId;

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      onChange(m.id);
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2.5 flex items-center justify-between hover:bg-gray-700/50 transition-colors text-left ${
                      isSelected ? 'bg-blue-600/20 hover:bg-blue-600/30' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isSelected && <Check size={14} className="text-blue-400 shrink-0" />}
                      <span className={`text-sm truncate ${isSelected ? 'text-blue-300' : 'text-gray-300'}`}>
                        {m.displayName || m.modelId}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ===== Temp Model Editor =====

const TempModelEditor: React.FC<{
  entry: TempModel;
  onChange: (e: TempModel) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ entry, onChange, onSave, onCancel }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Name / Display Name (optional)</label>
        <input
          value={entry.name || ''}
          onChange={e => { onChange({ ...entry, name: e.target.value || undefined }); }}
          placeholder="e.g. My Temp DeepSeek"
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Base URL</label>
        <input
          value={entry.baseURL}
          onChange={e => { onChange({ ...entry, baseURL: e.target.value }); }}
          placeholder="https://api.openai.com/v1"
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">API Key (Explicit)</label>
        <input
          type="password"
          value={entry.apiKey}
          onChange={e => { onChange({ ...entry, apiKey: e.target.value }); }}
          placeholder="sk-..."
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Model ID</label>
        <input
          value={entry.modelId}
          onChange={e => { onChange({ ...entry, modelId: e.target.value }); }}
          placeholder="e.g. gpt-4o, deepseek-reasoner"
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 font-mono text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Temperature</label>
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={entry.temperature ?? ''}
            onChange={e => { onChange({ ...entry, temperature: e.target.value === '' ? undefined : parseFloat(e.target.value) }); }}
            placeholder="Unset"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Max Tokens</label>
          <input
            type="number"
            min="1"
            max="1000000"
            value={entry.maxTokens ?? ''}
            onChange={e => { onChange({ ...entry, maxTokens: e.target.value === '' ? undefined : parseInt(e.target.value) }); }}
            placeholder="Unset"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Reasoning Effort</label>
        <select
          value={entry.reasoningEffort || ''}
          onChange={e => { onChange({ ...entry, reasoningEffort: e.target.value || undefined }); }}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
        >
          <option value="">Unset</option>
          <option value="max">Max</option>
          <option value="xhigh">Xhigh</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
          <option value="minimal">Minimal</option>
          <option value="none">None</option>
        </select>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-300">Extra Body (JSON)</label>
        </div>
        <ExtraBodyTextarea
          value={entry.extraBody}
          onChange={v => { onChange({ ...entry, extraBody: v }); }}
          placeholder='{"chat_template_kwargs":{"thinking":true}}'
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button onClick={onCancel} className="px-4 py-2 text-gray-300 hover:text-white transition-colors">Cancel</button>
        <button
          onClick={onSave}
          disabled={!entry.baseURL.trim() || !entry.apiKey.trim() || !entry.modelId.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Save size={14} /> Save Temp Model
        </button>
      </div>
    </div>
  );
};

// ===== Extra Body Textarea Component with Python dict normalization =====

interface ExtraBodyTextareaProps {
  value?: Record<string, any>;
  onChange: (v: Record<string, any> | undefined) => void;
  placeholder?: string;
}

const ExtraBodyTextarea: React.FC<ExtraBodyTextareaProps> = ({ value, onChange, placeholder }) => {
  const [text, setText] = useState(() => value ? JSON.stringify(value, null, 2) : '');

  useEffect(() => {
    setText(value ? JSON.stringify(value, null, 2) : '');
  }, [value]);

  const normalizePythonToJson = (input: string): string => {
    let normalized = input;
    // Replace Python True/False/None with JSON true/false/null
    normalized = normalized.replace(/\bTrue\b/g, 'true');
    normalized = normalized.replace(/\bFalse\b/g, 'false');
    normalized = normalized.replace(/\bNone\b/g, 'null');
    // Replace single quotes with double quotes (basic handling)
    normalized = normalized.replace(/'/g, '"');
    return normalized;
  };

  const handleBlur = () => {
    if (!text.trim()) {
      onChange(undefined);
      return;
    }
    try {
      // First try normalized Python-style dict
      const normalized = normalizePythonToJson(text);
      const parsed = JSON.parse(normalized);
      setText(JSON.stringify(parsed, null, 2));
      onChange(parsed);
    } catch {
      // If normalization fails, try original JSON
      try {
        const parsed = JSON.parse(text);
        setText(JSON.stringify(parsed, null, 2));
        onChange(parsed);
      } catch {
        // Invalid JSON - keep text as is, don't update value
      }
    }
  };

  return (
    <textarea
      value={text}
      onChange={e => { setText(e.target.value); }}
      onBlur={handleBlur}
      placeholder={placeholder}
      className="w-full bg-gray-950 border border-gray-700 font-mono text-green-400 text-sm rounded-lg p-3 focus:outline-none focus:border-blue-500 h-24 resize-y"
      spellCheck={false}
    />
  );
};

const makeEmptyProvider = (): ProviderInstance => ({
  id: crypto.randomUUID(),
  type: 'openai-compatible',
  name: '',
  apiKey: '',
  envKey: '',
});

const makeEmptyModel = (): ModelInstance => ({
  id: crypto.randomUUID(),
  providerId: '',
  providerType: 'openai-compatible',
  modelId: '',
});

const makeEmptyTempModel = (): TempModel => ({
  id: crypto.randomUUID(),
  name: '',
  baseURL: '',
  apiKey: '',
  modelId: '',
});

const makeEmptyCharacter = (): Character => ({
  id: crypto.randomUUID(),
  name: '',
  systemPrompt: '',
});

const makeEmptySkill = (): Skill => ({
  id: crypto.randomUUID(),
  name: '',
  prompt: '',
});

const getDefaultEnvKey = (type: string): string => {
  switch (type) {
    case 'google': return 'GEMINI_API_KEY';
    case 'nvidia': return 'NVIDIA_API_KEY';
    case 'openai-compatible': return 'OPENAI_API_KEY';
    default: return 'OPENAI_API_KEY';
  }
};

const getDefaultBaseURL = (type: string): string | undefined => {
  switch (type) {
    case 'google': return 'https://generativelanguage.googleapis.com/v1beta';
    case 'nvidia': return 'https://integrate.api.nvidia.com/v1';
    default: return undefined;
  }
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, templates, onSaveTemplates, onClose }) => {
  const [local, setLocal] = useState<UserSettings>({ ...DEFAULT_SETTINGS, ...settings });
  const [localTemplates, setLocalTemplates] = useState<Template[]>(templates || []);
  const [tab, setTab] = useState<Tab>('general');
  const [builtInTypes, setBuiltInTypes] = useState<{ id: string; name: string }[]>([]);

  const [editingProvider, setEditingProvider] = useState<ProviderInstance | null>(null);

  const [editingModel, setEditingModel] = useState<ModelInstance | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [editingTempModel, setEditingTempModel] = useState<TempModel | null>(null);

  const [cleaning, setCleaning] = useState(false);
  const [cleanResult, setCleanResult] = useState<{ cleaned: number; total: number } | null>(null);

  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  const [isChunkModalOpen, setIsChunkModalOpen] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<string>('all');
  const [newCustomChunk, setNewCustomChunk] = useState<string>('');

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState<string>('');

  const handleAddNote = () => {
    const newNote = {
      id: crypto.randomUUID(),
      content: '',
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    const updatedNotes = [...(local.stickyNotes || []), newNote];
    setLocal(s => ({ ...s, stickyNotes: updatedNotes }));
    setEditingNoteId(newNote.id);
    setEditingNoteContent('');
  };

  const applyActiveNoteEdit = (notes: any[], id: string, content: string): any[] => {
    const trimmed = content.trim();
    if (!trimmed) {
      return notes.filter(note => note.id !== id);
    }
    return notes.map(note => {
      if (note.id === id) {
        return { ...note, content: trimmed };
      }
      return note;
    });
  };

  const handleSaveNote = (id: string) => {
    const updatedNotes = applyActiveNoteEdit(local.stickyNotes || [], id, editingNoteContent);
    setLocal(s => ({ ...s, stickyNotes: updatedNotes }));
    setEditingNoteId(null);
  };

  const handleCancelNote = (id: string) => {
    const note = (local.stickyNotes || []).find(n => n.id === id);
    if (note && !note.content.trim()) {
      const updatedNotes = (local.stickyNotes || []).filter(n => n.id !== id);
      setLocal(s => ({ ...s, stickyNotes: updatedNotes }));
    }
    setEditingNoteId(null);
  };

  const handleDeleteNote = (id: string) => {
    if (window.confirm('确定要删除这张便利贴吗？')) {
      const updatedNotes = (local.stickyNotes || []).filter(note => note.id !== id);
      setLocal(s => ({ ...s, stickyNotes: updatedNotes }));
      if (editingNoteId === id) {
        setEditingNoteId(null);
      }
    }
  };

  const handleCleanClick = async () => {
    if (!window.confirm('警告：这将重写所有会话数据，移除任何已废弃的字段。此操作不可撤销。确定要继续吗？')) {
      return;
    }
    setCleaning(true);
    setCleanResult(null);
    try {
      const result = await api.sessions.clean();
      setCleanResult({ cleaned: result.cleaned, total: result.total });
    } catch {
      setCleanResult({ cleaned: 0, total: 0 });
    }
  }

  const handleExportClaude = () => {
    setIsChunkModalOpen(true);
  };

  const sanitizeClaudeSession = (session: {
    uuid: string;
    name: string;
    created_at: string;
    updated_at: string;
    chat_messages: any[];
  }) => {
    return {
      uuid: session.uuid,
      name: session.name,
      created_at: session.created_at,
      updated_at: session.updated_at,
      chat_messages: session.chat_messages
    };
  };

  const executeExport = async (chunkTime: string) => {
    try {
      // Capture the pre-export boundary time before listing sessions
      const preExportBoundary = new Date().toISOString();

      const sessions = await api.sessions.list();
      const characters = local.characters || [];

      // Filter sessions based on chunkTime
      let filteredSessions = sessions;
      if (chunkTime !== 'all') {
        const chunkDate = new Date(chunkTime);
        filteredSessions = sessions.filter(s => {
          const dateStr = s.updatedAt || s.createdAt;
          if (!dateStr) return false;
          const sDate = new Date(dateStr);
          return !isNaN(sDate.getTime()) && sDate >= chunkDate;
        });
      }

      if (filteredSessions.length === 0) {
        alert('没有找到符合条件的会话进行导出！');
        return;
      }

      const allExportedSessions = await Promise.all(filteredSessions.map(async (s) => {
        const fullSession = await api.sessions.get(s.id);
        const charId = fullSession.characterId || 'default';
        const character = characters.find(c => c.id === charId);
        let charName = 'Unknown';
        if (character) {
          charName = character.name;
        } else if (charId === 'default') {
          charName = 'Default';
        }

        const rawTimeStr = fullSession.updatedAt || fullSession.createdAt;
        let rawTime = 0;
        if (rawTimeStr) {
          const parsedDate = new Date(rawTimeStr);
          rawTime = parsedDate.getTime();
        }

        const chat_messages = fullSession.messages.map(m => {
          const contentBlocks: any[] = [];
          const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
          let textWithoutThinking = m.content;
          const matches = Array.from(m.content.matchAll(thinkRegex));

          for (const match of matches) {
            contentBlocks.push({
              type: 'thinking',
              thinking: (match as any)[1].trim()
            });
            textWithoutThinking = textWithoutThinking.replace(match[0], '');
          }

          textWithoutThinking = textWithoutThinking.trim();
          contentBlocks.push({
            type: 'text',
            text: textWithoutThinking
          });

          return {
            uuid: m.id,
            sender: m.role === 'user' ? 'human' : 'assistant',
            content: contentBlocks,
            created_at: formatClaudeDate(m.createdAt),
            updated_at: formatClaudeDate(m.createdAt),
            attachments: [],
            files: []
          };
        });

        return {
          uuid: fullSession.id,
          name: fullSession.title || "",
          created_at: formatClaudeDate(fullSession.createdAt),
          updated_at: formatClaudeDate(fullSession.updatedAt),
          chat_messages,
          _characterId: charId,
          _characterName: charName,
          _updatedAtTime: rawTime
        };
      }));

      // Sort the sessions primarily by _characterName, secondarily by _updatedAtTime (descending, newest first)
      // Note: Standalone ternary expressions are forbidden by project rule, so we use standard if/else statements.
      allExportedSessions.sort((a, b) => {
        const charComp = a._characterName.localeCompare(b._characterName, 'zh-Hans-u-co-pinyin', { sensitivity: 'base' });
        if (charComp !== 0) {
          return charComp;
        } else {
          return b._updatedAtTime - a._updatedAtTime;
        }
      });

      const masterZip = new JSZip();

      // Create a sub-ZIP named All_Conversations.zip containing a conversations.json file with all sorted sessions (helper fields stripped)
      const cleanAllSessions = allExportedSessions.map(sanitizeClaudeSession);

      const allConversationsZip = new JSZip();
      allConversationsZip.file('conversations.json', JSON.stringify(cleanAllSessions, null, 2));
      const allConversationsZipBlob = await allConversationsZip.generateAsync({ type: 'blob' });
      masterZip.file('All_Conversations.zip', allConversationsZipBlob);

      // Group the sorted session array by character ID to create non-empty individual character sub-ZIP files
      // Since allExportedSessions is already sorted by character name and updated time, each group's sessions
      // will also automatically preserve that exact sorted order.
      const groupedByCharacter: Record<string, typeof allExportedSessions> = {};
      for (const session of allExportedSessions) {
        const charId = session._characterId;
        if (!groupedByCharacter[charId]) {
          groupedByCharacter[charId] = [];
        }
        groupedByCharacter[charId].push(session);
      }

      for (const [charId, charSessions] of Object.entries(groupedByCharacter)) {
        const character = characters.find(c => c.id === charId);
        let charName = 'Unknown';
        if (character) {
          charName = character.name;
        } else if (charId === 'default') {
          charName = 'Default';
        }

        const cleanCharSessions = charSessions.map(sanitizeClaudeSession);

        const charZip = new JSZip();
        charZip.file('conversations.json', JSON.stringify(cleanCharSessions, null, 2));
        const charZipBlob = await charZip.generateAsync({ type: 'blob' });
        masterZip.file(`${charName}.zip`, charZipBlob);
      }

      const now = new Date();
      const timestamp = now.getFullYear().toString() +
                        (now.getMonth() + 1).toString().padStart(2, '0') +
                        now.getDate().toString().padStart(2, '0') + '_' +
                        now.getHours().toString().padStart(2, '0') +
                        now.getMinutes().toString().padStart(2, '0') +
                        now.getSeconds().toString().padStart(2, '0');

      const finalBlob = await masterZip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Claude_Export_${timestamp}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      // Only add a new chunk for preExportBoundary if build & download initiated successfully
      const updatedChunks = [...(local.claudeChunks || [])];
      if (!updatedChunks.includes(preExportBoundary)) {
        updatedChunks.push(preExportBoundary);
      }

      const updatedSettings = { ...local, claudeChunks: updatedChunks };
      setLocal(updatedSettings);
      onSave(updatedSettings);
    } catch (err: any) {
      console.error('Export failed', err);
      alert('Export failed: ' + err.message);
    }
  };

  useEffect(() => { api.providers.list().then(setBuiltInTypes).catch(() => { }); }, []);

  // ----- Provider CRUD -----
  const addProvider = () => {
    setEditingProvider(makeEmptyProvider());
  };

  const saveProvider = () => {
    if (!editingProvider?.name || !editingProvider.type) return;
    setLocal(s => {
      const providersList = [...s.providers];
      const idx = providersList.findIndex(p => p.id === editingProvider.id);
      if (idx >= 0) {
        providersList[idx] = editingProvider;
      } else {
        providersList.push(editingProvider);
      }
      const providers = sortProviders(providersList);
      const models = sortModels(s.models, providers);
      return { ...s, providers, models };
    });
    setEditingProvider(null);
  };

  const deleteProvider = (id: string) => {
    setLocal(s => {
      const providersList = s.providers.filter(p => p.id !== id);
      const providers = sortProviders(providersList);
      const filteredModels = s.models.filter(m => m.providerId !== id);
      const models = sortModels(filteredModels, providers);
      let nextActiveModelId = s.activeModelId;
      if (s.models.some(m => m.id === s.activeModelId && m.providerId === id)) {
        nextActiveModelId = undefined;
      }
      return {
        ...s,
        providers,
        models,
        activeModelId: nextActiveModelId,
      };
    });
  };

  // ----- Temp Model CRUD -----
  const addTempModel = () => {
    setEditingTempModel(makeEmptyTempModel());
  };

  const saveTempModel = () => {
    if (!editingTempModel?.baseURL || !editingTempModel.apiKey || !editingTempModel.modelId) return;

    const sanitizedTempModel = { ...editingTempModel };
    if (sanitizedTempModel.temperature !== undefined) {
      if (isNaN(sanitizedTempModel.temperature) || sanitizedTempModel.temperature < 0 || sanitizedTempModel.temperature > 2) {
        sanitizedTempModel.temperature = undefined;
      }
    }
    if (sanitizedTempModel.maxTokens !== undefined) {
      if (isNaN(sanitizedTempModel.maxTokens) || sanitizedTempModel.maxTokens < 1 || sanitizedTempModel.maxTokens > 1000000) {
        sanitizedTempModel.maxTokens = undefined;
      }
    }

    setLocal(s => {
      const list = [...(s.tempModels || [])];
      const idx = list.findIndex(m => m.id === sanitizedTempModel.id);
      if (idx >= 0) {
        list[idx] = sanitizedTempModel;
      } else {
        list.push(sanitizedTempModel);
      }
      return { ...s, tempModels: list };
    });
    setEditingTempModel(null);
  };

  const deleteTempModelEntry = (id: string) => {
    setLocal(s => {
      const filtered = (s.tempModels || []).filter(m => m.id !== id);
      let nextActiveModelId = s.activeModelId;
      if (s.activeModelId === id) {
        nextActiveModelId = undefined;
      }
      return {
        ...s,
        tempModels: filtered,
        activeModelId: nextActiveModelId,
      };
    });
  };

  // ----- Model CRUD -----
  const addModel = () => {
    setEditingModel(makeEmptyModel());
    setAvailableModels([]);
  };

  const loadModels = async (modelEntry: ModelInstance) => {
    const provider = local.providers.find(p => p.id === modelEntry.providerId);
    if (!provider) return;
    setLoadingModels(true);
    setFetchError(null);
    try {
      const result = await api.providers.models(provider.type, provider.baseURL, provider.apiKey, provider.envKey);
      setAvailableModels(result.models);
      if (result.error) setFetchError(result.error);
    } catch (e: any) {
      setAvailableModels([]);
      setFetchError(e.message || 'Failed to fetch models');
    }
    setLoadingModels(false);
  };

  const saveModel = () => {
    if (!editingModel?.providerId || !editingModel.modelId) return;
    setLocal(s => {
      const modelsList = [...s.models];
      const idx = modelsList.findIndex(m => m.id === editingModel.id);
      if (idx >= 0) {
        modelsList[idx] = editingModel;
      } else {
        modelsList.push(editingModel);
      }
      const models = sortModels(modelsList, s.providers);
      return { ...s, models };
    });
    setEditingModel(null);
    setAvailableModels([]);
  };

  const deleteModelEntry = (id: string) => {
    setLocal(s => {
      const filteredModels = s.models.filter(m => m.id !== id);
      const models = sortModels(filteredModels, s.providers);
      let nextActiveModelId = s.activeModelId;
      if (s.activeModelId === id) {
        nextActiveModelId = undefined;
      }
      return {
        ...s,
        models,
        activeModelId: nextActiveModelId,
      };
    });
  };

  // ----- Character CRUD -----
  const addCharacter = () => {
    setEditingCharacter(makeEmptyCharacter());
  };

  const saveCharacter = () => {
    if (!editingCharacter?.name.trim()) return;
    setLocal(s => {
      const characters = [...s.characters];
      const idx = characters.findIndex(c => c.id === editingCharacter.id);
      if (idx >= 0) characters[idx] = editingCharacter;
      else characters.push(editingCharacter);
      return { ...s, characters };
    });
    setEditingCharacter(null);
  };

  const deleteCharacterEntry = (id: string) => {
    setLocal(s => ({
      ...s,
      characters: s.characters.filter(c => c.id !== id),
      activeCharacterId: s.activeCharacterId === id ? undefined : s.activeCharacterId,
    }));
  };

  // ----- Skill CRUD -----
  const addSkill = () => {
    setEditingSkill(makeEmptySkill());
  };

  const saveSkill = () => {
    if (!editingSkill?.name.trim()) return;
    setLocal(s => {
      const skills = [...(s.skills || [])];
      const idx = skills.findIndex(sk => sk.id === editingSkill.id);
      if (idx >= 0) {
        skills[idx] = editingSkill;
      } else {
        skills.push(editingSkill);
      }
      return { ...s, skills };
    });
    setEditingSkill(null);
  };

  const deleteSkillEntry = (id: string) => {
    setLocal(s => {
      const skills = (s.skills || []).filter(sk => sk.id !== id);
      const activeSkillIds = (s.activeSkillIds || []).filter(skId => skId !== id);
      return { ...s, skills, activeSkillIds };
    });
  };

  // ----- Template CRUD -----
  const addTemplate = () => {
    setEditingTemplate({
      id: crypto.randomUUID(),
      name: '',
      content: '',
    });
  };

  const saveTemplate = () => {
    if (!editingTemplate?.name.trim()) return;
    setLocalTemplates(prev => {
      const list = [...prev];
      const idx = list.findIndex(t => t.id === editingTemplate.id);
      if (idx >= 0) list[idx] = editingTemplate;
      else list.push(editingTemplate);
      return list;
    });
    setEditingTemplate(null);
  };

  const deleteTemplate = (id: string) => {
    setLocalTemplates(prev => prev.filter(t => t.id !== id));
  };

  const moveTemplateUp = (index: number) => {
    if (index === 0) return;
    setLocalTemplates(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
  };

  const moveTemplateDown = (index: number) => {
    if (index === localTemplates.length - 1) return;
    setLocalTemplates(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
  };

  const handleSaveAll = async () => {
    const finalSettings = { ...local };
    if (editingNoteId) {
      const updatedNotes = applyActiveNoteEdit(local.stickyNotes || [], editingNoteId, editingNoteContent);
      finalSettings.stickyNotes = updatedNotes;
      setLocal(finalSettings);
      setEditingNoteId(null);
    }
    onSave(finalSettings);
    await onSaveTemplates(localTemplates);
  };

  let stickyNotesContent = null;
  if (!local.stickyNotes || local.stickyNotes.length === 0) {
    stickyNotesContent = (
      <div className="bg-gray-900/40 border border-gray-800/80 rounded-lg p-6 text-center">
        <p className="text-xs text-gray-500">暂无便利贴，您可以记录一些小的注释（如：到底导出到哪里了）</p>
      </div>
    );
  } else {
    stickyNotesContent = (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {local.stickyNotes.map(note => {
          const isEditing = editingNoteId === note.id;
          let cardInner = null;

          if (isEditing) {
            cardInner = (
              <div className="space-y-2 mt-2">
                <textarea
                  value={editingNoteContent}
                  onChange={e => setEditingNoteContent(e.target.value)}
                  className="w-full bg-amber-100/50 border border-amber-300 text-gray-800 rounded p-2 text-xs focus:outline-none focus:border-amber-500 resize-none"
                  rows={4}
                  placeholder="写下一些注释..."
                  autoFocus
                />
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCancelNote(note.id)}
                    className="text-[10px] bg-gray-200 hover:bg-gray-300 text-gray-600 px-2 py-1 rounded transition-colors font-medium"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveNote(note.id)}
                    className="text-[10px] bg-amber-600 hover:bg-amber-700 text-white px-2 py-1 rounded transition-colors font-medium flex items-center gap-1"
                  >
                    <Check size={10} />
                    保存
                  </button>
                </div>
              </div>
            );
          } else {
            cardInner = (
              <>
                <div className="space-y-3 mt-1">
                  <p className="text-xs font-normal whitespace-pre-wrap leading-relaxed text-gray-700 select-text break-words">
                    {note.content}
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-amber-200/50 pt-2 mt-3 text-[10px] text-gray-500">
                  <span>{note.createdAt}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingNoteId(note.id);
                        setEditingNoteContent(note.content);
                      }}
                      className="text-gray-500 hover:text-amber-700 p-1 rounded hover:bg-amber-200/50 transition-colors"
                      title="编辑"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(note.id)}
                      className="text-gray-500 hover:text-red-600 p-1 rounded hover:bg-amber-200/50 transition-colors"
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </>
            );
          }

          return (
            <div
              key={note.id}
              className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 shadow-sm text-gray-800 flex flex-col justify-between min-h-[140px] transform hover:scale-[1.01] transition-all relative overflow-hidden"
            >
              {/* Real tape effect on sticky note */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-16 h-4 bg-amber-200/40 border-b border-amber-300/30 rotate-1 shadow-sm"></div>
              {cardInner}
            </div>
          );
        })}
      </div>
    );
  }


  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-800 shrink-0">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>

        <div className="flex border-b border-gray-800 shrink-0">
          {(['general', 'providers', 'models', 'tempModels', 'characters', 'skills', 'templates'] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); }} className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}>
              {({ general: 'General', providers: 'Providers', models: 'Models', tempModels: 'Temp Models', characters: 'Characters', skills: 'Skills', templates: 'Templates' } as Record<Tab, string>)[t]}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* General Tab */}
          {tab === 'general' && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">Active Model</label>
                <ActiveModelDropdown
                  models={local.models}
                  providers={local.providers}
                  tempModels={local.tempModels}
                  activeModelId={local.activeModelId}
                  onChange={id => { setLocal(s => ({ ...s, activeModelId: id || undefined })); }}
                />
                {local.models.length === 0 && (!local.tempModels || local.tempModels.length === 0) && <p className="text-xs text-gray-500">Add models in the Models or Temp Models tab first.</p>}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">Active Character</label>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
                  {local.activeCharacterId && local.characters.find(c => c.id === local.activeCharacterId) ? (
                    <div className="space-y-1">
                      <div className="text-sm text-white font-medium">
                        {local.characters.find(c => c.id === local.activeCharacterId)?.name}
                      </div>
                      <div className="text-xs text-gray-400 line-clamp-2">
                        {local.characters.find(c => c.id === local.activeCharacterId)?.systemPrompt?.slice(0, 100)}...
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-500 text-sm">No active character selected</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">KaTeX Math Font</label>
                <select
                  value={local.katexFont || 'default'}
                  onChange={e => { setLocal(s => ({ ...s, katexFont: e.target.value })); }}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 transition-colors"
                >
                  {KATEX_FONTS.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-800">
                <h3 className="text-sm font-medium text-gray-300">Display</h3>
                {[
                  { key: 'autoScroll', label: 'Auto-scroll to bottom on new messages' },
                  { key: 'collapseThinkingFinished', label: 'Auto-collapse thinking process when finished' },
                  { key: 'renderThinkingAsMarkdown', label: 'Render thinking process as Markdown' },
                  { key: 'trimThinkingSpaces', label: 'Remove leading spaces from thinking' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" checked={(local as any)[key] ?? false} onChange={e => { setLocal(s => ({ ...s, [key]: e.target.checked })); }} className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900" />
                    <span className="text-sm text-gray-300">{label}</span>
                  </label>
                ))}
              </div>

              {/* 全局便利贴 (Sticky Notes) */}
              <div className="space-y-4 pt-6 border-t border-gray-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-300">全局便利贴 (Sticky Notes)</h3>
                  <button
                    type="button"
                    onClick={handleAddNote}
                    className="flex items-center gap-1 text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-2.5 py-1.5 rounded-lg border border-amber-500/30 transition-colors"
                  >
                    <Plus size={14} />
                    添加便利贴
                  </button>
                </div>

                {stickyNotesContent}
              </div>

              <div className="space-y-3 pt-4 border-t border-red-900/50">
                <button onClick={handleExportClaude} className="w-full bg-red-600/90 hover:bg-red-600 text-white rounded-lg p-3 font-medium transition-colors flex items-center justify-center gap-2">
                  <Download size={16} />
                  导出为 Claude 格式
                </button>
                <button onClick={handleCleanClick} className="w-full bg-red-600/90 hover:bg-red-600 text-white rounded-lg p-3 font-medium transition-colors flex items-center justify-center gap-2">
                  <AlertTriangle size={16} />
                  强制清洗数据
                </button>
              </div>
            </>
          )}

          {/* Chunk Filter / Selection Dialog Overlay */}
          {isChunkModalOpen && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">选择导出分片时间</h3>
                  <button onClick={() => setIsChunkModalOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <p className="text-xs text-gray-400">只导出选定时间及其以后的会话。如果某个角色在范围内没有任何会话，则不创建该角色子 zip。</p>

                <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-700/60 rounded-lg p-2 bg-gray-950/50">
                  <label className="flex items-center space-x-3 p-2 rounded hover:bg-gray-700/30 cursor-pointer text-sm text-gray-300">
                    <input
                      type="radio"
                      name="claude-chunk"
                      value="all"
                      checked={selectedChunk === 'all'}
                      onChange={() => setSelectedChunk('all')}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 bg-gray-800 border-gray-700"
                    />
                    <span className="font-medium text-blue-400">全部导出 (不限时间)</span>
                  </label>

                  {(local.claudeChunks || []).map((chunk) => {
                    const remark = local.claudeChunkRemarks?.[chunk] || '';
                    return (
                      <div key={chunk} className="flex items-center justify-between p-2 rounded hover:bg-gray-700/30 text-sm">
                        <label className="flex items-center space-x-3 cursor-pointer flex-1 text-gray-300 min-w-0">
                          <input
                            type="radio"
                            name="claude-chunk"
                            value={chunk}
                            checked={selectedChunk === chunk}
                            onChange={() => setSelectedChunk(chunk)}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500 bg-gray-800 border-gray-700"
                          />
                          <span className="truncate flex items-center gap-1.5 min-w-0" title={chunk}>
                            <span className="truncate shrink-0">{chunk}</span>
                            {remark && (
                              <span className="text-[10px] shrink bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded border border-blue-800/40 font-normal truncate" title={remark}>
                                {remark}
                              </span>
                            )}
                          </span>
                        </label>
                        <div className="flex items-center">
                          <button
                            onClick={() => {
                              const currentRemark = local.claudeChunkRemarks?.[chunk] || '';
                              const newRemark = window.prompt('编辑该时间点的备注：', currentRemark);
                              if (newRemark !== null) {
                                setLocal(s => {
                                  const remarks = { ...(s.claudeChunkRemarks || {}) };
                                  if (newRemark.trim()) {
                                    remarks[chunk] = newRemark.trim();
                                  } else {
                                    delete remarks[chunk];
                                  }
                                  return { ...s, claudeChunkRemarks: remarks };
                                });
                              }
                            }}
                            className="text-gray-500 hover:text-blue-400 p-1 rounded transition-colors"
                            title="编辑备注"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => {
                              const updated = (local.claudeChunks || []).filter(c => c !== chunk);
                              setLocal(s => {
                                const remarks = { ...(s.claudeChunkRemarks || {}) };
                                delete remarks[chunk];
                                return { ...s, claudeChunks: updated, claudeChunkRemarks: remarks };
                              });
                              if (selectedChunk === chunk) {
                                setSelectedChunk('all');
                              }
                            }}
                            className="text-gray-500 hover:text-red-400 p-1 rounded transition-colors"
                            title="删除分片时间"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-700/50">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const nowStr = new Date().toISOString();
                        const updated = [...(local.claudeChunks || [])];
                        if (!updated.includes(nowStr)) {
                          updated.push(nowStr);
                          setLocal(s => ({ ...s, claudeChunks: updated }));
                        }
                      }}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-xs py-2 px-3 rounded-lg transition-colors font-medium"
                    >
                      新增当前时间分片
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="自定义时间 (如 2026-07-16T13:10:27Z)"
                      value={newCustomChunk}
                      onChange={(e) => setNewCustomChunk(e.target.value)}
                      className="flex-1 bg-gray-900 border border-gray-700 text-gray-300 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => {
                        if (!newCustomChunk.trim()) return;
                        const date = new Date(newCustomChunk);
                        if (isNaN(date.getTime())) {
                          alert('无效的日期格式！请使用 ISO 8601 格式，例如: 2026-07-16T13:10:27Z');
                          return;
                        }
                        const isoStr = date.toISOString();
                        const updated = [...(local.claudeChunks || [])];
                        if (!updated.includes(isoStr)) {
                          updated.push(isoStr);
                          setLocal(s => ({ ...s, claudeChunks: updated }));
                          setNewCustomChunk('');
                        } else {
                          alert('该分片时间已存在！');
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 px-3 rounded-lg transition-colors font-medium shrink-0"
                    >
                      添加
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => setIsChunkModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={async () => {
                      setIsChunkModalOpen(false);
                      await executeExport(selectedChunk);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    确认并导出
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Providers Tab */}
          {tab === 'providers' && (
            <>
              {editingProvider ? (
                <ProviderEditor
                  entry={editingProvider}
                  builtInTypes={builtInTypes}
                  onChange={setEditingProvider}
                  onSave={saveProvider}
                  onCancel={() => { setEditingProvider(null); }}
                />
              ) : (
                <>
                  {local.providers.length === 0 && <p className="text-xs text-gray-500">No providers configured.</p>}
                  {local.providers.map(p => (
                    <div key={p.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">{p.name}</div>
                        <div className="text-xs text-gray-400">
                          {builtInTypes.find(b => b.id === p.type)?.name || p.type}
                          {' '}
                          {p.type === 'nvidia'
                            ? '(https://integrate.api.nvidia.com/v1)'
                            : p.type === 'google'
                              ? '(https://generativelanguage.googleapis.com/v1beta)'
                              : (p.baseURL || 'Custom Base URL')}
                          {p.modelSource && ' · Auto-sync enabled'}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => { setEditingProvider({ ...p }); }} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1">Edit</button>
                        <button onClick={() => { deleteProvider(p.id); }} className="text-xs text-red-400 hover:text-red-300 px-2 py-1"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={addProvider} className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 text-gray-300 rounded-lg p-4 transition-colors">
                    <Plus size={18} /> Add Provider
                  </button>
                </>
              )}
            </>
          )}

          {/* Skills Tab */}
          {tab === 'skills' && (
            <>
              {editingSkill ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Skill Name</label>
                    <input
                      value={editingSkill.name}
                      onChange={e => { setEditingSkill({ ...editingSkill, name: e.target.value }); }}
                      placeholder="e.g. Assistant"
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Prompt</label>
                    <textarea
                      value={editingSkill.prompt}
                      onChange={e => { setEditingSkill({ ...editingSkill, prompt: e.target.value }); }}
                      placeholder="Enter skill prompt instructions..."
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 h-40 resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button onClick={() => { setEditingSkill(null); }} className="px-4 py-2 text-gray-300 hover:text-white transition-colors">Cancel</button>
                    <button onClick={saveSkill} disabled={!editingSkill.name.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center gap-2"><Save size={14} /> Save Skill</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {(!local.skills || local.skills.length === 0) && <p className="text-xs text-gray-500">No skills configured.</p>}
                  {local.skills && local.skills.map(sk => (
                    <div key={sk.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white truncate">{sk.name}</div>
                        <div className="text-xs text-gray-400 line-clamp-2 mt-1">{sk.prompt?.slice(0, 120)}...</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <button onClick={() => { setEditingSkill({ ...sk }); }} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1">Edit</button>
                        <button onClick={() => { deleteSkillEntry(sk.id); }} className="text-xs text-red-400 hover:text-red-300 px-2 py-1"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={addSkill} className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 text-gray-300 rounded-lg p-4 transition-colors">
                    <Plus size={18} /> Add Skill
                  </button>
                </div>
              )}
            </>
          )}

          {/* Temp Models Tab */}
          {tab === 'tempModels' && (
            <>
              {editingTempModel ? (
                <TempModelEditor
                  entry={editingTempModel}
                  onChange={setEditingTempModel}
                  onSave={saveTempModel}
                  onCancel={() => setEditingTempModel(null)}
                />
              ) : (
                <div className="space-y-4">
                  {(!local.tempModels || local.tempModels.length === 0) && (
                    <p className="text-xs text-gray-500">No temporary models configured.</p>
                  )}
                  {local.tempModels && local.tempModels.length > 0 && (
                    <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden">
                      <div className="bg-gray-800 px-3 py-2 border-b border-gray-700/50 flex items-center justify-between">
                        <div className="text-xs font-medium text-purple-400">临时模型 (OpenAI Compatible)</div>
                        <div className="text-xs text-gray-500">{local.tempModels.length} models</div>
                      </div>
                      <div className="divide-y divide-gray-700/30">
                        {local.tempModels.map(m => (
                          <div key={m.id} className="px-3 py-2 flex items-center justify-between hover:bg-gray-700/30 transition-colors">
                            <div className="min-w-0 flex-1 grid grid-cols-12 gap-2 items-center">
                              <div className="col-span-6 text-xs text-white truncate">{m.name || m.modelId}</div>
                              <div className="col-span-3 text-xs text-gray-500 text-center">
                                {m.temperature !== undefined ? `T=${m.temperature}` : '-'}
                              </div>
                              <div className="col-span-3 text-xs text-gray-500 text-center">
                                {m.maxTokens !== undefined ? `M=${m.maxTokens}` : '-'}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 ml-2 shrink-0">
                              <button onClick={() => { setEditingTempModel({ ...m }); }} className="p-1.5 text-gray-400 hover:text-blue-400 transition-colors"><Pencil size={14} /></button>
                              <button onClick={() => { deleteTempModelEntry(m.id); }} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={addTempModel} className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 text-gray-300 rounded-lg p-3 text-sm transition-colors">
                    <Plus size={16} /> Add Temp Model
                  </button>
                </div>
              )}
            </>
          )}

          {/* Models Tab */}
          {tab === 'models' && (
            <>
              {editingModel ? (
                <ModelEditor
                  entry={editingModel}
                  providers={local.providers}
                  availableModels={availableModels}
                  loadingModels={loadingModels}
                  fetchError={fetchError}
                  onChange={setEditingModel}
                  onLoadModels={loadModels}
                  onSave={saveModel}
                  onCancel={() => { setEditingModel(null); setAvailableModels([]); }}
                />
              ) : (
                <div className="space-y-4">
                  {local.models.length === 0 && <p className="text-xs text-gray-500">No models configured.</p>}
                  {(() => {
                    const modelsByProvider = new Map<string, typeof local.models>();
                    local.models.forEach(m => {
                      const list = modelsByProvider.get(m.providerId) || [];
                      list.push(m);
                      modelsByProvider.set(m.providerId, list);
                    });

                    return local.providers.map(provider => {
                      const providerModels = modelsByProvider.get(provider.id) || [];
                      if (providerModels.length === 0) return null;

                      return (
                        <div key={provider.id} className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden">
                          <div className="bg-gray-800 px-3 py-2 border-b border-gray-700/50 flex items-center justify-between">
                            <div className="text-xs font-medium text-gray-300">{provider.name}</div>
                            <div className="text-xs text-gray-500">{providerModels.length} models</div>
                          </div>
                          <div className="divide-y divide-gray-700/30">
                            {providerModels.map(m => {
                              return (
                                <div key={m.id} className="px-3 py-2 flex items-center justify-between hover:bg-gray-700/30 transition-colors">
                                  <div className="min-w-0 flex-1 grid grid-cols-12 gap-2 items-center">
                                    <div className="col-span-6 text-xs text-white truncate">{m.displayName || m.modelId}</div>
                                    <div className="col-span-3 text-xs text-gray-500 text-center">
                                      {m.temperature !== undefined ? `T=${m.temperature}` : '-'}
                                    </div>
                                    <div className="col-span-3 text-xs text-gray-500 text-center">
                                      {m.maxTokens !== undefined ? `M=${m.maxTokens}` : '-'}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 ml-2 shrink-0">
                                    <button onClick={() => { setEditingModel({ ...m }); }} className="p-1.5 text-gray-400 hover:text-blue-400 transition-colors"><Pencil size={14} /></button>
                                    <button onClick={() => { deleteModelEntry(m.id); }} className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                  <button onClick={addModel} className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 text-gray-300 rounded-lg p-3 text-sm transition-colors">
                    <Plus size={16} /> Add Model
                  </button>
                </div>
              )}
            </>
          )}

          {/* Characters Tab */}
          {tab === 'characters' && (
            <>
              {editingCharacter ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Character Name</label>
                    <input
                      value={editingCharacter.name}
                      onChange={e => { setEditingCharacter({ ...editingCharacter, name: e.target.value }); }}
                      placeholder="e.g. Math Tutor"
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">System Prompt</label>
                    <textarea
                      value={editingCharacter.systemPrompt}
                      onChange={e => { setEditingCharacter({ ...editingCharacter, systemPrompt: e.target.value }); }}
                      placeholder="You are a helpful assistant..."
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 h-40 resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button onClick={() => { setEditingCharacter(null); }} className="px-4 py-2 text-gray-300 hover:text-white transition-colors">Cancel</button>
                    <button onClick={saveCharacter} disabled={!editingCharacter.name.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center gap-2"><Save size={14} /> Save Character</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {local.characters.length === 0 && <p className="text-xs text-gray-500">No characters configured.</p>}
                  {local.characters.map(c => (
                    <div key={c.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white truncate">{c.name}</div>
                        <div className="text-xs text-gray-400 line-clamp-2 mt-1">{c.systemPrompt}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <button onClick={() => { setEditingCharacter({ ...c }); }} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1">Edit</button>
                        <button onClick={() => { deleteCharacterEntry(c.id); }} className="text-xs text-red-400 hover:text-red-300 px-2 py-1"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={addCharacter} className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 text-gray-300 rounded-lg p-4 transition-colors">
                    <Plus size={18} /> Add Character
                  </button>
                </div>
              )}
            </>
          )}

          {/* Templates Tab */}
          {tab === 'templates' && (
            <>
              {editingTemplate ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Template Name</label>
                    <input
                      value={editingTemplate.name}
                      onChange={e => { setEditingTemplate({ ...editingTemplate, name: e.target.value }); }}
                      placeholder="e.g. 三角形基础"
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">Content</label>
                    <textarea
                      value={editingTemplate.content}
                      onChange={e => { setEditingTemplate({ ...editingTemplate, content: e.target.value }); }}
                      placeholder="Template content..."
                      className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 h-40 resize-none font-mono text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button onClick={() => { setEditingTemplate(null); }} className="px-4 py-2 text-gray-300 hover:text-white transition-colors">Cancel</button>
                    <button onClick={saveTemplate} disabled={!editingTemplate.name.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center gap-2"><Save size={14} /> Save Template</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {localTemplates.length === 0 && <p className="text-xs text-gray-500">No templates configured.</p>}
                  {localTemplates.map((t, idx) => (
                    <div key={t.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white truncate">{t.name}</div>
                        <div className="text-xs text-gray-400 line-clamp-2 mt-1 font-mono">{t.content}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <button
                          onClick={() => moveTemplateUp(idx)}
                          disabled={idx === 0}
                          className="p-1 text-gray-400 hover:text-white disabled:opacity-30 rounded transition-colors"
                          title="Move Up"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => moveTemplateDown(idx)}
                          disabled={idx === localTemplates.length - 1}
                          className="p-1 text-gray-400 hover:text-white disabled:opacity-30 rounded transition-colors"
                          title="Move Down"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button onClick={() => { setEditingTemplate({ ...t }); }} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1">Edit</button>
                        <button onClick={() => { deleteTemplate(t.id); }} className="text-xs text-red-400 hover:text-red-300 px-2 py-1"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={addTemplate} className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 text-gray-300 rounded-lg p-4 transition-colors">
                    <Plus size={18} /> Add Template
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-800 bg-gray-950 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 text-gray-300 hover:text-white font-medium transition-colors">Cancel</button>
          <button onClick={handleSaveAll} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"><Save size={16} /> Save</button>
        </div>
      </div>
      {cleaning && (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-[60]">
          {!cleanResult ? (
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-white text-lg">正在清洗数据...</p>
            </div>
          ) : (
            <div className="text-center bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md mx-4">
              <AlertTriangle size={40} className="text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">清洗完成</h3>
              <p className="text-gray-400">
                共清洗 {cleanResult.total} 个会话，其中 {cleanResult.cleaned} 个完成规范化。
              </p>
              <button
                onClick={() => { setCleaning(false); setCleanResult(null); }}
                className="mt-6 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                确定
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ===== Provider Editor =====

const ProviderEditor: React.FC<{
  entry: ProviderInstance;
  builtInTypes: { id: string; name: string }[];
  onChange: (e: ProviderInstance) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ entry, builtInTypes, onChange, onSave, onCancel }) => {

  const handleTypeChange = (type: string) => {
    if (!type) return;
    const envKey = getDefaultEnvKey(type);
    const baseURL = getDefaultBaseURL(type);
    onChange({ ...entry, type: type as BuiltInProviderType, envKey, baseURL });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Provider Type</label>
        <select
          value={entry.type}
          onChange={e => { handleTypeChange(e.target.value); }}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
        >
          {builtInTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Provider Name</label>
        <input
          value={entry.name}
          onChange={e => { onChange({ ...entry, name: e.target.value }); }}
          placeholder="e.g. My Nvidia Account"
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
        />
      </div>

      {entry.type === 'nvidia' ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Base URL</label>
          <input
            value={getDefaultBaseURL('nvidia') || ''}
            disabled
            className="w-full bg-gray-800 border border-gray-700 text-gray-500 rounded-lg p-3 font-mono text-sm cursor-not-allowed"
          />
          <p className="text-xs text-gray-500">Nvidia base URL is fixed and cannot be changed.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Base URL (optional)</label>
          <input
            value={entry.baseURL || ''}
            onChange={e => { onChange({ ...entry, baseURL: e.target.value || undefined }); }}
            placeholder={getDefaultBaseURL(entry.type) || 'https://api.example.com/v1'}
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 font-mono text-sm"
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">API Key (optional, overrides env variable)</label>
        <input
          type="password"
          value={entry.apiKey || ''}
          onChange={e => { onChange({ ...entry, apiKey: e.target.value || undefined }); }}
          placeholder="sk-... or leave empty to use env variable"
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Env Key Prefix (default: {getDefaultEnvKey(entry.type)})</label>
        <input
          value={entry.envKey || ''}
          onChange={e => { onChange({ ...entry, envKey: e.target.value || undefined }); }}
          placeholder={getDefaultEnvKey(entry.type)}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 font-mono text-sm"
        />
        <p className="text-xs text-gray-500">Leave empty to use the default env variable for this provider type.</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Extra Config (JSON, optional)</label>
        <ExtraBodyTextarea
          value={entry.extra}
          onChange={v => { onChange({ ...entry, extra: v }); }}
          placeholder='{"customHeader": "value"}'
        />
      </div>

      {entry.type !== 'google' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Model Source URL (optional)</label>
          <input
            value={entry.modelSource || ''}
            onChange={e => { onChange({ ...entry, modelSource: e.target.value || undefined }); }}
            placeholder="https://example.com/models.json"
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 font-mono text-sm"
          />
          <p className="text-xs text-gray-500">Remote JSON URL for auto-syncing model list on startup. Will replace all existing models for this provider.</p>
        </div>
      )}

      {entry.type === 'google' && entry.modelSource && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Model Source URL</label>
          <input
            value="Not applicable for Google Gemini"
            disabled
            className="w-full bg-gray-800 border border-gray-700 text-gray-500 rounded-lg p-3 font-mono text-sm cursor-not-allowed"
          />
          <p className="text-xs text-gray-500">Google Gemini does not support remote model source. Use the Fetch button in Models tab.</p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-4">
        <button onClick={onCancel} className="px-4 py-2 text-gray-300 hover:text-white transition-colors">Cancel</button>
        <button onClick={onSave} disabled={!entry.name || !entry.type} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center gap-2"><Save size={14} /> Save</button>
      </div>
    </div>
  );
};

// ===== Model Editor =====

const ModelEditor: React.FC<{
  entry: ModelInstance;
  providers: ProviderInstance[];
  availableModels: string[];
  loadingModels: boolean;
  fetchError: string | null;
  onChange: (e: ModelInstance) => void;
  onLoadModels: (m: ModelInstance) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ entry, providers, availableModels, loadingModels, fetchError, onChange, onLoadModels, onSave, onCancel }) => {
  const handleProviderChange = (providerId: string) => {
    const p = providers.find(x => x.id === providerId);
    if (!p) return;
    onChange({ ...entry, providerId, providerType: p.type });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Provider</label>
        <select
          value={entry.providerId}
          onChange={e => { handleProviderChange(e.target.value); }}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
        >
          <option value="">-- Select a provider --</option>
          {providers.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
        </select>
        {providers.length === 0 && <p className="text-xs text-red-400">Add a provider in the Providers tab first.</p>}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-2">
          <label className="block text-sm font-medium text-gray-300">Model</label>
          <input
            list="model-datalist"
            value={entry.modelId}
            onChange={e => { onChange({ ...entry, modelId: e.target.value }); }}
            placeholder="Select or type model name..."
            className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
          />
          <datalist id="model-datalist">
            {availableModels.map(m => <option key={m} value={m} />)}
          </datalist>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300 invisible">.</label>
          <button
            onClick={() => { onLoadModels(entry); }}
            disabled={loadingModels || !entry.providerId}
            className="px-4 py-3 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors text-sm shrink-0"
          >
            {loadingModels ? '...' : 'Fetch'}
          </button>
        </div>
      </div>
      {fetchError && (
        <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {fetchError}
        </div>
      )}

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Display Name (optional)</label>
        <input
          value={entry.displayName || ''}
          onChange={e => { onChange({ ...entry, displayName: e.target.value || undefined }); }}
          placeholder="e.g. My GPT-4o"
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Temperature</label>
          <input type="number" min="0" max="2" step="0.1" value={entry.temperature ?? ''} onChange={e => { onChange({ ...entry, temperature: e.target.value === '' ? undefined : parseFloat(e.target.value) }); }} placeholder="Unset" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500" />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Max Tokens</label>
          <input type="number" min="1" max="1000000" value={entry.maxTokens ?? ''} onChange={e => { onChange({ ...entry, maxTokens: e.target.value === '' ? undefined : parseInt(e.target.value) }); }} placeholder="Unset" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      {entry.providerType === 'google' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Thinking Level</label>
          <select value={entry.thinkingLevel || ''} onChange={e => { onChange({ ...entry, thinkingLevel: e.target.value || undefined }); }} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500">
            <option value="">Unset</option>
            <option value="none">None</option>
            <option value="minimal">Minimal</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      )}

      {entry.providerType === 'nvidia' && (
        <label className="flex items-center space-x-3 cursor-pointer bg-gray-800/50 border border-gray-700/50 rounded-lg p-3">
          <input type="checkbox" checked={entry.injectThinkingTemplate ?? false} onChange={e => { onChange({ ...entry, injectThinkingTemplate: e.target.checked }); }} className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900" />
          <span className="text-sm text-gray-300">Inject chat_template_kwargs thinking mode</span>
        </label>
      )}

      {entry.providerType === 'openai-compatible' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Reasoning Effort</label>
          <select value={entry.reasoningEffort || ''} onChange={e => { onChange({ ...entry, reasoningEffort: e.target.value || undefined }); }} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500">
            <option value="">Unset</option>
            <option value="max">Max</option>
            <option value="xhigh">Xhigh</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="minimal">Minimal</option>
            <option value="none">None</option>
          </select>
        </div>
      )}



      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-300">Extra Body (JSON)</label>
        </div>
        <ExtraBodyTextarea
          value={entry.extraBody}
          onChange={v => { onChange({ ...entry, extraBody: v }); }}
          placeholder='{"chat_template_kwargs":{"thinking":true}}'
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button onClick={onCancel} className="px-4 py-2 text-gray-300 hover:text-white transition-colors">Cancel</button>
        <button onClick={onSave} disabled={!entry.providerId || !entry.modelId} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center gap-2"><Save size={14} /> Save Entry</button>
      </div>
    </div>
  );
};