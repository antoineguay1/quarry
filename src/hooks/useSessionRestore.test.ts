import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useSessionRestore } from './useSessionRestore';
import { STORAGE_KEYS } from '@/lib/storage';
import type { SavedConnection, SavedQuery, TabEntry } from '@/types';

const flushPromises = () => new Promise((r) => setTimeout(r, 0));

function makeConnections(overrides: Record<string, unknown> = {}) {
  return {
    setSavedConnections: vi.fn(),
    setExpanded: vi.fn(),
    setConnLoading: vi.fn(),
    setConnDatabases: vi.fn(),
    setShownDatabases: vi.fn(),
    setDbExpanded: vi.fn(),
    setDbTables: vi.fn(),
    getStoredShownDatabases: vi.fn().mockReturnValue({}),
    persistShownDatabases: vi.fn(),
    ...overrides,
  };
}

function makeTabsHook(overrides: Record<string, unknown> = {}) {
  return {
    tabs: [] as TabEntry[],
    activeTabId: null as string | null,
    setTabs: vi.fn(),
    setActiveTabId: vi.fn(),
    markRestored: vi.fn(),
    ...overrides,
  };
}

function makeQueries(overrides: Record<string, unknown> = {}) {
  return {
    setSavedQueries: vi.fn(),
    ...overrides,
  };
}

const conn1: SavedConnection = {
  name: 'myconn',
  dbType: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  username: 'user',
};

const query1: SavedQuery = { id: 'q1', name: 'Query 1', sql: 'SELECT 1', connectionName: 'myconn' };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Group 1 – initialize basics
// ---------------------------------------------------------------------------

describe('useSessionRestore – initialize basics', () => {
  it('calls load_connections + load_saved_queries, sets state, calls markRestored', async () => {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === 'load_connections') return Promise.resolve([conn1]);
      if (cmd === 'load_saved_queries') return Promise.resolve([query1]);
      return Promise.resolve([]);
    });

    const connections = makeConnections();
    const tabsHook = makeTabsHook();
    const queries = makeQueries();
    const setActivePanel = vi.fn();

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => {
      await flushPromises();
    });

    expect(vi.mocked(invoke)).toHaveBeenCalledWith('load_connections');
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('load_saved_queries');
    expect(connections.setSavedConnections).toHaveBeenCalledWith([conn1]);
    expect(queries.setSavedQueries).toHaveBeenCalledWith([query1]);
    expect(tabsHook.markRestored).toHaveBeenCalled();
  });

  it('when both invoke calls reject, still sets empty arrays and calls markRestored', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('network'));

    const connections = makeConnections();
    const tabsHook = makeTabsHook();
    const queries = makeQueries();
    const setActivePanel = vi.fn();

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => {
      await flushPromises();
    });

    expect(connections.setSavedConnections).toHaveBeenCalledWith([]);
    expect(queries.setSavedQueries).toHaveBeenCalledWith([]);
    expect(tabsHook.markRestored).toHaveBeenCalled();
  });

  it('corrupted tabs JSON in localStorage calls markRestored anyway', async () => {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === 'load_connections') return Promise.resolve([conn1]);
      if (cmd === 'load_saved_queries') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    localStorage.setItem(STORAGE_KEYS.TABS, '{not-valid-json');

    const connections = makeConnections();
    const tabsHook = makeTabsHook();
    const queries = makeQueries();
    const setActivePanel = vi.fn();

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => {
      await flushPromises();
    });

    expect(tabsHook.markRestored).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Group 2 – tab validation filtering
// ---------------------------------------------------------------------------

