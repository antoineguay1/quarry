import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useClickOutside } from '@/hooks/useClickOutside';
import { useColumnResize } from '@/hooks/useColumnResize';
import { usePagination } from '@/hooks/usePagination';
import { usePendingChanges } from '@/hooks/usePendingChanges';
import { useTableData } from '@/hooks/useTableData';
import { useTableFilters } from '@/hooks/useTableFilters';
import { useTableSearch } from '@/hooks/useTableSearch';
import type { ColumnTypeCategory, DbType, FilterEntry } from '@/types';
import { normalizeDbType } from '@/lib/column-types';
import { ErrorMessage } from '@/components/ui/status-message';
import { invoke } from '@tauri-apps/api/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import CellContent from '../CellContent';
import EditableCell from './EditableCell';
import ColumnHeader from '../ColumnHeader';
import DropColumnModal from '../modals/DropColumnModal';
import DataTableToolbar from './DataTableToolbar';
import DataTableSearchBar from './DataTableSearchBar';
import DataTablePagination from './DataTablePagination';

interface Props {
  connectionName: string;
  database: string;
  table: string;
  dbType?: DbType;
  initialFilters?: FilterEntry[];
  filterKey?: number;
  refreshKey?: number;
  onRefresh?: () => void;
  onColumnDropped?: () => void;
  onPromote?: () => void;
  onOpenSchemaDiagram?: () => void;
  onNavigateFk?: (
    refTable: string,
    refCol: string,
    value: string,
    colType: ColumnTypeCategory
  ) => void;
}

