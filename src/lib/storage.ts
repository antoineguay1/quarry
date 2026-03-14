export const STORAGE_KEYS = {
  SHOWN_DATABASES: 'db-explorer-shown-databases',
  TABS: 'db-explorer-tabs',
  ACTIVE_TAB: 'db-explorer-active-tab',
  SIDEBAR: 'db-explorer-sidebar',
  SETTINGS: 'db-explorer-settings',
  TABLE_STATE_PREFIX: 'db-explorer-table-state',
  EDITOR_RATIO_PREFIX: 'db-explorer-editor-ratio',
} as const;

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore storage errors
  }
}
