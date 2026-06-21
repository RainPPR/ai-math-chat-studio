import React, { useState, useRef, useEffect } from 'react';
import { ChatSession, UserSettings } from '../types';
import { api } from '../lib/api';
import { Send, Loader2, Copy, Check, Download, RefreshCcw, Play, SquareTerminal, AlertCircle, X } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatAreaProps {
  session?: ChatSession;
  onSendMessage: (content: string) => void;
  isGenerating: boolean;
  settings: UserSettings;
  onStop?: () => void;
  onRetry?: (msgId: string) => void;
  onContinue?: () => void;
  onRegenerate?: (msgId: string) => void;
  onGenerationEnd?: (sessionId: string) => void;
  onSessionTitleUpdate?: (sessionId: string, title: string) => void;
  error?: string | null;
  onClearError?: () => void;
}

const MessageItem = ({ msg, isLast, isGenerating, settings, onCopy, copiedId, onRetry, onContinue, onRegenerate }: {
  msg: any; isLast: boolean; isGenerating: boolean; settings: UserSettings;
  onCopy: (id: string, content: string) => void; copiedId: string | null;
  onRetry?: (msgId: string) => void; onContinue?: () => void; onRegenerate?: (msgId: string) => void;
}) => {
  const isUser = msg.role === 'user';
  let thoughts: string[] = [];
  let mainContent = msg.content;

  if (!isUser) {
    const thoughtRegex = /<details(?: open)?>\n<summary>Thinking Process<\/summary>\n\n```text\n([\s\S]*?)(?:\n```\n\n<\/details>|$)/g;
    for (const m of msg.content.matchAll(thoughtRegex)) {
      if (m[1]) {
        let thoughtContent = m[1].trim();
        if (settings.gemmaTrimThinkingSpaces) {
          thoughtContent = thoughtContent.split('\n').map((l: string) => l.trimStart()).join('\n');
        }
        thoughts.push(thoughtContent);
      }
    }
    mainContent = mainContent.replace(thoughtRegex, '').trim();
  }

  const [isThoughtOpen, setIsThoughtOpen] = useState(() => {
    if (settings.collapseThinkingFinished) {
      return !((isLast && isGenerating) && !mainContent);
    }
    return true;
  });

  const hasAutoCollapsed = useRef(false);

  useEffect(() => {
    if (!settings.collapseThinkingFinished) return;
    if (hasAutoCollapsed.current) return;

    if (isLast && isGenerating) {
      // 对于正在生成的最后一条消息，只在 mainContent 首次出现时自动折叠一次
      if (mainContent) {
        hasAutoCollapsed.current = true;
        setIsThoughtOpen(false);
      }
    } else {
      // 对于其他消息，保持原始行为
      if (mainContent || (!isGenerating && !isLast)) {
        setIsThoughtOpen(false);
      }
    }
  }, [mainContent, isGenerating, isLast, settings.collapseThinkingFinished]);

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
      <div className={`max-w-[85%] md:max-w-[75%] flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'} w-full`}>
        {thoughts.map((thought, i) => (
          <div key={`thought-${i}`} className="rounded-xl shadow-sm relative w-full bg-gray-800/40 border border-gray-700/50 overflow-hidden">
            <button onClick={() => setIsThoughtOpen(!isThoughtOpen)} className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800/60 hover:bg-gray-800/80 transition-colors text-xs font-semibold uppercase tracking-wider text-gray-400">
              <div className="flex items-center gap-2">
                <Loader2 size={12} className={isGenerating && isLast ? 'animate-spin text-blue-400' : 'text-gray-500'} />
                Thinking Process
              </div>
              <span className="text-gray-500">{isThoughtOpen ? 'Hide' : 'Show'}</span>
            </button>
            {isThoughtOpen && (
              <div className="px-4 py-3 border-t border-gray-700/30 text-gray-300 text-sm">
                {settings.renderThinkingAsMarkdown ? <MarkdownRenderer content={thought} /> : <pre className="whitespace-pre-wrap font-sans text-sm opacity-80">{thought}</pre>}
              </div>
            )}
          </div>
        ))}
        {mainContent && (
          <div className={`rounded-2xl px-6 py-4 shadow-sm relative w-full ${isUser ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-100 border border-gray-700'}`}>
            <button onClick={() => msg.id && onCopy(msg.id, msg.content)} className={`absolute top-2 ${isUser ? '-left-10' : '-right-10'} p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity`} title="Copy">
              {copiedId === msg.id ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
            </button>
            <MarkdownRenderer content={mainContent} />
          </div>
        )}
        <div className="flex items-center gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity px-2 select-none">
          <span className="text-[10px] text-gray-500">{new Date(msg.createdAt).toLocaleString()}</span>
          {!isGenerating && onRetry && (
            <button onClick={() => msg.id && onRetry(msg.id)} className="text-[10px] text-gray-400 hover:text-blue-400 flex items-center gap-1 transition-colors">
              <RefreshCcw size={10} /> Retry
            </button>
          )}
          {!isGenerating && !isUser && onRegenerate && (
            <button onClick={() => msg.id && onRegenerate(msg.id)} className="text-[10px] text-gray-400 hover:text-blue-400 flex items-center gap-1 transition-colors">
              <RefreshCcw size={10} /> Regenerate
            </button>
          )}
          {!isGenerating && isLast && !isUser && onContinue && (
            <button onClick={onContinue} className="text-[10px] text-gray-400 hover:text-blue-400 flex items-center gap-1 transition-colors">
              <Play size={10} /> Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const estimateTokens = (text: string) => {
  if (!text) return 0;
  let ascii = 0, nonAscii = 0;
  for (let i = 0; i < text.length; i++) text.charCodeAt(i) <= 127 ? ascii++ : nonAscii++;
  return Math.ceil(ascii / 4 + nonAscii * 0.8);
};

const DRAFT_STORAGE_KEY = 'chat_drafts';

const saveDraft = (sessionId: string, content: string) => {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || '{}');
    drafts[sessionId] = { content, timestamp: Date.now() };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  } catch { /* ignore storage errors */ }
};

const loadDraft = (sessionId: string): string => {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || '{}');
    const draft = drafts[sessionId];
    // Draft expires after 7 days
    if (draft && Date.now() - draft.timestamp < 7 * 24 * 60 * 60 * 1000) {
      return draft.content || '';
    }
  } catch { /* ignore storage errors */ }
  return '';
};

