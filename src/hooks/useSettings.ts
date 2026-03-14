import { STORAGE_KEYS } from '@/lib/storage';
import { useSyncExternalStore } from 'react';

export interface AppSettings {
  fontSize: 12 | 13 | 14 | 16;
  tableDensity: 'compact' | 'comfortable';
  defaultPageSize: 50 | 100 | 200 | 500;
  dateFormat: 'iso' | 'locale' | 'relative';
  defaultConnection: string;
  aiModel: string;
}

const STORAGE_KEY = STORAGE_KEYS.SETTINGS;

const DEFAULT: AppSettings = {
  fontSize: 13,
  tableDensity: 'comfortable',
  defaultPageSize: 100,
  dateFormat: 'iso',
  defaultConnection: '',
  aiModel: 'claude-haiku-4-5-20251001',
};

function load(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT };
}

let current: AppSettings = load();
const listeners = new Set<() => void>();

function apply(s: AppSettings) {
  current = s;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  document.documentElement.style.setProperty('--quarry-font-size', `${s.fontSize}px`);
  document.documentElement.style.setProperty(
    '--quarry-cell-py',
    s.tableDensity === 'compact' ? '4px' : '8px',
  );
  listeners.forEach((fn) => fn());
}

apply(current);

export function getSettings(): AppSettings {
  return current;
}

export function useSettings() {
  const settings = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );

  function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    apply({ ...current, [key]: value });
  }

  return { settings, updateSetting };
}
