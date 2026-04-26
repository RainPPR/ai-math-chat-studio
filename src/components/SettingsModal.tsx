import React, { useState, useEffect } from 'react';
import { UserSettings } from '../types';
import { X, Sparkles } from 'lucide-react';
import { fetchNvidiaModels } from '../lib/nvidia';

interface SettingsModalProps {
  settings: UserSettings;
  models: string[];
  onSave: (settings: UserSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, models, onSave, onClose }) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>({
    provider: 'gemini',
    temperature: 1,
    topP: 0.95,
    maxTokens: 16384,
    extraBody: '{"chat_template_kwargs":{"thinking":true,"reasoning_effort":"max"}}',
    ...settings
  });
  
  const [nvidiaModels, setNvidiaModels] = useState<string[]>([]);

  useEffect(() => {
    fetchNvidiaModels().then(setNvidiaModels).catch(console.error);
  }, []);

  const handleBeautifyJson = () => {
    if (!localSettings.extraBody?.trim()) {
      setLocalSettings(s => ({ ...s, extraBody: '' }));
      return;
    }
    try {
      const parsed = JSON.parse(localSettings.extraBody);
      setLocalSettings(s => ({
        ...s,
        extraBody: JSON.stringify(parsed, null, 4)
      }));
    } catch (e) {
      alert("Invalid JSON format. Please check your syntax.");
    }
  };

  const isNvidia = localSettings.provider === 'nvidia';
  const displayModels = isNvidia ? nvidiaModels : models;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-gray-800 shrink-0">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="space-y-4 pb-6 border-b border-gray-800">
            <h3 className="text-lg font-medium text-white">General Settings</h3>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.renderThinkingAsMarkdown ?? false}
                onChange={e => setLocalSettings(s => ({ ...s, renderThinkingAsMarkdown: e.target.checked }))}
                className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
              />
              <span className="text-sm font-medium text-gray-300">Render Thinking Process as Markdown (instead of text block)</span>
            </label>

            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={localSettings.autoScroll ?? true}
                onChange={e => setLocalSettings(s => ({ ...s, autoScroll: e.target.checked }))}
                className="w-5 h-5 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
              />
              <span className="text-sm font-medium text-gray-300">Auto-scroll to bottom on new messages</span>
            </label>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Provider</label>
            <select 
              value={localSettings.provider || 'gemini'}
              onChange={e => setLocalSettings(s => ({ ...s, provider: e.target.value as 'gemini' | 'nvidia', model: e.target.value === 'nvidia' ? nvidiaModels[0] || '' : models[0] || '' }))}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="gemini">Google Gemini</option>
              <option value="nvidia">Nvidia API</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Model</label>
            <input 
              list="models-datalist"
              value={localSettings.model}
              onChange={e => setLocalSettings(s => ({ ...s, model: e.target.value }))}
              placeholder="Select or type model name..."
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <datalist id="models-datalist">
              {displayModels.map(m => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          {!isNvidia && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Thinking Level</label>
              <select 
                value={localSettings.thinkingLevel}
                onChange={e => setLocalSettings(s => ({ ...s, thinkingLevel: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="none">None</option>
                <option value="minimal">Minimal</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">System Prompt</label>
            <textarea 
              value={localSettings.systemPrompt}
              onChange={e => setLocalSettings(s => ({ ...s, systemPrompt: e.target.value }))}
              placeholder="You are a helpful assistant..."
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 transition-colors h-32 resize-none"
            />
          </div>

          {isNvidia && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">Temperature: {localSettings.temperature}</label>
                  <input 
                    type="range" min="0" max="2" step="0.1" 
                    value={localSettings.temperature ?? 1} 
                    onChange={e => setLocalSettings(s => ({ ...s, temperature: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">Top P: {localSettings.topP}</label>
                  <input 
                    type="range" min="0" max="1" step="0.05" 
                    value={localSettings.topP ?? 0.95} 
                    onChange={e => setLocalSettings(s => ({ ...s, topP: parseFloat(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">Max Tokens</label>
                <input 
                  type="number" min="1" max="32768"
                  value={localSettings.maxTokens ?? 16384}
                  onChange={e => setLocalSettings(s => ({ ...s, maxTokens: parseInt(e.target.value) || 16384 }))}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-300">Extra Body (JSON)</label>
                  <button onClick={handleBeautifyJson} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium">
                    <Sparkles size={12} /> Format
                  </button>
                </div>
                <textarea 
                  value={localSettings.extraBody || ''}
                  onChange={e => setLocalSettings(s => ({ ...s, extraBody: e.target.value }))}
                  placeholder='{"chat_template_kwargs":{"thinking":true,"reasoning_effort":"max"}}'
                  className="w-full bg-gray-950 border border-gray-700 font-mono text-green-400 text-sm rounded-lg p-3 focus:outline-none focus:border-blue-500 transition-colors h-32 resize-y"
                  spellCheck={false}
                />
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-800 bg-gray-950 flex justify-end gap-3 shrink-0">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 text-gray-300 hover:text-white font-medium transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(localSettings)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
