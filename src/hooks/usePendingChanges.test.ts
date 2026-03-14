import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePendingChanges } from './usePendingChanges';

describe('usePendingChanges', () => {
  it('modifyCell adds a change', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.modifyCell(0, 'name', 'Alice', 'Bob');
    });
    expect(result.current.isCellModified(0, 'name')).toBe(true);
    expect(result.current.changeCount).toBe(1);
  });

  it('modifying back to original value removes the change', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.modifyCell(0, 'name', 'Alice', 'Bob');
    });
    act(() => {
      result.current.modifyCell(0, 'name', 'Bob', 'Bob');
    });
    expect(result.current.isCellModified(0, 'name')).toBe(false);
    expect(result.current.changeCount).toBe(0);
  });

  it('changeCount counts distinct modified rows not cells', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.modifyCell(0, 'col1', 'x', 'a');
      result.current.modifyCell(0, 'col2', 'y', 'b'); // same row
      result.current.modifyCell(1, 'col1', 'z', 'c'); // different row
    });
    expect(result.current.changeCount).toBe(2);
  });

  it('modifying a cell in a deleted row does not double-count it', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.modifyCell(0, 'col1', 'x', 'a');
      result.current.markRowsDeleted([0]);
    });
    // Row 0 is deleted: modified-cell count excludes it, deleted row counts as 1
    expect(result.current.changeCount).toBe(1);
  });

  it('markRowsDeleted / unmarkRowDeleted / isRowDeleted', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.markRowsDeleted([2, 3]);
    });
    expect(result.current.isRowDeleted(2)).toBe(true);
    expect(result.current.isRowDeleted(3)).toBe(true);
    expect(result.current.isRowDeleted(1)).toBe(false);
    act(() => {
      result.current.unmarkRowDeleted(2);
    });
    expect(result.current.isRowDeleted(2)).toBe(false);
    expect(result.current.isRowDeleted(3)).toBe(true);
  });

  it('addInsertedRow assigns tempId starting with tmp_', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.addInsertedRow(['col1', 'col2'], new Set());
    });
    expect(result.current.insertedRows).toHaveLength(1);
    expect(result.current.insertedRows[0].tempId).toMatch(/^tmp_/);
  });

  it('addInsertedRow: auto-generated cols go to autoFields, others to fields', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.addInsertedRow(['id', 'name'], new Set(['id']));
    });
    const row = result.current.insertedRows[0];
    expect(row.autoFields.has('id')).toBe(true);
    expect('id' in row.fields).toBe(false);
    expect('name' in row.fields).toBe(true);
  });

  it('toggleInsertedRowAuto moves col to autoFields and back', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.addInsertedRow(['id', 'name'], new Set());
    });
    const tempId = result.current.insertedRows[0].tempId;
    expect(result.current.insertedRows[0].autoFields.has('id')).toBe(false);

    act(() => {
      result.current.toggleInsertedRowAuto(tempId, 'id');
    });
    expect(result.current.insertedRows[0].autoFields.has('id')).toBe(true);

    act(() => {
      result.current.toggleInsertedRowAuto(tempId, 'id');
    });
    expect(result.current.insertedRows[0].autoFields.has('id')).toBe(false);
  });

  it('getCellValue returns the modified value', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.modifyCell(0, 'name', 'Alice', 'Bob');
    });
    expect(result.current.getCellValue(0, 'name')).toBe('Alice');
    expect(result.current.getCellValue(0, 'other')).toBeUndefined();
  });

  it('revertAll clears all state', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.modifyCell(0, 'col', 'x', 'y');
      result.current.markRowsDeleted([1]);
      result.current.addInsertedRow(['col'], new Set());
    });
    act(() => {
      result.current.revertAll();
    });
    expect(result.current.hasChanges).toBe(false);
  });

  it('resetKey change clears all state without extra act', () => {
    const { result, rerender } = renderHook(
      ({ key }) => usePendingChanges(key),
      { initialProps: { key: 'resetA' } }
    );
    act(() => {
      result.current.modifyCell(0, 'col', 'x', 'y');
      result.current.markRowsDeleted([1]);
    });
    expect(result.current.hasChanges).toBe(true);
    rerender({ key: 'resetB' });
    expect(result.current.hasChanges).toBe(false);
    expect(result.current.modifiedCells.size).toBe(0);
    expect(result.current.deletedRows.size).toBe(0);
  });

  it('revertCell removes the specific cell modification', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.modifyCell(0, 'name', 'Alice', 'Bob');
      result.current.modifyCell(0, 'age', '30', '25');
    });
    expect(result.current.isCellModified(0, 'name')).toBe(true);
    act(() => {
      result.current.revertCell(0, 'name');
    });
    expect(result.current.isCellModified(0, 'name')).toBe(false);
    expect(result.current.isCellModified(0, 'age')).toBe(true);
  });

  it('removeInsertedRow removes only the target row', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.addInsertedRow(['col'], new Set());
      result.current.addInsertedRow(['col'], new Set());
    });
    expect(result.current.insertedRows).toHaveLength(2);
    const idToRemove = result.current.insertedRows[0].tempId;
    act(() => {
      result.current.removeInsertedRow(idToRemove);
    });
    expect(result.current.insertedRows).toHaveLength(1);
    expect(result.current.insertedRows[0].tempId).not.toBe(idToRemove);
  });

  it('updateInsertedRowField updates the field value for a row', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.addInsertedRow(['name', 'age'], new Set());
    });
    const tempId = result.current.insertedRows[0].tempId;
    act(() => {
      result.current.updateInsertedRowField(tempId, 'name', 'Charlie');
    });
    expect(result.current.insertedRows[0].fields['name']).toBe('Charlie');
  });

  it('modifyCell: originalValue null treated as null origStr — newValue null removes change', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.modifyCell(0, 'col', null, null);
    });
    expect(result.current.isCellModified(0, 'col')).toBe(false);
    expect(result.current.changeCount).toBe(0);
  });

  it('modifyCell: originalValue object is JSON-stringified for comparison', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.modifyCell(0, 'col', '{"x":1}', { x: 1 });
    });
    // JSON.stringify({ x: 1 }) === '{"x":1}' so newValue matches origStr
    expect(result.current.isCellModified(0, 'col')).toBe(false);
    expect(result.current.changeCount).toBe(0);
  });

  it('updateInsertedRowField: rows that do not match tempId are unchanged', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.addInsertedRow(['name'], new Set());
      result.current.addInsertedRow(['name'], new Set());
    });
    const tempId0 = result.current.insertedRows[0].tempId;
    const tempId1 = result.current.insertedRows[1].tempId;
    act(() => {
      result.current.updateInsertedRowField(tempId0, 'name', 'Alice');
    });
    expect(result.current.insertedRows[0].fields['name']).toBe('Alice');
    // Row 1 should remain unchanged
    expect(result.current.insertedRows[1].fields['name']).toBe('');
    expect(result.current.insertedRows[1].tempId).toBe(tempId1);
  });

  it('clearAfterSubmit clears all pending state', () => {
    const { result } = renderHook(() => usePendingChanges('key'));
    act(() => {
      result.current.modifyCell(0, 'col', 'x', 'y');
      result.current.markRowsDeleted([2]);
      result.current.addInsertedRow(['col'], new Set());
    });
    expect(result.current.hasChanges).toBe(true);
    act(() => {
      result.current.clearAfterSubmit();
    });
    expect(result.current.hasChanges).toBe(false);
    expect(result.current.modifiedCells.size).toBe(0);
    expect(result.current.deletedRows.size).toBe(0);
    expect(result.current.insertedRows).toHaveLength(0);
  });
});
