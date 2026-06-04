# Remove Firebase → Local JSON Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all Firebase/Google Cloud dependencies and replace with local JSON file storage under `/data` directory via server-side REST API.

**Architecture:** The Express server (`server.ts`) gains CRUD endpoints for reading/writing JSON files in `/data/settings.json` and `/data/sessions/*.json`. The client replaces all Firebase calls with simple `fetch()` calls to these endpoints. Authentication is removed entirely (single-user local app).

**Tech Stack:** Express.js (server), vanilla `fetch` (client), `fs/promises` (file I/O), UUID for session IDs.

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| Delete | `firebase-applet-config.json` | Firebase config — no longer needed |
| Delete | `firebase-blueprint.json` | Firestore schema — no longer needed |
| Delete | `firestore.rules` | Firestore security rules — no longer needed |
| Rewrite | `src/lib/firebase.ts` → `src/lib/dataService.ts` | New local data service via REST API |
| Modify | `server.ts` | Add `/api/data/*` CRUD endpoints |
| Modify | `src/App.tsx` | Remove Firebase auth/Firestore, use dataService |
| Modify | `src/components/Sidebar.tsx` | Remove `User` type from firebase/auth |
| Modify | `package.json` | Remove `firebase` dependency |
| Create | `.gitignore` update | Add `/data` to gitignore |

---

### Task 1: Delete Firebase config files

**Files:**

- Delete: `firebase-applet-config.json`
- Delete: `firebase-blueprint.json`
- Delete: `firestore.rules`

- [ ] **Step 1: Delete the three Firebase config files**

```bash
rm firebase-applet-config.json firebase-blueprint.json firestore.rules
```

- [ ] **Step 2: Verify files are gone**

```bash
ls firebase-*
# Expected: "ls: cannot access 'firebase-*': No such file or directory" or equivalent error
```

---

### Task 2: Remove Firebase dependency from package.json

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Remove `firebase` from dependencies**

In `package.json`, delete line 22: `"firebase": "^12.11.0",`

- [ ] **Step 2: Run `npm install` to update lockfile**

```bash
npm install
```

Expected: Clean install, no firebase packages in `node_modules`.

---

### Task 3: Add `/data` to `.gitignore`

**Files:**

- Modify: `.gitignore`

- [ ] **Step 1: Append `/data` to `.gitignore`**

Add a new line `/data` at the end of `.gitignore`.

---

### Task 4: Create server-side data API endpoints

**Files:**

- Modify: `server.ts`

Add the following REST API endpoints to `server.ts` **before** the Vite middleware section (before line 446):

- [ ] **Step 1: Add imports and data directory setup**

At the top of `server.ts`, add after existing imports:

```typescript
import fs from "fs/promises";
import { existsSync, mkdirSync } from "fs";
```

- [ ] **Step 2: Add data directory initialization**

After `app.use(express.json());` (line 10), add:

```typescript
const DATA_DIR = path.join(process.cwd(), "data");
const SESSIONS_DIR = path.join(DATA_DIR, "sessions");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });
```

- [ ] **Step 3: Add GET /api/data/settings endpoint**

```typescript
app.get("/api/data/settings", async (_req, res) => {
  try {
    const data = await fs.readFile(SETTINGS_FILE, "utf-8");
    res.json(JSON.parse(data));
  } catch {
    res.json(null);
  }
});
```

- [ ] **Step 4: Add PUT /api/data/settings endpoint**

