import React, { useState, useMemo, useEffect } from 'react';
import { ChatSession, Character, StarColor } from '../types';
import { Plus, Settings, MessageSquare, Trash2, Copy, ChevronDown, ChevronRight, User, Star, Search, X, FileSearch, Loader2, AlertCircle } from 'lucide-react';
import { normalizeForSearch } from '../../shared/thinking';

const STAR_COLORS = [
  { id: 'yellow', name: '黄', colorClass: 'text-yellow-500 hover:text-yellow-400', bgClass: 'bg-yellow-500' },
  { id: 'rose', name: '红', colorClass: 'text-rose-500 hover:text-rose-400', bgClass: 'bg-rose-500' },
  { id: 'blue', name: '蓝', colorClass: 'text-blue-500 hover:text-blue-400', bgClass: 'bg-blue-500' },
  { id: 'green', name: '绿', colorClass: 'text-green-500 hover:text-green-400', bgClass: 'bg-green-500' },
  { id: 'orange', name: '橙', colorClass: 'text-orange-500 hover:text-orange-400', bgClass: 'bg-orange-500' },
];

function getStarColorClass(colorId: string): string {
  const found = STAR_COLORS.find(c => c.id === colorId);
  if (found) {
    return found.colorClass;
  }
  return 'text-yellow-500 hover:text-yellow-400';
}

interface SessionItemProps {
  session: ChatSession;
  isSelected: boolean;
  isStarred: boolean;
  starredColor: string;
  showColorPicker: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onStarClick: (e: React.MouseEvent) => void;
  onSelectColor: (e: React.MouseEvent, colorId: string) => void;
  onUnstar: (e: React.MouseEvent) => void;
}

