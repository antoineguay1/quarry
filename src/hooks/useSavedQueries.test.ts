import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useSavedQueries } from './useSavedQueries';
import type { TabEntry } from '@/types';

beforeEach(() => {
  vi.clearAllMocks();
});

function makeOptions(overrides: Partial<Parameters<typeof useSavedQueries>[0]> = {}) {
  return {
    openSavedQuery: vi.fn(),
    closeTab: vi.fn(),
    setTabs: vi.fn(),
    setActivePanel: vi.fn(),
    ...overrides,
  };
}

describe('useSavedQueries', () => {
  it('handleCreateQuery with empty list generates "New Query 1"', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const opts = makeOptions();
    const { result } = renderHook(() => useSavedQueries(opts));

    await act(async () => {
      await result.current.handleCreateQuery('myconn');
    });

    expect(opts.openSavedQuery).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Query 1', connectionName: 'myconn' }),
      false
    );
  });

  it('handleCreateQuery with "New Query 1" and "New Query 2" generates "New Query 3"', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const opts = makeOptions();
    const { result } = renderHook(() => useSavedQueries(opts));

    act(() => {
      result.current.setSavedQueries([
        { id: '1', name: 'New Query 1', sql: '', connectionName: 'conn' },
        { id: '2', name: 'New Query 2', sql: '', connectionName: 'conn' },
      ]);
    });

    await act(async () => {
      await result.current.handleCreateQuery('conn');
    });

    expect(opts.openSavedQuery).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Query 3' }),
      false
    );
  });

  it('handleCreateQuery calls invoke save_query with the new query', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const opts = makeOptions();
    const { result } = renderHook(() => useSavedQueries(opts));

    await act(async () => {
      await result.current.handleCreateQuery('conn');
    });

    expect(vi.mocked(invoke)).toHaveBeenCalledWith(
      'save_query',
      expect.objectContaining({ query: expect.objectContaining({ name: 'New Query 1' }) })
    );
  });

  it('handleCreateQuery calls setActivePanel("queries") and sets pendingRenameQueryId', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const opts = makeOptions();
    const { result } = renderHook(() => useSavedQueries(opts));

    await act(async () => {
      await result.current.handleCreateQuery('conn');
    });

    expect(opts.setActivePanel).toHaveBeenCalledWith('queries');
    expect(result.current.pendingRenameQueryId).not.toBeNull();
  });

  it('handleUpdateQuery updates the query in savedQueries state', () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const opts = makeOptions();
    const { result } = renderHook(() => useSavedQueries(opts));

    act(() => {
      result.current.setSavedQueries([
        { id: 'q1', name: 'Old Name', sql: '', connectionName: 'conn' },
      ]);
    });

    act(() => {
      result.current.handleUpdateQuery('q1', { name: 'New Name' });
    });

    expect(result.current.savedQueries[0].name).toBe('New Name');
  });

  it('handleUpdateQuery with connectionName update calls setTabs', () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const setTabs = vi.fn();
    const opts = makeOptions({ setTabs });
    const { result } = renderHook(() => useSavedQueries(opts));

    act(() => {
      result.current.setSavedQueries([
        { id: 'q1', name: 'Test', sql: '', connectionName: 'conn1' },
      ]);
    });

    act(() => {
      result.current.handleUpdateQuery('q1', { connectionName: 'conn2' });
    });

    expect(setTabs).toHaveBeenCalled();
    // Verify the tab updater renames the connectionName on matching tabs
    const updater = setTabs.mock.calls[0][0] as (prev: TabEntry[]) => TabEntry[];
    const prevTabs: TabEntry[] = [
      { id: 'saved::q1', connectionName: 'conn1', type: 'saved-query', savedQueryId: 'q1' },
    ];
    const nextTabs = updater(prevTabs);
    expect(nextTabs[0].connectionName).toBe('conn2');
  });

  it('handleDeleteSavedQuery calls invoke, removes from state, closes tab', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const closeTab = vi.fn();
    const opts = makeOptions({ closeTab });
    const { result } = renderHook(() => useSavedQueries(opts));

    act(() => {
      result.current.setSavedQueries([
        { id: 'q1', name: 'Query 1', sql: '', connectionName: 'conn' },
      ]);
    });

    await act(async () => {
      await result.current.handleDeleteSavedQuery('q1');
    });

    expect(vi.mocked(invoke)).toHaveBeenCalledWith('delete_saved_query', { id: 'q1' });
    expect(result.current.savedQueries).toHaveLength(0);
    expect(closeTab).toHaveBeenCalledWith('saved::q1');
  });

  it('handleConfirmDeleteQuery does nothing when deleteQueryConfirm is null', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const opts = makeOptions();
    const { result } = renderHook(() => useSavedQueries(opts));

    await act(async () => {
      await result.current.handleConfirmDeleteQuery();
    });

    expect(vi.mocked(invoke)).not.toHaveBeenCalled();
  });

  it('handleUpdateQuery logs error when invoke rejects', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(invoke).mockRejectedValue(new Error('network error'));
    const opts = makeOptions();
    const { result } = renderHook(() => useSavedQueries(opts));

    act(() => {
      result.current.setSavedQueries([
        { id: 'q1', name: 'Query', sql: '', connectionName: 'conn' },
      ]);
    });

    act(() => {
      result.current.handleUpdateQuery('q1', { name: 'Renamed' });
    });

    // Wait for the rejected promise in the void invoke call
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(consoleSpy).toHaveBeenCalledWith('Auto-save failed:', expect.any(Error));
    consoleSpy.mockRestore();
  });

  it('handleConfirmDeleteQuery deletes when deleteQueryConfirm is set', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const closeTab = vi.fn();
    const opts = makeOptions({ closeTab });
    const { result } = renderHook(() => useSavedQueries(opts));

    act(() => {
      result.current.setSavedQueries([
        { id: 'q2', name: 'Q', sql: '', connectionName: 'conn' },
      ]);
      result.current.setDeleteQueryConfirm('q2');
    });

    await act(async () => {
      await result.current.handleConfirmDeleteQuery();
    });

    expect(closeTab).toHaveBeenCalledWith('saved::q2');
    expect(result.current.savedQueries).toHaveLength(0);
    expect(result.current.deleteQueryConfirm).toBeNull();
  });
});
