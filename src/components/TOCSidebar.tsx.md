````typescript
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChatMessage } from '../types';
import { MessageTOC, extractHeadingsFromContent } from '../lib/toc';
import { ListTree, ChevronDown, ChevronRight, X, Layers, ChevronsUpDown, ChevronsDownUp, PanelRightClose } from 'lucide-react';
import { cn } from '../lib/utils';

interface TOCSidebarProps {
  messages: ChatMessage[];
  maxLevel: number;
  onMaxLevelChange: (level: number) => void;
  activeHeadingId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectHeading: (headingId: string) => void;
  isGenerating?: boolean;
  isMobile?: boolean;
}

export const TOCSidebar: React.FC<TOCSidebarProps> = ({
  messages,
  maxLevel,
  onMaxLevelChange,
  activeHeadingId,
  isOpen,
  onClose,
  onSelectHeading,
  isGenerating = false,
  isMobile = false,
}) => {
  const [collapsedMessageIds, setCollapsedMessageIds] = useState<Record<string, boolean>>({});
  const lastMessageIdRef = useRef<string | null>(null);

  const messageTOCs: MessageTOC[] = useMemo(() => {
    return messages
      .map((msg, index) => {
        const headings = extractHeadingsFromContent(msg.id, msg.content);
        if (headings.length === 0) return null;

        let snippet = msg.content
          .replace(/<think>[\s\S]*?<\/think>/gi, '')
          .replace(/```[\s\S]*?```/g, '')
          .replace(/[#*`_~$-]/g, '')
          .trim();
        if (snippet.length > 25) {
          snippet = snippet.slice(0, 25) + '...';
        }
        if (!snippet) {
          if (msg.role === 'user') {
            snippet = `User Msg #${index + 1}`;
          } else {
            snippet = `AI Response #${index + 1}`;
          }
        }

        return {
          messageId: msg.id,
          role: msg.role,
          snippet,
          headings,
        };
      })
      .filter((toc): toc is MessageTOC => toc !== null);
  }, [messages]);

  useEffect(() => {
    if (messages.length === 0) return;
    const latestMsg = messages[messages.length - 1];

    if (latestMsg.id !== lastMessageIdRef.current) {
      lastMessageIdRef.current = latestMsg.id;
      setCollapsedMessageIds(prev => {
        if (prev[latestMsg.id] === undefined) return prev;
        const next = { ...prev };
        delete next[latestMsg.id];
        return next;
      });
    }
  }, [messages]);

  const filteredHeadingsCount = useMemo(() => {
    let count = 0;
    messageTOCs.forEach(toc => {
      count += toc.headings.filter(h => h.level <= maxLevel).length;
    });
    return count;
  }, [messageTOCs, maxLevel]);

  const toggleMessageCollapse = (messageId: string) => {
    setCollapsedMessageIds(prev => {
      let isCurrentlyCollapsed = true;
      if (prev[messageId] !== undefined) {
        isCurrentlyCollapsed = prev[messageId];
      } else {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && messageId === lastMsg.id) {
          isCurrentlyCollapsed = false;
        }
      }
      return {
        ...prev,
        [messageId]: !isCurrentlyCollapsed,
      };
    });
  };

  const handleExpandAll = () => {
    const nextState: Record<string, boolean> = {};
    messageTOCs.forEach(toc => {
      nextState[toc.messageId] = false;
    });
    setCollapsedMessageIds(nextState);
  };

  const handleCollapseAll = () => {
    const nextState: Record<string, boolean> = {};
    messageTOCs.forEach(toc => {
      nextState[toc.messageId] = true;
    });
    setCollapsedMessageIds(nextState);
  };

  if (!isOpen) return null;

  let containerClasses = 'w-72 bg-gray-900/90 border-l border-gray-800/80 flex flex-col h-full shrink-0 z-20 backdrop-blur select-none';
  if (isMobile) {
    containerClasses = 'fixed inset-y-0 right-0 z-50 w-80 bg-gray-900 border-l border-gray-800 shadow-2xl flex flex-col transition-transform duration-200 ease-in-out';
  }

  let closeIcon = <PanelRightClose size={16} />;
  if (isMobile) {
    closeIcon = <X size={16} />;
  }

  return (
    <>
      {isMobile && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={containerClasses} aria-label="Table of Contents">
        <div className="p-3.5 border-b border-gray-800 flex items-center justify-between gap-2 bg-gray-900/95">
          <div className="flex items-center gap-2 text-gray-200 font-medium text-sm min-w-0">
            <ListTree size={16} className="text-blue-400 shrink-0" />
            <span className="truncate">目录 (TOC)</span>
            {filteredHeadingsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-mono">
                {filteredHeadingsCount}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={handleExpandAll}
              className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
              title="展开全部"
            >
              <ChevronsUpDown size={14} />
            </button>
            <button
              onClick={handleCollapseAll}
              className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
              title="折叠全部"
            >
              <ChevronsDownUp size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-800 rounded transition-colors"
              title="关闭目录"
            >
              {closeIcon}
            </button>
          </div>
        </div>

        <div className="px-3 py-2 border-b border-gray-800/60 bg-gray-950/40 flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <Layers size={12} className="text-gray-500" />
            <span>层级:</span>
          </div>
          <div className="flex items-center gap-1 bg-gray-800/80 p-0.5 rounded-md border border-gray-700/50">
            {[1, 2, 3, 4, 5, 6].map(lvl => (
              <button
                key={lvl}
                onClick={() => onMaxLevelChange(lvl)}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer",
                  maxLevel === lvl
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-700/50"
                )}
                title={`显示到 H${lvl} 标题`}
              >
                H{lvl}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-3 text-xs">
          {messageTOCs.length === 0 ? (
            <div className="py-12 px-4 text-center text-gray-500">
              <p className="text-sm">暂无标题</p>
              <p className="text-[11px] mt-1 text-gray-600">
                {isGenerating ? 'AI 生成中，实时解析标题...' : '当前对话暂无 Markdown 标题'}
              </p>
            </div>
          ) : (
            messageTOCs.map((toc, index) => {
              const visibleHeadings = toc.headings.filter(h => h.level <= maxLevel);
              if (visibleHeadings.length === 0) return null;

              const isLatestMessage = index === messageTOCs.length - 1;
              let isCollapsed = false;
              if (collapsedMessageIds[toc.messageId] !== undefined) {
                isCollapsed = collapsedMessageIds[toc.messageId];
              } else {
                if (!isLatestMessage) {
                  isCollapsed = true;
                }
              }

              let roleLabel = 'AI';
              let roleBadgeColor = 'bg-green-500/10 text-green-400 border-green-500/20';
              if (toc.role === 'user') {
                roleLabel = '用户';
                roleBadgeColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
              }

              return (
                <div
                  key={toc.messageId}
                  className="rounded-lg border border-gray-800/80 bg-gray-900/50 overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => toggleMessageCollapse(toc.messageId)}
                    className="w-full flex items-center justify-between p-2 bg-gray-800/40 hover:bg-gray-800/80 transition-colors text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
                      {isCollapsed ? (
                        <ChevronRight size={12} className="text-gray-500 shrink-0" />
                      ) : (
                        <ChevronDown size={12} className="text-gray-500 shrink-0" />
                      )}
                      <span className={cn("px-1 py-0.2 rounded text-[10px] font-medium border shrink-0", roleBadgeColor)}>
                        {roleLabel}
                      </span>
                      <span className="truncate text-gray-300 font-medium text-[11px]">
                        {toc.snippet}
                      </span>
                    </div>

                    <span className="text-[10px] text-gray-500 font-mono shrink-0">
                      {visibleHeadings.length}
                    </span>
                  </button>

                  {!isCollapsed && (
                    <div className="py-1 px-1 space-y-0.5 border-t border-gray-800/40">
                      {visibleHeadings.map(heading => {
                        const isActive = activeHeadingId === heading.id;

                        let indentClass = 'pl-2';
                        if (heading.level === 2) {
                          indentClass = 'pl-4';
                        } else if (heading.level === 3) {
                          indentClass = 'pl-6';
                        } else if (heading.level === 4) {
                          indentClass = 'pl-8';
                        } else if (heading.level >= 5) {
                          indentClass = 'pl-10';
                        }

                        return (
                          <button
                            key={heading.id}
                            onClick={() => {
                              onSelectHeading(heading.id);
                              if (isMobile) {
                                onClose();
                              }
                            }}
                            className={cn(
                              "w-full text-left py-1 pr-2 rounded transition-all flex items-start gap-1.5 group cursor-pointer",
                              indentClass,
                              isActive
                                ? "bg-blue-600/20 text-blue-300 font-medium border-l-2 border-blue-500"
                                : "text-gray-400 hover:text-gray-200 hover:bg-gray-800/60"
                            )}
                          >
                            <span className="text-[10px] font-mono opacity-40 group-hover:opacity-80 shrink-0 mt-0.5">
                              H{heading.level}
                            </span>
                            <span className="truncate leading-tight text-[11px] flex-1">
                              {heading.text}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
    </>
  );
};

````