```typescript
import React, { useState, useEffect, useCallback } from 'react';
import { api } from './lib/api';
import { ChatSession, ChatMessage, UserSettings, DEFAULT_SETTINGS } from './types';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [generatingSessions, setGeneratingSessions] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => { setError(null); }, []);

  useEffect(() => {
    (async () => {
      const [loadedSessions, loadedSettings, { runningSessionIds }] = await Promise.all([
        api.sessions.list(),
        api.settings.get(),
        api.chat.getRunningSessions().catch(() => ({ runningSessionIds: [] as string[] })),
      ]);
      setSessions(loadedSessions);
      if (loadedSessions.length > 0) setCurrentSessionId(loadedSessions[0].id);
      if (loadedSettings) {
        const merged = { ...DEFAULT_SETTINGS, ...loadedSettings };
        // Detect old format (modelPool instead of providers/models)
        if ((merged as any).modelPool && !merged.providers) {
          merged.providers = [];
          merged.models = [];
          merged.activeModelId = undefined;
        }
        setSettings(merged);
      }
      if (runningSessionIds.length > 0) {
        setGeneratingSessions(new Set(runningSessionIds));
      }
      setIsReady(true);
    })();
  }, []);

  const markGenerating = useCallback((id: string, v: boolean) => {
    setGeneratingSessions(prev => {
      const next = new Set(prev);
      if (v) next.add(id); else next.delete(id);
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
      id, title: 'New Chat',
      messages: [],
      characterId: settings.activeCharacterId,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    setSessions(prev => [session, ...prev]);
    setCurrentSessionId(id);
  };

  const handleDeleteChat = async (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) setCurrentSessionId(null);
    await api.sessions.delete(id);
  };

  const handleDuplicateChat = async (id: string) => {
    try {
      const duplicated = await api.sessions.duplicate(id);
      setSessions(prev => [duplicated, ...prev]);
    } catch (e: any) {
      setError(e.message || 'Failed to duplicate chat');
    }
  };

  // Debounce mechanism for rapid new chat + send operations
  const pendingSendsRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map());

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    let sessionId = currentSessionId;
    let isNewSession = false;

    // Create new session if needed
    if (!sessionId) {
      isNewSession = true;
      sessionId = crypto.randomUUID();
      const session: ChatSession = {
        id: sessionId,
        title: content.trim().slice(0, 50) + (content.length > 50 ? '...' : ''),
        messages: [],
        characterId: settings.activeCharacterId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSessions(prev => [session, ...prev]);
      setCurrentSessionId(sessionId);
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    // Optimistic UI update
    setSessions(prev => prev.map(s => s.id === sessionId
      ? { ...s, messages: [...s.messages, userMsg], updatedAt: new Date().toISOString() }
      : s
    ));

    // Debounce API call for new sessions to prevent race conditions
    if (isNewSession) {
      const existingTimeout = pendingSendsRef.current.get(sessionId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const timeout = setTimeout(async () => {
        pendingSendsRef.current.delete(sessionId);
        try {
          await api.chat.send(sessionId, content);
          markGenerating(sessionId, true);
        } catch (e: any) {
          setError(e.message || 'Failed to send message');
        }
      }, 100); // Small delay to ensure session state is settled

      pendingSendsRef.current.set(sessionId, timeout);
    } else {
      // Existing session - send immediately
      try {
        await api.chat.send(sessionId, content);
        markGenerating(sessionId, true);
      } catch (e: any) {
        setError(e.message || 'Failed to send message');
      }
    }
  };

  // Cleanup pending sends on unmount
  useEffect(() => {
    return () => {
      pendingSendsRef.current.forEach(timeout => { clearTimeout(timeout); });
    };
  }, []);

  const handleStop = async () => {
    if (!currentSessionId) return;
    try {
      await api.chat.stop(currentSessionId);
    } catch (e: any) {
      console.error('Failed to stop generation:', e);
    }
  };

  const handleRetry = async (msgId: string) => {
    if (!currentSessionId) return;
    clearError();
    try {
      await api.chat.retry(currentSessionId, msgId);
      try {
        await refreshSession(currentSessionId);
      } catch (e) {
        console.error('Refresh session failed:', e);
      }
      markGenerating(currentSessionId, true);
    } catch (e: any) {
      setError(e.message || 'Failed to retry message');
    }
  };

  const handleContinue = async () => {
    if (!currentSessionId) return;
    clearError();
    try {
      await api.chat.continue(currentSessionId);
      try {
        await refreshSession(currentSessionId);
      } catch (e) {
        console.error('Refresh session failed:', e);
      }
      markGenerating(currentSessionId, true);
    } catch (e: any) {
      setError(e.message || 'Failed to continue generation');
    }
  };

  const handleRegenerate = async (msgId: string) => {
    if (!currentSessionId) return;
    clearError();
    try {
      await api.chat.regenerate(currentSessionId, msgId);
      try {
        await refreshSession(currentSessionId);
      } catch (e) {
        console.error('Refresh session failed:', e);
      }
      markGenerating(currentSessionId, true);
    } catch (e: any) {
      setError(e.message || 'Failed to regenerate message');
    }
  };

  const handleSaveSettings = async (newSettings: UserSettings) => {
    setSettings(newSettings);
    setIsSettingsOpen(false);
    await api.settings.save(newSettings);
  };

  const handleSelectModel = async (modelId: string) => {
    const newSettings = { ...settings, activeModelId: modelId };
    setSettings(newSettings);
    await api.settings.save(newSettings);
  };

  const handleUpdateSessionCharacter = async (characterId: string) => {
    if (!currentSessionId) return;
    try {
      const updated = await api.sessions.update(currentSessionId, { characterId });
      setSessions(prev => prev.map(s => s.id === currentSessionId ? updated : s));
    } catch (e: any) {
      setError(e.message || "Failed to update session character");
    }
  };

  const handleSelectCharacter = async (characterId: string) => {
    const newSettings = { ...settings, activeCharacterId: characterId };
    setSettings(newSettings);
    await api.settings.save(newSettings);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(180, Math.min(480, startWidth + deltaX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [sidebarWidth]);

  if (!isReady) {
    return <div className="flex h-screen items-center justify-center bg-gray-900"><Loader2 className="animate-spin text-white" /></div>;
  }

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="flex h-screen bg-gray-900 text-gray-100 overflow-hidden font-sans relative">
      <Sidebar
        sessions={sessions}
        characters={settings.characters}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onDuplicateChat={handleDuplicateChat}
        onOpenSettings={() => { setIsSettingsOpen(true); }}
        width={sidebarWidth}
      />

      <div
        className="w-[2px] hover:bg-blue-500 bg-gray-800/80 cursor-col-resize transition-colors h-full shrink-0 z-20"
        onMouseDown={handleMouseDown}
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
          onRegenerate={handleRegenerate}
          onSelectModel={handleSelectModel}
          onSelectCharacter={handleSelectCharacter}
          onUpdateSessionCharacter={handleUpdateSessionCharacter}
          error={error}
          onClearError={clearError}
          onError={setError}
          onGenerationEnd={async (id) => {
            // Do not clear error here as it might have just been set by onError
            try {
              await refreshSession(id);
            } catch (e) {
              console.error('Refresh session failed:', e);
            } finally {
              markGenerating(id, false);
            }
          }}
        />
      </main>

      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => { setIsSettingsOpen(false); }}
        />
      )}
    </div>
  );
}

```