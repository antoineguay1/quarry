import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTableSearch } from './useTableSearch';
import type { QueryResult } from '@/types';

function makeResult(cols: string[], rows: unknown[][]): QueryResult {
  return {
    columns: cols,
    column_types: [],
    column_raw_types: [],
    rows,
    row_count: rows.length,
    sql: '',
    execution_time_ms: 0,
  };
}

describe('useTableSearch', () => {
  it('allMatches is empty when no search query', () => {
    const result = makeResult(['name'], [['Alice'], ['Bob']]);
    const { result: hook } = renderHook(() =>
      useTableSearch({ result, hiddenColumns: new Set(), resetKey: 'k', historyKey: 'h1' })
    );
    expect(hook.current.allMatches).toHaveLength(0);
  });

  it('finds matches after commitSearch', () => {
    const result = makeResult(['name'], [['Alice'], ['Bob']]);
    const { result: hook } = renderHook(() =>
      useTableSearch({ result, hiddenColumns: new Set(), resetKey: 'k', historyKey: 'h2' })
    );
    act(() => {
      hook.current.commitSearch('Alice');
    });
    expect(hook.current.allMatches).toHaveLength(1);
    expect(hook.current.allMatches[0].rowIdx).toBe(0);
  });

  it('respects case sensitivity toggle', () => {
    const result = makeResult(['name'], [['Alice'], ['alice']]);
    const { result: hook } = renderHook(() =>
      useTableSearch({ result, hiddenColumns: new Set(), resetKey: 'k', historyKey: 'h3' })
    );
    act(() => {
      hook.current.setSearchCaseSensitive(true);
    });
    act(() => {
      hook.current.commitSearch('Alice');
    });
    // Case-sensitive: 'Alice' matches row 0 only
    expect(hook.current.allMatches).toHaveLength(1);
    expect(hook.current.allMatches[0].rowIdx).toBe(0);
  });

  it('hidden columns excluded from search', () => {
    const result = makeResult(['name', 'email'], [['Bob', 'bob@example.com']]);
    const { result: hook } = renderHook(() =>
      useTableSearch({ result, hiddenColumns: new Set(['email']), resetKey: 'k', historyKey: 'h4' })
    );
    act(() => {
      hook.current.commitSearch('bob');
    });
    // 'bob' matches in 'name' (colIdx=0) but NOT in hidden 'email' (colIdx=1)
    const colIndices = hook.current.allMatches.map((m) => m.colIdx);
    expect(colIndices).not.toContain(1);
  });

  it('null cells are skipped without errors', () => {
    const result = makeResult(['name'], [[null], ['Alice']]);
    const { result: hook } = renderHook(() =>
      useTableSearch({ result, hiddenColumns: new Set(), resetKey: 'k', historyKey: 'h5' })
    );
    act(() => {
      hook.current.commitSearch('Alice');
    });
    expect(hook.current.allMatches).toHaveLength(1);
    expect(hook.current.allMatches[0].rowIdx).toBe(1);
  });

  it('history deduplication: committing same term twice → one entry moved to front', () => {
    const { result: hook } = renderHook(() =>
      useTableSearch({ result: null, hiddenColumns: new Set(), resetKey: 'k', historyKey: 'h-dedup' })
    );
    act(() => { hook.current.commitSearch('foo'); });
    act(() => { hook.current.commitSearch('bar'); });
    act(() => { hook.current.commitSearch('foo'); }); // re-commit 'foo'
    expect(hook.current.searchHistory[0]).toBe('foo');
    expect(hook.current.searchHistory.filter((h) => h === 'foo')).toHaveLength(1);
  });

  it('history capped at 10 entries', () => {
    const { result: hook } = renderHook(() =>
      useTableSearch({ result: null, hiddenColumns: new Set(), resetKey: 'k', historyKey: 'h-cap' })
    );
    act(() => {
      for (let i = 0; i < 12; i++) {
        hook.current.commitSearch(`term${i}`);
      }
    });
    expect(hook.current.searchHistory).toHaveLength(10);
  });

  it('navigate(1) cycles forward, wrapping at end', () => {
    const result = makeResult(['name'], [['foo'], ['foo']]);
    const { result: hook } = renderHook(() =>
      useTableSearch({ result, hiddenColumns: new Set(), resetKey: 'k', historyKey: 'h-nav' })
    );
    act(() => { hook.current.commitSearch('foo'); });
    expect(hook.current.allMatches).toHaveLength(2);
    expect(hook.current.currentMatchIndex).toBe(0);

    act(() => { hook.current.navigate(1); });
    expect(hook.current.currentMatchIndex).toBe(1);

    act(() => { hook.current.navigate(1); });
    expect(hook.current.currentMatchIndex).toBe(0); // wraps
  });

  it('navigate(-1) cycles backward, wrapping at start', () => {
    const result = makeResult(['name'], [['foo'], ['foo']]);
    const { result: hook } = renderHook(() =>
      useTableSearch({ result, hiddenColumns: new Set(), resetKey: 'k', historyKey: 'h-nav2' })
    );
    act(() => { hook.current.commitSearch('foo'); });
    act(() => { hook.current.navigate(-1); });
    expect(hook.current.currentMatchIndex).toBe(1); // wraps to last
  });

  it('renderCellContent returns string when no query is set', () => {
    const queryResult = makeResult(['name'], [['Alice']]);
    const { result: hook } = renderHook(() =>
      useTableSearch({ result: queryResult, hiddenColumns: new Set(), resetKey: 'k', historyKey: 'h-render1' })
    );
    const rendered = hook.current.renderCellContent('Alice', 0, 0);
    expect(rendered).toBe('Alice');
  });

  it('renderCellContent returns JSX array with <mark> for matched text', () => {
    const queryResult = makeResult(['name'], [['Alice']]);
    const { result: hook } = renderHook(() =>
      useTableSearch({ result: queryResult, hiddenColumns: new Set(), resetKey: 'k', historyKey: 'h-render2' })
    );
    act(() => { hook.current.commitSearch('Alice'); });
    const rendered = hook.current.renderCellContent('Alice', 0, 0);
    expect(Array.isArray(rendered)).toBe(true);
    const parts = rendered as unknown[];
    const markEl = parts.find((p) => typeof p === 'object' && p !== null && (p as { type?: string }).type === 'mark');
    expect(markEl).toBeDefined();
  });

  it('applyHistoryItem sets inputValue and searchQuery', () => {
    const queryResult = makeResult(['name'], [['Alice']]);
    const { result: hook } = renderHook(() =>
      useTableSearch({ result: queryResult, hiddenColumns: new Set(), resetKey: 'k', historyKey: 'h-apply' })
    );
    act(() => { hook.current.commitSearch('Alice'); });
    act(() => { hook.current.applyHistoryItem('Alice'); });
    expect(hook.current.searchQuery).toBe('Alice');
    expect(hook.current.inputValue).toBe('Alice');
    expect(hook.current.historyOpen).toBe(false);
  });

  it('closeSearch clears searchQuery, inputValue and closes panel', () => {
    const { result: hook } = renderHook(() =>
      useTableSearch({ result: null, hiddenColumns: new Set(), resetKey: 'k', historyKey: 'h-close' })
    );
    act(() => {
      hook.current.setSearchOpen(true);
      hook.current.commitSearch('foo');
    });
    expect(hook.current.searchQuery).toBe('foo');
    act(() => { hook.current.closeSearch(); });
    expect(hook.current.searchQuery).toBe('');
    expect(hook.current.inputValue).toBe('');
    expect(hook.current.searchOpen).toBe(false);
  });

  it('resetKey change clears search state', () => {
    const { result: hook, rerender } = renderHook(
      ({ resetKey }: { resetKey: string }) =>
        useTableSearch({ result: null, hiddenColumns: new Set(), resetKey, historyKey: 'h-reset' }),
      { initialProps: { resetKey: 'k1' } }
    );
    act(() => {
      hook.current.setSearchOpen(true);
      hook.current.commitSearch('hello');
    });
    expect(hook.current.searchQuery).toBe('hello');
    rerender({ resetKey: 'k2' });
    expect(hook.current.searchQuery).toBe('');
    expect(hook.current.searchOpen).toBe(false);
  });

  it('historyKey change reloads search history', () => {
    const newKey = 'h-new-key';
    localStorage.setItem(
      `quarry-search-history::${newKey}`,
      JSON.stringify(['cached-term'])
    );
    const { result: hook, rerender } = renderHook(
      ({ historyKey }: { historyKey: string }) =>
        useTableSearch({ result: null, hiddenColumns: new Set(), resetKey: 'k', historyKey }),
      { initialProps: { historyKey: 'h-old-key' } }
    );
    expect(hook.current.searchHistory).toEqual([]);
    rerender({ historyKey: newKey });
    expect(hook.current.searchHistory).toEqual(['cached-term']);
  });

  it('Escape key closes search when open', () => {
    const { result: hook } = renderHook(() =>
      useTableSearch({ result: null, hiddenColumns: new Set(), resetKey: 'k', historyKey: 'h-esc' })
    );
    act(() => {
      hook.current.setSearchOpen(true);
      hook.current.commitSearch('hello');
    });
    expect(hook.current.searchOpen).toBe(true);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(hook.current.searchOpen).toBe(false);
    expect(hook.current.searchQuery).toBe('');
    expect(hook.current.inputValue).toBe('');
  });

  it('Escape key is a no-op when search is closed', () => {
    const { result: hook } = renderHook(() =>
      useTableSearch({ result: null, hiddenColumns: new Set(), resetKey: 'k', historyKey: 'h-esc-noop' })
    );
    expect(hook.current.searchOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(hook.current.searchOpen).toBe(false);
  });

  it('Ctrl+F opens search', () => {
    const { result: hook } = renderHook(() =>
      useTableSearch({ result: null, hiddenColumns: new Set(), resetKey: 'k', historyKey: 'h-ctrlf' })
    );
    expect(hook.current.searchOpen).toBe(false);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }));
    });
    expect(hook.current.searchOpen).toBe(true);
  });

  it('rowsWithMatches contains row indices with at least one match', () => {
    const queryResult = makeResult(['name', 'email'], [
      ['Alice', 'alice@example.com'],
      ['Bob', 'bob@example.com'],
    ]);
    const { result: hook } = renderHook(() =>
      useTableSearch({ result: queryResult, hiddenColumns: new Set(), resetKey: 'k', historyKey: 'h-rows' })
    );
    act(() => { hook.current.commitSearch('Alice'); });
    expect(hook.current.rowsWithMatches.has(0)).toBe(true);
    expect(hook.current.rowsWithMatches.has(1)).toBe(false);
  });
});
