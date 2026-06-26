import React, { useState, useMemo } from 'react';
import { ChatSession } from '../types';
import { Plus, Settings, MessageSquare, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onOpenSettings: () => void;
  width: number;
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
  sessions, currentSessionId, onSelectSession, onNewChat, onDeleteChat, onOpenSettings, width
}) => {
  const groups = useMemo(() => groupSessions(sessions), [sessions]);

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

  return (
    <div
      className="bg-gray-950 flex flex-col h-full shrink-0"
      style={{ width: `${width}px` }}
    >
      <div className="p-4">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-lg transition-colors font-medium"
        >
          <Plus size={20} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        {groups.map(group => {
          const isCollapsed = collapsedGroups.has(group.key);
          const isOlder = group.key === 'older';

          return (
            <div key={group.key}>
              <button
                onClick={() => { toggleGroup(group.key); }}
                className={`w-full flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded transition-colors select-none ${isOlder ? 'text-gray-600 hover:text-gray-500' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {isCollapsed ? <ChevronRight size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
                <span>{group.label}</span>
                <span className={`ml-auto ${isOlder ? 'text-gray-700' : 'text-gray-600'}`}>
                  {group.sessions.length}
                </span>
              </button>

              {!isCollapsed && (
                <div className="space-y-1">
                  {group.sessions.map(session => (
                    <div
                      key={session.id}
                      className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${currentSessionId === session.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
                      onClick={() => { onSelectSession(session.id); }}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <MessageSquare size={16} className="shrink-0" />
                        <span className="truncate text-sm font-medium">{session.title}</span>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteChat(session.id); }}
                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-gray-800 space-y-2">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-3 text-gray-400 hover:text-white px-3 py-2.5 rounded-lg hover:bg-gray-800 transition-colors font-medium"
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
};