const clearDraft = (sessionId: string) => {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || '{}');
    delete drafts[sessionId];
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
  } catch { /* ignore storage errors */ }
};

export const ChatArea: React.FC<ChatAreaProps> = ({ session, onSendMessage, isGenerating, settings, onStop, onRetry, onContinue, onRegenerate, onGenerationEnd, onSessionTitleUpdate, error, onClearError }) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const draftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInputRef = useRef<string>('');

  // Load draft on session change
  useEffect(() => {
    if (session) {
      const draft = loadDraft(session.id);
      setInput(draft);
      lastInputRef.current = draft;
      // Reset textarea height
      const textarea = document.getElementById('chat-input') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 256)}px`;
      }
    }
  }, [session?.id]);

  // Auto-save draft with debounce (500ms) - only save when composition is finished
  const handleInputChange = (value: string) => {
    setInput(value);

    if (draftTimeoutRef.current) {
      clearTimeout(draftTimeoutRef.current);
    }

    draftTimeoutRef.current = setTimeout(() => {
      if (session && value !== lastInputRef.current) {
        saveDraft(session.id, value);
        lastInputRef.current = value;
      }
    }, 500);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!session) { setStreamingContent(''); return; }
    if (!isGenerating) { setStreamingContent(''); return; }

    const unsubscribe = api.subscribeGeneration(session.id, {
      onDelta: (content) => setStreamingContent(content),
      onDone: () => {
        onGenerationEnd?.(session.id);
      },
      onError: () => {
        onGenerationEnd?.(session.id);
      },
      onStopped: () => {
        onGenerationEnd?.(session.id);
      },
      onTitle: (title) => {
        onSessionTitleUpdate?.(session.id, title);
      },
    });

    return unsubscribe;
  }, [session?.id, isGenerating]);

  // Throttled scroll to reduce layout calculations during rapid streaming
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (settings.autoScroll === false) return;
    
    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // Throttle scroll to max 10 times per second
    scrollTimeoutRef.current = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
    
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [session?.messages.length, streamingContent?.length, isGenerating, settings.autoScroll]);

  const handleSend = () => {
    if (input.trim() && !isGenerating) {
      onSendMessage(input);
      if (session) clearDraft(session.id);
      setInput('');
      lastInputRef.current = '';
      const textarea = document.getElementById('chat-input') as HTMLTextAreaElement;
      if (textarea) textarea.style.height = 'auto';
    }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = () => {
    if (!session) return;
    let text = `# ${session.title}\n\n`;
    session.messages.forEach(msg => { text += `### ${msg.role === 'user' ? 'User' : 'AI'}\n${msg.content}\n\n`; });
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `${session.title.replace(/[^a-z0-9]/gi, '_')}_export.md` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4"><Send size={24} className="text-gray-600" /></div>
          <p className="text-lg font-medium text-gray-400">Select a chat or start a new one</p>
        </div>
      </div>
    );
  }

  const displayMessages = [...session.messages];
  const lastMsg = session.messages.length > 0 ? session.messages[session.messages.length - 1] : null;
  let isStreamSaved = false;
  if (lastMsg && lastMsg.role === 'model' && streamingContent) {
    const normalizedSaved = lastMsg.content.replace(/<details>/g, '<details open>');
    const normalizedStream = streamingContent.replace(/<details>/g, '<details open>');
    isStreamSaved = normalizedSaved.includes(normalizedStream.substring(0, Math.min(normalizedStream.length, 500)));
  }
  if (isGenerating && streamingContent && !isStreamSaved) {
    displayMessages.push({
      id: '__streaming__',
      role: 'model',
      content: streamingContent,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <div className="flex-1 flex flex-col h-full relative bg-gray-900">
      <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/95 backdrop-blur z-10">
        <h2 className="text-lg font-medium text-gray-200 truncate">{session.title}</h2>
        <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors">
          <Download size={16} /><span>Export</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
        {error && (
          <div className="max-w-4xl mx-auto">
            <div className="rounded-xl px-4 py-3 bg-red-900/30 border border-red-700/50 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-200">{error}</p>
              </div>
              {onClearError && (
                <button onClick={onClearError} className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/50 rounded shrink-0">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}
        {displayMessages.map((msg, idx) => (
          <MessageItem
            key={msg.id || idx}
            msg={msg}
            isLast={idx === displayMessages.length - 1}
            isGenerating={isGenerating && idx === displayMessages.length - 1}
            settings={settings}
            onCopy={handleCopy}
            copiedId={copiedId}
            onRetry={onRetry}
            onContinue={onContinue}
            onRegenerate={onRegenerate}
          />
        ))}
        {isGenerating && !streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] md:max-w-[75%] rounded-2xl px-6 py-4 bg-gray-800 text-gray-100 border border-gray-700 flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-blue-400" />
              <span className="text-gray-400 text-sm font-medium">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      <div className="p-4 bg-gray-900 border-t border-gray-800">
        <div className="max-w-4xl mx-auto relative flex items-end gap-3 bg-gray-800 rounded-xl border border-gray-700 focus-within:border-gray-500 transition-colors p-2 shadow-lg">
          <textarea
            id="chat-input"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Type a message... (Ctrl+Enter to send, Enter/Shift+Enter for newline)"
            className="flex-1 bg-transparent text-white resize-none max-h-64 min-h-[44px] p-3 focus:outline-none placeholder-gray-500"
            rows={1}
            style={{ height: 'auto' }}
            onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 256)}px`; }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          {isGenerating ? (
            <button onClick={onStop} className="p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shrink-0 mb-0.5 shadow-sm">
              <SquareTerminal size={20} />
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim()} className="p-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl transition-colors shrink-0 mb-0.5 shadow-sm">
              <Send size={20} />
            </button>
          )}
        </div>
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 mt-2 px-1 text-center sm:text-left">
          <span className="text-xs text-gray-500">AI can make mistakes. Verify important information.</span>
          {input.length > 0 && <span className="text-xs text-gray-500 font-mono">Est. Tokens: <span className="text-blue-400 font-medium">{estimateTokens(input)}</span> (~{input.length} chars)</span>}
        </div>
      </div>
    </div>
  );
};
