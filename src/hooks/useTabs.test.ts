import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTabs } from './useTabs';
import { STORAGE_KEYS } from '@/lib/storage';

describe('useTabs', () => {
  it('openTable creates tab with correct id', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('myconn', 'mydb', 'users');
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].id).toBe('myconn::mydb::browse::users');
    expect(result.current.activeTabId).toBe('myconn::mydb::browse::users');
  });

  it('opening the same table twice → no duplicate tab', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tbl');
      result.current.openTable('conn', 'db', 'tbl');
    });
    expect(result.current.tabs).toHaveLength(1);
  });

  it('preview=true creates a preview tab', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tbl', true);
    });
    expect(result.current.tabs[0].preview).toBe(true);
  });

  it('preview=false creates a permanent tab', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tbl', false);
    });
    expect(result.current.tabs[0].preview).toBeFalsy();
  });

  it('opening a different table as preview replaces existing preview', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tblA', true);
      result.current.openTable('conn', 'db', 'tblB', true);
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].table).toBe('tblB');
  });

  it('opening a permanent tab does not remove existing permanent tabs', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tblA', false);
      result.current.openTable('conn', 'db', 'tblB', false);
    });
    expect(result.current.tabs).toHaveLength(2);
  });

  it('closeTab active tab at last index activates the new last tab', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tblA', false);
      result.current.openTable('conn', 'db', 'tblB', false);
    });
    const idA = 'conn::db::browse::tblA';
    const idB = 'conn::db::browse::tblB';
    expect(result.current.activeTabId).toBe(idB);
    act(() => {
      result.current.closeTab(idB);
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.activeTabId).toBe(idA);
  });

  it('closeTab non-active tab → activeTabId unchanged', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tblA', false);
      result.current.openTable('conn', 'db', 'tblB', false);
    });
    const idA = 'conn::db::browse::tblA';
    const idB = 'conn::db::browse::tblB';
    act(() => {
      result.current.closeTab(idA);
    });
    expect(result.current.activeTabId).toBe(idB);
  });

  it('closeTab last remaining tab → activeTabId becomes null', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tbl', false);
    });
    const id = 'conn::db::browse::tbl';
    act(() => {
      result.current.closeTab(id);
    });
    expect(result.current.tabs).toHaveLength(0);
    expect(result.current.activeTabId).toBeNull();
  });

  it('does not write tabs to localStorage before markRestored() is called', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tbl', false);
    });
    expect(localStorage.getItem(STORAGE_KEYS.TABS)).toBeNull();
  });

  it('writes tabs to localStorage after markRestored()', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.markRestored();
    });
    act(() => {
      result.current.openTable('conn', 'db', 'tbl', false);
    });
    expect(localStorage.getItem(STORAGE_KEYS.TABS)).not.toBeNull();
  });

  it('preview tabs are filtered out of localStorage', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.markRestored();
    });
    act(() => {
      result.current.openTable('conn', 'db', 'tbl', true);
    });
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.TABS) ?? '[]') as unknown[];
    expect(saved).toHaveLength(0);
  });

  it('create-table tabs are filtered out of localStorage', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.markRestored();
    });
    act(() => {
      result.current.openCreateTable('conn', 'db');
    });
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.TABS) ?? '[]') as unknown[];
    expect(saved).toHaveLength(0);
  });

  it('openSavedQuery creates saved-query tab with correct id', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openSavedQuery({ id: 'q1', name: 'Q', sql: '', connectionName: 'conn' });
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].id).toBe('saved::q1');
    expect(result.current.tabs[0].type).toBe('saved-query');
    expect(result.current.activeTabId).toBe('saved::q1');
  });

  it('openSavedQuery deduplication: same query twice = 1 tab', () => {
    const { result } = renderHook(() => useTabs());
    const q = { id: 'q1', name: 'Q', sql: '', connectionName: 'conn' };
    act(() => {
      result.current.openSavedQuery(q);
      result.current.openSavedQuery(q);
    });
    expect(result.current.tabs).toHaveLength(1);
  });

  it('openSavedQuery preview tab is replaced when a new preview is opened', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openSavedQuery({ id: 'q1', name: 'Q1', sql: '', connectionName: 'conn' }, true);
      result.current.openSavedQuery({ id: 'q2', name: 'Q2', sql: '', connectionName: 'conn' }, true);
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].id).toBe('saved::q2');
  });

  it('openSavedQuery permanent tab is not replaced by a subsequent preview', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openSavedQuery({ id: 'q1', name: 'Q1', sql: '', connectionName: 'conn' }, false);
      result.current.openSavedQuery({ id: 'q2', name: 'Q2', sql: '', connectionName: 'conn' }, true);
    });
    expect(result.current.tabs).toHaveLength(2);
  });

  it('promoteTab turns preview tab into permanent', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tbl', true);
    });
    expect(result.current.tabs[0].preview).toBe(true);
    act(() => {
      result.current.promoteTab('conn::db::browse::tbl');
    });
    expect(result.current.tabs[0].preview).toBe(false);
  });

  it('navigateFk creates new browse tab with initialFilters', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.navigateFk('conn', 'db', 'orders', 'user_id', '42', 'number');
    });
    expect(result.current.tabs).toHaveLength(1);
    const tab = result.current.tabs[0];
    expect(tab.id).toBe('conn::db::browse::orders');
    expect(tab.initialFilters).toEqual([
      { col: 'user_id', value: '42', caseSensitive: true, colType: 'number', exact: true },
    ]);
    expect(tab.filterKey).toBe(1);
  });

  it('navigateFk on existing tab increments filterKey and updates initialFilters', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'orders', false);
    });
    act(() => {
      result.current.navigateFk('conn', 'db', 'orders', 'user_id', '1', 'number');
    });
    act(() => {
      result.current.navigateFk('conn', 'db', 'orders', 'user_id', '2', 'number');
    });
    const tab = result.current.tabs[0];
    expect(tab.filterKey).toBe(2);
    expect(tab.initialFilters![0].value).toBe('2');
  });

  it('openSchemaDiagram creates schema-diagram tab with correct id', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openSchemaDiagram('conn', 'mydb');
    });
    expect(result.current.tabs[0].id).toBe('schema::conn::mydb');
    expect(result.current.tabs[0].type).toBe('schema-diagram');
  });

  it('openSchemaDiagram deduplicates: opening twice = 1 tab', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openSchemaDiagram('conn', 'mydb');
      result.current.openSchemaDiagram('conn', 'mydb');
    });
    expect(result.current.tabs).toHaveLength(1);
  });

  it('openCreateTable creates tab with correct id and type', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openCreateTable('conn', 'mydb');
    });
    expect(result.current.tabs[0].id).toBe('create-table::conn::mydb');
    expect(result.current.tabs[0].type).toBe('create-table');
  });

  it('refreshTab increments refreshKey on the target tab', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tbl', false);
    });
    const id = 'conn::db::browse::tbl';
    act(() => {
      result.current.refreshTab(id);
    });
    expect(result.current.tabs[0].refreshKey).toBe(1);
    act(() => {
      result.current.refreshTab(id);
    });
    expect(result.current.tabs[0].refreshKey).toBe(2);
  });

  it('Ctrl+W closes the active tab', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tbl', false);
    });
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, bubbles: true })
      );
    });
    expect(result.current.tabs).toHaveLength(0);
    expect(result.current.activeTabId).toBeNull();
  });

  it('closing the last tab after markRestored() removes ACTIVE_TAB from localStorage', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.markRestored();
      result.current.openTable('conn', 'db', 'tbl', false);
    });
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)).toBe('conn::db::browse::tbl');
    act(() => {
      result.current.closeTab('conn::db::browse::tbl');
    });
    expect(result.current.activeTabId).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)).toBeNull();
  });

  it('activeTabId is persisted to localStorage after markRestored()', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.markRestored();
      result.current.openTable('conn', 'db', 'tbl', false);
    });
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_TAB)).toBe('conn::db::browse::tbl');
  });

  it('openTable promotes existing preview tab when opened as permanent', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tbl', true);
    });
    expect(result.current.tabs[0].preview).toBe(true);
    act(() => {
      result.current.openTable('conn', 'db', 'tbl', false);
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].preview).toBe(false);
  });

  it('openTable existing permanent tab stays when opened again as preview', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tbl', false);
    });
    act(() => {
      result.current.openTable('conn', 'db', 'tbl', true);
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].preview).toBeFalsy();
  });

  it('openSavedQuery promotes existing preview tab when opened as permanent', () => {
    const { result } = renderHook(() => useTabs());
    const q = { id: 'q1', name: 'Q', sql: '', connectionName: 'conn' };
    act(() => {
      result.current.openSavedQuery(q, true);
    });
    expect(result.current.tabs[0].preview).toBe(true);
    act(() => {
      result.current.openSavedQuery(q, false);
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].preview).toBe(false);
  });

  it('openSavedQuery existing permanent tab stays when opened again as preview', () => {
    const { result } = renderHook(() => useTabs());
    const q = { id: 'q1', name: 'Q', sql: '', connectionName: 'conn' };
    act(() => {
      result.current.openSavedQuery(q, false);
    });
    act(() => {
      result.current.openSavedQuery(q, true);
    });
    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].preview).toBeFalsy();
  });

  it('openCreateTable deduplicates: opening same twice = 1 tab', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openCreateTable('conn', 'mydb');
      result.current.openCreateTable('conn', 'mydb');
    });
    expect(result.current.tabs).toHaveLength(1);
  });

  it('Cmd+W (metaKey) closes the active tab', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tbl', false);
    });
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'w', metaKey: true, bubbles: true })
      );
    });
    expect(result.current.tabs).toHaveLength(0);
    expect(result.current.activeTabId).toBeNull();
  });

  it('Ctrl+W with no active tab is a no-op', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, bubbles: true })
      );
    });
    expect(result.current.tabs).toHaveLength(0);
  });

  it('keydown with unrelated key does not close tab', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tbl', false);
    });
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'x', ctrlKey: true, bubbles: true })
      );
    });
    expect(result.current.tabs).toHaveLength(1);
  });

  it('promoteTab does not affect other tabs', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tblA', false);
      result.current.openTable('conn', 'db', 'tblB', true);
    });
    act(() => {
      result.current.promoteTab('conn::db::browse::tblB');
    });
    const tblA = result.current.tabs.find((t) => t.table === 'tblA');
    expect(tblA?.preview).toBeFalsy();
    const tblB = result.current.tabs.find((t) => t.table === 'tblB');
    expect(tblB?.preview).toBe(false);
  });

  it('openTable promotes existing preview tab with other tabs present', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tblA', false);
      result.current.openTable('conn', 'db', 'tblB', true);
    });
    // tblA is permanent, tblB is preview - both coexist since tblA is not preview
    expect(result.current.tabs).toHaveLength(2);
    act(() => {
      result.current.openTable('conn', 'db', 'tblB', false);
    });
    expect(result.current.tabs).toHaveLength(2);
    const tblB = result.current.tabs.find((t) => t.table === 'tblB');
    expect(tblB?.preview).toBe(false);
    const tblA = result.current.tabs.find((t) => t.table === 'tblA');
    expect(tblA?.preview).toBeFalsy();
  });

  it('openSavedQuery promotes existing preview tab with other tabs present', () => {
    const { result } = renderHook(() => useTabs());
    const q1 = { id: 'q1', name: 'Q1', sql: '', connectionName: 'conn' };
    const q2 = { id: 'q2', name: 'Q2', sql: '', connectionName: 'conn' };
    act(() => {
      result.current.openSavedQuery(q1, false);
      result.current.openSavedQuery(q2, true);
    });
    expect(result.current.tabs).toHaveLength(2);
    act(() => {
      result.current.openSavedQuery(q2, false);
    });
    expect(result.current.tabs).toHaveLength(2);
    const tab2 = result.current.tabs.find((t) => t.savedQueryId === 'q2');
    expect(tab2?.preview).toBe(false);
  });

  it('navigateFk on existing tab does not affect other tabs', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tblA', false);
      result.current.openTable('conn', 'db', 'tblB', false);
    });
    act(() => {
      result.current.navigateFk('conn', 'db', 'tblA', 'id', '1', 'number');
    });
    const tblB = result.current.tabs.find((t) => t.table === 'tblB');
    expect(tblB?.filterKey).toBeUndefined();
    const tblA = result.current.tabs.find((t) => t.table === 'tblA');
    expect(tblA?.filterKey).toBe(1);
  });

  it('refreshTab does not affect other tabs', () => {
    const { result } = renderHook(() => useTabs());
    act(() => {
      result.current.openTable('conn', 'db', 'tblA', false);
      result.current.openTable('conn', 'db', 'tblB', false);
    });
    act(() => {
      result.current.refreshTab('conn::db::browse::tblA');
    });
    const tblB = result.current.tabs.find((t) => t.table === 'tblB');
    expect(tblB?.refreshKey).toBeUndefined();
    const tblA = result.current.tabs.find((t) => t.table === 'tblA');
    expect(tblA?.refreshKey).toBe(1);
  });
});
