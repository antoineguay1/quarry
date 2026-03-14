import { Pencil, RefreshCw, Table2, Trash2 } from 'lucide-react';
import { ContextMenu } from 'radix-ui';

const ctxItemClass =
  'flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground';
const ctxDestructiveClass =
  'flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none text-destructive hover:bg-destructive hover:text-destructive-foreground';

interface Props {
  table: string;
  isActive: boolean;
  onOpen: (preview?: boolean) => void;
  onRefresh: () => void;
  onRenameClick: () => void;
  onDropClick: () => void;
  onAddColumnClick: () => void;
}

export default function TableRow({ table, isActive, onOpen, onRefresh, onRenameClick, onDropClick, onAddColumnClick }: Props) {
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <div
          className={`w-full flex items-center gap-1.5 pl-14 pr-2 py-1 text-sm hover:bg-accent transition-colors group cursor-pointer ${
            isActive ? 'bg-accent text-accent-foreground font-medium' : 'text-foreground'
          }`}
          onClick={() => onOpen()}
          onDoubleClick={() => onOpen(false)}
        >
          <Table2 size={12} className="shrink-0 text-muted-foreground" />
          <span className="flex-1 min-w-0 truncate">{table}</span>
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
            title="Refresh"
          >
            <RefreshCw size={11} />
          </button>
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0 ml-0.5"
            onClick={(e) => { e.stopPropagation(); onRenameClick(); }}
            title="Rename"
          >
            <Pencil size={11} />
          </button>
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0 ml-0.5"
            onClick={(e) => { e.stopPropagation(); onDropClick(); }}
            title="Drop"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="z-50 min-w-40 rounded-md border bg-popover p-1 shadow-md">
          <ContextMenu.Item className={ctxItemClass} onSelect={onRefresh}>
            Refresh
          </ContextMenu.Item>
          <ContextMenu.Item className={ctxItemClass} onSelect={onAddColumnClick}>
            Add Column
          </ContextMenu.Item>
          <ContextMenu.Item className={ctxItemClass} onSelect={onRenameClick}>
            Rename
          </ContextMenu.Item>
          <ContextMenu.Item className={ctxDestructiveClass} onSelect={onDropClick}>
            Drop Table
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
