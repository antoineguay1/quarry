import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useConnections } from './useConnections';
import { useTabs } from './useTabs';
import { useConnectionActions } from './useConnectionActions';
import { STORAGE_KEYS } from '@/lib/storage';
import type { SavedConnection, TabEntry } from '@/types';

const mockInvoke = vi.mocked(invoke);

function renderAll() {
  return renderHook(() => {
    const c = useConnections();
    const t = useTabs();
    const a = useConnectionActions(c, t);
    return { c, t, a };
  });
}

const makeConn = (overrides: Partial<SavedConnection> = {}): SavedConnection => ({
  name: 'myconn',
  dbType: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  username: 'user',
  ...overrides,
});

const makeBrowseTab = (overrides: Partial<TabEntry> = {}): TabEntry => ({
  id: 'myconn::mydb::browse::users',
  connectionName: 'myconn',
  database: 'mydb',
  type: 'browse',
  table: 'users',
  ...overrides,
});

const makeSavedQueryTab = (overrides: Partial<TabEntry> = {}): TabEntry => ({
  id: 'saved::query1',
  connectionName: 'myconn',
  type: 'saved-query',
  savedQueryId: 'query1',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────────────────────────
// 1. Initial state
// ──────────────────────────────────────────────────────────────────────────────
describe('initial state', () => {
  it('modalOpen=false, deleteConfirm=null, editConnection=null', () => {
    const { result } = renderAll();
    expect(result.current.a.modalOpen).toBe(false);
    expect(result.current.a.deleteConfirm).toBeNull();
    expect(result.current.a.editConnection).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. handleConnected — first-time (no localStorage entry)
// ──────────────────────────────────────────────────────────────────────────────
describe('handleConnected – first-time (no localStorage)', () => {
  // handleConnected fires `void loadConnections()` (→ invoke 'load_connections') BEFORE
  // `await invoke('list_databases')`, so mocks must be ordered accordingly.

  it('no defaultDatabase: uses databases[0], stores + shows it', async () => {
    mockInvoke.mockResolvedValueOnce([]);              // load_connections
    mockInvoke.mockResolvedValueOnce(['db1', 'db2']); // list_databases

    const { result } = renderAll();
    await act(async () => {
      await result.current.a.handleConnected('myconn');
    });

    expect(result.current.c.shownDatabases['myconn']).toEqual(['db1']);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOWN_DATABASES)!);
    expect(stored['myconn']).toEqual(['db1']);
    expect(result.current.c.expanded.has('myconn')).toBe(true);
    expect(result.current.a.modalOpen).toBe(false);
  });

  it('defaultDatabase in list: uses it', async () => {
    mockInvoke.mockResolvedValueOnce([]);              // load_connections
    mockInvoke.mockResolvedValueOnce(['db1', 'db2']); // list_databases

    const { result } = renderAll();
    await act(async () => {
      await result.current.a.handleConnected('myconn', 'db2');
    });

    expect(result.current.c.shownDatabases['myconn']).toEqual(['db2']);
  });

  it('defaultDatabase not in list: falls back to databases[0]', async () => {
    mockInvoke.mockResolvedValueOnce([]);              // load_connections
    mockInvoke.mockResolvedValueOnce(['db1', 'db2']); // list_databases

    const { result } = renderAll();
    await act(async () => {
      await result.current.a.handleConnected('myconn', 'missing');
    });

    expect(result.current.c.shownDatabases['myconn']).toEqual(['db1']);
  });

  it('empty database list: shown=[], defaultDb=""', async () => {
    mockInvoke.mockResolvedValueOnce([]); // load_connections
    mockInvoke.mockResolvedValueOnce([]); // list_databases

    const { result } = renderAll();
    await act(async () => {
      await result.current.a.handleConnected('myconn');
    });

    expect(result.current.c.shownDatabases['myconn']).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. handleConnected — stored entry exists
// ──────────────────────────────────────────────────────────────────────────────
describe('handleConnected – stored entry exists', () => {
  it('all stored databases still exist: kept as-is', async () => {
    localStorage.setItem(STORAGE_KEYS.SHOWN_DATABASES, JSON.stringify({ myconn: ['db1', 'db2'] }));
    mockInvoke.mockResolvedValueOnce([]);              // load_connections
    mockInvoke.mockResolvedValueOnce(['db1', 'db2', 'db3']); // list_databases

    const { result } = renderAll();
    await act(async () => {
      await result.current.a.handleConnected('myconn');
    });

    expect(result.current.c.shownDatabases['myconn']).toEqual(['db1', 'db2']);
  });

  it('some stored databases removed: filtered', async () => {
    localStorage.setItem(STORAGE_KEYS.SHOWN_DATABASES, JSON.stringify({ myconn: ['db1', 'removed'] }));
    mockInvoke.mockResolvedValueOnce([]);              // load_connections
    mockInvoke.mockResolvedValueOnce(['db1', 'db2']); // list_databases

    const { result } = renderAll();
    await act(async () => {
      await result.current.a.handleConnected('myconn');
    });

    expect(result.current.c.shownDatabases['myconn']).toEqual(['db1']);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOWN_DATABASES)!);
    expect(stored['myconn']).toEqual(['db1']);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. handleConnected — list_databases rejects
// ──────────────────────────────────────────────────────────────────────────────
describe('handleConnected – list_databases rejects', () => {
  it('swallows error; expanded + modalOpen still updated', async () => {
    mockInvoke.mockResolvedValueOnce([]);                    // load_connections
    mockInvoke.mockRejectedValueOnce(new Error('db error')); // list_databases

    const { result } = renderAll();
    await act(async () => {
      await result.current.a.handleConnected('myconn');
    });

    expect(result.current.c.expanded.has('myconn')).toBe(true);
    expect(result.current.a.modalOpen).toBe(false);
    // shownDatabases not set
    expect(result.current.c.shownDatabases['myconn']).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. handleEditConnected
// ──────────────────────────────────────────────────────────────────────────────
describe('handleEditConnected', () => {
  function setupEditState(result: ReturnType<typeof renderAll>['result'], oldConn: SavedConnection) {
    act(() => {
      result.current.a.setEditConnection(oldConn);
      result.current.c.setConnDatabases({ [oldConn.name]: ['db1', 'db2'] });
      result.current.c.setShownDatabases({ [oldConn.name]: ['db1'] });
      result.current.c.persistShownDatabases({ [oldConn.name]: ['db1'] });
      result.current.c.setDbExpanded(new Set([`${oldConn.name}::db1`, 'otherconn::db2']));
      result.current.c.setDbTables({
        [`${oldConn.name}::db1`]: ['users'],
        'otherconn::db2': ['products'],
      });
      result.current.c.setExpanded(new Set([oldConn.name]));
      result.current.c.setConnErrors({ [oldConn.name]: 'some error' });
    });
  }

  it('remaps connDatabases from oldName to newName', async () => {
    mockInvoke.mockResolvedValueOnce([]); // load_connections
    const oldConn = makeConn({ name: 'old' });
    const { result } = renderAll();
    setupEditState(result, oldConn);

    await act(async () => {
      result.current.a.handleEditConnected('new');
    });

    expect(result.current.c.connDatabases['new']).toEqual(['db1', 'db2']);
    expect(result.current.c.connDatabases['old']).toBeUndefined();
  });

  it('connDatabases no-op if oldName key absent', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const oldConn = makeConn({ name: 'nonexistent' });
    const { result } = renderAll();

    act(() => { result.current.a.setEditConnection(oldConn); });

    await act(async () => {
      result.current.a.handleEditConnected('new');
    });

    expect(result.current.c.connDatabases['new']).toBeUndefined();
  });

  it('remaps shownDatabases + localStorage', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const oldConn = makeConn({ name: 'old' });
    const { result } = renderAll();
    setupEditState(result, oldConn);

    await act(async () => {
      result.current.a.handleEditConnected('new');
    });

    expect(result.current.c.shownDatabases['new']).toEqual(['db1']);
    expect(result.current.c.shownDatabases['old']).toBeUndefined();
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOWN_DATABASES)!);
    expect(stored['new']).toEqual(['db1']);
    expect(stored['old']).toBeUndefined();
  });

  it('remaps dbExpanded keys; non-matching keys preserved', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const oldConn = makeConn({ name: 'old' });
    const { result } = renderAll();
    setupEditState(result, oldConn);

    await act(async () => {
      result.current.a.handleEditConnected('new');
    });

    expect(result.current.c.dbExpanded.has('new::db1')).toBe(true);
    expect(result.current.c.dbExpanded.has('old::db1')).toBe(false);
    expect(result.current.c.dbExpanded.has('otherconn::db2')).toBe(true);
  });

  it('remaps dbTables keys', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const oldConn = makeConn({ name: 'old' });
    const { result } = renderAll();
    setupEditState(result, oldConn);

    await act(async () => {
      result.current.a.handleEditConnected('new');
    });

    expect(result.current.c.dbTables['new::db1']).toEqual(['users']);
    expect(result.current.c.dbTables['old::db1']).toBeUndefined();
    expect(result.current.c.dbTables['otherconn::db2']).toEqual(['products']);
  });

  it('remaps expanded: oldName deleted, newName added', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const oldConn = makeConn({ name: 'old' });
    const { result } = renderAll();
    setupEditState(result, oldConn);

    await act(async () => {
      result.current.a.handleEditConnected('new');
    });

    expect(result.current.c.expanded.has('new')).toBe(true);
    expect(result.current.c.expanded.has('old')).toBe(false);
  });

  it('clears connErrors for oldName', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const oldConn = makeConn({ name: 'old' });
    const { result } = renderAll();
    setupEditState(result, oldConn);

    await act(async () => {
      result.current.a.handleEditConnected('new');
    });

    expect(result.current.c.connErrors['old']).toBeUndefined();
  });

  it('remaps browse tab id and connectionName', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const oldConn = makeConn({ name: 'old' });
    const browseTab = makeBrowseTab({ id: 'old::mydb::browse::users', connectionName: 'old' });
    const { result } = renderAll();

    act(() => {
      result.current.a.setEditConnection(oldConn);
      result.current.t.setTabs([browseTab]);
      result.current.t.setActiveTabId(browseTab.id);
    });

    await act(async () => {
      result.current.a.handleEditConnected('new');
    });

    const updatedTab = result.current.t.tabs[0];
    expect(updatedTab.id).toBe('new::mydb::browse::users');
    expect(updatedTab.connectionName).toBe('new');
  });

  it('saved-query tab: only connectionName updated, id unchanged', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const oldConn = makeConn({ name: 'old' });
    const sqTab = makeSavedQueryTab({ connectionName: 'old' });
    const { result } = renderAll();

    act(() => {
      result.current.a.setEditConnection(oldConn);
      result.current.t.setTabs([sqTab]);
    });

    await act(async () => {
      result.current.a.handleEditConnected('new');
    });

    const updatedTab = result.current.t.tabs[0];
    expect(updatedTab.id).toBe('saved::query1');
    expect(updatedTab.connectionName).toBe('new');
  });

  it('remaps activeTabId when it starts with oldName::', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const oldConn = makeConn({ name: 'old' });
    const browseTab = makeBrowseTab({ id: 'old::mydb::browse::users', connectionName: 'old' });
    const { result } = renderAll();

    act(() => {
      result.current.a.setEditConnection(oldConn);
      result.current.t.setTabs([browseTab]);
      result.current.t.setActiveTabId(browseTab.id);
    });

    await act(async () => {
      result.current.a.handleEditConnected('new');
    });

    expect(result.current.t.activeTabId).toBe('new::mydb::browse::users');
  });

  it('activeTabId unchanged when it does not start with oldName::', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const oldConn = makeConn({ name: 'old' });
    const { result } = renderAll();

    act(() => {
      result.current.a.setEditConnection(oldConn);
      result.current.t.setActiveTabId('other::mydb::browse::orders');
    });

    await act(async () => {
      result.current.a.handleEditConnected('new');
    });

    expect(result.current.t.activeTabId).toBe('other::mydb::browse::orders');
  });

  it('activeTabId null: stays null', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const oldConn = makeConn({ name: 'old' });
    const { result } = renderAll();

    act(() => {
      result.current.a.setEditConnection(oldConn);
      result.current.t.setActiveTabId(null);
    });

    await act(async () => {
      result.current.a.handleEditConnected('new');
    });

    expect(result.current.t.activeTabId).toBeNull();
  });

  it('tabs from other connections are left unchanged', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const oldConn = makeConn({ name: 'old' });
    const oldTab = makeBrowseTab({ id: 'old::mydb::browse::users', connectionName: 'old' });
    const otherTab = makeBrowseTab({ id: 'other::db::browse::t1', connectionName: 'other', database: 'db', table: 't1' });
    const { result } = renderAll();

    act(() => {
      result.current.a.setEditConnection(oldConn);
      result.current.t.setTabs([oldTab, otherTab]);
    });

    await act(async () => {
      result.current.a.handleEditConnected('new');
    });

    // Old tab renamed; other tab untouched
    expect(result.current.t.tabs.find((t) => t.id === 'other::db::browse::t1')).toBeDefined();
    expect(result.current.t.tabs.find((t) => t.connectionName === 'other')).toBeDefined();
  });

  it('resets editConnection to null', async () => {
    mockInvoke.mockResolvedValueOnce([]);
    const oldConn = makeConn({ name: 'old' });
    const { result } = renderAll();

    act(() => { result.current.a.setEditConnection(oldConn); });
    expect(result.current.a.editConnection).not.toBeNull();

    await act(async () => {
      result.current.a.handleEditConnected('new');
    });

    expect(result.current.a.editConnection).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. handleConfirmDelete
// ──────────────────────────────────────────────────────────────────────────────
describe('handleConfirmDelete', () => {
  it('guard: deleteConfirm=null → early return, invoke not called', async () => {
    const { result } = renderAll();
    await act(async () => {
      await result.current.a.handleConfirmDelete();
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('deletes connection and cleans all state', async () => {
    mockInvoke.mockResolvedValueOnce(undefined); // delete_connection
    mockInvoke.mockResolvedValueOnce([]);        // load_connections

    const { result } = renderAll();
    act(() => {
      result.current.c.setConnDatabases({ myconn: ['db1'], other: ['db2'] });
      result.current.c.setShownDatabases({ myconn: ['db1'], other: ['db2'] });
      result.current.c.persistShownDatabases({ myconn: ['db1'], other: ['db2'] });
      result.current.c.setDbExpanded(new Set(['myconn::db1', 'other::db2']));
      result.current.c.setDbTables({ 'myconn::db1': ['t1'], 'other::db2': ['t2'] });
      result.current.c.setConnErrors({ myconn: 'err', other: 'err2' });
      result.current.c.setExpanded(new Set(['myconn', 'other']));
      result.current.a.setDeleteConfirm('myconn');
    });

    await act(async () => {
      await result.current.a.handleConfirmDelete();
    });

    expect(mockInvoke).toHaveBeenCalledWith('delete_connection', { name: 'myconn' });
    expect(result.current.c.connDatabases['myconn']).toBeUndefined();
    expect(result.current.c.shownDatabases['myconn']).toBeUndefined();
    expect(result.current.c.dbExpanded.has('myconn::db1')).toBe(false);
    expect(result.current.c.dbTables['myconn::db1']).toBeUndefined();
    expect(result.current.c.connErrors['myconn']).toBeUndefined();
    expect(result.current.c.expanded.has('myconn')).toBe(false);
    // other connection untouched
    expect(result.current.c.connDatabases['other']).toEqual(['db2']);
    expect(result.current.c.shownDatabases['other']).toEqual(['db2']);
    expect(result.current.c.dbExpanded.has('other::db2')).toBe(true);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOWN_DATABASES)!);
    expect(stored['myconn']).toBeUndefined();
    expect(stored['other']).toEqual(['db2']);
  });

  it('active tab belongs to deleted connection → switches to first remaining', async () => {
    mockInvoke.mockResolvedValueOnce(undefined); // delete_connection
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();
    const tab1 = makeBrowseTab({ id: 'myconn::mydb::browse::t1', connectionName: 'myconn', table: 't1' });
    const tab2 = makeBrowseTab({ id: 'other::db::browse::t2', connectionName: 'other', database: 'db', table: 't2' });

    act(() => {
      result.current.t.setTabs([tab1, tab2]);
      result.current.t.setActiveTabId(tab1.id);
      result.current.a.setDeleteConfirm('myconn');
    });

    await act(async () => {
      await result.current.a.handleConfirmDelete();
    });

    expect(result.current.t.tabs.map((t) => t.id)).toEqual([tab2.id]);
    expect(result.current.t.activeTabId).toBe(tab2.id);
  });

  it('active tab does not belong to deleted connection → unchanged', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();
    const tab1 = makeBrowseTab({ id: 'myconn::mydb::browse::t1', connectionName: 'myconn', table: 't1' });
    const tab2 = makeBrowseTab({ id: 'other::db::browse::t2', connectionName: 'other', database: 'db', table: 't2' });

    act(() => {
      result.current.t.setTabs([tab1, tab2]);
      result.current.t.setActiveTabId(tab2.id);
      result.current.a.setDeleteConfirm('myconn');
    });

    await act(async () => {
      await result.current.a.handleConfirmDelete();
    });

    expect(result.current.t.activeTabId).toBe(tab2.id);
  });

  it('active tab belongs to deleted + no remaining tabs → null', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();
    const tab1 = makeBrowseTab();

    act(() => {
      result.current.t.setTabs([tab1]);
      result.current.t.setActiveTabId(tab1.id);
      result.current.a.setDeleteConfirm('myconn');
    });

    await act(async () => {
      await result.current.a.handleConfirmDelete();
    });

    expect(result.current.t.tabs).toHaveLength(0);
    expect(result.current.t.activeTabId).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 7. closeDatabaseTabs (tested via handleDropDatabase)
// ──────────────────────────────────────────────────────────────────────────────
describe('closeDatabaseTabs (via handleDropDatabase)', () => {
  it('removes browse tabs with matching prefix', async () => {
    mockInvoke.mockResolvedValueOnce([]); // refreshConnection → list_databases

    const { result } = renderAll();
    const tab1 = makeBrowseTab({ id: 'myconn::mydb::browse::t1', table: 't1' });
    const tab2 = makeBrowseTab({ id: 'myconn::mydb::browse::t2', table: 't2' });
    const tab3 = makeBrowseTab({ id: 'myconn::other::browse::t3', database: 'other', table: 't3' });

    act(() => {
      result.current.t.setTabs([tab1, tab2, tab3]);
      result.current.t.setActiveTabId('myconn::other::browse::t3');
    });

    await act(async () => {
      result.current.a.handleDropDatabase('myconn', 'mydb');
    });

    expect(result.current.t.tabs.map((t) => t.id)).toEqual(['myconn::other::browse::t3']);
  });

  it('active tab matches + other tabs remain → activates first remaining', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();
    const tab1 = makeBrowseTab({ id: 'myconn::mydb::browse::t1', table: 't1' });
    const tab2 = makeBrowseTab({ id: 'other::db::browse::t2', connectionName: 'other', database: 'db', table: 't2' });

    act(() => {
      result.current.t.setTabs([tab1, tab2]);
      result.current.t.setActiveTabId(tab1.id);
    });

    await act(async () => {
      result.current.a.handleDropDatabase('myconn', 'mydb');
    });

    expect(result.current.t.activeTabId).toBe(tab2.id);
  });

  it('active tab matches + no tabs remain → null', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();
    const tab1 = makeBrowseTab();

    act(() => {
      result.current.t.setTabs([tab1]);
      result.current.t.setActiveTabId(tab1.id);
    });

    await act(async () => {
      result.current.a.handleDropDatabase('myconn', 'mydb');
    });

    expect(result.current.t.activeTabId).toBeNull();
  });

  it('active tab does not match → unchanged', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();
    const tab1 = makeBrowseTab();
    const tab2 = makeBrowseTab({ id: 'other::db::browse::t2', connectionName: 'other', database: 'db', table: 't2' });

    act(() => {
      result.current.t.setTabs([tab1, tab2]);
      result.current.t.setActiveTabId(tab2.id);
    });

    await act(async () => {
      result.current.a.handleDropDatabase('myconn', 'mydb');
    });

    expect(result.current.t.activeTabId).toBe(tab2.id);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 8. handleRenameDatabase
// ──────────────────────────────────────────────────────────────────────────────
describe('handleRenameDatabase', () => {
  it('renames db in shownDatabases and persists', async () => {
    mockInvoke.mockResolvedValueOnce(['newdb']); // refreshConnection

    const { result } = renderAll();
    act(() => {
      result.current.c.setShownDatabases({ myconn: ['olddb', 'other'] });
      result.current.c.persistShownDatabases({ myconn: ['olddb', 'other'] });
    });

    act(() => {
      result.current.a.handleRenameDatabase('myconn', 'olddb', 'newdb');
    });

    expect(result.current.c.shownDatabases['myconn']).toEqual(['newdb', 'other']);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOWN_DATABASES)!);
    expect(stored['myconn']).toEqual(['newdb', 'other']);
    await act(async () => {}); // flush refreshConnection to avoid act() warnings
  });

  it('shownDatabases no-op if connName absent', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();

    await act(async () => {
      result.current.a.handleRenameDatabase('missing', 'olddb', 'newdb');
    });

    expect(result.current.c.shownDatabases['missing']).toBeUndefined();
  });

  it('renames dbExpanded key', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();
    act(() => {
      result.current.c.setDbExpanded(new Set(['myconn::olddb', 'myconn::other']));
    });

    act(() => {
      result.current.a.handleRenameDatabase('myconn', 'olddb', 'newdb');
    });

    expect(result.current.c.dbExpanded.has('myconn::newdb')).toBe(true);
    expect(result.current.c.dbExpanded.has('myconn::olddb')).toBe(false);
    expect(result.current.c.dbExpanded.has('myconn::other')).toBe(true);
    await act(async () => {}); // flush refreshConnection to avoid act() warnings
  });

  it('renames dbTables key', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();
    act(() => {
      result.current.c.setDbTables({ 'myconn::olddb': ['t1'], 'myconn::other': ['t2'] });
    });

    act(() => {
      result.current.a.handleRenameDatabase('myconn', 'olddb', 'newdb');
    });

    expect(result.current.c.dbTables['myconn::newdb']).toEqual(['t1']);
    expect(result.current.c.dbTables['myconn::olddb']).toBeUndefined();
    expect(result.current.c.dbTables['myconn::other']).toEqual(['t2']);
    await act(async () => {}); // flush refreshConnection to avoid act() warnings
  });

  it('updates browse tab database and id', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();
    const browseTab = makeBrowseTab({ id: 'myconn::olddb::browse::users', database: 'olddb' });
    const otherTab = makeBrowseTab({ id: 'myconn::other::browse::orders', database: 'other', table: 'orders' });

    act(() => {
      result.current.t.setTabs([browseTab, otherTab]);
    });

    await act(async () => {
      result.current.a.handleRenameDatabase('myconn', 'olddb', 'newdb');
    });

    const tabs = result.current.t.tabs;
    const renamed = tabs.find((t) => t.connectionName === 'myconn' && t.database === 'newdb');
    expect(renamed).toBeDefined();
    expect(renamed!.id).toBe('myconn::newdb::browse::users');
    // other tab unchanged
    expect(tabs.find((t) => t.id === 'myconn::other::browse::orders')).toBeDefined();
  });

  it('non-browse / non-matching tabs unchanged', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();
    const sqTab = makeSavedQueryTab();

    act(() => {
      result.current.t.setTabs([sqTab]);
    });

    await act(async () => {
      result.current.a.handleRenameDatabase('myconn', 'olddb', 'newdb');
    });

    expect(result.current.t.tabs[0].id).toBe('saved::query1');
  });

  it('remaps activeTabId for matching prefix', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();
    act(() => {
      result.current.t.setActiveTabId('myconn::olddb::browse::users');
    });

    await act(async () => {
      result.current.a.handleRenameDatabase('myconn', 'olddb', 'newdb');
    });

    expect(result.current.t.activeTabId).toBe('myconn::newdb::browse::users');
  });

  it('activeTabId unchanged when no match', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();
    act(() => {
      result.current.t.setActiveTabId('other::db::browse::t1');
    });

    await act(async () => {
      result.current.a.handleRenameDatabase('myconn', 'olddb', 'newdb');
    });

    expect(result.current.t.activeTabId).toBe('other::db::browse::t1');
  });

  it('calls refreshConnection', async () => {
    mockInvoke.mockResolvedValueOnce(['newdb']); // list_databases for refreshConnection

    const { result } = renderAll();
    act(() => {
      result.current.a.handleRenameDatabase('myconn', 'olddb', 'newdb');
    });

    // Allow the async refreshConnection to run
    await act(async () => {});

    expect(mockInvoke).toHaveBeenCalledWith('list_databases', { connection: 'myconn' });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 9. handleDropDatabase
// ──────────────────────────────────────────────────────────────────────────────
describe('handleDropDatabase', () => {
  it('filters out dbName from shownDatabases and persists', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();
    act(() => {
      result.current.c.setShownDatabases({ myconn: ['mydb', 'other'] });
      result.current.c.persistShownDatabases({ myconn: ['mydb', 'other'] });
    });

    act(() => {
      result.current.a.handleDropDatabase('myconn', 'mydb');
    });

    expect(result.current.c.shownDatabases['myconn']).toEqual(['other']);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOWN_DATABASES)!);
    expect(stored['myconn']).toEqual(['other']);
    await act(async () => {}); // flush refreshConnection to avoid act() warnings
  });

  it('no-op on shownDatabases if connName absent', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();

    await act(async () => {
      result.current.a.handleDropDatabase('missing', 'mydb');
    });

    expect(result.current.c.shownDatabases['missing']).toBeUndefined();
  });

  it('deletes dbExpanded key', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();
    act(() => {
      result.current.c.setDbExpanded(new Set(['myconn::mydb', 'myconn::other']));
    });

    act(() => {
      result.current.a.handleDropDatabase('myconn', 'mydb');
    });

    expect(result.current.c.dbExpanded.has('myconn::mydb')).toBe(false);
    expect(result.current.c.dbExpanded.has('myconn::other')).toBe(true);
    await act(async () => {}); // flush refreshConnection to avoid act() warnings
  });

  it('deletes dbTables key', async () => {
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderAll();
    act(() => {
      result.current.c.setDbTables({ 'myconn::mydb': ['t1'], 'myconn::other': ['t2'] });
    });

    act(() => {
      result.current.a.handleDropDatabase('myconn', 'mydb');
    });

    expect(result.current.c.dbTables['myconn::mydb']).toBeUndefined();
    expect(result.current.c.dbTables['myconn::other']).toEqual(['t2']);
    await act(async () => {}); // flush refreshConnection to avoid act() warnings
  });

  it('calls refreshConnection', async () => {
    mockInvoke.mockResolvedValueOnce(['other']); // list_databases

    const { result } = renderAll();
    act(() => {
      result.current.a.handleDropDatabase('myconn', 'mydb');
    });

    await act(async () => {});

    expect(mockInvoke).toHaveBeenCalledWith('list_databases', { connection: 'myconn' });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 10. handleSetDatabaseShown
// ──────────────────────────────────────────────────────────────────────────────
describe('handleSetDatabaseShown', () => {
  it('visible=true → updates shownDatabases, no tab removal', () => {
    const { result } = renderAll();
    const tab = makeBrowseTab();

    act(() => {
      result.current.t.setTabs([tab]);
      result.current.t.setActiveTabId(tab.id);
    });

    act(() => {
      result.current.a.handleSetDatabaseShown('myconn', 'mydb', true);
    });

    expect(result.current.c.shownDatabases['myconn']).toContain('mydb');
    // Tab should still be present
    expect(result.current.t.tabs).toHaveLength(1);
  });

  it('visible=false → shownDatabases updated AND database browse tabs removed', () => {
    const { result } = renderAll();
    const tab = makeBrowseTab();

    act(() => {
      result.current.c.setShownDatabases({ myconn: ['mydb'] });
      result.current.t.setTabs([tab]);
      result.current.t.setActiveTabId(tab.id);
    });

    act(() => {
      result.current.a.handleSetDatabaseShown('myconn', 'mydb', false);
    });

    expect(result.current.c.shownDatabases['myconn']).not.toContain('mydb');
    expect(result.current.t.tabs).toHaveLength(0);
  });
});
