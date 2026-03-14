import type { Dispatch, SetStateAction } from 'react';
import type { SavedQuery, TabEntry } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';

interface Options {
  openSavedQuery: (query: SavedQuery, preview?: boolean) => void;
  closeTab: (id: string) => void;
  setTabs: Dispatch<SetStateAction<TabEntry[]>>;
  setActivePanel: (panel: 'connections' | 'queries' | 'settings' | null) => void;
}

export function useSavedQueries({ openSavedQuery, closeTab, setTabs, setActivePanel }: Options) {
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [deleteQueryConfirm, setDeleteQueryConfirm] = useState<string | null>(null);
  const [pendingRenameQueryId, setPendingRenameQueryId] = useState<string | null>(null);
  const [showConnPicker, setShowConnPicker] = useState(false);

  async function handleCreateQuery(connectionName: string) {
    const existingNums = savedQueries
      .map((q) => q.name)
      .filter((n) => /^New Query \d+$/.test(n))
      .map((n) => parseInt(n.replace('New Query ', ''), 10));
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
    const name = `New Query ${nextNum}`;

    const id = Date.now().toString();
    const query: SavedQuery = { id, name, sql: '', connectionName };
    await invoke('save_query', { query });
    setSavedQueries((prev) => [...prev, query]);

    openSavedQuery(query, false);
    setShowConnPicker(false);
    setActivePanel('queries');
    setPendingRenameQueryId(id);
  }

  function handleUpdateQuery(
    queryId: string,
    updates: Partial<Omit<SavedQuery, 'id'>>
  ) {
    setSavedQueries((prev) =>
      prev.map((q) => {
        if (q.id !== queryId) return q;
        const updated = { ...q, ...updates };
        void invoke('save_query', { query: updated }).catch((e) =>
          console.error('Auto-save failed:', e),
        );
        return updated;
      })
    );
    if (updates.connectionName !== undefined) {
      setTabs((prev) =>
        prev.map((t) =>
          t.savedQueryId === queryId
            ? { ...t, connectionName: updates.connectionName! }
            : t
        )
      );
    }
  }

  async function handleDeleteSavedQuery(id: string) {
    await invoke('delete_saved_query', { id });
    setSavedQueries((prev) => prev.filter((q) => q.id !== id));
    closeTab(`saved::${id}`);
  }

  async function handleConfirmDeleteQuery() {
    if (!deleteQueryConfirm) return;
    const id = deleteQueryConfirm;
    setDeleteQueryConfirm(null);
    await handleDeleteSavedQuery(id);
  }

  return {
    savedQueries,
    setSavedQueries,
    deleteQueryConfirm,
    setDeleteQueryConfirm,
    pendingRenameQueryId,
    setPendingRenameQueryId,
    showConnPicker,
    setShowConnPicker,
    handleCreateQuery,
    handleUpdateQuery,
    handleDeleteSavedQuery,
    handleConfirmDeleteQuery,
  };
}
