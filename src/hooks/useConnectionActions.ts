import type { SavedConnection } from '@/types';
import type { useConnections } from '@/hooks/useConnections';
import type { useTabs } from '@/hooks/useTabs';
import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';

export function useConnectionActions(
  connections: ReturnType<typeof useConnections>,
  tabsHook: ReturnType<typeof useTabs>,
) {
  const {
    setExpanded,
    setConnErrors,
    setConnDatabases,
    setShownDatabases,
    setDbExpanded,
    setDbTables,
    getStoredShownDatabases,
    persistShownDatabases,
    loadConnections,
    refreshConnection,
    setDatabaseShown,
  } = connections;

  const { setTabs, setActiveTabId } = tabsHook;

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editConnection, setEditConnection] = useState<SavedConnection | null>(
    null
  );

  async function handleConnected(name: string, defaultDatabase?: string) {
    setExpanded((prev) => new Set([...prev, name]));
    setModalOpen(false);
    void loadConnections();
    try {
      const databases = await invoke<string[]>("list_databases", { connection: name });
      setConnDatabases((prev) => ({ ...prev, [name]: databases }));
      const stored = getStoredShownDatabases();
      if (!stored[name]) {
        const defaultDb = defaultDatabase && databases.includes(defaultDatabase)
          ? defaultDatabase
          : databases[0] ?? "";
        const shown = defaultDb ? [defaultDb] : [];
        stored[name] = shown;
        persistShownDatabases(stored);
        setShownDatabases((prev) => ({ ...prev, [name]: shown }));
      } else {
        const filtered = stored[name].filter((d) => databases.includes(d));
        stored[name] = filtered;
        persistShownDatabases(stored);
        setShownDatabases((prev) => ({ ...prev, [name]: filtered }));
      }
    } catch {
      // non-critical: badge just won't show
    }
  }

  function handleEditConnected(newName: string, _defaultDatabase?: string) {
    const oldName = editConnection!.name;

    setConnDatabases((prev) => {
      const next = { ...prev };
      if (next[oldName]) {
        next[newName] = next[oldName];
        delete next[oldName];
      }
      return next;
    });

    setShownDatabases((prev) => {
      const next = { ...prev };
      if (next[oldName]) {
        next[newName] = next[oldName];
        delete next[oldName];
      }
      const stored = getStoredShownDatabases();
      if (stored[oldName]) {
        stored[newName] = stored[oldName];
        delete stored[oldName];
        persistShownDatabases(stored);
      }
      return next;
    });

    setDbExpanded((prev) => {
      const next = new Set<string>();
      for (const k of prev) {
        if (k.startsWith(`${oldName}::`)) {
          next.add(`${newName}::${k.slice(oldName.length + 2)}`);
        } else {
          next.add(k);
        }
      }
      return next;
    });

    setDbTables((prev) => {
      const next: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (k.startsWith(`${oldName}::`)) {
          next[`${newName}::${k.slice(oldName.length + 2)}`] = v;
        } else {
          next[k] = v;
        }
      }
      return next;
    });

    setExpanded((prev) => {
      const next = new Set(prev);
      next.delete(oldName);
      next.add(newName);
      return next;
    });

    setConnErrors((prev) => {
      const next = { ...prev };
      delete next[oldName];
      return next;
    });

    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.connectionName !== oldName) return tab;
        if (tab.type === 'saved-query')
          return { ...tab, connectionName: newName };
        const newId = `${newName}::${tab.database!}::browse::${tab.table!}`;
        return { ...tab, connectionName: newName, id: newId };
      })
    );

    setActiveTabId((cur) => {
      if (!cur || !cur.startsWith(`${oldName}::`)) return cur;
      return `${newName}::${cur.slice(oldName.length + 2)}`;
    });

    setEditConnection(null);
    void loadConnections();
  }

  async function handleConfirmDelete() {
    if (!deleteConfirm) return;
    const name = deleteConfirm;
    setDeleteConfirm(null);

    await invoke('delete_connection', { name });

    setConnDatabases((prev) => {
      const n = { ...prev };
      delete n[name];
      return n;
    });
    setShownDatabases((prev) => {
      const n = { ...prev };
      delete n[name];
      const stored = getStoredShownDatabases();
      delete stored[name];
      persistShownDatabases(stored);
      return n;
    });
    setDbExpanded((prev) => {
      const next = new Set<string>();
      for (const k of prev) {
        if (!k.startsWith(`${name}::`)) next.add(k);
      }
      return next;
    });
    setDbTables((prev) => {
      const n = { ...prev };
      for (const k of Object.keys(n)) {
        if (k.startsWith(`${name}::`)) delete n[k];
      }
      return n;
    });
    setConnErrors((prev) => {
      const n = { ...prev };
      delete n[name];
      return n;
    });
    setExpanded((prev) => {
      const n = new Set(prev);
      n.delete(name);
      return n;
    });

    setTabs((prev) => {
      const remaining = prev.filter((t) => t.connectionName !== name);
      setActiveTabId((cur) => {
        const curBelongs =
          prev.find((t) => t.id === cur)?.connectionName === name;
        return curBelongs ? remaining[0]?.id ?? null : cur;
      });
      return remaining;
    });

    await loadConnections();
  }

  function closeDatabaseTabs(connectionName: string, database: string) {
    const prefix = `${connectionName}::${database}::browse::`;
    setTabs((prev) => {
      const remaining = prev.filter((t) => !t.id.startsWith(prefix));
      setActiveTabId((cur) => {
        if (cur && cur.startsWith(prefix)) {
          return remaining[0]?.id ?? null;
        }
        return cur;
      });
      return remaining;
    });
  }

  function handleRenameDatabase(connName: string, oldName: string, newName: string) {
    setShownDatabases((prev) => {
      const next = { ...prev };
      if (next[connName]) {
        next[connName] = next[connName].map((d) => (d === oldName ? newName : d));
        const stored = getStoredShownDatabases();
        stored[connName] = next[connName];
        persistShownDatabases(stored);
      }
      return next;
    });
    setDbExpanded((prev) => {
      const next = new Set<string>();
      for (const k of prev) {
        next.add(k === `${connName}::${oldName}` ? `${connName}::${newName}` : k);
      }
      return next;
    });
    setDbTables((prev) => {
      const next: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(prev)) {
        next[k === `${connName}::${oldName}` ? `${connName}::${newName}` : k] = v;
      }
      return next;
    });
    const oldPrefix = `${connName}::${oldName}::browse::`;
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.connectionName !== connName || tab.database !== oldName || tab.type !== 'browse') return tab;
        const newId = `${connName}::${newName}::browse::${tab.table!}`;
        return { ...tab, database: newName, id: newId };
      })
    );
    setActiveTabId((cur) => {
      if (!cur || !cur.startsWith(oldPrefix)) return cur;
      return `${connName}::${newName}::browse::${cur.slice(oldPrefix.length)}`;
    });
    void refreshConnection(connName);
  }

  function handleDropDatabase(connName: string, dbName: string) {
    closeDatabaseTabs(connName, dbName);
    setShownDatabases((prev) => {
      const next = { ...prev };
      if (next[connName]) {
        next[connName] = next[connName].filter((d) => d !== dbName);
        const stored = getStoredShownDatabases();
        stored[connName] = next[connName];
        persistShownDatabases(stored);
      }
      return next;
    });
    setDbExpanded((prev) => {
      const next = new Set(prev);
      next.delete(`${connName}::${dbName}`);
      return next;
    });
    setDbTables((prev) => {
      const next = { ...prev };
      delete next[`${connName}::${dbName}`];
      return next;
    });
    void refreshConnection(connName);
  }

  function handleSetDatabaseShown(
    connectionName: string,
    database: string,
    visible: boolean
  ) {
    setDatabaseShown(connectionName, database, visible);
    if (!visible) {
      closeDatabaseTabs(connectionName, database);
    }
  }

  return {
    modalOpen,
    setModalOpen,
    deleteConfirm,
    setDeleteConfirm,
    editConnection,
    setEditConnection,
    handleConnected,
    handleEditConnected,
    handleConfirmDelete,
    handleRenameDatabase,
    handleDropDatabase,
    handleSetDatabaseShown,
  };
}
