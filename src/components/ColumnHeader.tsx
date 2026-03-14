import { TableHead } from '@/components/ui/table';
import type { FilterDraft } from '@/hooks/useTableFilters';
import type { ColumnKeyInfo, ColumnTypeCategory, SortEntry } from '@/types';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Filter,
  Key,
  Link,
} from 'lucide-react';
import { memo, type RefObject } from 'react';
import { ContextMenu } from 'radix-ui';
import FilterModal from './modals/FilterModal';

interface Props {
  col: string;
  colType: ColumnTypeCategory;
  hasCase: boolean;
  colWidths: Record<string, number>;
  rawType: string;
  keyInfo: ColumnKeyInfo | undefined;
  sortEntry: SortEntry | null;
  sortPriority: number | null;
  filtered: boolean;
  openFilterCol: string | null;
  filterDraft: FilterDraft;
  filterModalRef: RefObject<HTMLDivElement | null>;
  onSort: (col: string) => void;
  onOpenFilter: (col: string) => void;
  onFilterChange: (draft: FilterDraft) => void;
  onApplyFilter: (col: string, colType: ColumnTypeCategory) => void;
  onClearFilter: (col: string) => void;
  onCloseFilter: () => void;
  onStartResize: (e: React.MouseEvent, col: string) => void;
  onDropColumn?: (col: string) => void;
}

export default memo(function ColumnHeader({
  col,
  colType,
  hasCase,
  colWidths,
  rawType,
  keyInfo,
  sortEntry,
  sortPriority,
  filtered,
  openFilterCol,
  filterDraft,
  filterModalRef,
  onSort,
  onOpenFilter,
  onFilterChange,
  onApplyFilter,
  onClearFilter,
  onCloseFilter,
  onStartResize,
  onDropColumn,
}: Props) {
  const isPk = keyInfo?.isPrimary ?? false;
  const fkTitle = keyInfo?.fkRefTable
    ? `Foreign key → ${keyInfo.fkRefTable}.${keyInfo.fkRefColumn}`
    : null;
  const keyTooltip =
    [isPk ? 'Primary key' : null, fkTitle].filter(Boolean).join('\n') ||
    undefined;

  const ctxItemClass =
    'flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground';
  const ctxDestructiveClass =
    'flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none text-destructive hover:bg-destructive hover:text-destructive-foreground';

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <TableHead
          title={keyTooltip}
          className="select-none whitespace-nowrap hover:bg-muted/60 transition-colors group relative"
          style={
            colWidths[col]
              ? {
                  width: colWidths[col],
                  minWidth: colWidths[col],
                  maxWidth: colWidths[col],
                }
              : undefined
          }
        >
          <div className="relative">
            <div className="flex items-center gap-1 min-w-0">
              <div className="flex flex-col min-w-0 flex-1 leading-tight">
                <span className="flex items-center gap-1 truncate">
                  {isPk && <Key className="size-3 shrink-0 text-amber-500" />}
                  {fkTitle && <Link className="size-3 shrink-0 text-blue-500" />}
                  {col}
                </span>
                {rawType && (
                  <span className="truncate text-[10px] text-muted-foreground font-normal opacity-70">
                    {rawType}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  onClick={() => onSort(col)}
                  className="inline-flex items-center gap-0.5 rounded p-0.5 hover:bg-muted transition-colors"
                  title="Sort column"
                >
                  {sortEntry ? (
                    <>
                      {sortEntry.dir === 'asc' ? (
                        <ArrowUp className="size-3 text-blue-500" />
                      ) : (
                        <ArrowDown className="size-3 text-blue-500" />
                      )}
                      {sortPriority !== null && (
                        <span className="text-[10px] leading-none font-medium text-blue-500">
                          {sortPriority}
                        </span>
                      )}
                    </>
                  ) : (
                    <ArrowUpDown className="size-3 opacity-20 group-hover:opacity-60 transition-opacity" />
                  )}
                </button>
                <button
                  onClick={() => onOpenFilter(col)}
                  className={`rounded p-0.5 transition-opacity ${
                    filtered
                      ? 'opacity-100 text-blue-500'
                      : 'opacity-20 group-hover:opacity-60'
                  }`}
                  title="Filter column"
                >
                  <Filter className="size-3" />
                </button>
              </div>
            </div>
            {openFilterCol === col && (
              <FilterModal
                col={col}
                colType={colType}
                hasCase={hasCase}
                filterDraft={filterDraft}
                filterModalRef={filterModalRef}
                onClose={onCloseFilter}
                onApply={(c) => onApplyFilter(c, colType)}
                onClear={onClearFilter}
                onChange={onFilterChange}
              />
            )}
          </div>
          <div
            className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-10"
            onMouseDown={(e) => onStartResize(e, col)}
          />
        </TableHead>
      </ContextMenu.Trigger>
      {onDropColumn && (
        <ContextMenu.Portal>
          <ContextMenu.Content className="z-50 min-w-40 rounded-md border bg-popover p-1 shadow-md">
            <ContextMenu.Item className={ctxItemClass} onSelect={() => onSort(col)}>
              Sort
            </ContextMenu.Item>
            <ContextMenu.Item className={ctxItemClass} onSelect={() => onOpenFilter(col)}>
              Filter
            </ContextMenu.Item>
            <ContextMenu.Separator className="my-1 h-px bg-border" />
            <ContextMenu.Item className={ctxDestructiveClass} onSelect={() => onDropColumn(col)}>
              Drop Column
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      )}
    </ContextMenu.Root>
  );
});
