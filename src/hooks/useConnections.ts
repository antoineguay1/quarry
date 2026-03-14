import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SavedConnection } from "@/types";
import { STORAGE_KEYS } from "@/lib/storage";

function getStoredShownDatabases(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SHOWN_DATABASES);
    return raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    return {};
  }
}

function persistShownDatabases(data: Record<string, string[]>) {
  localStorage.setItem(STORAGE_KEYS.SHOWN_DATABASES, JSON.stringify(data));
}

export function useConnections() {
  const [savedConnections, setSavedConnections] = useState<SavedConnection[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [connLoading, setConnLoading] = useState<Record<string, boolean>>({});
  const [connErrors, setConnErrors] = useState<Record<string, string>>({});

  // All known databases per connection (populated after first connect)
  const [connDatabases, setConnDatabases] = useState<Record<string, string[]>>({});
  // Visible databases per connection (persisted to localStorage)
  const [shownDatabases, setShownDatabases] = useState<Record<string, string[]>>(
    () => getStoredShownDatabases()
  );
  // "connName::dbName" expanded state
  const [dbExpanded, setDbExpanded] = useState<Set<string>>(new Set());
  // "connName::dbName" → tables
  const [dbTables, setDbTables] = useState<Record<string, string[]>>({});
  const [dbLoading, setDbLoading] = useState<Record<string, boolean>>({});
  const [dbErrors, setDbErrors] = useState<Record<string, string>>({});

  async function loadConnections() {
    try {
      const conns = await invoke<SavedConnection[]>('load_connections');
      setSavedConnections(conns);
    } catch {
      // non-critical
    }
  }

  async function toggleConnection(conn: SavedConnection) {
    const { name } = conn;

    if (expanded.has(name)) {
      setExpanded((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
      return;
    }

    // If databases already loaded, just expand
    if (connDatabases[name]) {
      setExpanded((prev) => new Set([...prev, name]));
      return;
    }

    setConnLoading((prev) => ({ ...prev, [name]: true }));
    setConnErrors((prev) => ({ ...prev, [name]: "" }));
    try {
      await invoke('connect_saved', { name });
      const databases = await invoke<string[]>('list_databases', { connection: name });
      setConnDatabases((prev) => ({ ...prev, [name]: databases }));

      // Restore or initialize shownDatabases
      const stored = getStoredShownDatabases();
      if (!stored[name]) {
        // First time: show only the default database
        const defaultDb = conn.database && databases.includes(conn.database)
          ? conn.database
          : databases[0] ?? "";
        const shown = defaultDb ? [defaultDb] : [];
        stored[name] = shown;
        persistShownDatabases(stored);
        setShownDatabases((prev) => ({ ...prev, [name]: shown }));
      } else {
        // Restore, filtering to only databases that still exist
        const filtered = stored[name].filter((d) => databases.includes(d));
        stored[name] = filtered;
        persistShownDatabases(stored);
        setShownDatabases((prev) => ({ ...prev, [name]: filtered }));
      }

      setExpanded((prev) => new Set([...prev, name]));
    } catch (err) {
      setConnErrors((prev) => ({ ...prev, [name]: String(err) }));
    } finally {
      setConnLoading((prev) => ({ ...prev, [name]: false }));
    }
  }

  async function toggleDatabase(connectionName: string, database: string) {
    const key = `${connectionName}::${database}`;

    if (dbExpanded.has(key)) {
      setDbExpanded((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      return;
    }

    if (dbTables[key]) {
      setDbExpanded((prev) => new Set([...prev, key]));
      return;
    }

    setDbLoading((prev) => ({ ...prev, [key]: true }));
    setDbErrors((prev) => ({ ...prev, [key]: "" }));
    try {
      await invoke('connect_database', { connection: connectionName, database });
      const tables = await invoke<string[]>('list_tables', {
        connection: connectionName,
        database,
      });
      setDbTables((prev) => ({ ...prev, [key]: tables }));
      setDbExpanded((prev) => new Set([...prev, key]));
    } catch (err) {
      setDbErrors((prev) => ({ ...prev, [key]: String(err) }));
    } finally {
      setDbLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  function setDatabaseShown(connectionName: string, database: string, visible: boolean) {
    setShownDatabases((prev) => {
      const current = prev[connectionName] ?? [];
      const next = visible
        ? current.includes(database) ? current : [...current, database]
        : current.filter((d) => d !== database);
      const newState = { ...prev, [connectionName]: next };
      const stored = getStoredShownDatabases();
      stored[connectionName] = next;
      persistShownDatabases(stored);
      return newState;
    });
  }

  async function refreshConnection(connName: string) {
    setConnLoading((prev) => ({ ...prev, [connName]: true }));
    setConnErrors((prev) => ({ ...prev, [connName]: "" }));
    try {
      const databases = await invoke<string[]>('list_databases', { connection: connName });
      setConnDatabases((prev) => ({ ...prev, [connName]: databases }));
      // Filter shown databases to only those that still exist
      const stored = getStoredShownDatabases();
      if (stored[connName]) {
        const filtered = stored[connName].filter((d) => databases.includes(d));
        stored[connName] = filtered;
        persistShownDatabases(stored);
        setShownDatabases((prev) => ({ ...prev, [connName]: filtered }));
      }
      // Clear cached tables and collapse expanded databases so they re-fetch on next expand
      setDbTables((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (k.startsWith(`${connName}::`)) delete next[k];
        }
        return next;
      });
      setDbExpanded((prev) => {
        const next = new Set(prev);
        for (const k of [...next]) {
          if (k.startsWith(`${connName}::`)) next.delete(k);
        }
        return next;
      });
    } catch (err) {
      setConnErrors((prev) => ({ ...prev, [connName]: String(err) }));
    } finally {
      setConnLoading((prev) => ({ ...prev, [connName]: false }));
    }
  }

  async function refreshDatabase(connName: string, dbName: string) {
    const key = `${connName}::${dbName}`;
    setDbLoading((prev) => ({ ...prev, [key]: true }));
    setDbErrors((prev) => ({ ...prev, [key]: "" }));
    try {
      const tables = await invoke<string[]>('list_tables', {
        connection: connName,
        database: dbName,
      });
      setDbTables((prev) => ({ ...prev, [key]: tables }));
    } catch (err) {
      setDbErrors((prev) => ({ ...prev, [key]: String(err) }));
    } finally {
      setDbLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  return {
    savedConnections,
    setSavedConnections,
    expanded,
    setExpanded,
    connLoading,
    setConnLoading,
    connErrors,
    setConnErrors,
    connDatabases,
    setConnDatabases,
    shownDatabases,
    setShownDatabases,
    dbExpanded,
    setDbExpanded,
    dbTables,
    setDbTables,
    dbLoading,
    dbErrors,
    setDbErrors,
    loadConnections,
    toggleConnection,
    toggleDatabase,
    setDatabaseShown,
    getStoredShownDatabases,
    persistShownDatabases,
    refreshConnection,
    refreshDatabase,
  };
}