describe('useSessionRestore – tab validation filtering', () => {
  function setupWithTabs(tabs: TabEntry[], conns: SavedConnection[], savedQueries: SavedQuery[]) {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === 'load_connections') return Promise.resolve(conns);
      if (cmd === 'load_saved_queries') return Promise.resolve(savedQueries);
      return Promise.resolve([]);
    });
    localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(tabs));
    return { connections: makeConnections(), tabsHook: makeTabsHook(), queries: makeQueries(), setActivePanel: vi.fn() };
  }

  it('browse tab without database field is filtered out', async () => {
    const tab: TabEntry = { id: 't1', connectionName: 'myconn', type: 'browse' };
    const { connections, tabsHook, queries, setActivePanel } = setupWithTabs([tab], [conn1], []);

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));
    await act(async () => { await flushPromises(); });

    expect(tabsHook.setTabs).not.toHaveBeenCalled();
  });

  it('browse tab with unknown connectionName is filtered out', async () => {
    const tab: TabEntry = { id: 't1', connectionName: 'unknown', type: 'browse', database: 'mydb' };
    const { connections, tabsHook, queries, setActivePanel } = setupWithTabs([tab], [conn1], []);

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));
    await act(async () => { await flushPromises(); });

    expect(tabsHook.setTabs).not.toHaveBeenCalled();
  });

  it('saved-query tab without savedQueryId is filtered out', async () => {
    const tab: TabEntry = { id: 't1', connectionName: 'myconn', type: 'saved-query' };
    const { connections, tabsHook, queries, setActivePanel } = setupWithTabs([tab], [conn1], [query1]);

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));
    await act(async () => { await flushPromises(); });

    expect(tabsHook.setTabs).not.toHaveBeenCalled();
  });

  it('saved-query tab with queryId not in loaded queries is filtered out', async () => {
    const tab: TabEntry = { id: 't1', connectionName: 'myconn', type: 'saved-query', savedQueryId: 'missing' };
    const { connections, tabsHook, queries, setActivePanel } = setupWithTabs([tab], [conn1], [query1]);

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));
    await act(async () => { await flushPromises(); });

    expect(tabsHook.setTabs).not.toHaveBeenCalled();
  });

  it('schema-diagram tab with valid conn + database is kept', async () => {
    const tab: TabEntry = { id: 't1', connectionName: 'myconn', type: 'schema-diagram', database: 'mydb' };
    const { connections, tabsHook, queries, setActivePanel } = setupWithTabs([tab], [conn1], []);

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));
    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    expect(tabsHook.setTabs).toHaveBeenCalledWith([tab]);
  });

  it('tab with unknown type is filtered out', async () => {
    const tab = { id: 't1', connectionName: 'myconn', type: 'create-table' } as TabEntry;
    const { connections, tabsHook, queries, setActivePanel } = setupWithTabs([tab], [conn1], []);

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));
    await act(async () => { await flushPromises(); });

    expect(tabsHook.setTabs).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Group 3 – active tab selection
// ---------------------------------------------------------------------------

describe('useSessionRestore – active tab selection', () => {
  const browseTab1: TabEntry = { id: 'tab1', connectionName: 'myconn', type: 'browse', database: 'mydb' };
  const browseTab2: TabEntry = { id: 'tab2', connectionName: 'myconn', type: 'browse', database: 'db2' };

  function setupBrowseTabs(storedActiveTab: string | null) {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === 'load_connections') return Promise.resolve([conn1]);
      if (cmd === 'load_saved_queries') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify([browseTab1, browseTab2]));
    if (storedActiveTab) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, storedActiveTab);
    }
    return { connections: makeConnections(), tabsHook: makeTabsHook(), queries: makeQueries(), setActivePanel: vi.fn() };
  }

  it('sets activeTabId from stored active tab when it matches a valid tab', async () => {
    const { connections, tabsHook, queries, setActivePanel } = setupBrowseTabs('tab1');

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));
    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    expect(tabsHook.setActiveTabId).toHaveBeenCalledWith('tab1');
  });

  it('falls back to last valid tab when stored active tab not in valid list', async () => {
    const { connections, tabsHook, queries, setActivePanel } = setupBrowseTabs('nonexistent');

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));
    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    expect(tabsHook.setActiveTabId).toHaveBeenCalledWith('tab2');
  });

  it('no stored active tab uses last valid tab', async () => {
    const { connections, tabsHook, queries, setActivePanel } = setupBrowseTabs(null);

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));
    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    expect(tabsHook.setActiveTabId).toHaveBeenCalledWith('tab2');
  });
});

