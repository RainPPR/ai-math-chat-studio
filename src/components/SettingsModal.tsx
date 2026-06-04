import React, { useState, useEffect } from 'react';
import { UserSettings, ProviderInstance, ModelInstance, BuiltInProviderType, DEFAULT_SETTINGS } from '../types';
import { api } from '../lib/api';
import { X, Plus, Trash2, Save, ChevronDown, Wrench } from 'lucide-react';

interface SettingsModalProps {
  settings: UserSettings;
  onSave: (settings: UserSettings) => void;
  onClose: () => void;
}

type Tab = 'general' | 'providers' | 'models';

const TOOL_NAMES = ['evaluate_expression', 'solve_equation', 'calculate_derivative'];
const TOOL_LABELS: Record<string, string> = {
  evaluate_expression: 'Evaluate Expression',
  solve_equation: 'Solve Equation',
  calculate_derivative: 'Calculate Derivative',
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
  enableTools: true,
  disabledTools: [],
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

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose }) => {
  const [local, setLocal] = useState<UserSettings>({ ...DEFAULT_SETTINGS, ...settings });
  const [tab, setTab] = useState<Tab>('general');
  const [builtInTypes, setBuiltInTypes] = useState<{ id: string; name: string }[]>([]);

  const [editingProvider, setEditingProvider] = useState<ProviderInstance | null>(null);

  const [editingModel, setEditingModel] = useState<ModelInstance | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => { api.providers.list().then(setBuiltInTypes).catch(() => { }); }, []);

  // ----- Provider CRUD -----
  const addProvider = () => {
    setEditingProvider(makeEmptyProvider());
  };

  const saveProvider = () => {
    if (!editingProvider || !editingProvider.name || !editingProvider.type) return;
    setLocal(s => {
      const providers = [...s.providers];
      const idx = providers.findIndex(p => p.id === editingProvider.id);
      if (idx >= 0) providers[idx] = editingProvider;
      else providers.push(editingProvider);
      return { ...s, providers };
    });
    setEditingProvider(null);
  };

  const deleteProvider = (id: string) => {
    setLocal(s => ({
      ...s,
      providers: s.providers.filter(p => p.id !== id),
      models: s.models.filter(m => m.providerId !== id),
      activeModelId: s.models.some(m => m.id === s.activeModelId && m.providerId === id) ? undefined : s.activeModelId,
    }));
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
      const result = await api.providers.models(provider.type, provider.baseURL, provider.apiKey);
      setAvailableModels(result.models);
      if (result.error) setFetchError(result.error);
    } catch (e: any) {
      setAvailableModels([]);
      setFetchError(e.message || 'Failed to fetch models');
    }
    setLoadingModels(false);
  };

  const saveModel = () => {
    if (!editingModel || !editingModel.providerId || !editingModel.modelId) return;
    setLocal(s => {
      const models = [...s.models];
      const idx = models.findIndex(m => m.id === editingModel.id);
      if (idx >= 0) models[idx] = editingModel;
      else models.push(editingModel);
      return { ...s, models };
    });
    setEditingModel(null);
    setAvailableModels([]);
  };

  const deleteModelEntry = (id: string) => {
    setLocal(s => ({
      ...s,
      models: s.models.filter(m => m.id !== id),
      activeModelId: s.activeModelId === id ? undefined : s.activeModelId,
    }));
  };

  const activeModel = local.models.find(m => m.id === local.activeModelId);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-800 shrink-0">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>

        <div className="flex border-b border-gray-800 shrink-0">
          {(['general', 'providers', 'models'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}>
              {t === 'general' ? 'General' : t === 'providers' ? 'Providers' : 'Models'}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* General Tab */}
          {tab === 'general' && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">Active Model</label>
                <select
                  value={local.activeModelId || ''}
                  onChange={e => setLocal(s => ({ ...s, activeModelId: e.target.value || undefined }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Select a model --</option>
                  {local.models.map(m => (
                    <option key={m.id} value={m.id}>{m.displayName || m.modelId}</option>
                  ))}
                </select>
                {local.models.length === 0 && <p className="text-xs text-gray-500">Add models in the Models tab first.</p>}
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">System Prompt</label>
                <textarea
                  value={local.systemPrompt}
                  onChange={e => setLocal(s => ({ ...s, systemPrompt: e.target.value }))}
                  placeholder="You are a helpful assistant..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 h-32 resize-none"
                />
              </div>

              <div className="space-y-3 pt-4 border-t border-gray-800">
                <h3 className="text-sm font-medium text-gray-300">Display</h3>
                {[
                  { key: 'autoScroll', label: 'Auto-scroll to bottom on new messages' },
                  { key: 'collapseThinkingFinished', label: 'Auto-collapse thinking process when finished' },
                  { key: 'renderThinkingAsMarkdown', label: 'Render thinking process as Markdown' },
                  { key: 'gemmaTrimThinkingSpaces', label: 'Remove leading spaces from thinking (Gemma)' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center space-x-3 cursor-pointer">
                    <input type="checkbox" checked={(local as any)[key] ?? false} onChange={e => setLocal(s => ({ ...s, [key]: e.target.checked }))} className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900" />
                    <span className="text-sm text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            </>
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
                  onCancel={() => setEditingProvider(null)}
                />
              ) : (
                <>
                  {local.providers.length === 0 && <p className="text-xs text-gray-500">No providers configured.</p>}
                  {local.providers.map(p => (
                    <div key={p.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">{p.name}</div>
                        <div className="text-xs text-gray-400">{builtInTypes.find(b => b.id === p.type)?.name || p.type} {(p.baseURL || 'Custom Base URL')}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setEditingProvider({ ...p })} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1">Edit</button>
                        <button onClick={() => deleteProvider(p.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1"><Trash2 size={14} /></button>
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
                <>
                  {local.models.length === 0 && <p className="text-xs text-gray-500">No models configured.</p>}
                  {local.models.map(entry => (
                    <div key={entry.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">{entry.displayName || entry.modelId}</div>
                        <div className="text-xs text-gray-400">{local.providers.find(p => p.id === entry.providerId)?.name || entry.providerId} · temp={entry.temperature ?? 'unset'} · maxTokens={entry.maxTokens ?? 'unset'}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => setEditingModel({ ...entry })} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1">Edit</button>
                        <button onClick={() => deleteModelEntry(entry.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={addModel} className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 text-gray-300 rounded-lg p-4 transition-colors">
                    <Plus size={18} /> Add Model
                  </button>
                </>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-800 bg-gray-950 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 text-gray-300 hover:text-white font-medium transition-colors">Cancel</button>
          <button onClick={() => onSave(local)} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"><Save size={16} /> Save</button>
        </div>
      </div>
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
          onChange={e => handleTypeChange(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
        >
          {builtInTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Provider Name</label>
        <input
          value={entry.name}
          onChange={e => onChange({ ...entry, name: e.target.value })}
          placeholder="e.g. My Nvidia Account"
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Base URL (optional)</label>
        <input
          value={entry.baseURL || ''}
          onChange={e => onChange({ ...entry, baseURL: e.target.value || undefined })}
          placeholder={getDefaultBaseURL(entry.type) || 'https://api.example.com/v1'}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">API Key (optional, overrides env variable)</label>
        <input
          type="password"
          value={entry.apiKey || ''}
          onChange={e => onChange({ ...entry, apiKey: e.target.value || undefined })}
          placeholder="sk-... or leave empty to use env variable"
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Env Key Prefix (default: {getDefaultEnvKey(entry.type)})</label>
        <input
          value={entry.envKey || ''}
          onChange={e => onChange({ ...entry, envKey: e.target.value || undefined })}
          placeholder={getDefaultEnvKey(entry.type)}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 font-mono text-sm"
        />
        <p className="text-xs text-gray-500">Leave empty to use the default env variable for this provider type.</p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Extra Config (JSON, optional)</label>
        <textarea
          value={entry.extra ? JSON.stringify(entry.extra, null, 2) : ''}
          onChange={e => {
            try {
              onChange({ ...entry, extra: JSON.parse(e.target.value) });
            } catch {
              onChange({ ...entry, extra: {} });
            }
          }}
          placeholder='{"customHeader": "value"}'
          className="w-full bg-gray-950 border border-gray-700 font-mono text-green-400 text-sm rounded-lg p-3 focus:outline-none focus:border-blue-500 h-24 resize-y"
        />
      </div>

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
  const selectedProvider = providers.find(p => p.id === entry.providerId);
  const [extraBodyText, setExtraBodyText] = useState(() => entry.extraBody ? JSON.stringify(entry.extraBody, null, 2) : '');

  useEffect(() => {
    setExtraBodyText(entry.extraBody ? JSON.stringify(entry.extraBody, null, 2) : '');
  }, [entry.id]);

  const handleExtraBodyBlur = () => {
    if (!extraBodyText.trim()) {
      onChange({ ...entry, extraBody: undefined });
      return;
    }
    try {
      onChange({ ...entry, extraBody: JSON.parse(extraBodyText) });
    } catch { /* keep raw text */ }
  };

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
          onChange={e => handleProviderChange(e.target.value)}
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
            onChange={e => onChange({ ...entry, modelId: e.target.value })}
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
            onClick={() => onLoadModels(entry)}
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
          onChange={e => onChange({ ...entry, displayName: e.target.value || undefined })}
          placeholder="e.g. My GPT-4o"
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Temperature</label>
          <input type="number" min="0" max="2" step="0.1" value={entry.temperature ?? ''} onChange={e => onChange({ ...entry, temperature: e.target.value === '' ? undefined : parseFloat(e.target.value) })} placeholder="Unset" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500" />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Max Tokens</label>
          <input type="number" min="1" max="100000" value={entry.maxTokens ?? ''} onChange={e => onChange({ ...entry, maxTokens: e.target.value === '' ? undefined : parseInt(e.target.value) })} placeholder="Unset" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      {entry.providerType === 'google' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Thinking Level</label>
          <select value={entry.thinkingLevel || ''} onChange={e => onChange({ ...entry, thinkingLevel: e.target.value || undefined })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500">
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
          <input type="checkbox" checked={entry.injectThinkingTemplate ?? false} onChange={e => onChange({ ...entry, injectThinkingTemplate: e.target.checked })} className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900" />
          <span className="text-sm text-gray-300">Inject chat_template_kwargs thinking mode</span>
        </label>
      )}

      {entry.providerType === 'openai-compatible' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Reasoning Effort</label>
          <select value={entry.reasoningEffort || ''} onChange={e => onChange({ ...entry, reasoningEffort: e.target.value || undefined })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500">
            <option value="">Unset</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      )}

      <div className="space-y-3 pt-4 border-t border-gray-800">
        <label className="flex items-center space-x-3 cursor-pointer">
          <input type="checkbox" checked={entry.enableTools} onChange={e => onChange({ ...entry, enableTools: e.target.checked })} className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900" />
          <span className="text-sm font-medium text-gray-300">Enable Math Tools</span>
        </label>
        {entry.enableTools && (
          <div className="pl-8 space-y-2">
            {TOOL_NAMES.map(name => (
              <label key={name} className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!entry.disabledTools?.includes(name)}
                  onChange={e => {
                    const disabled = [...(entry.disabledTools || [])];
                    if (e.target.checked) {
                      const i = disabled.indexOf(name);
                      if (i >= 0) disabled.splice(i, 1);
                    } else {
                      if (!disabled.includes(name)) disabled.push(name);
                    }
                    onChange({ ...entry, disabledTools: disabled });
                  }}
                  className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">{TOOL_LABELS[name]}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-300">Extra Body (JSON)</label>
        </div>
        <textarea
          value={extraBodyText}
          onChange={e => setExtraBodyText(e.target.value)}
          onBlur={handleExtraBodyBlur}
          placeholder='{"chat_template_kwargs":{"thinking":true}}'
          className="w-full bg-gray-950 border border-gray-700 font-mono text-green-400 text-sm rounded-lg p-3 focus:outline-none focus:border-blue-500 h-24 resize-y"
          spellCheck={false}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button onClick={onCancel} className="px-4 py-2 text-gray-300 hover:text-white transition-colors">Cancel</button>
        <button onClick={onSave} disabled={!entry.providerId || !entry.modelId} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors flex items-center gap-2"><Save size={14} /> Save Entry</button>
      </div>
    </div>
  );
};
