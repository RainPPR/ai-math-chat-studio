import React, { useState, useRef, useEffect } from 'react';
import { ChatSession, UserSettings } from '../types';
import { api } from '../lib/api';
import { Send, Loader2, Copy, Check, Download, RefreshCcw, Play, SquareTerminal, AlertCircle, X, ChevronDown, Bot, Sparkles, FileText, Eye, Printer } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatAreaProps {
  session?: ChatSession;
  onSendMessage: (content: string) => void;
  isGenerating: boolean;
  isStopping?: boolean;
  settings: UserSettings;
  onStop?: () => void;
  onRetry?: (msgId: string) => void;
  onContinue?: () => void;
  onRegenerate?: (msgId: string) => void;
  onGenerationEnd?: (sessionId: string) => void;
  onSelectModel?: (modelId: string) => void;
  onSelectCharacter?: (characterId: string) => void;
  onUpdateSessionCharacter?: (characterId: string) => void;
  error?: string | null;
  onClearError?: () => void;
  onError?: (message: string) => void;
}

/**
 * Detect and convert non-standard thinking format to standard format for display.
 * Non-standard: Thinking...\n> line1\n> line2\n...\ncontent
 * Standard: <think>\nline1\nline2\n...\n</think>\n\ncontent
 */
function convertNonStandardThinkingForDisplay(content: string): { thoughts: string[]; mainContent: string } {
  const lines = content.split(/\r?\n/);

  // Check if first line is exactly "Thinking..."
  if (lines[0]?.trim() !== 'Thinking...') {
    return { thoughts: [], mainContent: content };
  }

  const thinkingLines: string[] = [];
  let mainContentStartIndex = -1;

  // Start from index 1 (after "Thinking...")
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Skip empty lines in thinking section (they're part of thinking)
    if (line.trim() === '') {
      thinkingLines.push('');
      continue;
    }
    const quotedMatch = /^\s*>\s*(.*)$/.exec(line);
    if (quotedMatch) {
      thinkingLines.push(quotedMatch[1]);
    } else {
      mainContentStartIndex = i;
      break;
    }
  }

  // If no thinking lines found, return as-is
  if (thinkingLines.length === 0) {
    return { thoughts: [], mainContent: content };
  }

  const mainContent = mainContentStartIndex >= 0
    ? lines.slice(mainContentStartIndex).join('\n').trimStart()
    : '';

  return { thoughts: [thinkingLines.join('\n')], mainContent };
}

