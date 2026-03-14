import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useConnections } from './useConnections';
import { STORAGE_KEYS } from '@/lib/storage';
import type { SavedConnection } from '@/types';

const mockInvoke = vi.mocked(invoke);

const makeConn = (overrides: Partial<SavedConnection> = {}): SavedConnection => ({
  name: 'myconn',
  dbType: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  username: 'user',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useConnections – initial state', () => {
  it('loads shownDatabases from localStorage on init', () => {
    const stored = { myconn: ['db1', 'db2'] };
    localStorage.setItem(STORAGE_KEYS.SHOWN_DATABASES, JSON.stringify(stored));

    const { result } = renderHook(() => useConnections());
    expect(result.current.shownDatabases).toEqual(stored);
  });

  it('falls back to empty object when localStorage is empty', () => {
    const { result } = renderHook(() => useConnections());
    expect(result.current.shownDatabases).toEqual({});
  });

  it('falls back to empty object when localStorage contains invalid JSON', () => {
    localStorage.setItem(STORAGE_KEYS.SHOWN_DATABASES, 'not-json');
    const { result } = renderHook(() => useConnections());
    expect(result.current.shownDatabases).toEqual({});
  });
});

describe('loadConnections', () => {
  it('sets savedConnections on success', async () => {
    const conns = [makeConn()];
    mockInvoke.mockResolvedValueOnce(conns);

    const { result } = renderHook(() => useConnections());
    await act(async () => {
      await result.current.loadConnections();
    });

    expect(mockInvoke).toHaveBeenCalledWith('load_connections');
    expect(result.current.savedConnections).toEqual(conns);
  });

  it('swallows errors silently', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('network error'));

    const { result } = renderHook(() => useConnections());
    await act(async () => {
      await result.current.loadConnections();
    });

    expect(result.current.savedConnections).toEqual([]);
  });
});

describe('toggleConnection', () => {
  it('collapses an already-expanded connection', async () => {
    const conn = makeConn();
    mockInvoke.mockResolvedValueOnce(undefined); // connect_saved
    mockInvoke.mockResolvedValueOnce(['db1']);    // list_databases

    const { result } = renderHook(() => useConnections());

    await act(async () => { await result.current.toggleConnection(conn); });
    expect(result.current.expanded.has('myconn')).toBe(true);

    await act(async () => { await result.current.toggleConnection(conn); });
    expect(result.current.expanded.has('myconn')).toBe(false);
  });

  it('expands without re-fetching when databases already loaded', async () => {
    const conn = makeConn();
    mockInvoke.mockResolvedValueOnce(undefined); // connect_saved
    mockInvoke.mockResolvedValueOnce(['db1']);    // list_databases

    const { result } = renderHook(() => useConnections());

    // First toggle: connects + lists databases
    await act(async () => { await result.current.toggleConnection(conn); });
    // Collapse
    await act(async () => { await result.current.toggleConnection(conn); });
    expect(result.current.expanded.has('myconn')).toBe(false);

    const invokeCountBefore = mockInvoke.mock.calls.length;
    // Second expand: already loaded
    await act(async () => { await result.current.toggleConnection(conn); });
    expect(result.current.expanded.has('myconn')).toBe(true);
    expect(mockInvoke.mock.calls.length).toBe(invokeCountBefore); // no new calls
  });

  it('connects, lists databases, sets shownDatabases to default db on first connect', async () => {
    const conn = makeConn({ database: 'db1' });
    mockInvoke.mockResolvedValueOnce(undefined);         // connect_saved
    mockInvoke.mockResolvedValueOnce(['db1', 'db2']);    // list_databases

    const { result } = renderHook(() => useConnections());
    await act(async () => { await result.current.toggleConnection(conn); });

    expect(result.current.connDatabases['myconn']).toEqual(['db1', 'db2']);
    expect(result.current.shownDatabases['myconn']).toEqual(['db1']);
    expect(result.current.expanded.has('myconn')).toBe(true);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOWN_DATABASES)!);
    expect(persisted['myconn']).toEqual(['db1']);
  });

  it('falls back to first database when conn.database is not in the list', async () => {
    const conn = makeConn({ database: 'missing' });
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce(['other1', 'other2']);

    const { result } = renderHook(() => useConnections());
    await act(async () => { await result.current.toggleConnection(conn); });

    expect(result.current.shownDatabases['myconn']).toEqual(['other1']);
  });

  it('sets shown to empty array when database list is empty', async () => {
    const conn = makeConn({ database: '' });
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useConnections());
    await act(async () => { await result.current.toggleConnection(conn); });

    expect(result.current.shownDatabases['myconn']).toEqual([]);
  });

  it('restores and filters stored shownDatabases on subsequent connect', async () => {
    const stored = { myconn: ['db1', 'removed'] };
    localStorage.setItem(STORAGE_KEYS.SHOWN_DATABASES, JSON.stringify(stored));

    const conn = makeConn();
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce(['db1', 'db2']);

    const { result } = renderHook(() => useConnections());
    await act(async () => { await result.current.toggleConnection(conn); });

    expect(result.current.shownDatabases['myconn']).toEqual(['db1']);
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOWN_DATABASES)!);
    expect(persisted['myconn']).toEqual(['db1']);
  });

  it('sets connErrors on failure', async () => {
    const conn = makeConn();
    mockInvoke.mockRejectedValueOnce('connect failed');

    const { result } = renderHook(() => useConnections());
    await act(async () => { await result.current.toggleConnection(conn); });

    expect(result.current.connErrors['myconn']).toBe('connect failed');
    expect(result.current.connLoading['myconn']).toBe(false);
  });

  it('clears connLoading after success', async () => {
    const conn = makeConn();
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce(['db1']);

    const { result } = renderHook(() => useConnections());
    await act(async () => { await result.current.toggleConnection(conn); });

    expect(result.current.connLoading['myconn']).toBe(false);
  });
});

