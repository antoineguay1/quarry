import { useSyncExternalStore } from 'react';

function getInitialTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('quarry-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let currentTheme: 'light' | 'dark' = getInitialTheme();
const listeners = new Set<() => void>();

function applyTheme(t: 'light' | 'dark') {
  currentTheme = t;
  document.documentElement.classList.toggle('dark', t === 'dark');
  localStorage.setItem('quarry-theme', t);
  listeners.forEach((fn) => fn());
}

// Apply on module load
applyTheme(currentTheme);

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getSnapshot() {
  return currentTheme;
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot);

  function toggleTheme() {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return { theme, toggleTheme };
}
