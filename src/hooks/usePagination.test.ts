import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePagination } from './usePagination';
import type { FilterEntry, SortEntry } from '@/types';

// Stable references so the sort/filter dependency effect doesn't fire on every re-render
const stableSort: SortEntry[] = [];
const stableFilter: FilterEntry[] = [];

describe('usePagination', () => {
  it('initial page is 0', () => {
    const { result } = renderHook(() =>
      usePagination({ resetKey: 'k', sortEntries: stableSort, filterEntries: stableFilter })
    );
    expect(result.current.page).toBe(0);
  });

  it('setPage works manually', () => {
    const { result } = renderHook(() =>
      usePagination({ resetKey: 'k', sortEntries: stableSort, filterEntries: stableFilter })
    );
    act(() => { result.current.setPage(3); });
    expect(result.current.page).toBe(3);
  });

  it('page resets to 0 when resetKey changes', () => {
    const { result, rerender } = renderHook(
      ({ resetKey }: { resetKey: string }) =>
        usePagination({ resetKey, sortEntries: stableSort, filterEntries: stableFilter }),
      { initialProps: { resetKey: 'a' } }
    );
    act(() => { result.current.setPage(5); });
    expect(result.current.page).toBe(5);
    rerender({ resetKey: 'b' });
    expect(result.current.page).toBe(0);
  });

  it('page resets to 0 when sortEntries reference changes', () => {
    const initialSort: SortEntry[] = [];
    const { result, rerender } = renderHook(
      ({ sortEntries }: { sortEntries: SortEntry[] }) =>
        usePagination({ resetKey: 'k', sortEntries, filterEntries: stableFilter }),
      { initialProps: { sortEntries: initialSort } }
    );
    act(() => { result.current.setPage(2); });
    expect(result.current.page).toBe(2);
    rerender({ sortEntries: [{ col: 'name', dir: 'asc' }] });
    expect(result.current.page).toBe(0);
  });

  it('page resets to 0 when filterEntries reference changes', () => {
    const initialFilter: FilterEntry[] = [];
    const { result, rerender } = renderHook(
      ({ filterEntries }: { filterEntries: FilterEntry[] }) =>
        usePagination({ resetKey: 'k', sortEntries: stableSort, filterEntries }),
      { initialProps: { filterEntries: initialFilter } }
    );
    act(() => { result.current.setPage(4); });
    expect(result.current.page).toBe(4);
    rerender({
      filterEntries: [
        { col: 'name', value: 'x', operator: 'eq', caseSensitive: false, colType: 'text' },
      ],
    });
    expect(result.current.page).toBe(0);
  });
});