```typescript
app.put("/api/data/settings", async (req, res) => {
  try {
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(req.body, null, 2), "utf-8");
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 5: Add GET /api/data/sessions endpoint**

```typescript
app.get("/api/data/sessions", async (_req, res) => {
  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const sessions = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const data = await fs.readFile(path.join(SESSIONS_DIR, file), "utf-8");
      sessions.push(JSON.parse(data));
    }
    sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    res.json(sessions);
  } catch {
    res.json([]);
  }
});
```

- [ ] **Step 6: Add POST /api/data/sessions endpoint**

```typescript
app.post("/api/data/sessions", async (req, res) => {
  try {
    const session = req.body;
    const filePath = path.join(SESSIONS_DIR, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2), "utf-8");
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 7: Add PUT /api/data/sessions/:id endpoint**

```typescript
app.put("/api/data/sessions/:id", async (req, res) => {
  try {
    const filePath = path.join(SESSIONS_DIR, `${req.params.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(req.body, null, 2), "utf-8");
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

- [ ] **Step 8: Add DELETE /api/data/sessions/:id endpoint**

```typescript
app.delete("/api/data/sessions/:id", async (req, res) => {
  try {
    const filePath = path.join(SESSIONS_DIR, `${req.params.id}.json`);
    await fs.unlink(filePath);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### Task 5: Create `src/lib/dataService.ts` (replaces `firebase.ts`)

**Files:**

- Create: `src/lib/dataService.ts`
- Delete: `src/lib/firebase.ts`

- [ ] **Step 1: Create `src/lib/dataService.ts`**

```typescript
import { UserSettings, ChatSession } from '../types';

const API_BASE = '/api/data';

export async function loadSettings(): Promise<UserSettings | null> {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) return null;
  const data = await res.json();
  return data;
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  const clean = Object.fromEntries(Object.entries(settings).filter(([_, v]) => v !== undefined));
  await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(clean),
  });
}

export async function loadSessions(): Promise<ChatSession[]> {
  const res = await fetch(`${API_BASE}/sessions`);
  if (!res.ok) return [];
  return res.json();
}

export async function saveSession(session: ChatSession): Promise<void> {
  await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  });
}