describe('toggleDatabase', () => {
  it('collapses an already-expanded database', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);    // connect_database
    mockInvoke.mockResolvedValueOnce(['users']);    // list_tables

    const { result } = renderHook(() => useConnections());
    await act(async () => { await result.current.toggleDatabase('myconn', 'mydb'); });
    expect(result.current.dbExpanded.has('myconn::mydb')).toBe(true);

    await act(async () => { await result.current.toggleDatabase('myconn', 'mydb'); });
    expect(result.current.dbExpanded.has('myconn::mydb')).toBe(false);
  });

  it('expands without re-fetching when tables already cached', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce(['users']);

    const { result } = renderHook(() => useConnections());
    await act(async () => { await result.current.toggleDatabase('myconn', 'mydb'); });
    await act(async () => { await result.current.toggleDatabase('myconn', 'mydb'); }); // collapse

    const countBefore = mockInvoke.mock.calls.length;
    await act(async () => { await result.current.toggleDatabase('myconn', 'mydb'); });
    expect(result.current.dbExpanded.has('myconn::mydb')).toBe(true);
    expect(mockInvoke.mock.calls.length).toBe(countBefore);
  });

  it('loads tables, updates dbTables and expands on success', async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    mockInvoke.mockResolvedValueOnce(['users', 'orders']);

    const { result } = renderHook(() => useConnections());
    await act(async () => { await result.current.toggleDatabase('myconn', 'mydb'); });

    expect(mockInvoke).toHaveBeenCalledWith('connect_database', {
      connection: 'myconn',
      database: 'mydb',
    });
    expect(mockInvoke).toHaveBeenCalledWith('list_tables', {
      connection: 'myconn',
      database: 'mydb',
    });
    expect(result.current.dbTables['myconn::mydb']).toEqual(['users', 'orders']);
    expect(result.current.dbExpanded.has('myconn::mydb')).toBe(true);
    expect(result.current.dbLoading['myconn::mydb']).toBe(false);
  });

  it('sets dbErrors on failure', async () => {
    mockInvoke.mockRejectedValueOnce('db error');

    const { result } = renderHook(() => useConnections());
    await act(async () => { await result.current.toggleDatabase('myconn', 'mydb'); });

    expect(result.current.dbErrors['myconn::mydb']).toBe('db error');
    expect(result.current.dbLoading['myconn::mydb']).toBe(false);
    expect(result.current.dbExpanded.has('myconn::mydb')).toBe(false);
  });
});

describe('setDatabaseShown', () => {
  it('adds a database to the shown list', () => {
    const { result } = renderHook(() => useConnections());
    act(() => { result.current.setDatabaseShown('myconn', 'db1', true); });

    expect(result.current.shownDatabases['myconn']).toEqual(['db1']);
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOWN_DATABASES)!);
    expect(persisted['myconn']).toEqual(['db1']);
  });

  it('does not duplicate if database already shown', () => {
    const { result } = renderHook(() => useConnections());
    act(() => { result.current.setDatabaseShown('myconn', 'db1', true); });
    act(() => { result.current.setDatabaseShown('myconn', 'db1', true); });

    expect(result.current.shownDatabases['myconn']).toEqual(['db1']);
  });

  it('removes a database from the shown list', () => {
    const { result } = renderHook(() => useConnections());
    act(() => { result.current.setDatabaseShown('myconn', 'db1', true); });
    act(() => { result.current.setDatabaseShown('myconn', 'db1', false); });

    expect(result.current.shownDatabases['myconn']).toEqual([]);
    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOWN_DATABASES)!);
    expect(persisted['myconn']).toEqual([]);
  });

  it('starts from empty list if connection has no prior shown databases', () => {
    const { result } = renderHook(() => useConnections());
    act(() => { result.current.setDatabaseShown('newconn', 'db1', false); });

    expect(result.current.shownDatabases['newconn']).toEqual([]);
  });
});

