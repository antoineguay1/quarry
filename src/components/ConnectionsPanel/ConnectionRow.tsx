import DbTypeIcon from '@/components/DbTypeIcon';
import { ErrorMessage } from '@/components/ui/status-message';
import type { SavedConnection } from '@/types';
import { ChevronDown, ChevronRight, Loader2, Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { ContextMenu, Popover } from 'radix-ui';

const ctxItemClass =
  'flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground';
const ctxDestructiveClass =
  'flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none text-destructive hover:bg-destructive hover:text-destructive-foreground';

interface Props {
  conn: SavedConnection;
  isExpanded: boolean;
  isLoading: boolean;
  error?: string;
  allDbs?: string[];
  shownDbs: string[];
  onToggle: () => void;
  onSetShown: (db: string, visible: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onCreateQuery: () => void;
  onRefresh: () => void;
}

export default function ConnectionRow({
  conn,
  isExpanded,
  isLoading,
  error,
  allDbs,
  shownDbs,
  onToggle,
  onSetShown,
  onEdit,
  onDelete,
  onCreateQuery,
  onRefresh,
}: Props) {
  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer group hover:bg-accent transition-colors"
            onClick={onToggle}
          >
            {isLoading ? (
              <Loader2 size={14} className="shrink-0 text-muted-foreground animate-spin" />
            ) : isExpanded ? (
              <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
            )}
            <DbTypeIcon type={conn.dbType} size={14} />
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate font-medium">{conn.name}</div>
            </div>

            {allDbs && (
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button
                    type="button"
                    className="text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded shrink-0 hover:bg-accent transition-colors"
                    onClick={(e) => e.stopPropagation()}
                    title="Manage shown databases"
                  >
                    {shownDbs.length}/{allDbs.length}
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    className="z-50 min-w-44 rounded-md border bg-popover p-2 shadow-md"
                    side="right"
                    align="start"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">
                      Databases
                    </p>
                    {allDbs.map((db) => (
                      <label
                        key={db}
                        className="flex items-center gap-2 px-1 py-1 text-sm cursor-pointer hover:bg-accent rounded"
                      >
                        <input
                          type="checkbox"
                          checked={shownDbs.includes(db)}
                          onChange={(e) => onSetShown(db, e.target.checked)}
                          className="shrink-0"
                        />
                        {db}
                      </label>
                    ))}
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            )}

            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
              onClick={(e) => { e.stopPropagation(); onRefresh(); }}
              title="Refresh"
            >
              <RefreshCw size={12} />
            </button>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0 ml-0.5"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              title="Edit"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0 ml-0.5"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="z-50 min-w-40 rounded-md border bg-popover p-1 shadow-md">
            <ContextMenu.Item className={ctxItemClass} onSelect={onRefresh}>
              Refresh
            </ContextMenu.Item>
            <ContextMenu.Item className={ctxItemClass} onSelect={onCreateQuery}>
              New Query
            </ContextMenu.Item>
            <ContextMenu.Item className={ctxItemClass} onSelect={onEdit}>
              Edit Connection
            </ContextMenu.Item>
            <ContextMenu.Item className={ctxDestructiveClass} onSelect={onDelete}>
              Delete Connection
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
      {error && (
        <div className="pl-9 pr-3 pb-1">
          <ErrorMessage message={error} compact />
        </div>
      )}
    </>
  );
}