export default function DataTable({
  connectionName,
  database,
  table,
  dbType,
  initialFilters,
  filterKey,
  refreshKey,
  onRefresh,
  onColumnDropped,
  onPromote,
  onOpenSchemaDiagram,
  onNavigateFk,
}: Props) {
  const historyKey = `${connectionName}::${database}::${table}`;
  const resetKey = `${historyKey}::${filterKey ?? 0}`;

  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const lastClickedRowRef = useRef<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [dropColumnModal, setDropColumnModal] = useState<{ col: string } | null>(null);
  const columnsButtonRef = useRef<HTMLButtonElement | null>(null);
  const columnsPopoverRef = useRef<HTMLDivElement | null>(null);
  const { colWidths, setColWidths, startResize } = useColumnResize();

  // Cell navigation state
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);

  const pending = usePendingChanges(resetKey);

  // Reset state when table/connection/filterKey changes
  useEffect(() => {
    setHiddenColumns(new Set());
    setColWidths({});
    setColumnsOpen(false);
    setSelectedRows(new Set());
    lastClickedRowRef.current = null;
    setMutationError(null);
    setActiveCell(null);
    setEditingCell(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const filters = useTableFilters({ initialFilters, resetKey, storageKey: historyKey });

  const { page, setPage } = usePagination({
    resetKey,
    sortEntries: filters.sortEntries,
    filterEntries: filters.filterEntries,
  });

  const { result, error, loading, totalCount, totalCountLoading, loadTotalCount, columnTypes, columnRawTypes, columnKeys } =
    useTableData(
      connectionName,
      database,
      table,
      filters.sortEntries,
      filters.filterEntries,
      refreshKey,
      filters.pageSize,
      page,
      dbType
    );

  const search = useTableSearch({ result, hiddenColumns, resetKey, historyKey });

  useClickOutside([filters.filterModalRef], !!filters.openFilterCol, () =>
    filters.closeFilter()
  );
  useClickOutside([columnsPopoverRef, columnsButtonRef], columnsOpen, () =>
    setColumnsOpen(false)
  );
  useClickOutside([search.historyRef, search.historyButtonRef], search.historyOpen, () =>
    search.setHistoryOpen(false)
  );

  // Clear selection on page change
  useEffect(() => {
    setSelectedRows(new Set());
    lastClickedRowRef.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const pkColumn = Object.values(columnKeys).find((k) => k.isPrimary)?.columnName ?? null;
  const canEdit = !!pkColumn && !!dbType;

  // Visible columns (excluding hidden)
  const visibleColumns = result?.columns.filter((col) => !hiddenColumns.has(col)) ?? [];

  const handleRowIndexClick = useCallback((ri: number, e: React.MouseEvent) => {
    // If this row is deleted, undelete it on click
    if (pending.isRowDeleted(ri)) {
      pending.unmarkRowDeleted(ri);
      return;
    }

    if (e.shiftKey && lastClickedRowRef.current !== null) {
      const lo = Math.min(lastClickedRowRef.current, ri);
      const hi = Math.max(lastClickedRowRef.current, ri);
      setSelectedRows((prev) => {
        const s = new Set(prev);
        for (let i = lo; i <= hi; i++) s.add(i);
        return s;
      });
    } else {
      setSelectedRows((prev) => {
        const s = new Set(prev);
        if (s.has(ri)) s.delete(ri);
        else s.add(ri);
        return s;
      });
      lastClickedRowRef.current = ri;
    }
  }, [pending]);

  const handleStageDelete = useCallback(() => {
    if (selectedRows.size === 0) return;
    pending.markRowsDeleted([...selectedRows]);
    setSelectedRows(new Set());
    lastClickedRowRef.current = null;
  }, [selectedRows, pending]);

  const handleStageInsert = useCallback(() => {
    if (!result) return;
    const autoGenCols = new Set<string>();
    for (const col of result.columns) {
      if (columnKeys[col]?.isAutoGenerated) autoGenCols.add(col);
    }
    pending.addInsertedRow(result.columns, autoGenCols);
  }, [result, columnKeys, pending]);

  const handleSubmit = useCallback(async () => {
    if (!result) return;
    setIsSubmitting(true);
    setMutationError(null);
    try {
      // Build deletes
      const deleteValues: string[] = [];
      if (pkColumn) {
        const pkColIdx = result.columns.indexOf(pkColumn);
        for (const ri of pending.deletedRows) {
          deleteValues.push(String(result.rows[ri][pkColIdx]));
        }
      }

      // Build updates: group modified cells by row
      interface RowUpdate { pkValue: string; values: { column: string; value: string | null }[] }
      const updateMap = new Map<number, { column: string; value: string | null }[]>();
      for (const [key, mod] of pending.modifiedCells) {
        const [riStr, colName] = [key.substring(0, key.indexOf(':')), key.substring(key.indexOf(':') + 1)];
        const ri = parseInt(riStr);
        if (pending.deletedRows.has(ri)) continue;
        if (!updateMap.has(ri)) updateMap.set(ri, []);
        updateMap.get(ri)!.push({ column: colName, value: mod.value });
      }
      const updates: RowUpdate[] = [];
      if (pkColumn) {
        const pkColIdx = result.columns.indexOf(pkColumn);
        for (const [ri, values] of updateMap) {
          updates.push({ pkValue: String(result.rows[ri][pkColIdx]), values });
        }
      }

      // Build inserts
      const inserts = pending.insertedRows.map(row => {
        return Object.entries(row.fields).map(([column, value]) => ({
          column,
          value: value === '' ? null : value,
        }));
      });

      await invoke('submit_table_changes', {
        connection: connectionName,
        database,
        table,
        pkColumn,
        deletes: deleteValues,
        updates,
        inserts,
      });

      pending.clearAfterSubmit();
      setActiveCell(null);
      setEditingCell(null);
      onRefresh?.();
    } catch (e) {
      setMutationError(String(e));
    } finally {
      setIsSubmitting(false);
    }
  }, [result, pkColumn, pending, connectionName, database, table, onRefresh]);

  const handleDiscard = useCallback(() => {
    pending.revertAll();
    setActiveCell(null);
    setEditingCell(null);
    setMutationError(null);
  }, [pending]);

  const handleRefresh = useCallback(() => {
    if (pending.hasChanges) {
      if (!confirm('You have unsaved changes. Discard and refresh?')) return;
      pending.revertAll();
    }
    setActiveCell(null);
    setEditingCell(null);
    onRefresh?.();
  }, [pending, onRefresh]);

  // Cell navigation
  const handleNavigate = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!result) return;
    setActiveCell(prev => {
      if (!prev) return prev;
      const totalRows = result.rows.length + pending.insertedRows.length;
      let { row, col } = prev;
      switch (direction) {
        case 'up': row = Math.max(0, row - 1); break;
        case 'down': row = Math.min(totalRows - 1, row + 1); break;
        case 'left': col = Math.max(0, col - 1); break;
        case 'right': col = Math.min(visibleColumns.length - 1, col + 1); break;
      }
      return { row, col };
    });
    setEditingCell(null);
  }, [result, pending.insertedRows.length, visibleColumns.length]);

  const onClearSort = useCallback(() => { filters.setSortEntries([]); onPromote?.(); }, [filters.setSortEntries, onPromote]);
  const onClearFilters = useCallback(() => { filters.setFilterEntries([]); onPromote?.(); }, [filters.setFilterEntries, onPromote]);
  const onToggleSearch = useCallback(() => {
    if (search.searchOpen) {
      search.closeSearch();
    } else {
      search.setSearchOpen(true);
      setTimeout(() => search.searchInputRef.current?.focus(), 0);
    }
  }, [search.searchOpen, search.closeSearch, search.setSearchOpen, search.searchInputRef]);
  const onSort = useCallback((col: string) => { filters.handleSort(col); onPromote?.(); }, [filters.handleSort, onPromote]);
  const onApplyFilter = useCallback((col: string, colType: ColumnTypeCategory) => {
    filters.applyFilter(col, colType);
    onPromote?.();
  }, [filters.applyFilter, onPromote]);
  const onClearFilter = useCallback((col: string) => { filters.clearFilter(col); onPromote?.(); }, [filters.clearFilter, onPromote]);

  if (loading && !result)
    return <div className="text-muted-foreground text-sm">Loading…</div>;
  if (error && !result)
    return <div className="p-4"><ErrorMessage message={error} mono /></div>;
  if (!result) return null;

  return (
    <div className="flex flex-col gap-2 h-full">
      <DataTableToolbar
        result={result}
        totalCount={totalCount}
        totalCountLoading={totalCountLoading}
        loadTotalCount={loadTotalCount}
        loading={loading}
        sortCount={filters.sortEntries.length}
        filterCount={filters.filterEntries.length}
        onClearSort={onClearSort}
        onClearFilters={onClearFilters}
        hiddenColumns={hiddenColumns}
        setHiddenColumns={setHiddenColumns}
        columnsOpen={columnsOpen}
        setColumnsOpen={setColumnsOpen}
        columnsButtonRef={columnsButtonRef}
        columnsPopoverRef={columnsPopoverRef}
        sqlCopied={sqlCopied}
        setSqlCopied={setSqlCopied}
        selectedRows={selectedRows}
        pkColumn={pkColumn}
        onStartInsert={handleStageInsert}
        onDelete={handleStageDelete}
        onRefresh={handleRefresh}
        onOpenSchemaDiagram={onOpenSchemaDiagram}
        searchOpen={search.searchOpen}
        onToggleSearch={onToggleSearch}
        error={error}
        mutationError={mutationError}
        hasChanges={pending.hasChanges}
        changeCount={pending.changeCount}
        isSubmitting={isSubmitting}
        onSubmit={() => void handleSubmit()}
        onDiscard={handleDiscard}
      />
      {search.searchOpen && (
        <DataTableSearchBar
          searchInputRef={search.searchInputRef}
          inputValue={search.inputValue}
          setInputValue={search.setInputValue}
          searchQuery={search.searchQuery}
          commitSearch={search.commitSearch}
          navigate={search.navigate}
          closeSearch={search.closeSearch}
          allMatches={search.allMatches}
          currentMatchIndex={search.currentMatchIndex}
          searchCaseSensitive={search.searchCaseSensitive}
          setSearchCaseSensitive={search.setSearchCaseSensitive}
          historyOpen={search.historyOpen}
          setHistoryOpen={search.setHistoryOpen}
          historyButtonRef={search.historyButtonRef}
          historyRef={search.historyRef}
          searchHistory={search.searchHistory}
          applyHistoryItem={search.applyHistoryItem}
        />
      )}
      <div
        ref={search.tableContainerRef}
        className="rounded-md border overflow-auto flex-1 min-h-0"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10 text-center px-1 text-muted-foreground select-none sticky left-0 z-10 bg-muted shadow-[1px_0_0_0_var(--color-border)]">#</TableHead>
              {visibleColumns.map((col) => {
                  const entryIdx = filters.sortEntries.findIndex(
                    (e) => e.col === col
                  );
                  const sortEntry =
                    entryIdx !== -1 ? filters.sortEntries[entryIdx] : null;
                  const sortPriority =
                    filters.sortEntries.length > 1 ? entryIdx + 1 : null;
                  const colType = columnTypes[col] ?? 'text';
                  const hasCase =
                    colType === 'text' ||
                    colType === 'json' ||
                    colType === 'other';
                  return (
                    <ColumnHeader
                      key={col}
                      col={col}
                      colType={colType}
                      hasCase={hasCase}
                      colWidths={colWidths}
                      rawType={normalizeDbType(columnRawTypes[col] ?? '', dbType)}
                      keyInfo={columnKeys[col]}
                      sortEntry={sortEntry}
                      sortPriority={sortPriority}
                      filtered={filters.filterEntries.some((e) => e.col === col)}
                      openFilterCol={filters.openFilterCol}
                      filterDraft={filters.filterDraft}
                      filterModalRef={filters.filterModalRef}
                      onSort={onSort}
                      onOpenFilter={filters.openFilterModal}
                      onFilterChange={filters.setFilterDraft}
                      onApplyFilter={onApplyFilter}
                      onClearFilter={onClearFilter}
                      onCloseFilter={filters.closeFilter}
                      onStartResize={startResize}
                      onDropColumn={dbType ? (c) => setDropColumnModal({ col: c }) : undefined}
                    />
                  );
                })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 && pending.insertedRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + 1}
                  className="h-24 text-center text-muted-foreground text-sm"
                >
                  No rows found
                </TableCell>
              </TableRow>
            )}
            {result.rows.map((row, ri) => {
              const isDeleted = pending.isRowDeleted(ri);
              return (
              <TableRow
                key={ri}
                data-state={selectedRows.has(ri) ? 'selected' : undefined}
                className={`${
                  isDeleted
                    ? 'bg-red-50 dark:bg-red-950/30 line-through opacity-60'
                    : search.searchQuery && !search.rowsWithMatches.has(ri)
                    ? 'opacity-25'
                    : ''
                }`}
              >
                <TableCell
                  className={`w-10 px-1 text-center text-xs select-none transition-colors sticky left-0 z-10 shadow-[1px_0_0_0_var(--color-border)] cursor-pointer ${
                    isDeleted
                      ? 'bg-red-50 dark:bg-red-950/30 text-red-500'
                      : selectedRows.has(ri) ? 'bg-muted text-muted-foreground' : 'bg-background text-muted-foreground hover:bg-muted/50'
                  }`}
                  onClick={isDeleted ? () => pending.unmarkRowDeleted(ri) : (e) => handleRowIndexClick(ri, e)}
                  title={isDeleted ? 'Click to undelete' : 'Click to select, Shift+click to select range'}
                >
                  {ri + 1}
                </TableCell>
                {row.map((cell, ci) => {
                  const colName = result.columns[ci];
                  if (hiddenColumns.has(colName)) return null;
                  const visColIdx = visibleColumns.indexOf(colName);
                  const isPk = columnKeys[colName]?.isPrimary;
                  const isAutoGen = columnKeys[colName]?.isAutoGenerated;
                  const cellEditable = canEdit && !isPk && !isAutoGen && !isDeleted;
                  const isModified = pending.isCellModified(ri, colName);
                  const modifiedValue = isModified ? pending.getCellValue(ri, colName) : undefined;
                  const isActiveCell = activeCell?.row === ri && activeCell?.col === visColIdx;
                  const isEditingCell = editingCell?.row === ri && editingCell?.col === visColIdx;

                  if (canEdit) {
                    return (
                      <EditableCell
                        key={ci}
                        cell={cell}
                        colName={colName}
                        colWidth={colWidths[colName]}
                        rowIdx={ri}
                        colIdx={ci}
                        fkInfo={columnKeys[colName]}
                        colType={columnTypes[colName] ?? 'text'}
                        searchQuery={search.searchQuery}
                        renderCellContent={search.renderCellContent}
                        onNavigateFk={onNavigateFk}
                        editable={cellEditable}
                        isModified={isModified}
                        isDeleted={isDeleted}
                        modifiedValue={modifiedValue}
                        onModify={cellEditable ? (value) => pending.modifyCell(ri, colName, value, cell) : undefined}
                        isActive={isActiveCell}
                        isEditing={isEditingCell}
                        onActivate={() => setActiveCell({ row: ri, col: visColIdx })}
                        onStartEdit={() => { setActiveCell({ row: ri, col: visColIdx }); setEditingCell({ row: ri, col: visColIdx }); }}
                        onStopEdit={() => setEditingCell(null)}
                        onNavigate={handleNavigate}
                        onRevert={isModified ? () => pending.revertCell(ri, colName) : undefined}
                      />
                    );
                  }

                  return (
                    <CellContent
                      key={ci}
                      cell={cell}
                      colName={colName}
                      colWidth={colWidths[colName]}
                      rowIdx={ri}
                      colIdx={ci}
                      fkInfo={columnKeys[colName]}
                      colType={columnTypes[colName] ?? 'text'}
                      searchQuery={search.searchQuery}
                      renderCellContent={search.renderCellContent}
                      onNavigateFk={onNavigateFk}
                    />
                  );
                })}
              </TableRow>
              );
            })}
            {/* Inserted rows */}
            {pending.insertedRows.map((insertedRow) => {
              return (
                <TableRow key={insertedRow.tempId} className="bg-green-50 dark:bg-green-950/30">
                  <TableCell
                    className="w-10 px-1 text-center text-xs text-red-500 select-none cursor-pointer sticky left-0 z-10 bg-green-50 dark:bg-green-950/30 shadow-[1px_0_0_0_var(--color-border)]"
                    onClick={() => pending.removeInsertedRow(insertedRow.tempId)}
                    title="Remove new row"
                  >
                    &times;
                  </TableCell>
                  {visibleColumns.map((col) => {
                    const colType = columnTypes[col] ?? 'text';
                    const isAutoGen = columnKeys[col]?.isAutoGenerated ?? false;
                    const isNullable = columnKeys[col]?.isNullable ?? true;
                    const isAuto = insertedRow.autoFields.has(col);
                    const fieldValue = insertedRow.fields[col];
                    const isNull = fieldValue === null;
                    const isDisabled = isAuto || isNull;

                    return (
                      <TableCell key={col} className="px-1 py-0.5 align-top">
                        <div className="flex flex-col gap-0.5">
                          {colType === 'boolean' ? (
                            <select
                              value={isDisabled ? '' : (fieldValue ?? '')}
                              disabled={isDisabled}
                              onChange={(e) =>
                                pending.updateInsertedRowField(insertedRow.tempId, col, e.target.value)
                              }
                              className="w-full min-w-0 rounded border px-1 py-0.5 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-30 disabled:bg-muted"
                            >
                              <option value="">—</option>
                              <option value="1">true</option>
                              <option value="0">false</option>
                            </select>
                          ) : (
                            <input
                              type={colType === 'number' ? 'number' : 'text'}
                              value={isDisabled ? '' : (fieldValue ?? '')}
                              disabled={isDisabled}
                              onChange={(e) =>
                                pending.updateInsertedRowField(insertedRow.tempId, col, e.target.value)
                              }
                              className="w-full min-w-0 rounded border px-1 py-0.5 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-30 disabled:bg-muted"
                              placeholder={
                                isAuto ? 'auto' :
                                isNull ? 'NULL' :
                                colType === 'date' ? 'YYYY-MM-DD' :
                                colType === 'time' ? 'HH:MM:SS' :
                                colType === 'datetime' ? 'YYYY-MM-DD HH:MM:SS' :
                                ''
                              }
                            />
                          )}
                          <div className="flex gap-0.5">
                            {isAutoGen && (
                              <button
                                type="button"
                                onClick={() => pending.toggleInsertedRowAuto(insertedRow.tempId, col)}
                                className={`rounded px-1 py-0 text-[10px] transition-colors ${
                                  isAuto
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                              >
                                Auto
                              </button>
                            )}
                            {isNullable && !isAutoGen && (
                              <button
                                type="button"
                                onClick={() =>
                                  pending.updateInsertedRowField(insertedRow.tempId, col, isNull ? '' : null)
                                }
                                disabled={isAuto}
                                className={`rounded px-1 py-0 text-[10px] transition-colors disabled:pointer-events-none ${
                                  isNull
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                              >
                                NULL
                              </button>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination
        page={page}
        setPage={pending.hasChanges ? (() => {}) as never : setPage}
        pageSize={filters.pageSize}
        setPageSize={pending.hasChanges ? (() => {}) as never : filters.setPageSize}
        totalCount={totalCount}
        totalCountLoading={totalCountLoading}
        loadTotalCount={loadTotalCount}
        rowCount={result.row_count}
        disabled={pending.hasChanges}
      />
      {dropColumnModal && dbType && (
        <DropColumnModal
          connectionName={connectionName}
          database={database}
          table={table}
          column={dropColumnModal.col}
          dbType={dbType}
          onDropped={() => { setDropColumnModal(null); onRefresh?.(); onColumnDropped?.(); }}
          onCancel={() => setDropColumnModal(null)}
        />
      )}
    </div>
  );
}