describe('refreshConnection', () => {
  it('refreshes database list, filters shownDatabases, clears tables/expanded', async () => {
    // Pre-populate shownDatabases and stored data
    localStorage.setItem(STORAGE_KEYS.SHOWN_DATABASES, JSON.stringify({
      myconn: ['db1', 'stale'],
    }));
    mockInvoke.mockResolvedValueOnce(['db1', 'db2']); // list_databases

    const { result } = renderHook(() => useConnections());

    // Manually set some dbTables and dbExpanded to verify they get cleared
    act(() => {
      result.current.setDbTables({ 'myconn::db1': ['t1'], 'other::db': ['t2'] });
      result.current.setDbExpanded(new Set(['myconn::db1', 'other::db']));
    });

    await act(async () => { await result.current.refreshConnection('myconn'); });

    expect(result.current.connDatabases['myconn']).toEqual(['db1', 'db2']);
    expect(result.current.shownDatabases['myconn']).toEqual(['db1']);
    // Tables for myconn cleared, other connection untouched
    expect(result.current.dbTables['myconn::db1']).toBeUndefined();
    expect(result.current.dbTables['other::db']).toEqual(['t2']);
    // dbExpanded: myconn entries removed, other remains
    expect(result.current.dbExpanded.has('myconn::db1')).toBe(false);
    expect(result.current.dbExpanded.has('other::db')).toBe(true);
    expect(result.current.connLoading['myconn']).toBe(false);
  });

  it('skips shownDatabases filtering when connection has no stored entry', async () => {
    mockInvoke.mockResolvedValueOnce(['db1']);

    const { result } = renderHook(() => useConnections());
    await act(async () => { await result.current.refreshConnection('myconn'); });

    // No shownDatabases entry created
    expect(result.current.shownDatabases['myconn']).toBeUndefined();
  });

  it('sets connErrors on failure', async () => {
    mockInvoke.mockRejectedValueOnce('refresh failed');

    const { result } = renderHook(() => useConnections());
    await act(async () => { await result.current.refreshConnection('myconn'); });

    expect(result.current.connErrors['myconn']).toBe('refresh failed');
    expect(result.current.connLoading['myconn']).toBe(false);
  });
});

describe('refreshDatabase', () => {
  it('reloads tables for a specific database', async () => {
    mockInvoke.mockResolvedValueOnce(['users', 'orders']);

    const { result } = renderHook(() => useConnections());
    await act(async () => { await result.current.refreshDatabase('myconn', 'mydb'); });

    expect(mockInvoke).toHaveBeenCalledWith('list_tables', {
      connection: 'myconn',
      database: 'mydb',
    });
    expect(result.current.dbTables['myconn::mydb']).toEqual(['users', 'orders']);
    expect(result.current.dbLoading['myconn::mydb']).toBe(false);
  });

  it('sets dbErrors on failure', async () => {
    mockInvoke.mockRejectedValueOnce('table error');

    const { result } = renderHook(() => useConnections());
    await act(async () => { await result.current.refreshDatabase('myconn', 'mydb'); });

    expect(result.current.dbErrors['myconn::mydb']).toBe('table error');
    expect(result.current.dbLoading['myconn::mydb']).toBe(false);
  });
});

describe('getStoredShownDatabases / persistShownDatabases', () => {
  it('persistShownDatabases writes to localStorage', () => {
    const { result } = renderHook(() => useConnections());
    act(() => {
      result.current.persistShownDatabases({ conn1: ['db1'] });
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SHOWN_DATABASES)!);
    expect(stored).toEqual({ conn1: ['db1'] });
  });

  it('getStoredShownDatabases reads from localStorage', () => {
    localStorage.setItem(STORAGE_KEYS.SHOWN_DATABASES, JSON.stringify({ conn1: ['db1'] }));
    const { result } = renderHook(() => useConnections());
    expect(result.current.getStoredShownDatabases()).toEqual({ conn1: ['db1'] });
  });
});
