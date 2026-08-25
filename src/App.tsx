import React, { useState, useEffect, useCallback } from 'react';
import { api } from './lib/api';
import { ChatSession, ChatMessage, UserSettings, DEFAULT_SETTINGS, StarColor, Template } from './types';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';
import { Loader2 } from 'lucide-react';

let settingsSaveQueue = Promise.resolve();

function useWindowWidth() {
  const [width, setWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024));

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return width;
}

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [generatingSessions, setGeneratingSessions] = useState<Set<string>>(new Set());
  const [stoppingSessions, setStoppingSessions] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;

  const clearError = useCallback(() => { setError(null); }, []);

  useEffect(() => {
    (async () => {
      const [loadedSessions, loadedSettings, loadedTemplates, { runningSessionIds }] = await Promise.all([
        api.sessions.list(),
        api.settings.get(),
        api.templates.get().catch(() => []),
        api.chat.getRunningSessions().catch(() => ({ runningSessionIds: [] as string[] })),
      ]);
      setSessions(loadedSessions);
      if (loadedSessions.length > 0) setCurrentSessionId(loadedSessions[0].id);
      setTemplates(loadedTemplates);
      if (loadedSettings) {
        const merged = { ...DEFAULT_SETTINGS, ...loadedSettings };
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
      skillIds: settings.activeSkillIds || [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    setSessions(prev => [session, ...prev]);
    setCurrentSessionId(id);
    if (isMobile) {
      setIsMobileSidebarOpen(false);
    }
  };

  const handleDeleteChat = async (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) {
      setCurrentSessionId(null);
    }
    await api.sessions.delete(id);

    if (settings.starredSessions && settings.starredSessions[id]) {
      const previousSettings = { ...settings };
      const updatedStarred = { ...settings.starredSessions };
      delete updatedStarred[id];
      const newSettings = { ...settings, starredSessions: updatedStarred };
      setSettings(newSettings);

      settingsSaveQueue = settingsSaveQueue.then(async () => {
        try {
          await api.settings.save(newSettings);
        } catch (e: any) {
          setSettings(previousSettings);
          setError(e.message || 'Failed to update starred sessions after deletion');
        }
      });
      await settingsSaveQueue;
    }
  };

  const handleDuplicateChat = async (id: string) => {
    try {
      const duplicated = await api.sessions.duplicate(id);
      setSessions(prev => [duplicated, ...prev]);
    } catch (e: any) {
      setError(e.message || 'Failed to duplicate chat');
    }
  };

  const pendingSendsRef = React.useRef<Map<string, NodeJS.Timeout>>(new Map());

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    let sessionId = currentSessionId;
    let isNewSession = false;

    if (!sessionId) {
      isNewSession = true;
      sessionId = crypto.randomUUID();
      const session: ChatSession = {
        id: sessionId,
        title: content.trim().slice(0, 50) + (content.length > 50 ? '...' : ''),
        messages: [],
        characterId: settings.activeCharacterId,
        skillIds: settings.activeSkillIds || [],
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

    setSessions(prev => prev.map(s => s.id === sessionId
      ? { ...s, messages: [...s.messages, userMsg], updatedAt: new Date().toISOString() }
      : s
    ));

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
      }, 100);

      pendingSendsRef.current.set(sessionId, timeout);
    } else {
      try {
        await api.chat.send(sessionId, content);
        markGenerating(sessionId, true);
      } catch (e: any) {
        setError(e.message || 'Failed to send message');
      }
    }
  };

  useEffect(() => {
    return () => {
      pendingSendsRef.current.forEach(timeout => { clearTimeout(timeout); });
    };
  }, []);

  const handleStop = async () => {
    if (!currentSessionId) return;
    setStoppingSessions(prev => {
      const next = new Set(prev);
      next.add(currentSessionId);
      return next;
    });
    try {
      await api.chat.stop(currentSessionId);
    } catch (e: any) {
      console.error('Failed to stop generation:', e);
      setStoppingSessions(prev => {
        const next = new Set(prev);
        next.delete(currentSessionId);
        return next;
      });
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
    const previousSettings = { ...settings };
    setSettings(newSettings);
    setIsSettingsOpen(false);

    settingsSaveQueue = settingsSaveQueue.then(async () => {
      try {
        await api.settings.save(newSettings);
      } catch (e: any) {
        setSettings(previousSettings);
        setError(e.message || 'Failed to save settings');
      }
    });
    await settingsSaveQueue;
  };

  const handleSaveTemplates = async (newTemplates: Template[]) => {
    const previousTemplates = templates;
    setTemplates(newTemplates);
    try {
      await api.templates.save(newTemplates);
    } catch (e: any) {
      setTemplates(previousTemplates);
      setError(e.message || 'Failed to save templates');
    }
  };

  const handleSelectModel = async (modelId: string) => {
    const previousSettings = { ...settings };
    const newSettings = { ...settings, activeModelId: modelId };
    setSettings(newSettings);

    settingsSaveQueue = settingsSaveQueue.then(async () => {
      try {
        await api.settings.save(newSettings);
      } catch (e: any) {
        setSettings(previousSettings);
        setError(e.message || 'Failed to update selected model');
      }
    });
    await settingsSaveQueue;
  };

  const handleToggleStarSession = async (sessionId: string, color: StarColor | '') => {
    const previousSettings = { ...settings };
    const currentStarred = settings.starredSessions || {};
    const updatedStarred = { ...currentStarred };
    if (!color) {
      delete updatedStarred[sessionId];
    } else {
      updatedStarred[sessionId] = color;
    }
    const newSettings = { ...settings, starredSessions: updatedStarred };
    setSettings(newSettings);

    settingsSaveQueue = settingsSaveQueue.then(async () => {
      try {
        await api.settings.save(newSettings);
      } catch (e: any) {
        setSettings(previousSettings);
        setError(e.message || 'Failed to update starred session');
      }
    });
    await settingsSaveQueue;
  };

  const handleUpdateSession = async (sessionId: string, updates: Partial<ChatSession>) => {
    try {
      const updated = await api.sessions.update(sessionId, updates);
      setSessions(prev => prev.map(s => s.id === sessionId ? updated : s));
    } catch (e: any) {
      setError(e.message || "Failed to update session");
      throw e;
    }
  };

  const handleUpdateSessionCharacter = async (characterId: string) => {
    if (!currentSessionId) return;
    try {
      await handleUpdateSession(currentSessionId, { characterId });
    } catch {
      // Handled in handleUpdateSession
    }
  };

  const handleUpdateSessionSkills = async (skillIds: string[]) => {
    if (!currentSessionId) return;
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, skillIds };
      }
      return s;
    }));

    try {
      await handleUpdateSession(currentSessionId, { skillIds });
    } catch {
      // Handled in handleUpdateSession
    }
  };

  const handleSelectCharacter = async (characterId: string) => {
    const previousSettings = { ...settings };
    const newSettings = { ...settings, activeCharacterId: characterId };
    setSettings(newSettings);

    settingsSaveQueue = settingsSaveQueue.then(async () => {
      try {
        await api.settings.save(newSettings);
      } catch (e: any) {
        setSettings(previousSettings);
        setError(e.message || 'Failed to update selected character');
      }
    });
    await settingsSaveQueue;
  };

  const handleSelectSkills = async (skillIds: string[]) => {
    const previousSettings = { ...settings };
    const newSettings = { ...settings, activeSkillIds: skillIds };
    setSettings(newSettings);

    settingsSaveQueue = settingsSaveQueue.then(async () => {
      try {
        await api.settings.save(newSettings);
      } catch (e: any) {
        setSettings(previousSettings);
        setError(e.message || 'Failed to update selected skills');
      }
    });
    await settingsSaveQueue;
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

  let fontName = 'default';
  if (settings.katexFont) {
    fontName = settings.katexFont;
  }
  const currentFontClass = `katex-font-${fontName}`;

  const commonSidebarProps = {
    sessions,
    characters: settings.characters,
    currentSessionId,
    onNewChat: handleNewChat,
    onDeleteChat: handleDeleteChat,
    onDuplicateChat: handleDuplicateChat,
    starredSessions: settings.starredSessions,
    onToggleStarSession: handleToggleStarSession,
  };

  let sidebarElement = null;
  if (isMobile) {
    if (isMobileSidebarOpen) {
      sidebarElement = (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative z-10 h-full flex">
            <Sidebar
              {...commonSidebarProps}
              onSelectSession={(id) => {
                setCurrentSessionId(id);
                setIsMobileSidebarOpen(false);
              }}
              onOpenSettings={() => {
                setIsSettingsOpen(true);
                setIsMobileSidebarOpen(false);
              }}
              width={280}
            />
          </div>
        </div>
      );
    }
  } else {
    sidebarElement = (
      <>
        <Sidebar
          {...commonSidebarProps}
          onSelectSession={setCurrentSessionId}
          onOpenSettings={() => { setIsSettingsOpen(true); }}
          width={sidebarWidth}
        />
        <div
          className="w-[2px] hover:bg-blue-500 bg-gray-800/80 cursor-col-resize transition-colors h-full shrink-0 z-20"
          onMouseDown={handleMouseDown}
        />
      </>
    );
  }

  return (
    <div className={`flex h-screen bg-gray-900 text-gray-100 overflow-hidden font-sans relative ${currentFontClass}`}>
      {sidebarElement}

      <main className="flex-1 flex flex-col min-w-0">
        <ChatArea
          session={currentSession}
          onSendMessage={handleSendMessage}
          isGenerating={currentSessionId ? generatingSessions.has(currentSessionId) : false}
          isStopping={currentSessionId ? stoppingSessions.has(currentSessionId) : false}
          settings={settings}
          templates={templates}
          onStop={handleStop}
          onRetry={handleRetry}
          onContinue={handleContinue}
          onRegenerate={handleRegenerate}
          onSelectModel={handleSelectModel}
          onSelectCharacter={handleSelectCharacter}
          onSelectSkills={handleSelectSkills}
          onUpdateSessionCharacter={handleUpdateSessionCharacter}
          onUpdateSessionSkills={handleUpdateSessionSkills}
          onUpdateSession={handleUpdateSession}
          error={error}
          onClearError={clearError}
          onError={setError}
          isMobile={isMobile}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onGenerationEnd={async (id) => {
            try {
              await refreshSession(id);
            } catch (e) {
              console.error('Refresh session failed:', e);
            } finally {
              setGeneratingSessions(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
              setStoppingSessions(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
            }
          }}
        />
      </main>

      {isSettingsOpen && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          templates={templates}
          onSaveTemplates={handleSaveTemplates}
          onClose={() => { setIsSettingsOpen(false); }}
        />
      )}
    </div>
  );
}
