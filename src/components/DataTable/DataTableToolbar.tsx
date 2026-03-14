import { ErrorMessage } from '@/components/ui/status-message';
import {
  Check,
  Columns3,
  Copy,
  Minus,
  Network,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { memo, type RefObject } from 'react';

interface Props {
  result: { columns: string[]; row_count: number; sql: string };
  totalCount: number | null;
  totalCountLoading: boolean;
  loadTotalCount: () => void;
  loading: boolean;
  sortCount: number;
  filterCount: number;
  onClearSort: () => void;
  onClearFilters: () => void;
  hiddenColumns: Set<string>;
  setHiddenColumns: React.Dispatch<React.SetStateAction<Set<string>>>;
  columnsOpen: boolean;
  setColumnsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  columnsButtonRef: RefObject<HTMLButtonElement | null>;
  columnsPopoverRef: RefObject<HTMLDivElement | null>;
  sqlCopied: boolean;
  setSqlCopied: React.Dispatch<React.SetStateAction<boolean>>;
  selectedRows: Set<number>;
  pkColumn: string | null;
  onStartInsert: () => void;
  onDelete: () => void;
  onRefresh?: () => void;
  onOpenSchemaDiagram?: () => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  error: string | null;
  mutationError: string | null;
  // Staged editing props
  hasChanges: boolean;
  changeCount: number;
  isSubmitting: boolean;
  onSubmit: () => void;
  onDiscard: () => void;
}

export default memo(function DataTableToolbar({
  result,
  totalCount,
  totalCountLoading,
  loadTotalCount,
  loading,
  sortCount,
  filterCount,
  onClearSort,
  onClearFilters,
  hiddenColumns,
  setHiddenColumns,
  columnsOpen,
  setColumnsOpen,
  columnsButtonRef,
  columnsPopoverRef,
  sqlCopied,
  setSqlCopied,
  selectedRows,
  pkColumn,
  onStartInsert,
  onDelete,
  onRefresh,
  onOpenSchemaDiagram,
  searchOpen,
  onToggleSearch,
  error,
  mutationError,
  hasChanges,
  changeCount,
  isSubmitting,
  onSubmit,
  onDiscard,
}: Props) {
  return (
    <>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>
          {result.row_count} of{' '}
          {totalCount !== null ? (
            totalCount.toLocaleString()
          ) : (
            <button
              onClick={loadTotalCount}
              disabled={totalCountLoading}
              className="underline decoration-dotted hover:text-foreground transition-colors disabled:opacity-50 disabled:no-underline disabled:cursor-default"
              title="Load total count"
            >
              {totalCountLoading ? '…' : '?'}
            </button>
          )}{' '}
          row{result.row_count !== 1 ? 's' : ''}
          {loading && <span className="ml-2 opacity-60">Loading…</span>}
        </span>
        {sortCount > 0 && (
          <button
            onClick={onClearSort}
            disabled={hasChanges}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            title={hasChanges ? 'Submit or discard changes first' : undefined}
          >
            <X className="size-3" />
            Clear sorting
          </button>
        )}
        {filterCount > 0 && (
          <button
            onClick={onClearFilters}
            disabled={hasChanges}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            title={hasChanges ? 'Submit or discard changes first' : undefined}
          >
            <X className="size-3" />
            Clear filters
          </button>
        )}
        {hiddenColumns.size > 0 && (
          <button
            onClick={() => setHiddenColumns(new Set())}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
            Show all columns
          </button>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {hasChanges && (
            <>
              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                {changeCount} change{changeCount !== 1 ? 's' : ''}
              </span>
              <button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitting}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/60 disabled:opacity-50"
                title="Submit all changes"
              >
                <Check className="size-3" />
                <span>Submit</span>
              </button>
              <button
                type="button"
                onClick={onDiscard}
                disabled={isSubmitting}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                title="Discard all changes"
              >
                <X className="size-3" />
              </button>
              <div className="w-px h-3 bg-border mx-0.5" />
            </>
          )}
          {selectedRows.size > 0 && (
            <span className="text-xs text-muted-foreground">{selectedRows.size} selected</span>
          )}
          <button
            type="button"
            onClick={onStartInsert}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Add row"
          >
            <Plus className="size-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={selectedRows.size === 0 || !pkColumn}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            title={!pkColumn ? 'No primary key — delete unavailable' : `Mark ${selectedRows.size} row(s) for deletion`}
          >
            <Minus className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(result.sql);
              setSqlCopied(true);
              setTimeout(() => setSqlCopied(false), 1500);
            }}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Copy SQL"
          >
            {sqlCopied ? (
              <Check className="size-3" />
            ) : (
              <Copy className="size-3" />
            )}
          </button>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Refresh"
            >
              <RefreshCw className="size-3" />
            </button>
          )}
          {onOpenSchemaDiagram && (
            <button
              type="button"
              onClick={onOpenSchemaDiagram}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Schema Diagram"
            >
              <Network className="size-3" />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleSearch}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
              searchOpen
                ? 'bg-muted text-foreground'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
            title="Search (⌘F)"
          >
            <Search className="size-3" />
          </button>
        </div>
        <div className="relative">
          <button
            ref={columnsButtonRef}
            onClick={() => setColumnsOpen((o) => !o)}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
              columnsOpen || hiddenColumns.size > 0
                ? 'bg-muted text-foreground'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <Columns3 className="size-3" />
            Columns
            {hiddenColumns.size > 0 && (
              <span className="text-[10px] font-medium opacity-70">
                ({result.columns.length - hiddenColumns.size}/
                {result.columns.length})
              </span>
            )}
          </button>
          {columnsOpen && (
            <div
              ref={columnsPopoverRef}
              className="absolute right-0 top-full z-50 mt-1 min-w-40 rounded-md border bg-popover shadow-md p-2 flex flex-col gap-0.5"
            >
              {result.columns.map((col) => (
                <label
                  key={col}
                  className="flex items-center gap-2 cursor-pointer rounded px-1.5 py-1 hover:bg-muted transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={!hiddenColumns.has(col)}
                    onChange={() =>
                      setHiddenColumns((prev) => {
                        const next = new Set(prev);
                        if (next.has(col)) next.delete(col);
                        else next.add(col);
                        return next;
                      })
                    }
                    className="size-3 accent-primary"
                  />
                  <span className="font-mono text-xs">{col}</span>
                </label>
              ))}
              <div className="flex gap-1 mt-1 pt-1.5 border-t">
                <button
                  onClick={() => setHiddenColumns(new Set())}
                  className="flex-1 rounded px-1.5 py-0.5 text-xs hover:bg-muted transition-colors"
                >
                  Show all
                </button>
                <button
                  onClick={() => setHiddenColumns(new Set(result.columns))}
                  className="flex-1 rounded px-1.5 py-0.5 text-xs hover:bg-muted transition-colors"
                >
                  Hide all
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {error && <ErrorMessage message={error} mono />}
      {mutationError && <ErrorMessage message={mutationError} mono />}
    </>
  );
});
