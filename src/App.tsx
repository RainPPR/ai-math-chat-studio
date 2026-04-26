import React, { useState, useEffect } from 'react';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { ChatSession, UserSettings, ChatMessage, ToolCallRecord } from './types';
import { fetchModels, generateChatResponse } from './lib/gemini';
import { generateNvidiaChatResponse, fetchNvidiaModels } from './lib/nvidia';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';
import { v4 as uuidv4 } from 'uuid';
import { Loader2, Wrench, ChevronRight, ChevronLeft } from 'lucide-react';

const DEFAULT_SETTINGS: UserSettings = {
  provider: 'gemini',
  model: 'gemini-3.1-pro-preview',
  systemPrompt: '',
  thinkingLevel: 'DEFAULT',
  temperature: 1,
  topP: 0.95,
  maxTokens: 16384,
  extraBody: '{"chat_template_kwargs":{"thinking":true,"reasoning_effort":"max"}}',
  renderThinkingAsMarkdown: false,
  autoScroll: true,
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isToolsSidebarOpen, setIsToolsSidebarOpen] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetchModels().then(m => setModels(m || []));
  }, []);

  useEffect(() => {
    if (!isAuthReady || !user) {
      setSessions([]);
      setSettings(DEFAULT_SETTINGS);
      return;
    }

    const q = query(collection(db, 'sessions'), where('uid', '==', user.uid));
    const unsubscribeSessions = onSnapshot(q, (snapshot) => {
      const loadedSessions = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatSession));
      loadedSessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setSessions(loadedSessions);
      
      setCurrentSessionId(prev => {
        if (loadedSessions.length > 0 && !prev) {
          return loadedSessions[0].id;
        }
        if (prev && !loadedSessions.find(s => s.id === prev)) {
          return loadedSessions.length > 0 ? loadedSessions[0].id : null;
        }
        return prev;
      });
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'sessions'));

    const unsubscribeSettings = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ ...DEFAULT_SETTINGS, ...docSnap.data() } as UserSettings);
      } else {
        setDoc(doc(db, 'users', user.uid), DEFAULT_SETTINGS).catch(e => handleFirestoreError(e, OperationType.CREATE, 'users'));
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    return () => {
      unsubscribeSessions();
      unsubscribeSettings();
    };
  }, [user, isAuthReady]);

  const handleNewChat = async () => {
    if (!user) return;
    const newSession: ChatSession = {
      id: uuidv4(),
      uid: user.uid,
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Optimistically update local state to prevent UI flicker
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    
    try {
      await setDoc(doc(db, 'sessions', newSession.id), newSession);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'sessions');
    }
  };

  const handleDeleteChat = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sessions', id));
      if (currentSessionId === id) {
        setCurrentSessionId(null);
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, 'sessions');
    }
  };

  const handleSaveSettings = async (newSettings: UserSettings) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), newSettings);
      setSettings(newSettings);
      setIsSettingsOpen(false);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'users');
    }
  };

  const abortControllerRef = React.useRef<AbortController | null>(null);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const runLLM = async (sessionId: string, messagesToSubmit: ChatMessage[]) => {
    setIsGenerating(true);
    abortControllerRef.current = new AbortController();
    const abortSignal = abortControllerRef.current.signal;

    const modelMessageId = uuidv4();
    let currentModelText = "";
    let currentToolCalls: ToolCallRecord[] = [];

    const history = messagesToSubmit.slice(0, -1).map(m => ({ role: m.role as 'user'|'model', content: m.content }));
    const newMessageContent = messagesToSubmit[messagesToSubmit.length - 1].content;

    try {
      let extraBodyObj = undefined;
      if (settings.provider === 'nvidia' && settings.extraBody) {
        try {
          extraBodyObj = JSON.parse(settings.extraBody);
        } catch (e) {
          console.warn("Invalid extraBody JSON, ignoring.");
        }
      }

      if (settings.provider === 'nvidia') {
        await generateNvidiaChatResponse(
          settings.model,
          settings.systemPrompt,
          history,
          newMessageContent,
          settings.temperature ?? 1,
          settings.topP ?? 0.95,
          settings.maxTokens ?? 16384,
          extraBodyObj,
          (text) => {
            currentModelText = text;
            setSessions(prev => prev.map(s => {
              if (s.id === sessionId) {
                const msgs = [...s.messages];
                const lastMsg = msgs[msgs.length - 1];
                if (lastMsg && lastMsg.id === modelMessageId) {
                  lastMsg.content = text;
                } else {
                  msgs.push({
                    id: modelMessageId,
                    role: 'model',
                    content: text,
                    createdAt: new Date().toISOString(),
                    toolCalls: [],
                  });
                }
                return { ...s, messages: msgs };
              }
              return s;
            }));
          },
          { signal: abortSignal }
        );
      } else {
        await generateChatResponse(
          settings.model,
          settings.systemPrompt,
          settings.thinkingLevel,
          history,
          newMessageContent,
          (text) => {
            currentModelText = text;
            setSessions(prev => prev.map(s => {
              if (s.id === sessionId) {
                const msgs = [...s.messages];
                const lastMsg = msgs[msgs.length - 1];
                if (lastMsg && lastMsg.id === modelMessageId) {
                  lastMsg.content = text;
                  lastMsg.toolCalls = currentToolCalls;
                } else {
                  msgs.push({
                    id: modelMessageId,
                    role: 'model',
                    content: text,
                    createdAt: new Date().toISOString(),
                    toolCalls: currentToolCalls,
                  });
                }
                return { ...s, messages: msgs };
              }
              return s;
            }));
          },
          (toolCall) => {
            currentToolCalls = [...currentToolCalls, toolCall];
            setSessions(prev => prev.map(s => {
              if (s.id === sessionId) {
                const msgs = [...s.messages];
                const lastMsg = msgs[msgs.length - 1];
                if (lastMsg && lastMsg.id === modelMessageId) {
                  lastMsg.toolCalls = currentToolCalls;
                }
                return { ...s, messages: msgs };
              }
              return s;
            }));
          },
          { signal: abortSignal }
        );
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        console.log('Generation aborted');
      } else {
        console.error("Generation error", error);
        currentModelText += "\n\n**Error generating response.**";
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
      const finalModelMessage: ChatMessage = {
        id: modelMessageId,
        role: 'model',
        content: currentModelText,
        createdAt: new Date().toISOString(),
        toolCalls: currentToolCalls,
      };
      try {
        await updateDoc(doc(db, 'sessions', sessionId), {
          messages: [...messagesToSubmit, finalModelMessage].filter(m => m.content.trim() !== ""),
          updatedAt: new Date().toISOString(),
        });
      } catch (insertErr) {
        console.error('Failed to save final message', insertErr);
      }
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!user || !content.trim() || isGenerating) return;

    let sessionId = currentSessionId;
    let session = sessions.find(s => s.id === sessionId);

    if (!sessionId || !session) {
      sessionId = uuidv4();
      session = {
        id: sessionId,
        uid: user.uid,
        title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      try {
        await setDoc(doc(db, 'sessions', sessionId), session);
        setCurrentSessionId(sessionId);
      } catch (e) {
        handleFirestoreError(e, OperationType.CREATE, 'sessions');
        return;
      }
    }

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...session.messages, userMessage];
    
    try {
      await updateDoc(doc(db, 'sessions', sessionId), {
        messages: updatedMessages,
        updatedAt: new Date().toISOString(),
        title: session.messages.length === 0 ? content.slice(0, 30) : session.title
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'sessions');
      return;
    }

    await runLLM(sessionId, updatedMessages);
  };

  const handleRetry = async (msgId: string) => {
    if (isGenerating || !currentSessionId) return;
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return;

    const idx = session.messages.findIndex(m => m.id === msgId);
    if (idx === -1) return;

    let userMsgIdx = idx;
    while (userMsgIdx >= 0 && session.messages[userMsgIdx].role !== 'user') {
      userMsgIdx--;
    }
    if (userMsgIdx === -1) return;

    const updatedMessages = session.messages.slice(0, userMsgIdx + 1);
    try {
      await updateDoc(doc(db, 'sessions', currentSessionId), {
        messages: updatedMessages,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'sessions');
      return;
    }
    
    // optimistically update state before generation
    setSessions(prev => prev.map(s => s.id === currentSessionId ? { ...s, messages: updatedMessages } : s));

    await runLLM(currentSessionId, updatedMessages);
  };

  const handleContinue = async () => {
    if (isGenerating || !currentSessionId) return;
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session || session.messages.length === 0) return;

    // continue sends a user message "continue" but we might actually just append logic here
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: 'continue',
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...session.messages, userMessage];
    try {
      await updateDoc(doc(db, 'sessions', currentSessionId), {
        messages: updatedMessages,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'sessions');
      return;
    }

    await runLLM(currentSessionId, updatedMessages);
  };

  if (!isAuthReady) {
    return <div className="flex h-screen items-center justify-center bg-gray-900"><Loader2 className="animate-spin text-white" /></div>;
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-900 text-white">
        <h1 className="text-4xl font-bold mb-8">AI Studio Chat</h1>
        <button 
          onClick={loginWithGoogle}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
        >
          Sign in with Google
        </button>
      </div>
    );
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
        user={user}
        onLogout={logout}
      />
      
      <main className="flex-1 flex flex-col min-w-0">
        <ChatArea 
          session={currentSession}
          onSendMessage={handleSendMessage}
          isGenerating={isGenerating}
          settings={settings}
          onStop={handleStop}
          onRetry={handleRetry}
          onContinue={handleContinue}
        />
      </main>

      {/* Tools Sidebar */}
      <div className={`bg-gray-800 border-l border-gray-700 flex flex-col transition-all duration-300 ease-in-out ${isToolsSidebarOpen ? 'w-80' : 'w-0'}`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700 whitespace-nowrap overflow-hidden">
          <div className="flex items-center gap-2 font-medium">
            <Wrench className="w-4 h-4 text-blue-400" />
            <span>Tool Calls</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {currentSession?.messages.filter(m => m.toolCalls && m.toolCalls.length > 0).length === 0 ? (
            <div className="text-sm text-gray-500 text-center mt-10">
              No tools called in this session yet.
            </div>
          ) : (
            currentSession?.messages.map((msg, msgIdx) => {
              if (!msg.toolCalls || msg.toolCalls.length === 0) return null;
              return (
                <div key={msg.id} className="space-y-3">
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <div className="h-px bg-gray-700 flex-1"></div>
                    <span>Message {msgIdx + 1}</span>
                    <div className="h-px bg-gray-700 flex-1"></div>
                  </div>
                  {msg.toolCalls.map((call, idx) => (
                    <div key={idx} className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden text-sm">
                      <div className="bg-gray-800 px-3 py-2 border-b border-gray-700 font-mono text-xs text-blue-400 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        {call.name}
                      </div>
                      <div className="p-3 space-y-3">
                        {call.name === 'evaluate_expression' ? (
                          <>
                            <div>
                              <span className="text-gray-500 text-xs uppercase tracking-wider">Expression</span>
                              <div className="mt-1 font-mono text-sm text-gray-200 bg-gray-800/50 p-2 rounded border border-gray-700/50">
                                {call.args.expression}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs uppercase tracking-wider">Result</span>
                              <div className="mt-1 font-mono text-lg text-green-400 bg-gray-800/50 p-2 rounded border border-gray-700/50">
                                = {call.result}
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <span className="text-gray-500 text-xs uppercase tracking-wider">Arguments</span>
                              <pre className="mt-1 font-mono text-xs text-gray-300 whitespace-pre-wrap break-all bg-gray-800/50 p-2 rounded">
                                {JSON.stringify(call.args, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs uppercase tracking-wider">Result</span>
                              <pre className="mt-1 font-mono text-xs text-green-400 whitespace-pre-wrap break-all bg-gray-800/50 p-2 rounded">
                                {call.result}
                              </pre>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Tools Sidebar Toggle Button */}
      <button
        onClick={() => setIsToolsSidebarOpen(!isToolsSidebarOpen)}
        className={`absolute top-1/2 -translate-y-1/2 bg-gray-800 border border-gray-700 text-gray-400 hover:text-white p-1 rounded-l-md transition-all duration-300 z-10 ${isToolsSidebarOpen ? 'right-80' : 'right-0'}`}
      >
        {isToolsSidebarOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
      </button>

      {isSettingsOpen && (
        <SettingsModal 
          settings={settings}
          models={models}
          onSave={handleSaveSettings}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </div>
  );
}