const MessageItem = ({ msg, isLast, isGenerating, settings, onCopy, copiedId, onRetry, onContinue, onRegenerate, onView }: {
  msg: any; isLast: boolean; isGenerating: boolean; settings: UserSettings;
  onCopy: (id: string, content: string) => void; copiedId: string | null;
  onRetry?: (msgId: string) => void; onContinue?: () => void; onRegenerate?: (msgId: string) => void;
  onView: (content: string) => void;
}) => {
  const isUser = msg.role === 'user';
  let thoughts: string[] = [];
  let mainContent = msg.content;

  if (!isUser) {
    // First, try to detect non-standard thinking format and convert for display
    const converted = convertNonStandardThinkingForDisplay(msg.content);
    if (converted.thoughts.length > 0) {
      thoughts = converted.thoughts;
      mainContent = converted.mainContent;
    } else {
      // Standard format: parse existing <think> blocks
      const thoughtRegex = /<think>(?:\r?\n)?([\s\S]*?)(?:(?:\r?\n)?<\/think>(?:\r?\n)*|$)/g;
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

  let alignClass = 'justify-start';
  if (isUser) {
    alignClass = 'justify-end';
  }

  let itemsAlignClass = 'items-start';
  if (isUser) {
    itemsAlignClass = 'items-end';
  }

  let copyIcon = <Copy size={16} />;
  if (copiedId === msg.id) {
    copyIcon = <Check size={16} className="text-green-400" />;
  }

  let actionPositionClass = 'absolute top-2 -right-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity';
  if (isUser) {
    actionPositionClass = 'absolute top-2 -left-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity';
  }

  let backgroundClass = 'bg-gray-800 text-gray-100 border border-gray-700';
  if (isUser) {
    backgroundClass = 'bg-blue-600 text-white';
  }

  return (
    <div className={`flex ${alignClass} group`}>
      <div className={`max-w-[85%] md:max-w-[75%] flex flex-col gap-2 ${itemsAlignClass} w-full`}>
        {thoughts.map((thought, i) => (
          <div key={`thought-${i}`} className="rounded-xl shadow-sm relative w-full bg-gray-800/40 border border-gray-700/50 overflow-hidden">
            <button onClick={() => { setIsThoughtOpen(!isThoughtOpen); }} className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-800/60 hover:bg-gray-800/80 transition-colors text-xs font-semibold uppercase tracking-wider text-gray-400">
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
          <div className={`rounded-2xl px-6 py-4 shadow-sm relative w-full ${backgroundClass}`}>
            <div className={actionPositionClass}>
              <button
                onClick={() => onView(mainContent)}
                className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors cursor-pointer"
                title="查看"
              >
                <Eye size={16} />
              </button>
              <button
                onClick={() => {
                  if (msg.id) {
                    onCopy(msg.id, msg.content);
                  }
                }}
                className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 transition-colors cursor-pointer"
                title="Copy"
              >
                {copyIcon}
              </button>
            </div>
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
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) <= 127) {
      ascii++;
    } else {
      nonAscii++;
    }
  }
  return Math.ceil(ascii / 4 + nonAscii * 0.8);
};

const DRAFT_STORAGE_KEY = 'chat_drafts';

const PRESET_TEMPLATES = [
  {
    name: '三角形基础',
    content: '在 $\\triangle ABC$ 中，角 $A,B,C$ 所对的边分别为 $a,b,c$，已知 ',
  },
  {
    name: '锐角三角形',
    content: '在锐角 $\\triangle ABC$ 中，角 $A,B,C$ 所对的边分别为 $a,b,c$，已知 ',
  },
];

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

export const ChatArea: React.FC<ChatAreaProps> = ({ session, onSendMessage, isGenerating, isStopping, settings, onStop, onRetry, onContinue, onRegenerate, onGenerationEnd, onSelectModel, onSelectCharacter, onUpdateSessionCharacter, error, onClearError, onError }) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [viewingContent, setViewingContent] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const draftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInputRef = useRef<string>('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [characterDropdownOpen, setCharacterDropdownOpen] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [headerCharacterDropdownOpen, setHeaderCharacterDropdownOpen] = useState(false);
  const headerCharacterDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const characterDropdownRef = useRef<HTMLDivElement>(null);
  const templateDropdownRef = useRef<HTMLDivElement>(null);

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
      onDelta: (content) => { setStreamingContent(content); },
      onDone: () => {
        onGenerationEnd?.(session.id);
      },
      onError: (message) => {
        onError?.(message);
        onGenerationEnd?.(session.id);
      },
      onStopped: () => {
        onGenerationEnd?.(session.id);
      },
    });

    return unsubscribe;
  }, [session?.id, isGenerating]);

  // Throttled scroll to reduce layout calculations during rapid streaming
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!settings.autoScroll) return;
    
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
      if (characterDropdownRef.current && !characterDropdownRef.current.contains(e.target as Node)) {
        setCharacterDropdownOpen(false);
      }
      if (templateDropdownRef.current && !templateDropdownRef.current.contains(e.target as Node)) {
        setTemplateDropdownOpen(false);
      }
      if (headerCharacterDropdownRef.current && !headerCharacterDropdownRef.current.contains(e.target as Node)) {
        setHeaderCharacterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => { document.removeEventListener('mousedown', handleClickOutside); };
  }, []);

  // Lock body scroll when viewing content overlay is active
  useEffect(() => {
    if (viewingContent) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [viewingContent]);

  const handlePrint = () => {
    const printElement = document.getElementById('print-content-render');
    if (!printElement) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML)
      .join('\n');

    const printStyles = `
      <style>
        @media print {
          @page {
            margin: 20mm;
          }
          body {
            background-color: white !important;
            color: black !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            padding: 20px;
            margin: 0;
          }
          .prose-invert {
            color: black !important;
          }
          .prose {
            max-width: none !important;
            color: black !important;
          }
          .prose * {
            color: black !important;
            border-color: #ddd !important;
            background-color: transparent !important;
          }
          .katex {
            text-rendering: auto;
          }
        }
        body {
          background-color: white !important;
          color: black !important;
          padding: 20px;
        }
      </style>
    `;

    doc.open();
    doc.write(
      '<!DOCTYPE html>\n' +
      '<html>\n' +
      '  <head>\n' +
      '    <title>Print Content</title>\n' +
      '    ' + styles + '\n' +
      '    ' + printStyles + '\n' +
      '  </head>\n' +
      '  <body>\n' +
      '    <div class="prose">\n' +
      '      ' + printElement.innerHTML + '\n' +
      '    </div>\n' +
      '  </body>\n' +
      '</html>'
    );
    doc.close();

    setTimeout(() => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1000);
    }, 500);
  };

  // Intercept Ctrl+P / Cmd+P in viewing overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewingContent) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
          e.preventDefault();
          handlePrint();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewingContent]);

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

  const handleTemplateSelect = (content: string) => {
    const newInput = input + content;
    handleInputChange(newInput);
    setTemplateDropdownOpen(false);

    // Adjust textarea height
    setTimeout(() => {
      const textarea = document.getElementById('chat-input') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 256)}px`;
        textarea.focus();
      }
    }, 0);
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => { setCopiedId(null); }, 2000);
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
  if (lastMsg?.role === 'model' && streamingContent) {
    const normalizedSaved = lastMsg.content;
    const normalizedStream = streamingContent;
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
        <div className="flex flex-col min-w-0">
          <h2 className="text-lg font-medium text-gray-200 truncate">{session.title}</h2>
          <div ref={headerCharacterDropdownRef} className="relative">
            <button
              onClick={() => setHeaderCharacterDropdownOpen(!headerCharacterDropdownOpen)}
              className="flex items-center gap-1 px-1.5 py-0.5 hover:bg-gray-800 rounded transition-colors text-xs text-gray-500"
            >
              {(() => {
                const c = settings.characters.find(x => x.id === session.characterId);
                return c ? `(${c.name})` : '(No Character)';
              })()}
              <ChevronDown size={10} className={`transition-transform ${headerCharacterDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {headerCharacterDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-auto">
                <button
                  onClick={() => { onUpdateSessionCharacter?.(''); setHeaderCharacterDropdownOpen(false); }}
                  className={`w-full px-2.5 py-1.5 text-left text-xs hover:bg-gray-700/50 transition-colors truncate ${!session.characterId ? 'text-blue-300 bg-blue-600/10' : 'text-gray-300'}`}
                >
                  None
                </button>
                {settings.characters.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { onUpdateSessionCharacter?.(c.id); setHeaderCharacterDropdownOpen(false); }}
                    className={`w-full px-2.5 py-1.5 text-left text-xs hover:bg-gray-700/50 transition-colors truncate ${c.id === session.characterId ? 'text-blue-300 bg-blue-600/10' : 'text-gray-300'}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
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
            isGenerating={isGenerating && !isStopping && idx === displayMessages.length - 1}
            settings={settings}
            onCopy={handleCopy}
            copiedId={copiedId}
            onRetry={onRetry}
            onContinue={onContinue}
            onRegenerate={onRegenerate}
            onView={(content) => setViewingContent(content)}
          />
        ))}
        {isGenerating && !isStopping && !streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] md:max-w-[75%] rounded-2xl px-6 py-4 bg-gray-800 text-gray-100 border border-gray-700 flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-blue-400" />
              <span className="text-gray-400 text-sm font-medium">Waiting...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      <div className="p-4 bg-gray-900 border-t border-gray-800">
        {/* Floating model & character selector bar */}
        <div className="max-w-4xl mx-auto mb-2 flex items-center gap-2">
          {/* Model Selector */}
          <div ref={modelDropdownRef} className="relative">
            <button
              onClick={() => { setCharacterDropdownOpen(false); setModelDropdownOpen(!modelDropdownOpen); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/50 rounded-lg text-xs text-gray-300 transition-colors"
            >
              <Sparkles size={12} className="text-blue-400" />
              <span className="max-w-[120px] truncate">
                {(() => {
                  const m = settings.models.find(x => x.id === settings.activeModelId);
                  return m?.displayName || m?.modelId || 'Model';
                })()}
              </span>
              <ChevronDown size={12} className={`transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {modelDropdownOpen && (
              <div className="absolute bottom-full mb-1 left-0 z-50 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-72 overflow-auto">
                {settings.providers.map(provider => {
                  const providerModels = settings.models.filter(m => m.providerId === provider.id);
                  if (providerModels.length === 0) return null;
                  return (
                    <div key={provider.id} className="border-b border-gray-700/50 last:border-b-0">
                      <div className="px-2.5 py-1.5 bg-gray-800/80 sticky top-0">
                        <span className="text-[10px] font-medium text-gray-400">{provider.name}</span>
                      </div>
                      {providerModels.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { onSelectModel?.(m.id); setModelDropdownOpen(false); }}
                          className={`w-full px-2.5 py-1.5 text-left text-xs hover:bg-gray-700/50 transition-colors truncate ${m.id === settings.activeModelId ? 'text-blue-300 bg-blue-600/10' : 'text-gray-300'}`}
                        >
                          {m.displayName || m.modelId}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Character Selector */}
          <div ref={characterDropdownRef} className="relative">
            <button
              onClick={() => { setModelDropdownOpen(false); setCharacterDropdownOpen(!characterDropdownOpen); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/50 rounded-lg text-xs text-gray-300 transition-colors"
            >
              <Bot size={12} className="text-green-400" />
              <span className="max-w-[120px] truncate">
                {(() => {
                  const c = settings.characters.find(x => x.id === settings.activeCharacterId);
                  return c?.name || 'Character';
                })()}
              </span>
              <ChevronDown size={12} className={`transition-transform ${characterDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {characterDropdownOpen && (
              <div className="absolute bottom-full mb-1 left-0 z-50 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-auto">
                {settings.characters.length === 0 && (
                  <div className="px-2.5 py-2 text-xs text-gray-500">No characters configured</div>
                )}
                {settings.characters.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { onSelectCharacter?.(c.id); setCharacterDropdownOpen(false); }}
                    className={`w-full px-2.5 py-1.5 text-left text-xs hover:bg-gray-700/50 transition-colors truncate ${c.id === settings.activeCharacterId ? 'text-green-300 bg-green-600/10' : 'text-gray-300'}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Template Selector */}
          <div ref={templateDropdownRef} className="relative">
            <button
              onClick={() => { setModelDropdownOpen(false); setCharacterDropdownOpen(false); setTemplateDropdownOpen(!templateDropdownOpen); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/50 rounded-lg text-xs text-gray-300 transition-colors"
            >
              <FileText size={12} className="text-orange-400" />
              <span className="max-w-[120px] truncate">Templates</span>
              <ChevronDown size={12} className={`transition-transform ${templateDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {templateDropdownOpen && (
              <div className="absolute bottom-full mb-1 left-0 z-50 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-64 overflow-auto">
                {PRESET_TEMPLATES.map((t, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleTemplateSelect(t.content)}
                    className="w-full px-2.5 py-1.5 text-left text-xs hover:bg-gray-700/50 transition-colors truncate text-gray-300"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto relative flex items-end gap-3 bg-gray-800 rounded-xl border border-gray-700 focus-within:border-gray-500 transition-colors p-2 shadow-lg">
          <textarea
            id="chat-input"
            value={input}
            onChange={(e) => { handleInputChange(e.target.value); }}
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
          {isGenerating && !isStopping ? (
            <button onClick={onStop} className="p-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl transition-colors shrink-0 mb-0.5 shadow-sm">
              <SquareTerminal size={20} />
            </button>
          ) : (
            <button onClick={handleSend} disabled={!input.trim() || isStopping} className="p-3.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl transition-colors shrink-0 mb-0.5 shadow-sm">
              <Send size={20} />
            </button>
          )}
        </div>
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 mt-2 px-1 text-center sm:text-left">
          <span className="text-xs text-gray-500">AI can make mistakes. Verify important information.</span>
          {input.length > 0 && <span className="text-xs text-gray-500 font-mono">Est. Tokens: <span className="text-blue-400 font-medium">{estimateTokens(input)}</span> (~{input.length} chars)</span>}
        </div>
      </div>

      {viewingContent && (
        <div className="fixed inset-0 z-50 bg-gray-950 overflow-y-auto flex flex-col p-6 sm:p-12">
          <div className="max-w-4xl mx-auto w-full flex justify-between items-center mb-6 pb-4 border-b border-gray-800">
            <h3 className="text-lg font-semibold text-gray-300">Markdown 渲染结果</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg transition-colors text-sm font-medium cursor-pointer"
                title="打印 (Ctrl+P)"
              >
                <Printer size={16} />
                <span>打印</span>
              </button>
              <button
                onClick={() => setViewingContent(null)}
                className="flex items-center gap-2 px-4 py-2 bg-red-950/40 hover:bg-red-900/40 text-red-200 border border-red-900/30 rounded-lg transition-colors text-sm font-medium cursor-pointer"
                title="关闭"
              >
                <X size={16} />
                <span>关闭</span>
              </button>
            </div>
          </div>

          <div id="print-content" className="max-w-4xl mx-auto w-full flex-1 bg-gray-900 text-gray-100 rounded-xl shadow-xl p-8 sm:p-12 border border-gray-800 mb-8 overflow-x-auto">
            <div id="print-content-render" className="prose prose-invert prose-lg md:prose-xl max-w-none">
              <MarkdownRenderer content={viewingContent} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
