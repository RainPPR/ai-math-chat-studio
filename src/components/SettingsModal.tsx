import React, { useState, useEffect } from 'react';
import { UserSettings, ModelPoolEntry, DEFAULT_SETTINGS } from '../types';
import { api } from '../lib/api';
import { X, Plus, Trash2, Save, ChevronDown, Wrench } from 'lucide-react';

interface SettingsModalProps {
  settings: UserSettings;
  onSave: (settings: UserSettings) => void;
  onClose: () => void;
}

type Tab = 'general' | 'models' | 'tools';

const TOOL_NAMES = ['evaluate_expression', 'solve_equation', 'calculate_derivative'];
const TOOL_LABELS: Record<string, string> = {
  evaluate_expression: 'Evaluate Expression',
  solve_equation: 'Solve Equation',
  calculate_derivative: 'Calculate Derivative',
};

const EMPTY_ENTRY: ModelPoolEntry = {
  id: '', providerId: '', modelId: '', displayName: '',
  enableTools: true, disabledTools: [],
};

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose }) => {
  const [local, setLocal] = useState<UserSettings>({ ...DEFAULT_SETTINGS, ...settings });
  const [tab, setTab] = useState<Tab>('general');
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([]);
  const [editingEntry, setEditingEntry] = useState<ModelPoolEntry | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => { api.providers.list().then(setProviders).catch(() => {}); }, []);

  const loadModels = async (providerId: string, baseURL?: string, apiKey?: string) => {
    setLoadingModels(true);
    setFetchError(null);
    try {
      const result = await api.providers.models(providerId, baseURL, apiKey);
      setAvailableModels(result.models);
      if (result.error) setFetchError(result.error);
    } catch (e: any) {
      setAvailableModels([]);
      setFetchError(e.message || 'Failed to fetch models');
    }
    setLoadingModels(false);
  };

  const addEntry = () => {
    setEditingEntry({ ...EMPTY_ENTRY, id: crypto.randomUUID() });
    setAvailableModels([]);
  };

  const editEntry = (entry: ModelPoolEntry) => {
    setEditingEntry({ ...entry });
    loadModels(entry.providerId, entry.baseURL, entry.apiKey);
  };

  const saveEntry = () => {
    if (!editingEntry || !editingEntry.providerId || !editingEntry.modelId) return;
    const pool = [...local.modelPool];
    const idx = pool.findIndex(e => e.id === editingEntry.id);
    if (idx >= 0) pool[idx] = editingEntry;
    else pool.push(editingEntry);
    setLocal(s => ({ ...s, modelPool: pool }));
    setEditingEntry(null);
  };

  const deleteEntry = (id: string) => {
    setLocal(s => ({
      ...s,
      modelPool: s.modelPool.filter(e => e.id !== id),
      activeModelId: s.activeModelId === id ? undefined : s.activeModelId,
    }));
  };

  const activeModel = local.modelPool.find(m => m.id === local.activeModelId);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-800 shrink-0">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X size={24} /></button>
        </div>

        <div className="flex border-b border-gray-800 shrink-0">
          {(['general', 'models', 'tools'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === t ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}>
              {t === 'general' ? 'General' : t === 'models' ? 'Models' : 'Tools'}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
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
                  {local.modelPool.map(m => (
                    <option key={m.id} value={m.id}>{m.displayName || `${m.providerId}/${m.modelId}`}</option>
                  ))}
                </select>
                {local.modelPool.length === 0 && <p className="text-xs text-gray-500">Add models in the Models tab first.</p>}
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

          {tab === 'models' && (
            <>
              {editingEntry ? (
                <ModelEntryEditor
                  entry={editingEntry}
                  providers={providers}
                  availableModels={availableModels}
                  loadingModels={loadingModels}
                  fetchError={fetchError}
                  onChange={setEditingEntry}
                  onLoadModels={loadModels}
                  onSave={saveEntry}
                  onCancel={() => setEditingEntry(null)}
                />
              ) : (
                <>
                  {local.modelPool.map(entry => (
                    <div key={entry.id} className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">{entry.displayName || entry.modelId}</div>
                        <div className="text-xs text-gray-400">{providers.find(p => p.id === entry.providerId)?.name || entry.providerId} · temp={entry.temperature ?? 'unset'} · maxTokens={entry.maxTokens ?? 'unset'}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => editEntry(entry)} className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1">Edit</button>
                        <button onClick={() => deleteEntry(entry.id)} className="text-xs text-red-400 hover:text-red-300 px-2 py-1"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                  <button onClick={addEntry} className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 text-gray-300 rounded-lg p-4 transition-colors">
                    <Plus size={18} /> Add Model
                  </button>
                </>
              )}
            </>
          )}

          {tab === 'tools' && (
            <>
              <p className="text-sm text-gray-400">Configure math tools availability. Per-model overrides can be set in the Models tab.</p>
              <div className="space-y-3">
                {TOOL_NAMES.map(name => (
                  <div key={name} className="bg-gray-800 rounded-lg border border-gray-700 p-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">{TOOL_LABELS[name]}</div>
                      <div className="text-xs text-gray-400 font-mono">{name}</div>
                    </div>
                    <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded">Built-in</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500">To disable tools for a specific model, edit that model entry in the Models tab.</p>
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

const ModelEntryEditor: React.FC<{
  entry: ModelPoolEntry;
  providers: { id: string; name: string }[];
  availableModels: string[];
  loadingModels: boolean;
  fetchError: string | null;
  onChange: (e: ModelPoolEntry) => void;
  onLoadModels: (providerId: string, baseURL?: string, apiKey?: string) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ entry, providers, availableModels, loadingModels, fetchError, onChange, onLoadModels, onSave, onCancel }) => {
  const isCustom = !['nvidia', 'cloudflare', 'aihubmix', 'opengateway', 'poe', 'gemini'].includes(entry.providerId) || !!entry.baseURL;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Display Name (optional)</label>
        <input value={entry.displayName || ''} onChange={e => onChange({ ...entry, displayName: e.target.value })} placeholder="e.g. My GPT-4o" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500" />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">Provider</label>
        <select
          value={providers.some(p => p.id === entry.providerId) ? entry.providerId : '__custom__'}
          onChange={e => {
            const pid = e.target.value;
            onChange({ ...entry, providerId: pid, modelId: '' });
            onLoadModels(pid, entry.baseURL, entry.apiKey);
          }}
          className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500"
        >
          {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="__custom__">Custom (OpenAI-compatible)</option>
        </select>
      </div>

      {(entry.providerId === '__custom__' || isCustom) && (
        <>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Base URL</label>
            <input value={entry.baseURL || ''} onChange={e => onChange({ ...entry, baseURL: e.target.value })} placeholder="https://api.example.com/v1" className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 font-mono text-sm" />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">API Key</label>
            <input type="password" value={entry.apiKey || ''} onChange={e => onChange({ ...entry, apiKey: e.target.value })} placeholder="sk-..." className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 font-mono text-sm" />
          </div>
        </>
      )}

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
            onClick={() => onLoadModels(entry.providerId, entry.baseURL, entry.apiKey)}
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Reasoning Effort</label>
          <select value={entry.reasoningEffort || ''} onChange={e => onChange({ ...entry, reasoningEffort: e.target.value || undefined })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500">
            <option value="">Unset</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">Thinking Level (Gemini)</label>
          <select value={entry.thinkingLevel || ''} onChange={e => onChange({ ...entry, thinkingLevel: e.target.value || undefined })} className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500">
            <option value="">Unset</option>
            <option value="none">None</option>
            <option value="minimal">Minimal</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>

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
          value={entry.extraBody ? JSON.stringify(entry.extraBody, null, 2) : ''}
          onChange={e => {
            try { onChange({ ...entry, extraBody: JSON.parse(e.target.value) }); }
            catch { /* ignore parse errors while typing */ }
          }}
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
