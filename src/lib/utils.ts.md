```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function loadStoredNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.max(min, Math.min(Math.round(parsed), max));
  } catch {
    return fallback;
  }
}

export function saveStoredNumber(key: string, value: number, min: number, max: number): void {
  try {
    const clamped = Math.max(min, Math.min(Math.round(value), max));
    localStorage.setItem(key, String(clamped));
  } catch {
    /* ignore storage errors */
  }
}

export function loadStoredBoolean(key: string, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (raw === 'true') {
      return true;
    }
    if (raw === 'false') {
      return false;
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export function saveStoredBoolean(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    /* ignore storage errors */
  }
}

```