```typescript
import { UserSettings, ChatSession, Template } from '../types';

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  settings: {
    get: () => request<UserSettings | null>('/api/settings'),
    save: (s: UserSettings) => request<{ ok: true }>('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    }),
  },

  templates: {
    get: () => request<Template[]>('/api/templates'),
    save: (t: Template[]) => request<{ ok: true; templates: Template[] }>('/api/templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(t),
    }),
  },

  sessions: {
    update: (id: string, updates: Partial<ChatSession>) => request<ChatSession>(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }),
    list: () => request<ChatSession[]>('/api/sessions'),
    get: (id: string) => request<ChatSession>(`/api/sessions/${id}`),
    delete: (id: string) => request<{ ok: true }>(`/api/sessions/${id}`, { method: 'DELETE' }),
    duplicate: (id: string) => request<ChatSession>(`/api/sessions/${id}/duplicate`, { method: 'POST' }),
    clean: () => request<{ cleaned: number; total: number; details: string[] }>('/api/sessions/clean', { method: 'POST' }),
  },

  chat: {
    send: (sessionId: string, content: string, characterId?: string, skillIds?: string[]) => request<{ ok: true }>(`/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, characterId, skillIds }),
    }),
    stop: (sessionId: string) => request<{ ok: true }>(`/api/sessions/${sessionId}/generation`, { method: 'DELETE' }),
    retry: (sessionId: string, messageId: string) => request<{ ok: true }>(`/api/sessions/${sessionId}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    }),
    continue: (sessionId: string) => request<{ ok: true }>(`/api/sessions/${sessionId}/continue`, { method: 'POST' }),
    regenerate: (sessionId: string, messageId: string) => request<{ ok: true }>(`/api/sessions/${sessionId}/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId }),
    }),
    getRunningSessions: () => request<{ runningSessionIds: string[] }>('/api/generation-status'),
  },

  providers: {
    list: () => request<{ id: string; name: string }[]>('/api/providers'),
    models: async (providerType: string, baseURL?: string, apiKey?: string, envKey?: string): Promise<{ models: string[]; error?: string }> => {
      const res = await fetch(`/api/providers/${providerType}/models`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseURL, apiKey, envKey }),
      });
      const data = await res.json();
      if (!res.ok) return { models: [], error: data.error || `HTTP ${res.status}` };
      return data;
    },
  },

  subscribeGeneration(
    sessionId: string,
    callbacks: {
      onDelta?: (content: string) => void;
      onDone?: (content: string) => void;
      onError?: (message: string) => void;
      onStopped?: () => void;
    },
  ): () => void {
    const es = new EventSource(`/api/sessions/${sessionId}/generation`);

    es.addEventListener('delta', (e) => {
      const data = JSON.parse(e.data);
      callbacks.onDelta?.(data.content);
    });

    es.addEventListener('done', (e) => {
      const data = JSON.parse(e.data);
      callbacks.onDone?.(data.content);
      es.close();
    });

    es.addEventListener('error', (e: any) => {
      if (es.readyState === EventSource.CLOSED) return;
      try {
        const data = JSON.parse(e.data);
        callbacks.onError?.(data.message);
      } catch {
        callbacks.onError?.('Connection lost');
      }
      es.close();
    });

    es.addEventListener('stopped', () => {
      callbacks.onStopped?.();
      es.close();
    });

    return () => { es.close(); };
  },
};

```