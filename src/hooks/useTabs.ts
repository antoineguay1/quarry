import { useEffect, useRef, useState } from "react";
import type { ColumnTypeCategory, FilterEntry, SavedQuery, TabEntry } from "@/types";
import { STORAGE_KEYS } from "@/lib/storage";

export function useTabs() {
  const [tabs, setTabs] = useState<TabEntry[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const tabsRestoredRef = useRef(false);

  // Persist tabs (minus transient fields, preview tabs excluded) whenever they change
  useEffect(() => {
    if (!tabsRestoredRef.current) return;
    const toSave = tabs
      .filter((t) => !t.preview && t.type !== "create-table")
      .map(({ initialFilters: _f, filterKey: _k, refreshKey: _r, preview: _p, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(toSave));
  }, [tabs]);

  // Persist active tab id
  useEffect(() => {
    if (!tabsRestoredRef.current) return;
    if (activeTabId !== null) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, activeTabId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_TAB);
    }
  }, [activeTabId]);

  // Close active tab on Ctrl/Cmd+W
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTabId]); // eslint-disable-line react-hooks/exhaustive-deps

  function markRestored() {
    tabsRestoredRef.current = true;
  }

  function closeTab(id: string) {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        setActiveTabId(next[Math.min(idx, next.length - 1)]?.id ?? null);
      }
      return next;
    });
  }

  function promoteTab(id: string) {
    setTabs((prev) => prev.map((t) => t.id === id ? { ...t, preview: false } : t));
  }

  function openTable(connectionName: string, database: string, table: string, preview = true) {
    const id = `${connectionName}::${database}::browse::${table}`;
    setTabs((prev) => {
      const existing = prev.find((t) => t.id === id);
      if (existing) {
        // Promote if opening as permanent and tab is currently preview
        if (!preview && existing.preview) {
          return prev.map((t) => t.id === id ? { ...t, preview: false } : t);
        }
        return prev;
      }
      if (preview) {
        // Replace existing preview tab with this one
        const withoutPreview = prev.filter((t) => !t.preview);
        return [...withoutPreview, { id, connectionName, database, type: "browse", table, preview: true }];
      }
      return [...prev, { id, connectionName, database, type: "browse", table }];
    });
    setActiveTabId(id);
  }

  function openSavedQuery(query: SavedQuery, preview = true) {
    const id = `saved::${query.id}`;
    setTabs((prev) => {
      const existing = prev.find((t) => t.id === id);
      if (existing) {
        if (!preview && existing.preview) {
          return prev.map((t) => t.id === id ? { ...t, preview: false } : t);
        }
        return prev;
      }
      if (preview) {
        const withoutPreview = prev.filter((t) => !t.preview);
        return [...withoutPreview, { id, connectionName: query.connectionName, type: "saved-query", savedQueryId: query.id, preview: true }];
      }
      return [...prev, { id, connectionName: query.connectionName, type: "saved-query", savedQueryId: query.id }];
    });
    setActiveTabId(id);
  }

  function navigateFk(
    connectionName: string,
    database: string,
    refTable: string,
    refCol: string,
    value: string,
    colType: ColumnTypeCategory,
  ) {
    const filter: FilterEntry = { col: refCol, value, caseSensitive: true, colType, exact: true };
    const id = `${connectionName}::${database}::browse::${refTable}`;
    setTabs((prev) => {
      const existing = prev.find((t) => t.id === id);
      if (existing) {
        return prev.map((t) =>
          t.id === id ? { ...t, initialFilters: [filter], filterKey: (t.filterKey ?? 0) + 1 } : t
        );
      }
      return [
        ...prev,
        { id, connectionName, database, type: "browse", table: refTable, initialFilters: [filter], filterKey: 1 },
      ];
    });
    setActiveTabId(id);
  }

  function openSchemaDiagram(connectionName: string, database: string) {
    const id = `schema::${connectionName}::${database}`;
    setTabs((prev) => {
      if (prev.find((t) => t.id === id)) return prev;
      return [...prev, { id, connectionName, database, type: "schema-diagram" }];
    });
    setActiveTabId(id);
  }

  function openCreateTable(connectionName: string, database: string) {
    const id = `create-table::${connectionName}::${database}`;
    setTabs((prev) => {
      if (prev.find((t) => t.id === id)) return prev;
      return [...prev, { id, connectionName, database, type: "create-table" }];
    });
    setActiveTabId(id);
  }

  function refreshTab(tabId: string) {
    setTabs((prev) =>
      prev.map((t) => t.id === tabId ? { ...t, refreshKey: (t.refreshKey ?? 0) + 1 } : t)
    );
  }

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    markRestored,
    closeTab,
    promoteTab,
    openTable,
    openSavedQuery,
    navigateFk,
    refreshTab,
    openCreateTable,
    openSchemaDiagram,
  };
}