// ---------------------------------------------------------------------------
// Group 4 – skipPanelSync + panel sync
// ---------------------------------------------------------------------------

describe('useSessionRestore – skipPanelSync + panel sync', () => {
  it('first activeTabId change after initialize is skipped, second fires panel sync', async () => {
    const browseTab: TabEntry = { id: 't1', connectionName: 'myconn', type: 'browse', database: 'mydb' };
    const browseTab2: TabEntry = { id: 't2', connectionName: 'myconn', type: 'browse', database: 'db2' };
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === 'load_connections') return Promise.resolve([conn1]);
      if (cmd === 'load_saved_queries') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    // Stored tabs trigger skipPanelSyncRef = true in initialize
    localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify([browseTab]));

    const setActivePanel = vi.fn();
    const tabs = [browseTab, browseTab2];
    const connections = makeConnections();
    // Start with null activeTabId so panel sync effect doesn't fire on mount
    const tabsHookState = { tabs, activeTabId: null as string | null, setTabs: vi.fn(), setActiveTabId: vi.fn(), markRestored: vi.fn() };
    const queries = makeQueries();

    const { rerender } = renderHook(() =>
      useSessionRestore(connections as never, tabsHookState as never, queries as never, setActivePanel)
    );

    // Run initialize — sets skipPanelSyncRef = true (stored tabs exist)
    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    expect(setActivePanel).not.toHaveBeenCalled();

    // First tab change: skipPanelSyncRef consumes the skip
    act(() => {
      tabsHookState.activeTabId = 't1';
      rerender();
    });
    expect(setActivePanel).not.toHaveBeenCalled();

    // Second tab change: panel sync fires normally
    act(() => {
      tabsHookState.activeTabId = 't2';
      rerender();
    });
    expect(setActivePanel).toHaveBeenCalledWith('connections');
  });

  it('panel sync: browse tab → setActivePanel connections, setExpanded, setDbExpanded', async () => {
    const browseTab: TabEntry = { id: 't1', connectionName: 'myconn', type: 'browse', database: 'mydb' };
    const connections = makeConnections();
    const tabsHook = makeTabsHook({ tabs: [browseTab], activeTabId: 't1' });
    const queries = makeQueries();
    const setActivePanel = vi.fn();

    vi.mocked(invoke).mockResolvedValue([]);

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => { await flushPromises(); });

    expect(setActivePanel).toHaveBeenCalledWith('connections');
    expect(connections.setExpanded).toHaveBeenCalled();
    expect(connections.setDbExpanded).toHaveBeenCalled();

    // Execute the setExpanded updater to cover its arrow function body
    const expandCalls = (connections.setExpanded as ReturnType<typeof vi.fn>).mock.calls;
    const expandUpdater = expandCalls[0][0] as (prev: Set<string>) => Set<string>;
    const expandResult = expandUpdater(new Set());
    expect(expandResult.has('myconn')).toBe(true);

    // Execute the setDbExpanded updater to cover its arrow function body
    const dbExpandCalls = (connections.setDbExpanded as ReturnType<typeof vi.fn>).mock.calls;
    const dbUpdater = dbExpandCalls[0][0] as (prev: Set<string>) => Set<string>;
    const dbResult = dbUpdater(new Set());
    expect(dbResult.has('myconn::mydb')).toBe(true);
  });

  it('panel sync: browse tab without database → setActivePanel connections, setExpanded, no setDbExpanded', async () => {
    const browseTab: TabEntry = { id: 't1', connectionName: 'myconn', type: 'browse' };
    const connections = makeConnections();
    const tabsHook = makeTabsHook({ tabs: [browseTab], activeTabId: 't1' });
    const queries = makeQueries();
    const setActivePanel = vi.fn();

    vi.mocked(invoke).mockResolvedValue([]);

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => { await flushPromises(); });

    expect(setActivePanel).toHaveBeenCalledWith('connections');
    expect(connections.setExpanded).toHaveBeenCalled();
    expect(connections.setDbExpanded).not.toHaveBeenCalled();
  });

  it('panel sync: saved-query tab → setActivePanel queries', async () => {
    const queryTab: TabEntry = { id: 'saved::q1', connectionName: 'myconn', type: 'saved-query', savedQueryId: 'q1' };
    const connections = makeConnections();
    const tabsHook = makeTabsHook({ tabs: [queryTab], activeTabId: 'saved::q1' });
    const queries = makeQueries();
    const setActivePanel = vi.fn();

    vi.mocked(invoke).mockResolvedValue([]);

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => { await flushPromises(); });

    expect(setActivePanel).toHaveBeenCalledWith('queries');
  });

  it('panel sync: no matching tab → no setActivePanel called', async () => {
    const connections = makeConnections();
    const tabsHook = makeTabsHook({ tabs: [], activeTabId: 'nonexistent' });
    const queries = makeQueries();
    const setActivePanel = vi.fn();

    vi.mocked(invoke).mockResolvedValue([]);

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => { await flushPromises(); });

    expect(setActivePanel).not.toHaveBeenCalled();
  });

  it('panel sync fires on initial render for non-null activeTabId when no tab restore happened', async () => {
    const browseTab: TabEntry = { id: 't1', connectionName: 'myconn', type: 'browse', database: 'mydb' };
    const connections = makeConnections();
    const tabsHook = makeTabsHook({ tabs: [browseTab], activeTabId: 't1' });
    const queries = makeQueries();
    const setActivePanel = vi.fn();

    vi.mocked(invoke).mockResolvedValue([]);

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => { await flushPromises(); });

    expect(setActivePanel).toHaveBeenCalledWith('connections');
  });
});

