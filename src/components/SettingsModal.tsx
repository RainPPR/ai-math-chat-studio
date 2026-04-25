import React, { useState } from 'react';
import { UserSettings } from '../types';
import { X } from 'lucide-react';

interface SettingsModalProps {
  settings: UserSettings;
  models: string[];
  onSave: (settings: UserSettings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, models, onSave, onClose }) => {
  const [localSettings, setLocalSettings] = useState<UserSettings>(settings);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">Model</label>
            <select 
              value={localSettings.model}
              onChange={e => setLocalSettings(s => ({ ...s, model: e.target.value }))}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 transition-colors"
            >
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

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

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">System Prompt</label>
            <textarea 
              value={localSettings.systemPrompt}
              onChange={e => setLocalSettings(s => ({ ...s, systemPrompt: e.target.value }))}
              placeholder="You are a helpful assistant..."
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-lg p-3 focus:outline-none focus:border-blue-500 transition-colors h-32 resize-none"
            />
          </div>
        </div>

        <div className="p-6 border-t border-gray-800 bg-gray-950 flex justify-end gap-3">
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