const SessionItem: React.FC<SessionItemProps> = ({
  session,
  isSelected,
  isStarred,
  starredColor,
  showColorPicker,
  onSelect,
  onDuplicate,
  onDelete,
  onStarClick,
  onSelectColor,
  onUnstar,
}) => {
  let bgClass = 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200';
  if (isSelected) {
    bgClass = 'bg-gray-800 text-white';
  }

  const starColorClass = getStarColorClass(starredColor);

  let starButtonClass = 'text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100';
  if (isStarred) {
    starButtonClass = starColorClass;
  }

  let starFill = 'none';
  if (isStarred) {
    starFill = 'currentColor';
  }

  return (
    <div
      className={`group flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${bgClass}`}
    >
      <button
        onClick={onSelect}
        className="flex items-center gap-3 overflow-hidden min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded cursor-pointer py-1"
      >
        <MessageSquare size={16} className="shrink-0" />
        <span className="truncate text-sm font-medium">{session.title}</span>
      </button>
      <div className="flex items-center gap-1 shrink-0 relative">
        <div className="relative">
          <button
            onClick={onStarClick}
            data-picker-element="true"
            className={`p-1 rounded transition cursor-pointer ${starButtonClass}`}
            title="Star Chat"
          >
            <Star size={16} fill={starFill} />
          </button>

          {showColorPicker && (
            <div
              onClick={(e) => { e.stopPropagation(); }}
              data-picker-element="true"
              className="absolute right-0 top-full mt-1 z-[100] bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2 flex items-center gap-1.5 whitespace-nowrap"
            >
              {STAR_COLORS.map(color => (
                <button
                  key={color.id}
                  onClick={(e) => onSelectColor(e, color.id)}
                  className={`w-4 h-4 rounded-full ${color.bgClass} border border-white/20 hover:scale-125 transition-transform cursor-pointer`}
                  title={color.name}
                />
              ))}
              {isStarred && (
                <button
                  onClick={onUnstar}
                  className="text-xs text-gray-400 hover:text-red-400 px-1 border-l border-gray-700 transition-colors cursor-pointer"
                >
                  取消
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="text-gray-500 hover:text-blue-400 transition-colors p-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            title="Duplicate Chat"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-gray-500 hover:text-red-400 transition-colors p-1 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 rounded"
            title="Delete Chat"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

interface SidebarProps {
  sessions: ChatSession[];
  characters: Character[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onDuplicateChat: (id: string) => void;
  onOpenSettings: () => void;
  width: number;
  starredSessions?: Record<string, StarColor>;
  onToggleStarSession?: (sessionId: string, color: StarColor | '') => void;
}

interface SessionGroup {
  key: string;
  label: string;
  sessions: ChatSession[];
}

function getDayStart(daysAgo: number): Date {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - daysAgo);
  return start;
}

function getDateLabel(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}

function groupSessions(sessions: ChatSession[]): SessionGroup[] {
  const todayStart = getDayStart(0);
  const yesterdayStart = getDayStart(1);
  const sevenDaysAgo = getDayStart(7);
  const thirtyDaysAgo = getDayStart(30);
  const oneYearAgo = getDayStart(365);

  const dateGroups = new Map<string, ChatSession[]>();
  const recentMonth: ChatSession[] = [];
  const pastYear: ChatSession[] = [];
  const older: ChatSession[] = [];

  for (const session of sessions) {
    const date = new Date(session.updatedAt);

    if (date >= todayStart) {
      const key = 'today';
      if (!dateGroups.has(key)) dateGroups.set(key, []);
      dateGroups.get(key)!.push(session);
    } else if (date >= yesterdayStart) {
      const key = 'yesterday';
      if (!dateGroups.has(key)) dateGroups.set(key, []);
      dateGroups.get(key)!.push(session);
    } else if (date >= sevenDaysAgo) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const key = `date:${y}-${m}-${d}`;
      if (!dateGroups.has(key)) dateGroups.set(key, []);
      dateGroups.get(key)!.push(session);
    } else if (date >= thirtyDaysAgo) {
      recentMonth.push(session);
    } else if (date >= oneYearAgo) {
      pastYear.push(session);
    } else {
      older.push(session);
    }
  }

  const result: SessionGroup[] = [];

  if (dateGroups.has('today')) {
    result.push({ key: 'today', label: '今天', sessions: dateGroups.get('today')! });
  }
  if (dateGroups.has('yesterday')) {
    result.push({ key: 'yesterday', label: '昨天', sessions: dateGroups.get('yesterday')! });
  }

  const sortedDateKeys = Array.from(dateGroups.keys())
    .filter(k => k.startsWith('date:'))
    .sort((a, b) => b.localeCompare(a));

  for (const key of sortedDateKeys) {
    const sessionsList = dateGroups.get(key)!;
    const dateStr = key.slice(5);
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    result.push({ key, label: getDateLabel(date), sessions: sessionsList });
  }

  if (recentMonth.length > 0) {
    result.push({ key: 'recent_month', label: '最近一个月', sessions: recentMonth });
  }
  if (pastYear.length > 0) {
    result.push({ key: 'past_year', label: '过去一年', sessions: pastYear });
  }
  if (older.length > 0) {
    result.push({ key: 'older', label: '更早', sessions: older });
  }

  return result;
}

const ALWAYS_COLLAPSED = new Set(['past_year', 'older']);

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  characters,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteChat,
  onDuplicateChat,
  onOpenSettings,
  width,
  starredSessions,
  onToggleStarSession,
}) => {
  const [filterCharacterId, setFilterCharacterId] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeColorPickerId, setActiveColorPickerId] = useState<string | null>(null);
  const [isStarredCollapsed, setIsStarredCollapsed] = useState(false);

  // Full text search states
  const [isFullTextMode, setIsFullTextMode] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [matchedSessionIds, setMatchedSessionIds] = useState<Set<string> | null>(null);
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false);

  // Close activeColorPickerId when clicking outside using capture-phase event listener
  useEffect(() => {
    const handleClosePicker = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (target instanceof Element && target.closest('[data-picker-element="true"]')) {
        return;
      }
      setActiveColorPickerId(null);
    };
    document.addEventListener('click', handleClosePicker, true);
    return () => {
      document.removeEventListener('click', handleClosePicker, true);
    };
  }, []);

  const filteredSessions = useMemo(() => {
    let list = sessions;
    if (filterCharacterId !== 'all') {
      list = list.filter(s => s.characterId === filterCharacterId);
    }
    const query = searchQuery.trim();
    if (!query) {
      return list;
    }

    if (isFullTextMode && matchedSessionIds !== null) {
      return list.filter(s => matchedSessionIds.has(s.id));
    }

    const strippedQuery = query.toLowerCase().replace(/\s/g, '');
    return list.filter(s => {
      const titleMatch = s.title ? s.title.toLowerCase().replace(/\s/g, '').includes(strippedQuery) : false;
      const idMatch = s.id ? s.id.toLowerCase().replace(/\s/g, '').includes(strippedQuery) : false;
      return titleMatch || idMatch;
    });
  }, [sessions, filterCharacterId, searchQuery, isFullTextMode, matchedSessionIds]);

  const handleStartFullTextSearch = async (queryToSearch?: string) => {
    const q = (queryToSearch !== undefined ? queryToSearch : searchQuery).trim();
    if (!q) return;

    const normalizedQuery = q.toLowerCase().replace(/\s/g, '');
    if (!normalizedQuery) return;

    setIsFullTextMode(true);
    setIsSearching(true);
    setSearchProgress({ current: 0, total: sessions.length });

    const matchedIds = new Set<string>();

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i];

      // Match title or ID first
      const normalizedTitle = session.title ? session.title.toLowerCase().replace(/\s/g, '') : '';
      const normalizedId = session.id ? session.id.toLowerCase().replace(/\s/g, '') : '';

      let matched = normalizedTitle.includes(normalizedQuery) || normalizedId.includes(normalizedQuery);

      if (!matched && session.messages) {
        for (const msg of session.messages) {
          if (msg.content) {
            const normalizedContent = normalizeForSearch(msg.content);
            if (normalizedContent.includes(normalizedQuery)) {
              matched = true;
              break;
            }
          }
        }
      }

      if (matched) {
        matchedIds.add(session.id);
      }

      setSearchProgress({ current: i + 1, total: sessions.length });

      // Yield control every 5 sessions to keep UI smooth and show progress bar update
      if (i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    setMatchedSessionIds(matchedIds);
    setIsSearching(false);
  };

  const requestCloseFullTextSearch = () => {
    setShowCloseConfirmModal(true);
  };

  const confirmCloseFullTextSearch = () => {
    setIsFullTextMode(false);
    setIsSearching(false);
    setMatchedSessionIds(null);
    setSearchQuery('');
    setShowCloseConfirmModal(false);
  };

  const starredSessionsList = useMemo(() => {
    if (!starredSessions) {
      return [];
    }
    return filteredSessions.filter(s => starredSessions[s.id]);
  }, [filteredSessions, starredSessions]);

  const groups = useMemo(() => {
    let listForGroups = filteredSessions;
    if (searchQuery.trim() && starredSessions) {
      listForGroups = filteredSessions.filter(s => !starredSessions[s.id]);
    }
    return groupSessions(listForGroups);
  }, [filteredSessions, searchQuery, starredSessions]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    return new Set(ALWAYS_COLLAPSED);
  });

  const toggleGroup = (key: string) => {
    if (searchQuery.trim()) return;
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleStarClick = (e: React.MouseEvent, pickerId: string) => {
    e.stopPropagation();
    if (activeColorPickerId === pickerId) {
      setActiveColorPickerId(null);
    } else {
      setActiveColorPickerId(pickerId);
    }
  };

  const handleSelectColor = (e: React.MouseEvent, sessionId: string, colorId: StarColor) => {
    e.stopPropagation();
    if (onToggleStarSession) {
      onToggleStarSession(sessionId, colorId);
    }
    setActiveColorPickerId(null);
  };

  const handleUnstar = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (onToggleStarSession) {
      onToggleStarSession(sessionId, '');
    }
    setActiveColorPickerId(null);
  };

  return (
    <div
      className="bg-gray-950 flex flex-col h-full shrink-0"
      style={{ width: `${width}px` }}
    >
      <div className="p-4 space-y-3">
        <div className="pb-1">
          <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors">
              <User size={14} />
            </div>
            <select
              value={filterCharacterId}
              onChange={(e) => setFilterCharacterId(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 text-gray-300 text-xs rounded-lg pl-9 pr-8 py-2 appearance-none focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer hover:bg-gray-800/50"
            >
              <option value="all">All Characters</option>
              {characters.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none">
              <ChevronDown size={12} />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="relative group flex items-center">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors pointer-events-none">
              <Search size={14} />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (isFullTextMode) {
                    requestCloseFullTextSearch();
                  } else if (searchQuery.trim()) {
                    handleStartFullTextSearch();
                  }
                }
              }}
              disabled={isFullTextMode}
              placeholder={isFullTextMode ? "全文搜索已开启 (输入已锁定)" : "搜索标题/ID或按按钮全文搜索..."}
              className={`w-full bg-gray-900 border text-gray-300 text-xs rounded-lg pl-9 pr-14 py-2 focus:outline-none transition-colors ${
                isFullTextMode
                  ? 'border-blue-500/50 bg-gray-900/80 cursor-not-allowed opacity-90'
                  : 'border-gray-800 focus:border-blue-500/50 hover:bg-gray-800/50'
              }`}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {isFullTextMode ? (
                <button
                  onClick={requestCloseFullTextSearch}
                  className="p-1 rounded text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors cursor-pointer"
                  title="关闭全文搜索 (需确认)"
                >
                  <X size={14} />
                </button>
              ) : (
                <>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="p-1 text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
                      title="清空搜索"
                    >
                      <X size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleStartFullTextSearch()}
                    disabled={!searchQuery.trim() || isSearching}
                    className="p-1 text-blue-400 hover:text-blue-300 hover:bg-blue-950/40 disabled:opacity-30 disabled:hover:bg-transparent rounded transition-colors cursor-pointer disabled:cursor-not-allowed"
                    title="开启全文搜索 (检索正文源码)"
                  >
                    <FileSearch size={14} />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Full Text Search Progress Bar */}
          {isFullTextMode && (
            <div className="bg-gray-900 border border-blue-900/40 rounded-lg p-2 space-y-1.5 text-xs text-gray-300">
              <div className="flex items-center justify-between text-[11px]">
                <span className="flex items-center gap-1 text-blue-400 font-medium">
                  {isSearching ? (
                    <>
                      <Loader2 size={12} className="animate-spin shrink-0" />
                      <span>正文检索中...</span>
                    </>
                  ) : (
                    <>
                      <FileSearch size={12} className="shrink-0" />
                      <span>全文搜索结果</span>
                    </>
                  )}
                </span>
                <span className="text-gray-400 font-mono">
                  {searchProgress.current} / {searchProgress.total}
                </span>
              </div>

              <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-150 rounded-full"
                  style={{
                    width: searchProgress.total > 0 ? `${(searchProgress.current / searchProgress.total) * 100}%` : '0%'
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-lg transition-colors font-medium cursor-pointer"
        >
          <Plus size={20} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {/* Starred sessions list */}
        {starredSessionsList.length > 0 && (
          <div className="px-3 mb-4">
            <button
              onClick={() => {
                if (searchQuery.trim()) return;
                setIsStarredCollapsed(!isStarredCollapsed);
              }}
              className={`w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-yellow-500 hover:text-yellow-400 rounded transition-colors select-none ${searchQuery.trim() ? 'cursor-default' : 'cursor-pointer'}`}
            >
              {(isStarredCollapsed && !searchQuery.trim()) ? <ChevronRight size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
              <Star size={14} className="shrink-0 text-yellow-500 fill-current" />
              <span>已加星会话</span>
              <span className="ml-auto text-yellow-600/80 font-mono">
                {starredSessionsList.length}
              </span>
            </button>

            {(!isStarredCollapsed || !!searchQuery.trim()) && (
              <div className="space-y-1 mt-1">
                {starredSessionsList.map(session => {
                  const isSelected = currentSessionId === session.id;
                  const isStarred = true;
                  const color = starredSessions?.[session.id] || 'yellow';
                  const pickerId = `starred-${session.id}`;
                  return (
                    <SessionItem
                      key={pickerId}
                      session={session}
                      isSelected={isSelected}
                      isStarred={isStarred}
                      starredColor={color}
                      showColorPicker={activeColorPickerId === pickerId}
                      onSelect={() => onSelectSession(session.id)}
                      onDuplicate={() => onDuplicateChat(session.id)}
                      onDelete={() => onDeleteChat(session.id)}
                      onStarClick={(e) => handleStarClick(e, pickerId)}
                      onSelectColor={(e, colorId) => handleSelectColor(e, session.id, colorId as StarColor)}
                      onUnstar={(e) => handleUnstar(e, session.id)}
                    />
                  );
                })}
              </div>
            )}
            <div className="border-b border-gray-800/60 my-3" />
          </div>
        )}

        <div className="px-3 space-y-1">
          {groups.map(group => {
            const isCollapsed = searchQuery.trim() ? false : collapsedGroups.has(group.key);
            const isOlder = group.key === 'older';

            return (
              <div key={group.key}>
                <button
                  onClick={() => { toggleGroup(group.key); }}
                  className={`w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded transition-colors select-none ${searchQuery.trim() ? 'cursor-default' : 'cursor-pointer'} ${isOlder ? 'text-gray-600 hover:text-gray-500' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  {isCollapsed ? <ChevronRight size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
                  <span>{group.label}</span>
                  <span className={`ml-auto ${isOlder ? 'text-gray-700' : 'text-gray-600'}`}>
                    {group.sessions.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-1">
                    {group.sessions.map(session => {
                      const isSelected = currentSessionId === session.id;
                      const isStarred = !!(starredSessions && starredSessions[session.id]);
                      const color = (starredSessions && starredSessions[session.id]) || '';
                      const pickerId = `regular-${session.id}`;
                      return (
                        <SessionItem
                          key={session.id}
                          session={session}
                          isSelected={isSelected}
                          isStarred={isStarred}
                          starredColor={color}
                          showColorPicker={activeColorPickerId === pickerId}
                          onSelect={() => onSelectSession(session.id)}
                          onDuplicate={() => onDuplicateChat(session.id)}
                          onDelete={() => onDeleteChat(session.id)}
                          onStarClick={(e) => handleStarClick(e, pickerId)}
                          onSelectColor={(e, colorId) => handleSelectColor(e, session.id, colorId as StarColor)}
                          onUnstar={(e) => handleUnstar(e, session.id)}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-4 border-t border-gray-800 space-y-2">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 text-gray-400 hover:text-white px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors font-medium cursor-pointer"
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </div>

      {/* Confirmation Modal for Closing Full-Text Search */}
      {showCloseConfirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg shrink-0">
                <AlertCircle size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-gray-100">结束全文搜索</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  关闭全文搜索将解锁输入框并恢复正常会话列表。是否确定要结束当前的全文搜索？
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-1">
              <button
                onClick={() => setShowCloseConfirmModal(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={confirmCloseFullTextSearch}
                className="px-3.5 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                确定结束
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};