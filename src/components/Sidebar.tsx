import React from 'react';
import { ChatSession } from '../types';
import { Plus, Settings, LogOut, MessageSquare, Trash2 } from 'lucide-react';
import { User } from 'firebase/auth';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onOpenSettings: () => void;
  user: User;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions, currentSessionId, onSelectSession, onNewChat, onDeleteChat, onOpenSettings, user, onLogout
}) => {
  return (
    <div className="w-64 bg-gray-950 flex flex-col h-full border-r border-gray-800 shrink-0">
      <div className="p-4">
        <button 
          onClick={onNewChat}
          className="w-full flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-lg transition-colors font-medium"
        >
          <Plus size={20} />
          <span>New Chat</span>
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {sessions.map(session => (
          <div 
            key={session.id}
            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${currentSessionId === session.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
            onClick={() => onSelectSession(session.id)}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <MessageSquare size={16} className="shrink-0" />
              <span className="truncate text-sm font-medium">{session.title}</span>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); onDeleteChat(session.id); }}
              className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity p-1"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-800 space-y-2">
        <button 
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 text-gray-400 hover:text-white px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors font-medium"
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>
        <div className="flex items-center justify-between px-3 py-2.5 mt-2 bg-gray-900 rounded-lg border border-gray-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <img src={user.photoURL || ''} alt="User" className="w-8 h-8 rounded-full bg-gray-800 shrink-0" />
            <span className="truncate text-sm text-gray-300 font-medium">{user.displayName || user.email}</span>
          </div>
          <button onClick={onLogout} className="text-gray-500 hover:text-white p-1" title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
