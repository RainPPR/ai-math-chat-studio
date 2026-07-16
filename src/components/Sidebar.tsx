import React, { useState, useMemo, useEffect } from 'react';
import { ChatSession } from '../types';
import { Plus, Settings, MessageSquare, Trash2, Copy, ChevronDown, ChevronRight, User, Star } from 'lucide-react';
import { Character } from '../types';

const STAR_COLORS = [
  { id: 'yellow', name: '黄', colorClass: 'text-yellow-500 hover:text-yellow-400', bgClass: 'bg-yellow-500' },
  { id: 'rose', name: '红', colorClass: 'text-rose-500 hover:text-rose-400', bgClass: 'bg-rose-500' },
  { id: 'blue', name: '蓝', colorClass: 'text-blue-500 hover:text-blue-400', bgClass: 'bg-blue-500' },
  { id: 'green', name: '绿', colorClass: 'text-green-500 hover:text-green-400', bgClass: 'bg-green-500' },
  { id: 'orange', name: '橙', colorClass: 'text-orange-500 hover:text-orange-400', bgClass: 'bg-orange-500' },
];

function getStarColorClass(colorId: string): string {
  if (colorId === 'rose') {
    return 'text-rose-500 hover:text-rose-400';
  }
  if (colorId === 'blue') {
    return 'text-blue-500 hover:text-blue-400';
  }
  if (colorId === 'green') {
    return 'text-green-500 hover:text-green-400';
  }
  if (colorId === 'orange') {
    return 'text-orange-500 hover:text-orange-400';
  }
  return 'text-yellow-500 hover:text-yellow-400';
}

interface SessionItemProps {
  session: ChatSession;
  isSelected: boolean;
  isStarred: boolean;
  starredColor: string;
  activeColorPickerSessionId: string | null;
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
  activeColorPickerSessionId,
  onSelect,
  onDuplicate,
  onDelete,
  onStarClick,
  onSelectColor,
  onUnstar,
}) => {
  const bgClass = isSelected
    ? 'bg-gray-800 text-white'
    : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200';

  const starColorClass = getStarColorClass(starredColor);

  return (
    <div
      className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${bgClass}`}
      onClick={onSelect}
    >
      <div className="flex items-center gap-3 overflow-hidden min-w-0">
        <MessageSquare size={16} className="shrink-0" />
        <span className="truncate text-sm font-medium">{session.title}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0 relative">
        <div className="relative">
          <button
            onClick={onStarClick}
            className={`p-1 rounded transition-colors ${
              isStarred
                ? starColorClass
                : 'text-gray-500 hover:text-gray-300 opacity-0 group-hover:opacity-100'
            }`}
            title="Star Chat"
          >
            <Star size={16} fill={isStarred ? 'currentColor' : 'none'} />
          </button>

          {activeColorPickerSessionId === session.id && (
            <div className="absolute right-0 bottom-full mb-1 z-[100] bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-2 flex items-center gap-1.5 whitespace-nowrap">
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

        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="text-gray-500 hover:text-blue-400 transition-colors p-1 cursor-pointer"
            title="Duplicate Chat"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-gray-500 hover:text-red-400 transition-colors p-1 cursor-pointer"
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
  starredSessions?: Record<string, string>;
  onToggleStarSession?: (sessionId: string, color: string) => void;
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
  const [activeColorPickerSessionId, setActiveColorPickerSessionId] = useState<string | null>(null);
  const [isStarredCollapsed, setIsStarredCollapsed] = useState(false);

  // Close activeColorPickerSessionId when clicking outside
  useEffect(() => {
    const handleClosePicker = () => {
      setActiveColorPickerSessionId(null);
    };
    document.addEventListener('click', handleClosePicker);
    return () => {
      document.removeEventListener('click', handleClosePicker);
    };
  }, []);

  const filteredSessions = useMemo(() => {
    if (filterCharacterId === 'all') {
      return sessions;
    }
    return sessions.filter(s => s.characterId === filterCharacterId);
  }, [sessions, filterCharacterId]);

  const starredSessionsList = useMemo(() => {
    if (!starredSessions) {
      return [];
    }
    return filteredSessions.filter(s => starredSessions[s.id]);
  }, [filteredSessions, starredSessions]);

  const groups = useMemo(() => groupSessions(filteredSessions), [filteredSessions]);

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    return new Set(ALWAYS_COLLAPSED);
  });

  const toggleGroup = (key: string) => {
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

  const handleStarClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (activeColorPickerSessionId === sessionId) {
      setActiveColorPickerSessionId(null);
    } else {
      setActiveColorPickerSessionId(sessionId);
    }
  };

  const handleSelectColor = (e: React.MouseEvent, sessionId: string, colorId: string) => {
    e.stopPropagation();
    if (onToggleStarSession) {
      onToggleStarSession(sessionId, colorId);
    }
    setActiveColorPickerSessionId(null);
  };

  const handleUnstar = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (onToggleStarSession) {
      onToggleStarSession(sessionId, '');
    }
    setActiveColorPickerSessionId(null);
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
              onClick={() => { setIsStarredCollapsed(!isStarredCollapsed); }}
              className="w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-yellow-500 hover:text-yellow-400 rounded transition-colors select-none cursor-pointer"
            >
              {isStarredCollapsed ? <ChevronRight size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
              <Star size={14} className="shrink-0 text-yellow-500 fill-current" />
              <span>已加星会话</span>
              <span className="ml-auto text-yellow-600/80 font-mono">
                {starredSessionsList.length}
              </span>
            </button>

            {!isStarredCollapsed && (
              <div className="space-y-1 mt-1">
                {starredSessionsList.map(session => {
                  const isSelected = currentSessionId === session.id;
                  const isStarred = true;
                  const color = starredSessions?.[session.id] || 'yellow';
                  return (
                    <SessionItem
                      key={`starred-${session.id}`}
                      session={session}
                      isSelected={isSelected}
                      isStarred={isStarred}
                      starredColor={color}
                      activeColorPickerSessionId={activeColorPickerSessionId}
                      onSelect={() => onSelectSession(session.id)}
                      onDuplicate={() => onDuplicateChat(session.id)}
                      onDelete={() => onDeleteChat(session.id)}
                      onStarClick={(e) => handleStarClick(e, session.id)}
                      onSelectColor={(e, colorId) => handleSelectColor(e, session.id, colorId)}
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
            const isCollapsed = collapsedGroups.has(group.key);
            const isOlder = group.key === 'older';

            return (
              <div key={group.key}>
                <button
                  onClick={() => { toggleGroup(group.key); }}
                  className={`w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded transition-colors select-none cursor-pointer ${isOlder ? 'text-gray-600 hover:text-gray-500' : 'text-gray-500 hover:text-gray-300'}`}
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
                      return (
                        <SessionItem
                          key={session.id}
                          session={session}
                          isSelected={isSelected}
                          isStarred={isStarred}
                          starredColor={color}
                          activeColorPickerSessionId={activeColorPickerSessionId}
                          onSelect={() => onSelectSession(session.id)}
                          onDuplicate={() => onDuplicateChat(session.id)}
                          onDelete={() => onDeleteChat(session.id)}
                          onStarClick={(e) => handleStarClick(e, session.id)}
                          onSelectColor={(e, colorId) => handleSelectColor(e, session.id, colorId)}
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
    </div>
  );
};