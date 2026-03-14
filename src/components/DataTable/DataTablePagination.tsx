import { ChevronLeft, ChevronRight } from 'lucide-react';
import { memo } from 'react';

interface Props {
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  setPageSize: (size: number) => void;
  totalCount: number | null;
  totalCountLoading: boolean;
  loadTotalCount: () => void;
  rowCount: number;
  disabled?: boolean;
}

export default memo(function DataTablePagination({
  page,
  setPage,
  pageSize,
  setPageSize,
  totalCount,
  totalCountLoading,
  loadTotalCount,
  rowCount,
  disabled,
}: Props) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="flex items-center gap-1">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          disabled={disabled}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(0);
          }}
          className="bg-transparent border rounded px-1 py-0.5 text-xs text-foreground focus:outline-none disabled:opacity-50"
        >
          {[50, 100, 200, 500].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-1 ml-auto">
        <span className="tabular-nums">
          Page {page + 1} of{' '}
          {totalCount !== null ? (
            Math.max(1, Math.ceil(totalCount / pageSize))
          ) : (
            <button
              onClick={loadTotalCount}
              disabled={totalCountLoading}
              className="underline decoration-dotted hover:text-foreground transition-colors disabled:opacity-50 disabled:no-underline disabled:cursor-default tabular-nums"
              title="Load total count"
            >
              {totalCountLoading ? '…' : '?'}
            </button>
          )}
        </span>
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0 || disabled}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title={disabled ? 'Submit or discard changes first' : undefined}
        >
          <ChevronLeft className="size-3" />
        </button>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={rowCount < pageSize || disabled}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
          title={disabled ? 'Submit or discard changes first' : undefined}
        >
          <ChevronRight className="size-3" />
        </button>
      </div>
    </div>
  );
});