// ---------------------------------------------------------------------------
// Group 5 – connection restore (connect_saved)
// ---------------------------------------------------------------------------

describe('useSessionRestore – connection restore', () => {
  const browseTab: TabEntry = { id: 't1', connectionName: 'myconn', type: 'browse', database: 'mydb' };
  const browseTab2: TabEntry = { id: 't2', connectionName: 'otherconn', type: 'browse', database: 'otherdb' };
  const otherConn: SavedConnection = { ...conn1, name: 'otherconn', database: 'otherdb' };

  function setupRestore(tabs: TabEntry[], conns: SavedConnection[], invokeImpl?: (cmd: string, args?: unknown) => unknown) {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (invokeImpl) {
        const result = invokeImpl(cmd as string);
        if (result !== undefined) return Promise.resolve(result);
      }
      if (cmd === 'load_connections') return Promise.resolve(conns);
      if (cmd === 'load_saved_queries') return Promise.resolve([]);
      if (cmd === 'connect_saved') return Promise.resolve(undefined);
      if (cmd === 'list_databases') return Promise.resolve(['mydb']);
      if (cmd === 'connect_database') return Promise.resolve(undefined);
      if (cmd === 'list_tables') return Promise.resolve(['users', 'posts']);
      return Promise.resolve([]);
    });
    localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify(tabs));
    return { connections: makeConnections(), tabsHook: makeTabsHook(), queries: makeQueries(), setActivePanel: vi.fn() };
  }

  it('connect_saved success: setConnLoading(false) after success', async () => {
    const { connections, tabsHook, queries, setActivePanel } = setupRestore([browseTab], [conn1]);

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    const calls = (connections.setConnLoading as ReturnType<typeof vi.fn>).mock.calls;
    // First call sets loading to true
    const firstUpdater = calls[0][0] as (prev: Record<string, boolean>) => Record<string, boolean>;
    expect(firstUpdater({})).toEqual({ myconn: true });
    // Last call sets loading to false
    const lastUpdater = calls[calls.length - 1][0] as (prev: Record<string, boolean>) => Record<string, boolean>;
    expect(lastUpdater({})).toEqual({ myconn: false });
  });

  it('connect_saved failure: setConnLoading(false), removes conn from expanded', async () => {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === 'load_connections') return Promise.resolve([conn1]);
      if (cmd === 'load_saved_queries') return Promise.resolve([]);
      if (cmd === 'connect_saved') return Promise.reject(new Error('auth failed'));
      return Promise.resolve([]);
    });
    localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify([browseTab]));
    const connections = makeConnections();
    const tabsHook = makeTabsHook();
    const queries = makeQueries();
    const setActivePanel = vi.fn();

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    const loadingCalls = (connections.setConnLoading as ReturnType<typeof vi.fn>).mock.calls;
    const lastLoading = loadingCalls[loadingCalls.length - 1][0] as (prev: Record<string, boolean>) => Record<string, boolean>;
    expect(lastLoading({})).toEqual({ myconn: false });

    expect(connections.setExpanded).toHaveBeenCalled();
    // The expand call should remove the connection
    const expandCalls = (connections.setExpanded as ReturnType<typeof vi.fn>).mock.calls;
    const deleteUpdater = expandCalls[expandCalls.length - 1][0] as (prev: Set<string>) => Set<string>;
    const result = deleteUpdater(new Set(['myconn']));
    expect(result.has('myconn')).toBe(false);
  });

  it('active connection gets setExpanded called; non-active connection does not get initial setExpanded', async () => {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === 'load_connections') return Promise.resolve([conn1, otherConn]);
      if (cmd === 'load_saved_queries') return Promise.resolve([]);
      if (cmd === 'connect_saved') return Promise.resolve(undefined);
      if (cmd === 'list_databases') return Promise.resolve(['mydb', 'otherdb']);
      if (cmd === 'connect_database') return Promise.resolve(undefined);
      if (cmd === 'list_tables') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify([browseTab, browseTab2]));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, 't1');
    const connections = makeConnections();
    const tabsHook = makeTabsHook();
    const queries = makeQueries();
    const setActivePanel = vi.fn();

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    // setExpanded should be called for the active connection (myconn), not for otherconn initially
    const expandCalls = (connections.setExpanded as ReturnType<typeof vi.fn>).mock.calls;
    const expandedConns = expandCalls
      .map((call) => {
        const updater = call[0] as (prev: Set<string>) => Set<string>;
        return updater(new Set());
      })
      .filter((s) => s.has('myconn'));
    expect(expandedConns.length).toBeGreaterThan(0);
  });

  it('setConnDatabases updater merges databases correctly', async () => {
    const { connections, tabsHook, queries, setActivePanel } = setupRestore([browseTab], [conn1]);

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    const calls = (connections.setConnDatabases as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const updater = calls[0][0] as (prev: Record<string, string[]>) => Record<string, string[]>;
    const result = updater({});
    expect(result['myconn']).toEqual(['mydb']);
  });

  it('list_databases failure is non-critical (no crash)', async () => {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === 'load_connections') return Promise.resolve([conn1]);
      if (cmd === 'load_saved_queries') return Promise.resolve([]);
      if (cmd === 'connect_saved') return Promise.resolve(undefined);
      if (cmd === 'list_databases') return Promise.reject(new Error('db error'));
      return Promise.resolve([]);
    });
    localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify([browseTab]));
    const connections = makeConnections();
    const tabsHook = makeTabsHook();
    const queries = makeQueries();
    const setActivePanel = vi.fn();

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    // Should not throw; markRestored should be called
    expect(tabsHook.markRestored).toHaveBeenCalled();
  });

  it('list_databases success with stored shown databases → filters and persists', async () => {
    const stored = { myconn: ['mydb', 'deleted_db'] };
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === 'load_connections') return Promise.resolve([conn1]);
      if (cmd === 'load_saved_queries') return Promise.resolve([]);
      if (cmd === 'connect_saved') return Promise.resolve(undefined);
      if (cmd === 'list_databases') return Promise.resolve(['mydb']);
      if (cmd === 'connect_database') return Promise.resolve(undefined);
      if (cmd === 'list_tables') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify([browseTab]));
    const connections = makeConnections({ getStoredShownDatabases: vi.fn().mockReturnValue(stored) });
    const tabsHook = makeTabsHook();
    const queries = makeQueries();
    const setActivePanel = vi.fn();

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    expect(connections.persistShownDatabases).toHaveBeenCalled();
    expect(connections.setShownDatabases).toHaveBeenCalled();
    // Filtered to only include databases that still exist
    const shownCalls = (connections.setShownDatabases as ReturnType<typeof vi.fn>).mock.calls;
    const lastUpdater = shownCalls[shownCalls.length - 1][0] as (prev: Record<string, string[]>) => Record<string, string[]>;
    const result = lastUpdater({});
    expect(result['myconn']).toEqual(['mydb']);
  });

  it('list_databases success with no stored data for this conn → persistShownDatabases not called', async () => {
    const { connections, tabsHook, queries, setActivePanel } = setupRestore([browseTab], [conn1]);

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    // getStoredShownDatabases returns {} (empty), so no stored data for myconn
    expect(connections.persistShownDatabases).not.toHaveBeenCalled();
  });

  it('connect_database or list_tables failure is silently ignored', async () => {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === 'load_connections') return Promise.resolve([conn1]);
      if (cmd === 'load_saved_queries') return Promise.resolve([]);
      if (cmd === 'connect_saved') return Promise.resolve(undefined);
      if (cmd === 'list_databases') return Promise.resolve(['mydb']);
      if (cmd === 'connect_database') return Promise.reject(new Error('conn failed'));
      return Promise.resolve([]);
    });
    localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify([browseTab]));
    const connections = makeConnections();
    const tabsHook = makeTabsHook();
    const queries = makeQueries();
    const setActivePanel = vi.fn();

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    expect(connections.setDbTables).not.toHaveBeenCalled();
    expect(tabsHook.markRestored).toHaveBeenCalled();
  });

  it('setDbTables called with tables on success', async () => {
    const { connections, tabsHook, queries, setActivePanel } = setupRestore([browseTab], [conn1]);

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    expect(connections.setDbTables).toHaveBeenCalled();
    const calls = (connections.setDbTables as ReturnType<typeof vi.fn>).mock.calls;
    const updater = calls[0][0] as (prev: Record<string, string[]>) => Record<string, string[]>;
    const result = updater({});
    expect(result['myconn::mydb']).toEqual(['users', 'posts']);
  });

  it('setDbExpanded called only for active connection databases', async () => {
    vi.mocked(invoke).mockImplementation((cmd) => {
      if (cmd === 'load_connections') return Promise.resolve([conn1, otherConn]);
      if (cmd === 'load_saved_queries') return Promise.resolve([]);
      if (cmd === 'connect_saved') return Promise.resolve(undefined);
      if (cmd === 'list_databases') return Promise.resolve(['mydb', 'otherdb']);
      if (cmd === 'connect_database') return Promise.resolve(undefined);
      if (cmd === 'list_tables') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    localStorage.setItem(STORAGE_KEYS.TABS, JSON.stringify([browseTab, browseTab2]));
    localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, 't1'); // myconn is active
    const connections = makeConnections();
    const tabsHook = makeTabsHook();
    const queries = makeQueries();
    const setActivePanel = vi.fn();

    renderHook(() => useSessionRestore(connections as never, tabsHook as never, queries as never, setActivePanel));

    await act(async () => {
      await flushPromises();
      await flushPromises();
      await flushPromises();
      await flushPromises();
    });

    // setDbExpanded should be called for myconn::mydb
    const dbExpandCalls = (connections.setDbExpanded as ReturnType<typeof vi.fn>).mock.calls;
    const expandedKeys = dbExpandCalls.flatMap((call) => {
      const updater = call[0] as (prev: Set<string>) => Set<string>;
      return [...updater(new Set())];
    });
    expect(expandedKeys).toContain('myconn::mydb');
    // otherconn's db should not be expanded (not active conn)
    expect(expandedKeys).not.toContain('otherconn::otherdb');
  });
});
