```typescript
import React, { useState, useRef, useEffect } from 'react';
import { ChatSession, ChatMessage, UserSettings, Template } from '../types';
import { api } from '../lib/api';
import { Send, Loader2, Copy, Check, Download, RefreshCcw, Play, SquareTerminal, AlertCircle, X, ChevronDown, Bot, Sparkles, FileText, Eye, Printer, Edit, Trash2, ArrowUp, ArrowDown, Plus } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatAreaProps {
  session?: ChatSession;
  onSendMessage: (content: string) => void;
  isGenerating: boolean;
  isStopping?: boolean;
  settings: UserSettings;
  templates: Template[];
  onStop?: () => void;
  onRetry?: (msgId: string) => void;
  onContinue?: () => void;
  onRegenerate?: (msgId: string) => void;
  onGenerationEnd?: (sessionId: string) => void;
  onSelectModel?: (modelId: string) => void;
  onSelectCharacter?: (characterId: string) => void;
  onUpdateSessionCharacter?: (characterId: string) => void;
  onUpdateSession?: (sessionId: string, updates: Partial<ChatSession>) => Promise<void>;
  error?: string | null;
  onClearError?: () => void;
  onError?: (message: string) => void;
}

interface EditBlock {
  id: string;
  type: 'input' | 'thinking' | 'output';
  content: string;
  originalMessageId?: string;
  originalCreatedAt?: string;
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

function normalizeSearchString(str: string): string {
  return str.toLowerCase().replace(/[\s\-,，_.]/g, '');
}

function isModelMatch(modelName: string, modelId: string, query: string): boolean {
  if (!query) {
    return true;
  }
  const normalizedQuery = normalizeSearchString(query);
  const normalizedName = normalizeSearchString(modelName);
  const normalizedId = normalizeSearchString(modelId);
  if (normalizedName.includes(normalizedQuery)) {
    return true;
  }
  if (normalizedId.includes(normalizedQuery)) {
    return true;
  }
  return false;
}

export function parseMessageContent(
  content: string,
  isUser: boolean,
  settings: UserSettings
): { thoughts: string[]; mainContent: string } {
  let thoughts: string[] = [];
  let mainContent = content;

  if (isUser) {
    return { thoughts, mainContent };
  }

  // First, try to detect non-standard thinking format and convert for display
  const converted = convertNonStandardThinkingForDisplay(content);
  if (converted.thoughts.length > 0) {
    thoughts = converted.thoughts;
    mainContent = converted.mainContent;
  } else {
    // Standard format: parse existing <think> blocks
    const thoughtRegex = /<think>(?:\r?\n)?([\s\S]*?)(?:(?:\r?\n)?<\/think>(?:\r?\n)*|$)/g;
    for (const m of content.matchAll(thoughtRegex)) {
      if (m[1]) {
        let thoughtContent = m[1].trim();
        if (settings.trimThinkingSpaces) {
          thoughtContent = thoughtContent.split('\n').map((l: string) => l.trimStart()).join('\n');
        }
        thoughts.push(thoughtContent);
      }
    }
    mainContent = mainContent.replace(thoughtRegex, '').trim();
  }

  return { thoughts, mainContent };
}

const MessageItem = ({ msg, isLast, isGenerating, settings, onCopy, copiedId, onRetry, onContinue, onRegenerate, onView }: {
  msg: any; isLast: boolean; isGenerating: boolean; settings: UserSettings;
  onCopy: (id: string, content: string, htmlContent?: string) => void; copiedId: string | null;
  onRetry?: (msgId: string) => void; onContinue?: () => void; onRegenerate?: (msgId: string) => void;
  onView: () => void;
}) => {
  const isUser = msg.role === 'user';

  const parsed = parseMessageContent(msg.content, isUser, settings);
  const thoughts = parsed.thoughts;
  const mainContent = parsed.mainContent;

  const contentRef = useRef<HTMLDivElement>(null);

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

  const alignClass = isUser ? 'justify-end' : 'justify-start';
  const itemsAlignClass = isUser ? 'items-end' : 'items-start';
  const copyIcon = copiedId === msg.id ? <Check size={16} className="text-green-400" /> : <Copy size={16} />;

  let sideOffset = 'sm:left-auto sm:-right-10';
  if (isUser) {
    sideOffset = 'sm:right-auto sm:-left-10';
  }

  const actionPositionClass = `absolute top-2 right-2 ${sideOffset} flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-within:opacity-100 transition-opacity z-10`;

  const backgroundClass = isUser ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-100 border border-gray-700';

  const isCurrentlyStreaming = isGenerating && isLast;

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
              {!isCurrentlyStreaming && (
                <button
                  onClick={onView}
                  className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer"
                  title="查看"
                  aria-label="查看"
                >
                  <Eye size={16} />
                </button>
              )}
              <button
                onClick={() => {
                  if (msg.id) {
                    const htmlContent = contentRef.current?.innerHTML || '';
                    onCopy(msg.id, mainContent, htmlContent);
                  }
                }}
                className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer"
                title="Copy"
                aria-label="复制消息"
              >
                {copyIcon}
              </button>
            </div>
            <div ref={contentRef}>
              <MarkdownRenderer content={mainContent} />
            </div>
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

const parseMessagesToBlocks = (messages: ChatMessage[], settings: UserSettings): EditBlock[] => {
  const blocks: EditBlock[] = [];
  messages.forEach(msg => {
    if (msg.role === 'user') {
      blocks.push({
        id: crypto.randomUUID(),
        type: 'input',
        content: msg.content,
        originalMessageId: msg.id,
        originalCreatedAt: msg.createdAt,
      });
    } else {
      const converted = convertNonStandardThinkingForDisplay(msg.content);
      let content = msg.content;
      if (converted.thoughts.length > 0) {
        content = `<think>\n${converted.thoughts.join('\n')}\n</think>\n\n${converted.mainContent}`;
      }

      const thinkRegex = /<think>(?:\r?\n)?([\s\S]*?)(?:(?:\r?\n)?<\/think>(?:\r?\n)*|$)/g;
      let lastIndex = 0;
      let match;
      while ((match = thinkRegex.exec(content)) !== null) {
        let textBefore = content.substring(lastIndex, match.index).trim();
        textBefore = textBefore.replace(/<!--\s*block:thinking\s*-->/g, '').trim();
        if (textBefore) {
          const outputSubBlocks = textBefore.split(/<!--\s*block:output\s*-->/);
          outputSubBlocks.forEach(sub => {
            const trimmed = sub.trim();
            if (trimmed) {
              blocks.push({
                id: crypto.randomUUID(),
                type: 'output',
                content: trimmed,
                originalMessageId: msg.id,
                originalCreatedAt: msg.createdAt,
              });
            }
          });
        }
        let thought = match[1].trim();
        if (settings.trimThinkingSpaces) {
          thought = thought.split('\n').map((l: string) => l.trimStart()).join('\n');
        }
        if (thought) {
          blocks.push({
            id: crypto.randomUUID(),
            type: 'thinking',
            content: thought,
            originalMessageId: msg.id,
            originalCreatedAt: msg.createdAt,
          });
        }
        lastIndex = thinkRegex.lastIndex;
      }
      let textAfter = content.substring(lastIndex).trim();
      textAfter = textAfter.replace(/<!--\s*block:thinking\s*-->/g, '').trim();
      if (textAfter) {
        const outputSubBlocks = textAfter.split(/<!--\s*block:output\s*-->/);
        outputSubBlocks.forEach(sub => {
          const trimmed = sub.trim();
          if (trimmed) {
            blocks.push({
              id: crypto.randomUUID(),
              type: 'output',
              content: trimmed,
              originalMessageId: msg.id,
              originalCreatedAt: msg.createdAt,
            });
          }
        });
      }
    }
  });
  return blocks;
};

const compileBlocksToMessages = (blocks: EditBlock[]): ChatMessage[] => {
  const messages: ChatMessage[] = [];
  let currentModelBlocks: EditBlock[] = [];
  const usedIds = new Set<string>();

  const flushModelBlocks = () => {
    if (currentModelBlocks.length === 0) return;
    const contentParts: string[] = [];
    let lastType: 'thinking' | 'output' | null = null;

    currentModelBlocks.forEach(b => {
      if (b.type === 'thinking') {
        if (lastType === 'thinking') {
          contentParts.push('<!-- block:thinking -->');
        }
        contentParts.push(`<think>\n${b.content.trim()}\n</think>`);
        lastType = 'thinking';
      } else if (b.type === 'output') {
        if (lastType === 'output') {
          contentParts.push('<!-- block:output -->');
        }
        contentParts.push(b.content.trim());
        lastType = 'output';
      }
    });

    // Resolve model message's id and createdAt:
    // If we have blocks with originalMessageId/originalCreatedAt, preserve them,
    // as long as the ID hasn't been consumed yet in this save session.
    const originalBlockWithMetadata = currentModelBlocks.find(b => b.originalMessageId && !usedIds.has(b.originalMessageId));
    const id = originalBlockWithMetadata?.originalMessageId || crypto.randomUUID();
    usedIds.add(id);

    const createdAt = originalBlockWithMetadata?.originalCreatedAt || new Date().toISOString();

    messages.push({
      id,
      role: 'model',
      content: contentParts.join('\n\n').trim(),
      createdAt,
    });
    currentModelBlocks = [];
  };

  blocks.forEach(block => {
    if (block.type === 'input') {
      flushModelBlocks();
      let id = block.originalMessageId || crypto.randomUUID();
      if (usedIds.has(id)) {
        id = crypto.randomUUID();
      }
      usedIds.add(id);

      messages.push({
        id,
        role: 'user',
        content: block.content,
        createdAt: block.originalCreatedAt || new Date().toISOString(),
      });
    } else {
      currentModelBlocks.push(block);
    }
  });
  flushModelBlocks();

  return messages;
};

export const ChatArea: React.FC<ChatAreaProps> = ({ session, onSendMessage, isGenerating, isStopping, settings, templates, onStop, onRetry, onContinue, onRegenerate, onGenerationEnd, onSelectModel, onSelectCharacter, onUpdateSessionCharacter, onUpdateSession, error, onClearError, onError }) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [viewingContent, setViewingContent] = useState<{ userContent?: string; modelContent: string } | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editBlocks, setEditBlocks] = useState<EditBlock[]>([]);
  const [editModalError, setEditModalError] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const draftTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInputRef = useRef<string>('');
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [characterDropdownOpen, setCharacterDropdownOpen] = useState(false);
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [headerCharacterDropdownOpen, setHeaderCharacterDropdownOpen] = useState(false);
  const headerCharacterDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const modelToggleBtnRef = useRef<HTMLButtonElement>(null);
  const characterDropdownRef = useRef<HTMLDivElement>(null);
  const templateDropdownRef = useRef<HTMLDivElement>(null);
  const activeModelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!modelDropdownOpen) {
      setModelSearchQuery('');
    } else {
      // const timer = setTimeout(() => {
      activeModelRef.current?.scrollIntoView({ block: 'nearest' });
      // }, 50);
      // return () => clearTimeout(timer);
    }
  }, [modelDropdownOpen]);

  // Clear streaming content on session change
  useEffect(() => {
    setStreamingContent('');
  }, [session?.id]);

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

  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const chatContainer = document.getElementById('chat-scroll-container');
    if (viewingContent) {
      lastActiveElementRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      if (chatContainer) {
        chatContainer.style.overflowY = 'hidden';
      }
      const closeBtn = document.getElementById('viewing-close-btn');
      if (closeBtn) {
        closeBtn.focus();
      }
    } else {
      document.body.style.overflow = '';
      if (chatContainer) {
        chatContainer.style.overflowY = 'auto';
      }
      if (lastActiveElementRef.current) {
        lastActiveElementRef.current.focus();
        lastActiveElementRef.current = null;
      }
    }
    return () => {
      document.body.style.overflow = '';
      if (chatContainer) {
        chatContainer.style.overflowY = 'auto';
      }
    };
  }, [viewingContent]);

  const executePrint = (htmlContent: string, sessionId?: string, katexFont?: string, onComplete?: () => void) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
      onComplete?.();
      return;
    }

    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map(el => el.outerHTML)
      .join('\n');

    const fontName = katexFont || 'default';
    const currentFontClass = `katex-font-${fontName}`;

    const printStyles = `
      <style>
        @page {
          margin: 20mm;
        }
        html, body {
          background-color: white !important;
          color: black !important;
          color-scheme: light !important;
        }
        body {
          font-family: "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, system-ui, -apple-system, BlinkMacSystemFont;
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
        .katex .frac-line {
          border-color: black !important;
          color: black !important;
        }
      </style>
    `;

    doc.open();
    doc.write(
      '<!DOCTYPE html>\n' +
      '<html style="color-scheme: light;">\n' +
      '  <head>\n' +
      '    <title>Print Content</title>\n' +
      '    ' + styles + '\n' +
      '    ' + printStyles + '\n' +
      '  </head>\n' +
      '  <body class="' + currentFontClass + '">\n' +
      '    <div class="prose">\n' +
      (sessionId ? '      <h1>Session ID: ' + sessionId + '</h1>\n' : '') +
      '      ' + htmlContent + '\n' +
      '    </div>\n' +
      '  </body>\n' +
      '</html>'
    );
    doc.close();

    let cleanTimeout: ReturnType<typeof setTimeout> | null = null;
    const triggerTimeout = setTimeout(() => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
      cleanTimeout = setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
        onComplete?.();
      }, 1000);
    }, 500);

    return () => {
      clearTimeout(triggerTimeout);
      if (cleanTimeout) {
        clearTimeout(cleanTimeout);
      }
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };
  };

  const handlePrint = () => {
    const printElement = document.getElementById('print-content-render');
    if (!printElement) return;
    executePrint(printElement.innerHTML, session?.id, settings.katexFont);
  };

  useEffect(() => {
    if (!viewingContent) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      } else if (e.key === 'Escape') {
        setViewingContent(null);
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

  const handleCopy = (id: string, content: string, htmlContent?: string) => {
    if (htmlContent && typeof ClipboardItem !== 'undefined' && navigator.clipboard && navigator.clipboard.write) {
      const textBlob = new Blob([content], { type: 'text/plain' });
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const item = new ClipboardItem({
        'text/plain': textBlob,
        'text/html': htmlBlob,
      });
      navigator.clipboard.write([item])
        .then(() => {
          setCopiedId(id);
          setTimeout(() => { setCopiedId(null); }, 2000);
        })
        .catch(() => {
          navigator.clipboard.writeText(content)
            .then(() => {
              setCopiedId(id);
              setTimeout(() => { setCopiedId(null); }, 2000);
            })
            .catch(() => {});
        });
    } else {
      navigator.clipboard.writeText(content)
        .then(() => {
          setCopiedId(id);
          setTimeout(() => { setCopiedId(null); }, 2000);
        })
        .catch(() => {});
    }
  };

  const [isPrintingAll, setIsPrintingAll] = useState(false);

  // Keep references to the latest mutable states to treat effect triggers as snapshots
  const sessionRef = useRef(session);
  const settingsRef = useRef(settings);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!isPrintingAll) return;

    const currentSession = sessionRef.current;
    if (!currentSession) {
      setIsPrintingAll(false);
      return;
    }

    const printElement = document.getElementById('print-all-session-content');
    if (!printElement) {
      setIsPrintingAll(false);
      return;
    }

    return executePrint(
      printElement.innerHTML,
      currentSession.id,
      settingsRef.current.katexFont,
      () => setIsPrintingAll(false)
    );
  }, [isPrintingAll]);

  const handlePrintAll = () => {
    setIsPrintingAll(true);
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

  if (isGenerating && streamingContent) {
    if (lastMsg?.role === 'model') {
      // Continuation mode: update the last message in-place
      displayMessages[displayMessages.length - 1] = {
        ...lastMsg,
        content: streamingContent,
      };
    } else {
      // Normal mode: push a new streaming message
      displayMessages.push({
        id: '__streaming__',
        role: 'model',
        content: streamingContent,
        createdAt: new Date().toISOString(),
      });
    }
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditBlocks(parseMessagesToBlocks(session.messages, settings));
              setEditModalError(null);
              setIsEditModalOpen(true);
            }}
            disabled={isGenerating || isStopping}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer"
          >
            <Edit size={16} /><span>Edit</span>
          </button>
          <button onClick={handlePrintAll} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors cursor-pointer">
            <Printer size={16} /><span>Print</span>
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors cursor-pointer">
            <Download size={16} /><span>Export</span>
          </button>
        </div>
      </div>

      <div id="chat-scroll-container" className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4">
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
            onView={() => {
              const mainContent = parseMessageContent(msg.content, msg.role === 'user', settings).mainContent;
              if (msg.role === 'model') {
                let nearestUserMsg = null;
                for (let i = idx - 1; i >= 0; i--) {
                  if (displayMessages[i].role === 'user') {
                    nearestUserMsg = displayMessages[i];
                    break;
                  }
                }
                if (nearestUserMsg) {
                  const userContent = parseMessageContent(nearestUserMsg.content, true, settings).mainContent;
                  setViewingContent({ userContent, modelContent: mainContent });
                } else {
                  setViewingContent({ modelContent: mainContent });
                }
              } else {
                setViewingContent({ modelContent: mainContent });
              }
            }}
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
              ref={modelToggleBtnRef}
              onClick={() => { setCharacterDropdownOpen(false); setModelDropdownOpen(!modelDropdownOpen); }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700/50 rounded-lg text-xs text-gray-300 transition-colors"
            >
              <Sparkles size={12} className="text-blue-400" />
              <span className="max-w-[120px] truncate">
                {(() => {
                  const m = settings.models.find(x => x.id === settings.activeModelId);
                  if (m) return m.displayName || m.modelId;
                  const tm = (settings.tempModels || []).find(x => x.id === settings.activeModelId);
                  if (tm) return tm.name || tm.modelId;
                  return 'Model';
                })()}
              </span>
              <ChevronDown size={12} className={`transition-transform ${modelDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {modelDropdownOpen && (() => {
              const allFilteredModels = settings.models.filter(m => {
                const match = isModelMatch(m.displayName || '', m.modelId || '', modelSearchQuery);
                return match;
              });

              const allFilteredTempModels = (settings.tempModels || []).filter(tm => {
                const match = isModelMatch(tm.name || '', tm.modelId || '', modelSearchQuery);
                return match;
              });

              const hasAnyMatches = allFilteredModels.length > 0 || allFilteredTempModels.length > 0;

              return (
                <div className="absolute bottom-full mb-1 left-0 z-50 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-72 overflow-auto flex flex-col">
                  {/* Sticky Search Bar */}
                  <div className="p-2 border-b border-gray-700 sticky top-0 bg-gray-800 z-10">
                    <input
                      type="text"
                      placeholder="搜索模型..."
                      value={modelSearchQuery}
                      onChange={(e) => setModelSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setModelDropdownOpen(false);
                          modelToggleBtnRef.current?.focus();
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (allFilteredModels.length > 0) {
                            const firstModel = allFilteredModels[0];
                            onSelectModel?.(firstModel.id);
                            setModelDropdownOpen(false);
                            modelToggleBtnRef.current?.focus();
                          } else if (allFilteredTempModels.length > 0) {
                            const firstTemp = allFilteredTempModels[0];
                            onSelectModel?.(firstTemp.id);
                            setModelDropdownOpen(false);
                            modelToggleBtnRef.current?.focus();
                          }
                        }
                      }}
                      className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                  </div>

                  {/* Scrollable list content */}
                  <div className="flex-1 overflow-y-auto">
                    {!hasAnyMatches && (
                      <div className="px-3 py-4 text-center text-xs text-gray-500">
                        No matching models
                      </div>
                    )}

                    {allFilteredModels.length > 0 && settings.providers.map(provider => {
                      const providerModels = allFilteredModels.filter(m => m.providerId === provider.id);
                      if (providerModels.length === 0) {
                        return null;
                      }
                      return (
                        <div key={provider.id} className="border-b border-gray-700/50 last:border-b-0">
                          <div className="px-2.5 py-1.5 bg-gray-800/80 sticky top-0 z-10">
                            <span className="text-[10px] font-medium text-gray-400">{provider.name}</span>
                          </div>
                          {providerModels.map(m => {
                            const isActive = m.id === settings.activeModelId;
                            let buttonClass = 'w-full px-2.5 py-1.5 text-left text-xs hover:bg-gray-700/50 transition-colors truncate ';
                            if (isActive) {
                              buttonClass += 'text-blue-300 bg-blue-600/10';
                            } else {
                              buttonClass += 'text-gray-300';
                            }

                            return (
                              <button
                                key={m.id}
                                ref={isActive ? activeModelRef : undefined}
                                onClick={() => { onSelectModel?.(m.id); setModelDropdownOpen(false); }}
                                className={buttonClass}
                              >
                                {m.displayName || m.modelId}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}

                    {allFilteredTempModels.length > 0 && (
                      <div className="border-b border-gray-700/50 last:border-b-0">
                        <div className="px-2.5 py-1.5 bg-gray-800/80 sticky top-0 z-10 flex items-center justify-between">
                          <span className="text-[10px] font-medium text-purple-400">临时模型</span>
                        </div>
                        {allFilteredTempModels.map(tm => {
                          const isActive = tm.id === settings.activeModelId;
                          let buttonClass = 'w-full px-2.5 py-1.5 text-left text-xs hover:bg-gray-700/50 transition-colors truncate ';
                          if (isActive) {
                            buttonClass += 'text-purple-300 bg-purple-600/10';
                          } else {
                            buttonClass += 'text-gray-300';
                          }

                          return (
                            <button
                              key={tm.id}
                              ref={isActive ? activeModelRef : undefined}
                              onClick={() => { onSelectModel?.(tm.id); setModelDropdownOpen(false); }}
                              className={buttonClass}
                            >
                              {tm.name || tm.modelId}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
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
                {templates.length === 0 && (
                  <div className="px-2.5 py-2 text-xs text-gray-500">No templates configured</div>
                )}
                {templates.map((t) => (
                  <button
                    key={t.id}
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
        <div
          className="fixed inset-0 z-50 bg-gray-950 overflow-y-auto flex flex-col p-6 sm:p-12"
          role="dialog"
          aria-modal="true"
          aria-labelledby="viewing-content-title"
        >
          <div className="max-w-[90%] 2xl:max-w-7xl mx-auto w-full flex justify-between items-center mb-6 pb-4 border-b border-gray-800">
            <h3 id="viewing-content-title" className="text-lg font-semibold text-gray-300">Markdown 渲染结果</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg transition-colors text-sm font-medium cursor-pointer"
                title="打印 (Ctrl+P)"
                aria-label="打印渲染结果"
              >
                <Printer size={16} />
                <span>打印</span>
              </button>
              <button
                id="viewing-close-btn"
                onClick={() => setViewingContent(null)}
                className="flex items-center gap-2 px-4 py-2 bg-red-950/40 hover:bg-red-900/40 text-red-200 border border-red-900/30 focus:outline-none focus:ring-2 focus:ring-red-500 rounded-lg transition-colors text-sm font-medium cursor-pointer"
                title="关闭"
                aria-label="关闭预览"
              >
                <X size={16} />
                <span>关闭</span>
              </button>
            </div>
          </div>

          <div id="print-content" className="max-w-[90%] 2xl:max-w-7xl mx-auto w-full flex-1 bg-gray-900 text-gray-100 rounded-xl shadow-xl p-8 sm:p-12 border border-gray-800 mb-8 overflow-x-auto">
            <div id="print-content-render" className="prose prose-invert prose-lg md:prose-xl max-w-none space-y-8">
              {viewingContent.userContent && (
                <div className="border-b border-gray-800/80 pb-8">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-400 mb-4 select-none">问题 (Question)</h4>
                  <MarkdownRenderer content={viewingContent.userContent} />
                </div>
              )}
              <div>
                {viewingContent.userContent && (
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-green-400 mb-4 select-none">回答 (Answer)</h4>
                )}
                <MarkdownRenderer content={viewingContent.modelContent} />
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-gray-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-200 flex items-center gap-2">
                <Edit size={18} className="text-blue-400" />
                <span>编辑对话</span>
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {editModalError && (
              <div className="mx-6 mt-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg flex items-center gap-3">
                <AlertCircle size={18} className="text-red-400 shrink-0" />
                <span className="text-sm text-red-200">{editModalError}</span>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {editBlocks.length === 0 ? (
                <div className="text-center py-12 text-gray-500">暂无内容，请添加块</div>
              ) : (
                editBlocks.map((block, index) => {
                  // Helper function to resolve block container class names
                  const getBlockContainerClass = (type: 'input' | 'thinking' | 'output') => {
                    if (type === 'input') {
                      return 'bg-blue-950/20 border-blue-900/40';
                    }
                    if (type === 'thinking') {
                      return 'bg-amber-950/10 border-amber-900/30';
                    }
                    return 'bg-gray-800/40 border-gray-700/50';
                  };

                  // Helper function to resolve select element class names
                  const getSelectClass = (type: 'input' | 'thinking' | 'output') => {
                    if (type === 'input') {
                      return 'bg-blue-600/20 text-blue-300';
                    }
                    if (type === 'thinking') {
                      return 'bg-amber-600/20 text-amber-300';
                    }
                    return 'bg-green-600/20 text-green-300';
                  };

                  // Helper function to resolve textarea placeholder
                  const getTextareaPlaceholder = (type: 'input' | 'thinking' | 'output') => {
                    if (type === 'input') {
                      return '输入用户输入内容...';
                    }
                    if (type === 'thinking') {
                      return '输入思考过程内容...';
                    }
                    return '输入模型输出内容...';
                  };

                  return (
                    <div
                      key={block.id}
                      className={`p-4 rounded-lg border flex flex-col gap-3 transition-colors ${getBlockContainerClass(
                        block.type
                      )}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <select
                            value={block.type}
                            onChange={(e) => {
                              const newType = e.target.value as 'input' | 'thinking' | 'output';
                              setEditBlocks(prev =>
                              prev.map(b => (b.id === block.id ? { ...b, type: newType, originalMessageId: undefined, originalCreatedAt: undefined } : b))
                              );
                            }}
                            className={`px-2 py-1 rounded text-xs font-semibold focus:outline-none cursor-pointer ${getSelectClass(
                              block.type
                            )}`}
                          >
                            <option value="input" className="bg-gray-900 text-gray-100">输入</option>
                            <option value="thinking" className="bg-gray-900 text-gray-100">思考</option>
                            <option value="output" className="bg-gray-900 text-gray-100">输出</option>
                          </select>
                          <span className="text-xs text-gray-500 font-mono">Block #{index + 1}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              if (index === 0) return;
                              setEditBlocks(prev => {
                                const next = [...prev];
                                const temp = next[index];
                                next[index] = next[index - 1];
                                next[index - 1] = temp;
                                return next;
                              });
                            }}
                            disabled={index === 0}
                            className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent rounded transition-colors"
                            title="上移"
                          >
                            <ArrowUp size={16} />
                          </button>
                          <button
                            onClick={() => {
                              if (index === editBlocks.length - 1) return;
                              setEditBlocks(prev => {
                                const next = [...prev];
                                const temp = next[index];
                                next[index] = next[index + 1];
                                next[index + 1] = temp;
                                return next;
                              });
                            }}
                            disabled={index === editBlocks.length - 1}
                            className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent rounded transition-colors"
                            title="下移"
                          >
                            <ArrowDown size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setEditBlocks(prev => prev.filter(b => b.id !== block.id));
                            }}
                            className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors"
                            title="删除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <textarea
                        value={block.content}
                        onChange={(e) => {
                          const newContent = e.target.value;
                          setEditBlocks(prev =>
                            prev.map(b => (b.id === block.id ? { ...b, content: newContent } : b))
                          );
                        }}
                        placeholder={getTextareaPlaceholder(block.type)}
                        className="w-full bg-gray-950/60 border border-gray-800 focus:border-gray-700 rounded-lg p-3 text-sm text-gray-200 placeholder-gray-600 focus:outline-none resize-y min-h-[160px]"
                        rows={6}
                      />
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 border-t border-gray-800 bg-gray-900/50 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setEditBlocks(prev => [
                      ...prev,
                      { id: crypto.randomUUID(), type: 'input', content: '' },
                    ]);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>添加输入</span>
                </button>
                <button
                  onClick={() => {
                    setEditBlocks(prev => [
                      ...prev,
                      { id: crypto.randomUUID(), type: 'thinking', content: '' },
                    ]);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/10 hover:bg-amber-600/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>添加思考</span>
                </button>
                <button
                  onClick={() => {
                    setEditBlocks(prev => [
                      ...prev,
                      { id: crypto.randomUUID(), type: 'output', content: '' },
                    ]);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/10 hover:bg-green-600/20 text-green-300 border border-green-500/30 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>添加输出</span>
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    if (onUpdateSession) {
                      setIsSavingEdit(true);
                      setEditModalError(null);
                      try {
                        const compiled = compileBlocksToMessages(editBlocks);
                        await onUpdateSession(session.id, { messages: compiled });
                        setIsEditModalOpen(false);
                      } catch (err: any) {
                        setEditModalError(err.message || '保存失败，请重试');
                      } finally {
                        setIsSavingEdit(false);
                      }
                    } else {
                      setIsEditModalOpen(false);
                    }
                  }}
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  {isSavingEdit && <Loader2 size={16} className="animate-spin" />}
                  <span>保存</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden container for printing all messages of the session */}
      {isPrintingAll && session && (
        <div id="print-all-session-content" className="hidden">
          <div className="prose prose-invert prose-lg md:prose-xl max-w-none space-y-8">
            {displayMessages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const titleText = isUser ? '问题 (Question)' : '回答 (Answer)';
              const titleColorClass = isUser ? 'text-blue-400' : 'text-green-400';
              const parsed = parseMessageContent(msg.content, isUser, settings);

              return (
                <div key={msg.id || idx} className="border-b border-gray-800/80 pb-8 last:border-0">
                  <h4 className={`text-xs font-semibold uppercase tracking-wider ${titleColorClass} mb-4 select-none`}>
                    {titleText}
                  </h4>
                  <MarkdownRenderer content={parsed.mainContent} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

```