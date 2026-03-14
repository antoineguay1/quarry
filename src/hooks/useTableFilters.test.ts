import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTableFilters } from './useTableFilters';
import { STORAGE_KEYS } from '@/lib/storage';

describe('useTableFilters', () => {
  it('restores sort and filter from localStorage on init', () => {
    const storageKey = 'test-table-restore';
    const saved = {
      sort: [{ col: 'name', dir: 'asc' }],
      filter: [{ col: 'name', value: 'Alice', operator: 'eq', caseSensitive: false, colType: 'text' }],
      pageSize: 50,
    };
    localStorage.setItem(`${STORAGE_KEYS.TABLE_STATE_PREFIX}::${storageKey}`, JSON.stringify(saved));

    const { result } = renderHook(() =>
      useTableFilters({ resetKey: 'k', storageKey })
    );
    expect(result.current.sortEntries).toEqual(saved.sort);
    expect(result.current.filterEntries).toEqual(saved.filter);
    expect(result.current.pageSize).toBe(50);
  });

  it('uses DEFAULT pageSize when nothing is stored', () => {
    const { result } = renderHook(() =>
      useTableFilters({ resetKey: 'k', storageKey: 'fresh-table' })
    );
    // Default page size from useSettings is 100
    expect(result.current.pageSize).toBe(100);
  });

  it('applyFilter with between operator + empty value2 → filter NOT added', () => {
    const { result } = renderHook(() =>
      useTableFilters({ resetKey: 'k', storageKey: 'tbl-between' })
    );
    act(() => {
      result.current.setFilterDraft({
        value: '10',
        value2: '',
        operator: 'between',
        caseSensitive: false,
        nullFilter: '',
      });
    });
    act(() => {
      result.current.applyFilter('age', 'number');
    });
    expect(result.current.filterEntries).toHaveLength(0);
  });

  it('applyFilter with nullFilter set → entry added regardless of value', () => {
    const { result } = renderHook(() =>
      useTableFilters({ resetKey: 'k', storageKey: 'tbl-null' })
    );
    act(() => {
      result.current.setFilterDraft({
        value: '',
        value2: '',
        operator: 'eq',
        caseSensitive: false,
        nullFilter: 'is_null',
      });
    });
    act(() => {
      result.current.applyFilter('email', 'text');
    });
    expect(result.current.filterEntries).toHaveLength(1);
    expect(result.current.filterEntries[0].nullFilter).toBe('is_null');
  });

  it('replacing existing filter for same column → still one entry', () => {
    const { result } = renderHook(() =>
      useTableFilters({ resetKey: 'k', storageKey: 'tbl-replace' })
    );
    act(() => {
      result.current.setFilterDraft({ value: 'Alice', value2: '', operator: 'eq', caseSensitive: false, nullFilter: '' });
    });
    act(() => {
      result.current.applyFilter('name', 'text');
    });
    act(() => {
      result.current.setFilterDraft({ value: 'Bob', value2: '', operator: 'eq', caseSensitive: false, nullFilter: '' });
    });
    act(() => {
      result.current.applyFilter('name', 'text');
    });
    expect(result.current.filterEntries).toHaveLength(1);
    expect(result.current.filterEntries[0].value).toBe('Bob');
  });

  it('handleSort cycles: unsorted → asc → desc → removed', () => {
    const { result } = renderHook(() =>
      useTableFilters({ resetKey: 'k', storageKey: 'tbl-sort' })
    );
    act(() => { result.current.handleSort('age'); });
    expect(result.current.sortEntries[0]).toEqual({ col: 'age', dir: 'asc' });

    act(() => { result.current.handleSort('age'); });
    expect(result.current.sortEntries[0]).toEqual({ col: 'age', dir: 'desc' });

    act(() => { result.current.handleSort('age'); });
    expect(result.current.sortEntries).toHaveLength(0);
  });

  it('initialFilters prop seeds the filter entries', () => {
    const initial = [{ col: 'id', value: '42', operator: 'eq' as const, caseSensitive: true, colType: 'number' as const }];
    const { result } = renderHook(() =>
      useTableFilters({ initialFilters: initial, resetKey: 'k', storageKey: 'tbl-init' })
    );
    expect(result.current.filterEntries).toEqual(initial);
    expect(result.current.sortEntries).toHaveLength(0);
  });

  it('resetKey change with initialFilters clears sort and applies new filters', () => {
    const initial = [{ col: 'id', value: '1', operator: 'eq' as const, caseSensitive: false, colType: 'number' as const }];
    type Props = { resetKey: string; filters: typeof initial | undefined };
    const { result, rerender } = renderHook(
      ({ resetKey, filters }: Props) => useTableFilters({ initialFilters: filters, resetKey, storageKey: 'tbl-reset-f' }),
      { initialProps: { resetKey: 'keyA', filters: undefined as typeof initial | undefined } }
    );
    act(() => {
      result.current.handleSort('col');
    });
    expect(result.current.sortEntries).toHaveLength(1);

    // Provide new initialFilters on resetKey change (FK navigation use-case)
    rerender({ resetKey: 'keyB', filters: initial });
    expect(result.current.sortEntries).toHaveLength(0);
    expect(result.current.filterEntries).toEqual(initial);
  });

  it('applyFilter with normal text value adds the filter entry', () => {
    const { result } = renderHook(() =>
      useTableFilters({ resetKey: 'k', storageKey: 'tbl-text-filter' })
    );
    act(() => {
      result.current.setFilterDraft({
        value: 'Alice',
        value2: '',
        operator: 'eq',
        caseSensitive: false,
        nullFilter: '',
      });
    });
    act(() => {
      result.current.applyFilter('name', 'text');
    });
    expect(result.current.filterEntries).toHaveLength(1);
    expect(result.current.filterEntries[0].col).toBe('name');
    expect(result.current.filterEntries[0].value).toBe('Alice');
  });

  it('applyFilter with empty value removes an existing filter for that column', () => {
    const { result } = renderHook(() =>
      useTableFilters({ resetKey: 'k', storageKey: 'tbl-remove-filter' })
    );
    act(() => {
      result.current.setFilterDraft({ value: 'Bob', value2: '', operator: 'eq', caseSensitive: false, nullFilter: '' });
    });
    act(() => {
      result.current.applyFilter('name', 'text');
    });
    expect(result.current.filterEntries).toHaveLength(1);

    act(() => {
      result.current.setFilterDraft({ value: '', value2: '', operator: 'eq', caseSensitive: false, nullFilter: '' });
    });
    act(() => {
      result.current.applyFilter('name', 'text');
    });
    expect(result.current.filterEntries).toHaveLength(0);
  });

  it('openFilterModal populates filterDraft with existing entry values', () => {
    const { result } = renderHook(() =>
      useTableFilters({ resetKey: 'k', storageKey: 'tbl-open-modal' })
    );
    act(() => {
      result.current.setFilterDraft({ value: 'Alice', value2: '', operator: 'eq', caseSensitive: true, nullFilter: '' });
    });
    act(() => {
      result.current.applyFilter('name', 'text');
    });
    // Clear the draft, then re-open the modal for the same column
    act(() => {
      result.current.setFilterDraft({ value: '', value2: '', operator: 'eq', caseSensitive: false, nullFilter: '' });
    });
    act(() => {
      result.current.openFilterModal('name');
    });
    expect(result.current.filterDraft.value).toBe('Alice');
    expect(result.current.filterDraft.caseSensitive).toBe(true);
    expect(result.current.openFilterCol).toBe('name');
  });

  it('clearFilter removes the entry for that column', () => {
    const { result } = renderHook(() =>
      useTableFilters({ resetKey: 'k', storageKey: 'tbl-clear-filter' })
    );
    act(() => {
      result.current.setFilterDraft({ value: 'x', value2: '', operator: 'eq', caseSensitive: false, nullFilter: '' });
    });
    act(() => {
      result.current.applyFilter('status', 'text');
    });
    expect(result.current.filterEntries).toHaveLength(1);
    act(() => {
      result.current.clearFilter('status');
    });
    expect(result.current.filterEntries).toHaveLength(0);
  });

  it('closeFilter sets openFilterCol to null', () => {
    const { result } = renderHook(() =>
      useTableFilters({ resetKey: 'k', storageKey: 'tbl-close-filter' })
    );
    act(() => {
      result.current.openFilterModal('age');
    });
    expect(result.current.openFilterCol).toBe('age');
    act(() => {
      result.current.closeFilter();
    });
    expect(result.current.openFilterCol).toBeNull();
  });

  it('loadState returns null and falls back to defaults when localStorage has invalid JSON', () => {
    const storageKey = 'tbl-invalid-json';
    localStorage.setItem(`${STORAGE_KEYS.TABLE_STATE_PREFIX}::${storageKey}`, 'not-json');
    const { result } = renderHook(() =>
      useTableFilters({ resetKey: 'k', storageKey })
    );
    expect(result.current.sortEntries).toEqual([]);
    expect(result.current.filterEntries).toEqual([]);
    expect(result.current.pageSize).toBe(100);
  });

  it('setPageSize updates the pageSize value', () => {
    const { result } = renderHook(() =>
      useTableFilters({ resetKey: 'k', storageKey: 'tbl-pagesize' })
    );
    act(() => {
      result.current.setPageSize(200);
    });
    expect(result.current.pageSize).toBe(200);
  });
});
