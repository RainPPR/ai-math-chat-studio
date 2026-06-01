import React, { useState, useEffect, useCallback } from 'react';
import { api } from './lib/api';
import { ChatSession, UserSettings, DEFAULT_SETTINGS } from './types';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';
import { Loader2, Wrench, ChevronRight, ChevronLeft } from 'lucide-react';

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isToolsSidebarOpen, setIsToolsSidebarOpen] = useState(true);
  const [generatingSessions, setGeneratingSessions] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const [loadedSessions, loadedSettings] = await Promise.all([
        api.sessions.list(),
        api.settings.get(),
      ]);
      setSessions(loadedSessions);
      if (loadedSessions.length > 0) setCurrentSessionId(loadedSessions[0].id);
      if (loadedSettings) setSettings({ ...DEFAULT_SETTINGS, ...loadedSettings });
      setIsReady(true);
    })();
  }, []);

  const markGenerating = useCallback((id: string, v: boolean) => {
    setGeneratingSessions(prev => {
      const next = new Set(prev);
      v ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const refreshSession = useCallback(async (id: string) => {
    const updated = await api.sessions.get(id);
    setSessions(prev => prev.map(s => s.id === id ? updated : s));
  }, []);

  const handleNewChat = async () => {
    const id = crypto.randomUUID();
    const session: ChatSession = {
      id, uid: 'local', title: 'New Chat',
      messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    setSessions(prev => [session, ...prev]);
    setCurrentSessionId(id);
  };

  const handleDeleteChat = async (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) setCurrentSessionId(null);
    await api.sessions.delete(id);
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      const session: ChatSession = {
        id: sessionId, uid: 'local',
        title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
        messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      setSessions(prev => [session, ...prev]);
      setCurrentSessionId(sessionId);
    }

    try {
      await api.chat.send(sessionId, content);
      markGenerating(sessionId, true);
    } catch (e: any) {
      console.error('Send failed:', e);
    }
  };

  const handleStop = async () => {
    if (!currentSessionId) return;
    await api.chat.stop(currentSessionId);
  };

  const handleRetry = async (msgId: string) => {
    if (!currentSessionId) return;
    try {
      await api.chat.retry(currentSessionId, msgId);
      markGenerating(currentSessionId, true);
    } catch (e: any) {
      console.error('Retry failed:', e);
    }
  };

  const handleContinue = async () => {
    if (!currentSessionId) return;
    try {
      await api.chat.continue(currentSessionId);
      markGenerating(currentSessionId, true);
    } catch (e: any) {
      console.error('Continue failed:', e);
    }
  };

  const handleSaveSettings = async (newSettings: UserSettings) => {
    setSettings(newSettings);
    setIsSettingsOpen(false);
    await api.settings.save(newSettings);
  };

  if (!isReady) {
    return <div className="flex h-screen items-center justify-center bg-gray-900"><Loader2 className="animate-spin text-white" /></div>;
  }

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden font-sans relative">
      <Sidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className="flex-1 flex flex-col min-w-0">
        <ChatArea
          session={currentSession}
          onSendMessage={handleSendMessage}
          isGenerating={currentSessionId ? generatingSessions.has(currentSessionId) : false}
          settings={settings}
          onStop={handleStop}
          onRetry={handleRetry}
          onContinue={handleContinue}
          onGenerationEnd={(id) => { markGenerating(id, false); refreshSession(id); }}
        />
      </main>

      <div className={`bg-gray-800 border-l border-gray-700 flex flex-col transition-all duration-300 ease-in-out ${isToolsSidebarOpen ? 'w-80' : 'w-0'}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700 whitespace-nowrap overflow-hidden">
          <div className="flex items-center gap-2 font-medium">
            <Wrench className="w-4 h-4 text-blue-400" />
            <span>Tool Calls</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {currentSession?.messages.filter(m => m.toolCalls?.length).length === 0 ? (
            <div className="text-sm text-gray-500 text-center mt-10">No tools called yet.</div>
          ) : (
            currentSession?.messages.map((msg, msgIdx) => {
              if (!msg.toolCalls?.length) return null;
              return (
                <div key={msg.id} className="space-y-3">
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <div className="h-px bg-gray-700 flex-1" />
                    <span>Message {msgIdx + 1}</span>
                    <div className="h-px bg-gray-700 flex-1" />
                  </div>
                  {msg.toolCalls.map((call, idx) => (
                    <div key={idx} className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden text-sm">
                      <div className="bg-gray-800 px-3 py-2 border-b border-gray-700 font-mono text-xs text-blue-400 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        {call.name}
                      </div>
                      <div className="p-3 space-y-3">
                        <div>
                          <span className="text-gray-500 text-xs uppercase tracking-wider">Arguments</span>
                          <pre className="mt-1 font-mono text-xs text-gray-300 whitespace-pre-wrap break-all bg-gray-800/50 p-2 rounded">{JSON.stringify(call.args, null, 2)}</pre>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs uppercase tracking-wider">Result</span>
                          <pre className="mt-1 font-mono text-xs text-green-400 whitespace-pre-wrap break-all bg-gray-800/50 p-2 rounded">{call.result}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      <button
        onClick={() => setIsToolsSidebarOpen(!isToolsSidebarOpen)}
        className={`absolute top-1/2 -translate-y-1/2 bg-gray-800 border border-gray-700 text-gray-400 hover:text-white p-1 rounded-l-md transition-all duration-300 z-10 ${isToolsSidebarOpen ? 'right-80' : 'right-0'}`}
      >
        {isToolsSidebarOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>

      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}
