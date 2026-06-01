import React, { useState, useRef, useEffect } from 'react';
import { ChatSession, UserSettings, ToolCallRecord } from '../types';
import { api } from '../lib/api';
import { Send, Loader2, Copy, Check, Download, RefreshCcw, Play, SquareTerminal } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatAreaProps {
  session?: ChatSession;
  onSendMessage: (content: string) => void;
  isGenerating: boolean;
  settings: UserSettings;
  onStop?: () => void;
  onRetry?: (msgId: string) => void;
  onContinue?: () => void;
  onGenerationEnd?: (sessionId: string) => void;
}

const MessageItem = ({ msg, isLast, isGenerating, settings, onCopy, copiedId, onRetry, onContinue }: {
  msg: any; isLast: boolean; isGenerating: boolean; settings: UserSettings;
  onCopy: (id: string, content: string) => void; copiedId: string | null;
  onRetry?: (msgId: string) => void; onContinue?: () => void;
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

  useEffect(() => {
    if (settings.collapseThinkingFinished) {
      if (mainContent || (!isGenerating && !isLast)) setIsThoughtOpen(false);
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

export const ChatArea: React.FC<ChatAreaProps> = ({ session, onSendMessage, isGenerating, settings, onStop, onRetry, onContinue, onGenerationEnd }) => {
  const [input, setInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCallRecord[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) { setStreamingContent(''); setStreamingToolCalls([]); return; }
    if (!isGenerating) { setStreamingContent(''); setStreamingToolCalls([]); return; }

    const unsubscribe = api.subscribeGeneration(session.id, {
      onDelta: (content) => setStreamingContent(content),
      onToolCall: (name, args, result) => {
        setStreamingToolCalls(prev => [...prev, { name, args: JSON.parse(args || '{}'), result }]);
      },
      onDone: () => {
        setStreamingContent('');
        setStreamingToolCalls([]);
        onGenerationEnd?.(session.id);
      },
      onError: () => {
        setStreamingContent('');
        onGenerationEnd?.(session.id);
      },
      onStopped: () => {
        setStreamingContent('');
        onGenerationEnd?.(session.id);
      },
    });

    return unsubscribe;
  }, [session?.id, isGenerating]);

  useEffect(() => {
    if (settings.autoScroll !== false) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages, streamingContent, isGenerating, settings.autoScroll]);

  const handleSend = () => {
    if (input.trim() && !isGenerating) {
      onSendMessage(input);
      setInput('');
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
  if (isGenerating && streamingContent) {
    displayMessages.push({
      id: '__streaming__',
      role: 'model',
      content: streamingContent,
      createdAt: new Date().toISOString(),
      toolCalls: streamingToolCalls.length > 0 ? streamingToolCalls : undefined,
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
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message... (Enter for newline, click Send to submit)"
            className="flex-1 bg-transparent text-white resize-none max-h-64 min-h-[44px] p-3 focus:outline-none placeholder-gray-500"
            rows={1}
            style={{ height: 'auto' }}
            onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 256)}px`; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
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
