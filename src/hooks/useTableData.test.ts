import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { ColumnInfo, ColumnKeyInfo, FilterEntry, QueryResult } from '@/types';
import { useTableData } from './useTableData';

const mockInvoke = vi.mocked(invoke);

const makeResult = (overrides: Partial<QueryResult> = {}): QueryResult => ({
  columns: ['id', 'name'],
  column_types: ['number', 'text'],
  column_raw_types: ['int4', 'varchar'],
  rows: [[1, 'Alice']],
  row_count: 1,
  sql: 'SELECT * FROM tbl LIMIT 100',
  execution_time_ms: 5,
  ...overrides,
});

// Stable references — inline [] in renderHook callbacks causes new refs every render → infinite loops
const noSort: never[] = [];
const noFilter: never[] = [];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useTableData', () => {
  it('loads data and sets result, columnTypes, columnRawTypes, totalCount', async () => {
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data') return Promise.resolve(makeResult());
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter, undefined, 100, 0, 'postgres')
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.result).toMatchObject({ columns: ['id', 'name'], row_count: 1 });
    expect(result.current.error).toBeNull();
    expect(result.current.columnTypes).toEqual({ id: 'number', name: 'text' });
    expect(result.current.columnRawTypes).toEqual({ id: 'int4', name: 'varchar' });
    // row_count=1 < pageSize=100 → totalCount set to 0*100+1
    expect(result.current.totalCount).toBe(1);
  });

  it('calculates totalCount as page*pageSize + row_count on non-first page', async () => {
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data') return Promise.resolve(makeResult({ row_count: 50 }));
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter, undefined, 100, 2)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.totalCount).toBe(250); // 2*100 + 50
  });

  it('does not auto-set totalCount when row_count >= pageSize', async () => {
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data') return Promise.resolve(makeResult({ row_count: 100 }));
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter, undefined, 100, 0)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.totalCount).toBeNull();
  });

  it('handles data with columns but empty column_types (no type maps set)', async () => {
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data')
        return Promise.resolve(makeResult({ column_types: [], column_raw_types: [] }));
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.result?.columns).toEqual(['id', 'name']);
    expect(result.current.columnTypes).toEqual({});
    expect(result.current.columnRawTypes).toEqual({});
  });

  it('uses cached columns when a subsequent load returns empty columns', async () => {
    let callCount = 0;
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data') {
        callCount++;
        if (callCount === 1) return Promise.resolve(makeResult());
        return Promise.resolve(
          makeResult({ columns: [], rows: [], row_count: 0, column_types: [], column_raw_types: [] })
        );
      }
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const filters2: FilterEntry[] = [
      { col: 'id', value: '1', caseSensitive: false, colType: 'number', operator: 'eq' },
    ];

    const { result, rerender } = renderHook(
      ({ filters }: { filters: FilterEntry[] }) =>
        useTableData('conn', 'db', 'tbl', noSort, filters, undefined, 100, 0),
      { initialProps: { filters: noFilter as FilterEntry[] } }
    );

    await waitFor(() => expect(result.current.result?.columns).toEqual(['id', 'name']));

    rerender({ filters: filters2 });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      // second data call completed — columns restored from cache
      expect(result.current.result?.columns).toEqual(['id', 'name']);
    });
  });

  it('fetches schema via get_table_columns when columns and cache are empty', async () => {
    const columnInfos: ColumnInfo[] = [
      { name: 'id', dataType: 'integer' },
      { name: 'label', dataType: 'text' },
    ];
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data')
        return Promise.resolve(
          makeResult({ columns: [], rows: [], row_count: 0, column_types: [], column_raw_types: [] })
        );
      if (cmd === 'get_table_columns') return Promise.resolve(columnInfos);
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter, undefined, 100, 0, 'postgres')
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.result?.columns).toEqual(['id', 'label']);
    expect(result.current.columnTypes).toEqual({ id: 'number', label: 'text' });
    expect(result.current.columnRawTypes).toEqual({ id: 'integer', label: 'text' });
    expect(mockInvoke).toHaveBeenCalledWith('get_table_columns', {
      connection: 'conn',
      database: 'db',
      table: 'tbl',
    });
  });

  it('get_table_columns returning empty array leaves columns empty', async () => {
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data')
        return Promise.resolve(
          makeResult({ columns: [], rows: [], row_count: 0, column_types: [], column_raw_types: [] })
        );
      if (cmd === 'get_table_columns') return Promise.resolve([]);
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.result?.columns).toEqual([]);
    expect(result.current.columnTypes).toEqual({});
  });

  it('handles get_table_columns throwing an error gracefully', async () => {
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data')
        return Promise.resolve(
          makeResult({ columns: [], rows: [], row_count: 0, column_types: [], column_raw_types: [] })
        );
      if (cmd === 'get_table_columns') return Promise.reject(new Error('schema error'));
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.result?.columns).toEqual([]);
  });

  it('sets error state when get_table_data throws', async () => {
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data') return Promise.reject(new Error('DB error'));
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Error: DB error');
    expect(result.current.result).toBeNull();
  });

  it('auto-reconnects when get_table_data throws "Not connected"', async () => {
    let dataCallCount = 0;
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data') {
        dataCallCount++;
        if (dataCallCount === 1) return Promise.reject('Not connected');
        return Promise.resolve(makeResult());
      }
      if (cmd === 'connect_saved') return Promise.resolve(null);
      if (cmd === 'connect_database') return Promise.resolve(null);
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.result).not.toBeNull();
    expect(mockInvoke).toHaveBeenCalledWith('connect_saved', { name: 'conn' });
    expect(mockInvoke).toHaveBeenCalledWith('connect_database', { connection: 'conn', database: 'db' });
    expect(dataCallCount).toBe(2);
  });

  it('loads and maps column keys', async () => {
    const keys: ColumnKeyInfo[] = [
      {
        columnName: 'id',
        isPrimary: true,
        fkRefTable: null,
        fkRefColumn: null,
        isNullable: false,
        isAutoGenerated: true,
      },
      {
        columnName: 'user_id',
        isPrimary: false,
        fkRefTable: 'users',
        fkRefColumn: 'id',
        isNullable: true,
        isAutoGenerated: false,
      },
    ];
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data') return Promise.resolve(makeResult());
      if (cmd === 'get_column_keys') return Promise.resolve(keys);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.columnKeys).toEqual({ id: keys[0], user_id: keys[1] });
  });

  it('handles get_column_keys failure gracefully', async () => {
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data') return Promise.resolve(makeResult());
      if (cmd === 'get_column_keys') return Promise.reject(new Error('keys error'));
      return Promise.resolve(null);
    });

    const { result } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.columnKeys).toEqual({});
    expect(result.current.error).toBeNull();
  });

  it('loadTotalCount sets totalCount and manages loading flag', async () => {
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data') return Promise.resolve(makeResult({ row_count: 100 }));
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      if (cmd === 'count_rows') return Promise.resolve(999);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter, undefined, 100, 0)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.totalCount).toBeNull();

    act(() => { result.current.loadTotalCount(); });

    expect(result.current.totalCountLoading).toBe(true);

    await waitFor(() => expect(result.current.totalCountLoading).toBe(false));

    expect(result.current.totalCount).toBe(999);
    expect(mockInvoke).toHaveBeenCalledWith('count_rows', {
      connection: 'conn',
      database: 'db',
      table: 'tbl',
      filterEntries: noFilter,
    });
  });

  it('loadTotalCount handles failure gracefully', async () => {
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data') return Promise.resolve(makeResult({ row_count: 100 }));
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      if (cmd === 'count_rows') return Promise.reject(new Error('count error'));
      return Promise.resolve(null);
    });

    const { result } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter, undefined, 100, 0)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.loadTotalCount(); });

    await waitFor(() => expect(result.current.totalCountLoading).toBe(false));

    expect(result.current.totalCount).toBeNull();
  });

  it('resets totalCount when table changes', async () => {
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data') return Promise.resolve(makeResult({ row_count: 100 }));
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      if (cmd === 'count_rows') return Promise.resolve(500);
      return Promise.resolve(null);
    });

    const { result, rerender } = renderHook(
      ({ table }: { table: string }) =>
        useTableData('conn', 'db', table, noSort, noFilter, undefined, 100, 0),
      { initialProps: { table: 'table1' } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.loadTotalCount(); });
    await waitFor(() => expect(result.current.totalCount).toBe(500));

    rerender({ table: 'table2' });

    // Reset effect fires → totalCount becomes null
    await waitFor(() => expect(result.current.totalCount).toBeNull());
  });

  it('resets totalCount when filterEntries change', async () => {
    const filters: FilterEntry[] = [
      { col: 'id', value: '1', caseSensitive: false, colType: 'number', operator: 'eq' },
    ];
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data') return Promise.resolve(makeResult({ row_count: 100 }));
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      if (cmd === 'count_rows') return Promise.resolve(42);
      return Promise.resolve(null);
    });

    const { result, rerender } = renderHook(
      ({ f }: { f: FilterEntry[] }) =>
        useTableData('conn', 'db', 'tbl', noSort, f, undefined, 100, 0),
      { initialProps: { f: noFilter as FilterEntry[] } }
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.loadTotalCount(); });
    await waitFor(() => expect(result.current.totalCount).toBe(42));

    rerender({ f: filters });

    await waitFor(() => expect(result.current.totalCount).toBeNull());
  });

  it('clears column cache when refreshKey changes', async () => {
    let dataCallCount = 0;
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data') {
        dataCallCount++;
        if (dataCallCount === 1) return Promise.resolve(makeResult()); // first: with columns
        return Promise.resolve(
          makeResult({ columns: [], rows: [], row_count: 0, column_types: [], column_raw_types: [] })
        );
      }
      if (cmd === 'get_table_columns') return Promise.resolve([]);
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { result, rerender } = renderHook(
      ({ refreshKey }: { refreshKey: number }) =>
        useTableData('conn', 'db', 'tbl', noSort, noFilter, refreshKey, 100, 0),
      { initialProps: { refreshKey: 0 } }
    );

    await waitFor(() => expect(result.current.result?.columns).toEqual(['id', 'name']));

    // Changing refreshKey clears the cache
    rerender({ refreshKey: 1 });

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Cache was cleared; second load returned empty columns with no fallback
    expect(result.current.result?.columns).toEqual([]);
  });

  it('does not update state after unmount (cancelled flag)', async () => {
    let resolveData!: (v: QueryResult) => void;
    const dataPromise = new Promise<QueryResult>((res) => { resolveData = res; });

    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data') return dataPromise;
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { result, unmount } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter)
    );

    expect(result.current.loading).toBe(true);

    unmount();

    // Resolve after unmount — should not throw or cause React warnings
    await act(async () => { resolveData(makeResult()); });

    // State was not updated after unmount
    expect(result.current.loading).toBe(true);
    expect(result.current.result).toBeNull();
  });

  it('passes filterEntries to count_rows in loadTotalCount', async () => {
    const filters: FilterEntry[] = [
      { col: 'status', value: 'active', caseSensitive: false, colType: 'text', operator: 'eq' },
    ];
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data') return Promise.resolve(makeResult({ row_count: 100 }));
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      if (cmd === 'count_rows') return Promise.resolve(10);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, filters, undefined, 100, 0)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.loadTotalCount(); });
    await waitFor(() => expect(result.current.totalCountLoading).toBe(false));

    expect(mockInvoke).toHaveBeenCalledWith('count_rows', {
      connection: 'conn',
      database: 'db',
      table: 'tbl',
      filterEntries: filters,
    });
  });

  it('falls back to "text"/"" when column_types has fewer entries than columns', async () => {
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data')
        return Promise.resolve(makeResult({
          columns: ['id', 'name', 'extra'],
          column_types: ['number'], // only one type for three columns
          column_raw_types: ['int4'],
        }));
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter)
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.columnTypes).toEqual({ id: 'number', name: 'text', extra: 'text' });
    expect(result.current.columnRawTypes).toEqual({ id: 'int4', name: '', extra: '' });
  });

  it('does not call setResult when unmounted after get_table_data resolves but before get_table_columns resolves', async () => {
    let resolveColumns!: (v: ColumnInfo[]) => void;
    const columnsPromise = new Promise<ColumnInfo[]>((res) => { resolveColumns = res; });

    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data')
        return Promise.resolve(
          makeResult({ columns: [], rows: [], row_count: 0, column_types: [], column_raw_types: [] })
        );
      if (cmd === 'get_table_columns') return columnsPromise;
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { result, unmount } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter)
    );

    // Wait until get_table_columns is called (meaning get_table_data resolved)
    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('get_table_columns', expect.any(Object))
    );

    // Unmount while get_table_columns is still pending
    unmount();

    // Resolve get_table_columns after unmount
    await act(async () => { resolveColumns([{ name: 'id', dataType: 'integer' }]); });

    // No state updates should have occurred
    expect(result.current.result).toBeNull();
    expect(result.current.columnTypes).toEqual({});
  });

  it('does not set error when unmounted before get_table_data rejects', async () => {
    let rejectData!: (e: Error) => void;
    const dataPromise = new Promise<QueryResult>((_, rej) => { rejectData = rej; });

    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data') return dataPromise;
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { result, unmount } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter)
    );

    unmount();

    await act(async () => { rejectData(new Error('late error')); });

    expect(result.current.error).toBeNull();
  });

  it('uses rawTypeToCategory with dbType for fallback column types (MySQL tinyint(1) → boolean)', async () => {
    const columnInfos: ColumnInfo[] = [{ name: 'active', dataType: 'tinyint(1)' }];
    mockInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_table_data')
        return Promise.resolve(
          makeResult({ columns: [], rows: [], row_count: 0, column_types: [], column_raw_types: [] })
        );
      if (cmd === 'get_table_columns') return Promise.resolve(columnInfos);
      if (cmd === 'get_column_keys') return Promise.resolve([]);
      return Promise.resolve(null);
    });

    const { result } = renderHook(() =>
      useTableData('conn', 'db', 'tbl', noSort, noFilter, undefined, 100, 0, 'mysql')
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.columnTypes).toEqual({ active: 'boolean' });
    expect(result.current.columnRawTypes).toEqual({ active: 'tinyint(1)' });
  });
});
