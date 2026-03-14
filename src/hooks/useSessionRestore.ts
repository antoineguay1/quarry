import type { SavedConnection, SavedQuery, TabEntry } from '@/types';
import type { useConnections } from '@/hooks/useConnections';
import type { useTabs } from '@/hooks/useTabs';
import type { useSavedQueries } from '@/hooks/useSavedQueries';
import { STORAGE_KEYS } from '@/lib/storage';
import { invoke } from '@tauri-apps/api/core';
import { useEffect, useRef } from 'react';

export function useSessionRestore(
  connections: ReturnType<typeof useConnections>,
  tabsHook: ReturnType<typeof useTabs>,
  queries: ReturnType<typeof useSavedQueries>,
  setActivePanel: (panel: 'connections' | 'queries' | null) => void,
) {
  const {
    setSavedConnections,
    setExpanded,
    setConnLoading,
    setConnDatabases,
    setShownDatabases,
    setDbExpanded,
    setDbTables,
    getStoredShownDatabases,
    persistShownDatabases,
  } = connections;

  const { tabs, activeTabId, setTabs, setActiveTabId, markRestored } = tabsHook;

  const skipPanelSyncRef = useRef(false);

  useEffect(() => {
    void initialize();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function initialize() {
    let conns: SavedConnection[] = [];
    let savedQueryList: SavedQuery[] = [];
    try {
      [conns, savedQueryList] = await Promise.all([
        invoke<SavedConnection[]>('load_connections'),
        invoke<SavedQuery[]>('load_saved_queries'),
      ]);
    } catch {
      /* non-critical */
    }

    setSavedConnections(conns);
    queries.setSavedQueries(savedQueryList);

    // Restore tabs from previous session
    try {
      const storedTabs = localStorage.getItem(STORAGE_KEYS.TABS);
      const storedActiveTab = localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB);
      if (storedTabs) {
        const parsed: TabEntry[] = JSON.parse(storedTabs);
        const connNames = new Set(conns.map((c) => c.name));
        const queryIds = new Set(savedQueryList.map((q) => q.id));
        const valid = parsed.filter((t) => {
          if (t.type === 'browse') return connNames.has(t.connectionName) && !!t.database;
          if (t.type === 'saved-query')
            return !!t.savedQueryId && queryIds.has(t.savedQueryId);
          if (t.type === 'schema-diagram') return connNames.has(t.connectionName) && !!t.database;
          return false;
        });
        if (valid.length > 0) {
          setTabs(valid);
          const activeId =
            storedActiveTab && valid.find((t) => t.id === storedActiveTab)
              ? storedActiveTab
              : valid[valid.length - 1].id;
          skipPanelSyncRef.current = true;
          setActiveTabId(activeId);

          // Only expand the active tab's connection (if it's a browse tab)
          const activeTab = valid.find((t) => t.id === activeId);
          const activeConnName =
            activeTab?.type === 'browse' ? activeTab.connectionName : null;

          // Collect unique connection names from browse + schema-diagram tabs
          const dbTabs = valid.filter(
            (t): t is TabEntry & { database: string } =>
              (t.type === 'browse' || t.type === 'schema-diagram') && !!t.database
          );
          const browseConnNames = [
            ...new Set(dbTabs.map((t) => t.connectionName)),
          ];

          for (const name of browseConnNames) {
            setConnLoading((prev) => ({ ...prev, [name]: true }));
            if (name === activeConnName) {
              setExpanded((prev) => new Set([...prev, name]));
            }
          }

          void Promise.all(
            browseConnNames.map(async (name) => {
              try {
                await invoke('connect_saved', { name });
              } catch {
                setConnLoading((prev) => ({ ...prev, [name]: false }));
                setExpanded((prev) => {
                  const n = new Set(prev);
                  n.delete(name);
                  return n;
                });
                return;
              }
              setConnLoading((prev) => ({ ...prev, [name]: false }));

              // Load all databases to populate the count badge
              try {
                const databases = await invoke<string[]>('list_databases', { connection: name });
                setConnDatabases((prev) => ({ ...prev, [name]: databases }));
                const stored = getStoredShownDatabases();
                if (stored[name]) {
                  const filtered = stored[name].filter((d) => databases.includes(d));
                  stored[name] = filtered;
                  persistShownDatabases(stored);
                  setShownDatabases((prev) => ({ ...prev, [name]: filtered }));
                }
              } catch {
                // non-critical
              }

              // Connect each database and load tables
              const dbs = [
                ...new Set(
                  dbTabs
                    .filter((t) => t.connectionName === name)
                    .map((t) => t.database)
                ),
              ];
              await Promise.all(
                dbs.map(async (database) => {
                  try {
                    await invoke('connect_database', {
                      connection: name,
                      database,
                    });
                    const tables = await invoke<string[]>('list_tables', {
                      connection: name,
                      database,
                    });
                    const key = `${name}::${database}`;
                    setDbTables((prev) => ({ ...prev, [key]: tables }));
                    if (name === activeConnName) {
                      setDbExpanded((prev) => new Set([...prev, key]));
                    }
                  } catch {
                    // silently fail; DataTable has its own auto-reconnect
                  }
                })
              );
            })
          );
        }
      }
    } catch {
      /* corrupted storage, ignore */
    }

    markRestored();
  }

  // When a tab becomes active, sync the sidebar panel to match the tab type
  useEffect(() => {
    if (skipPanelSyncRef.current) {
      skipPanelSyncRef.current = false;
      return;
    }
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (activeTab?.type === 'browse') {
      setExpanded((prev) => new Set([...prev, activeTab.connectionName]));
      if (activeTab.database) {
        setDbExpanded((prev) =>
          new Set([...prev, `${activeTab.connectionName}::${activeTab.database}`])
        );
      }
      setActivePanel('connections');
    } else if (activeTab?.type === 'saved-query') {
      setActivePanel('queries');
    }
    // tabs intentionally omitted: effect should only fire on activeTabId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);
}