export async function updateSession(session: ChatSession): Promise<void> {
  await fetch(`${API_BASE}/sessions/${session.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session),
  });
}

export async function deleteSession(id: string): Promise<void> {
  await fetch(`${API_BASE}/sessions/${id}`, {
    method: 'DELETE',
  });
}
```

- [ ] **Step 2: Delete `src/lib/firebase.ts`**

```bash
rm src/lib/firebase.ts
```

---

### Task 6: Rewrite `src/App.tsx` — remove all Firebase, use dataService

**Files:**

- Modify: `src/App.tsx`

This is the largest change. The entire file needs to be rewritten to:

1. Remove all Firebase imports (lines 2-4)
2. Remove `User` type usage — replace with simple local user object
3. Remove `isLocalMode` checks — everything is local now
4. Remove `onAuthStateChanged` — no auth
5. Remove `onSnapshot` listeners — use async load on mount
6. Replace all `setDoc`/`updateDoc`/`deleteDoc` with `dataService` calls
7. Remove the login page (lines 631-643) — go straight to main UI
8. Remove `user` prop from `Sidebar` — no user info to show

- [ ] **Step 1: Replace imports**

Replace lines 1-16 with:

```typescript
import React, { useState, useEffect } from 'react';
import { loadSettings, saveSettings, loadSessions, saveSession, updateSession, deleteSession } from './lib/dataService';
import { ChatSession, UserSettings, ChatMessage, ToolCallRecord } from './types';
import { fetchModels, generateChatResponse } from './lib/gemini';
import { generateNvidiaChatResponse, fetchNvidiaModels } from './lib/nvidia';
import { generateCloudflareChatResponse, fetchCloudflareModels } from './lib/cloudflare';
import { generateAihubmixChatResponse, fetchAihubmixModels } from './lib/aihubmix';
import { generatePoeChatResponse, fetchPoeModels } from './lib/poe';
import { generateOnerouterChatResponse, fetchOnerouterModels } from './lib/Onerouter';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SettingsModal } from './components/SettingsModal';
import { v4 as uuidv4 } from 'uuid';
import { Loader2, Wrench, ChevronRight, ChevronLeft } from 'lucide-react';
```

- [ ] **Step 2: Remove `user` and `isAuthReady` state, remove `isLocalMode`**

Replace the state declarations and the first `useEffect` (lines 33-57) with:

```typescript
export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isToolsSidebarOpen, setIsToolsSidebarOpen] = useState(true);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    fetchModels().then(m => setModels(m || []));
  }, []);
```

- [ ] **Step 3: Replace the data loading useEffect (lines 63-123)**

Replace with:

```typescript
  useEffect(() => {
    async function loadData() {
      const [loadedSessions, loadedSettings] = await Promise.all([
        loadSessions(),
        loadSettings(),
      ]);
      setSessions(loadedSessions);
      if (loadedSessions.length > 0) {
        setCurrentSessionId(loadedSessions[0].id);
      }
      setSettings(loadedSettings ? { ...DEFAULT_SETTINGS, ...loadedSettings } : DEFAULT_SETTINGS);
      setIsReady(true);
    }
    loadData();
  }, []);
```

- [ ] **Step 4: Simplify `handleNewChat` (lines 125-151)**

Replace with:

```typescript
  const handleNewChat = async () => {
    const newSession: ChatSession = {
      id: uuidv4(),
      uid: 'local',
      title: 'New Chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    await saveSession(newSession);
  };
```

- [ ] **Step 5: Simplify `handleDeleteChat` (lines 153-171)**

Replace with:

```typescript
  const handleDeleteChat = async (id: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    if (currentSessionId === id) setCurrentSessionId(null);
    await deleteSession(id);
  };
```

- [ ] **Step 6: Simplify `handleSaveSettings` (lines 173-189)**

Replace with:

```typescript
  const handleSaveSettings = async (newSettings: UserSettings) => {
    setSettings(newSettings);
    setIsSettingsOpen(false);
    await saveSettings(newSettings);
  };
```

- [ ] **Step 7: Simplify `runLLM` finally block (lines 462-482)**

In the `finally` block of `runLLM`, replace the Firestore `updateDoc` with:

```typescript
      const finalModelMessage: ChatMessage = {
        id: modelMessageId,
        role: 'model',
        content: currentModelText,
        createdAt: new Date().toISOString(),
        toolCalls: currentToolCalls,
      };
      const currentSession = sessions.find(s => s.id === sessionId);
      if (currentSession) {
        const updated = {
          ...currentSession,
          messages: [...messagesToSubmit, finalModelMessage].filter(m => m.content.trim() !== ""),
          updatedAt: new Date().toISOString(),
        };
        setSessions(prev => prev.map(s => s.id === sessionId ? updated : s));
        await updateSession(updated);
      }
```

Note: The `sessions` reference inside `runLLM` may be stale due to closure. Use a ref or pass sessions as parameter. A simpler approach: read the current sessions from state at the point of writing. Since `runLLM` is called from handlers that have already updated sessions, we can use a `useRef` for sessions or restructure slightly. The simplest fix: use `setSessions` callback form to get latest state and then call `updateSession`.

Revised approach for the `finally` block:

```typescript
      finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
        const finalModelMessage: ChatMessage = {
          id: modelMessageId,
          role: 'model',
          content: currentModelText,
          createdAt: new Date().toISOString(),
          toolCalls: currentToolCalls,
        };
        setSessions(prev => {
          const next = prev.map(s => {
            if (s.id === sessionId) {
              const updated = {
                ...s,
                messages: [...messagesToSubmit, finalModelMessage].filter(m => m.content.trim() !== ""),
                updatedAt: new Date().toISOString(),
              };
              updateSession(updated);
              return updated;
            }
            return s;
          });
          return next;
        });
      }
```

- [ ] **Step 8: Simplify `handleSendMessage` (lines 485-553)**

Replace the Firestore calls with dataService calls. Remove `user` checks. The session creation and message update should use `saveSession`/`updateSession`:

```typescript
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isGenerating) return;

    let sessionId = currentSessionId;
    let session = sessions.find(s => s.id === sessionId);

    if (!sessionId || !session) {
      sessionId = uuidv4();
      session = {
        id: sessionId,
        uid: 'local',
        title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSessions(prev => [session!, ...prev]);
      setCurrentSessionId(sessionId);
      await saveSession(session);
    }

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...session.messages, userMessage];
    const updatedSession = {
      ...session,
      messages: updatedMessages,
      updatedAt: new Date().toISOString(),
      title: session.messages.length === 0 ? content.slice(0, 30) : session.title,
    };

    setSessions(prev => prev.map(s => s.id === sessionId ? updatedSession : s));
    await updateSession(updatedSession);

    await runLLM(sessionId, updatedMessages);
  };
```

- [ ] **Step 9: Simplify `handleRetry` (lines 555-590)**

Replace Firestore calls:

```typescript
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
    const updatedSession = { ...session, messages: updatedMessages, updatedAt: new Date().toISOString() };

    setSessions(prev => prev.map(s => s.id === currentSessionId ? updatedSession : s));
    await updateSession(updatedSession);

    await runLLM(currentSessionId, updatedMessages);
  };
```

- [ ] **Step 10: Simplify `handleContinue` (lines 592-625)**

Replace Firestore calls:

```typescript
  const handleContinue = async () => {
    if (isGenerating || !currentSessionId) return;
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session || session.messages.length === 0) return;

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: 'continue',
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...session.messages, userMessage];
    const updatedSession = { ...session, messages: updatedMessages, updatedAt: new Date().toISOString() };

    setSessions(prev => prev.map(s => s.id === currentSessionId ? updatedSession : s));
    await updateSession(updatedSession);

    await runLLM(currentSessionId, updatedMessages);
  };
```

- [ ] **Step 11: Replace auth-gating UI (lines 627-643)**

Replace the `isAuthReady` / `!user` checks with:

```typescript
  if (!isReady) {
    return <div className="flex h-screen items-center justify-center bg-gray-900"><Loader2 className="animate-spin text-white" /></div>;
  }
```

Remove the entire login page block (the `if (!user)` block with "Sign in with Google" button).

- [ ] **Step 12: Update Sidebar usage in JSX**

Remove `user={user}` and `onLogout={logout}` props from `<Sidebar>`:

```typescript
      <Sidebar 
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />
```

- [ ] **Step 13: Update `finally` block in `runLLM` to use functional `setSessions`**

The `runLLM` function captures `sessions` in closure which may be stale. Use functional `setSessions`:

In the `finally` block, replace the session update logic with:

```typescript
      finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
        const finalModelMessage: ChatMessage = {
          id: modelMessageId,
          role: 'model',
          content: currentModelText,
          createdAt: new Date().toISOString(),
          toolCalls: currentToolCalls,
        };
        setSessions(prev => {
          return prev.map(s => {
            if (s.id === sessionId) {
              const updated = {
                ...s,
                messages: [...messagesToSubmit, finalModelMessage].filter(m => m.content.trim() !== ""),
                updatedAt: new Date().toISOString(),
              };
              updateSession(updated);
              return updated;
            }
            return s;
          });
        });
      }
```

---

### Task 7: Update `src/components/Sidebar.tsx` — remove Firebase User type

**Files:**

- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Remove Firebase import and user-related props**

Replace the entire file with:

```typescript
import React from 'react';
import { ChatSession } from '../types';
import { Plus, Settings, MessageSquare, Trash2 } from 'lucide-react';

interface SidebarProps {
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  onOpenSettings: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions, currentSessionId, onSelectSession, onNewChat, onDeleteChat, onOpenSettings
}) => {
  return (
    <div className="w-64 bg-gray-950 flex flex-col h-full border-r border-gray-800 shrink-0">
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
        {sessions.map(session => (
          <div 
            key={session.id}
            className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${currentSessionId === session.id ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-gray-200'}`}
            onClick={() => onSelectSession(session.id)}
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

      <div className="p-4 border-t border-gray-800">
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
```

---

### Task 8: Update `src/types.ts` — remove `uid` field (optional)

**Files:**

- Modify: `src/types.ts`

- [ ] **Step 1: Keep `uid` for backward compat but it will always be `'local'`**

No change needed to `types.ts` — the `uid` field remains for data structure stability but is always `'local'`.

---

### Task 9: Run lint and verify build

- [ ] **Step 1: Run TypeScript check**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Clean build.

- [ ] **Step 3: Run dev server and verify**

```bash
npm run dev
```

Then open `http://localhost:3000` and verify:

- App loads without login page
- Can create new chat
- Can send messages
- Can delete chats
- Settings modal works
- Data persists in `/data/settings.json` and `/data/sessions/*.json`

---

## Summary of all changes

| File | Change |
|------|--------|
| `firebase-applet-config.json` | DELETE |
| `firebase-blueprint.json` | DELETE |
| `firestore.rules` | DELETE |
| `package.json` | Remove `firebase` dependency |
| `.gitignore` | Add `/data` |
| `server.ts` | Add 6 REST endpoints for `/api/data/*` |
| `src/lib/firebase.ts` | DELETE |
| `src/lib/dataService.ts` | CREATE — fetch-based data service |
| `src/App.tsx` | Remove all Firebase imports/auth/Firestore, use dataService |
| `src/components/Sidebar.tsx` | Remove `User` type, remove user info/logout UI |
