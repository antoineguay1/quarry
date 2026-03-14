import { ErrorMessage } from '@/components/ui/status-message';
import { ChevronDown, ChevronRight, Database, Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { ContextMenu } from 'radix-ui';

const ctxItemClass =
  'flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground';
const ctxDestructiveClass =
  'flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none text-destructive hover:bg-destructive hover:text-destructive-foreground';

interface Props {
  database: string;
  dbType: 'postgres' | 'mysql';
  isExpanded: boolean;
  isLoading: boolean;
  error?: string;
  onToggle: () => void;
  onRefresh: () => void;
  onCreate: () => void;
  onSchemaDiagram: () => void;
  onRenameClick: () => void;
  onDropClick: () => void;
}

export default function DatabaseRow({
  database,
  dbType,
  isExpanded,
  isLoading,
  error,
  onToggle,
  onRefresh,
  onCreate,
  onSchemaDiagram,
  onRenameClick,
  onDropClick,
}: Props) {
  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            className="flex items-center gap-1.5 pl-5 pr-2 py-1.5 cursor-pointer hover:bg-accent transition-colors group"
            onClick={onToggle}
          >
            {isLoading ? (
              <Loader2 size={13} className="shrink-0 text-muted-foreground animate-spin" />
            ) : isExpanded ? (
              <ChevronDown size={13} className="shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight size={13} className="shrink-0 text-muted-foreground" />
            )}
            <Database size={13} className="shrink-0 text-muted-foreground" />
            <span className="flex-1 min-w-0 text-sm truncate">{database}</span>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0 ml-0.5"
              onClick={(e) => { e.stopPropagation(); onCreate(); }}
              title="New Table"
            >
              <Plus size={12} />
            </button>
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0 ml-0.5"
              onClick={(e) => { e.stopPropagation(); onRefresh(); }}
              title="Refresh"
            >
              <RefreshCw size={12} />
            </button>
            {dbType === 'postgres' && (
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0 ml-0.5"
                onClick={(e) => { e.stopPropagation(); onRenameClick(); }}
                title="Rename"
              >
                <Pencil size={12} />
              </button>
            )}
            <button
              type="button"
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0 ml-0.5"
              onClick={(e) => { e.stopPropagation(); onDropClick(); }}
              title="Drop"
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
            <ContextMenu.Item className={ctxItemClass} onSelect={onSchemaDiagram}>
              View Schema Diagram
            </ContextMenu.Item>
            <ContextMenu.Item className={ctxItemClass} onSelect={onCreate}>
              New Table
            </ContextMenu.Item>
            {dbType === 'postgres' && (
              <ContextMenu.Item className={ctxItemClass} onSelect={onRenameClick}>
                Rename
              </ContextMenu.Item>
            )}
            <ContextMenu.Item className={ctxDestructiveClass} onSelect={onDropClick}>
              Drop Database
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
      {error && (
        <div className="pl-14 pr-3 pb-1">
          <ErrorMessage message={error} compact />
        </div>
      )}
    </>
  );
}
