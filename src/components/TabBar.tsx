import type { SavedQuery, TabEntry } from '@/types';
import { X } from 'lucide-react';
import { memo } from 'react';
import { ContextMenu } from 'radix-ui';

interface Props {
  tabs: TabEntry[];
  activeTabId: string | null;
  savedQueries: SavedQuery[];
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onCloseOthers: (id: string) => void;
  onCloseAll: () => void;
  onPromote: (id: string) => void;
}

export default memo(function TabBar({
  tabs,
  activeTabId,
  savedQueries,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseAll,
  onPromote,
}: Props) {
  return (
    <div className="flex border-b overflow-x-auto shrink-0 bg-background">
      {tabs.map((tab) => {
        const queryName =
          tab.type === 'saved-query'
            ? savedQueries.find((q) => q.id === tab.savedQueryId)?.name ??
              'Query'
            : null;
        return (
          <ContextMenu.Root key={tab.id}>
            <ContextMenu.Trigger asChild>
              <div
                className={`flex items-center gap-1.5 px-3 py-2 text-xs shrink-0 border-r cursor-pointer hover:bg-accent/60 transition-colors ${
                  activeTabId === tab.id
                    ? 'bg-accent text-accent-foreground font-medium border-b-2 border-b-primary'
                    : 'text-muted-foreground'
                }`}
                onClick={() => onActivate(tab.id)}
                onDoubleClick={() => onPromote(tab.id)}
              >
                <span className={`max-w-45 truncate select-none ${tab.preview ? 'italic' : ''}`}>
                  {tab.type === 'browse' ? (
                    <>
                      {tab.connectionName}
                      <span className="text-muted-foreground mx-0.5">/</span>
                      {tab.database}.{tab.table}
                    </>
                  ) : tab.type === 'create-table' ? (
                    <>
                      {tab.connectionName}
                      <span className="text-muted-foreground mx-0.5">/</span>
                      {tab.database} · New Table
                    </>
                  ) : tab.type === 'schema-diagram' ? (
                    <>
                      {tab.connectionName}
                      <span className="text-muted-foreground mx-0.5">/</span>
                      {tab.database} · Schema
                    </>
                  ) : (
                    queryName
                  )}
                </span>
                <button
                  type="button"
                  className="shrink-0 hover:text-destructive transition-colors opacity-60 hover:opacity-100 p-0.5 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(tab.id);
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Content className="z-50 min-w-40 rounded-md border bg-popover p-1 shadow-md">
                <ContextMenu.Item
                  className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  onSelect={() => onClose(tab.id)}
                >
                  Close tab
                </ContextMenu.Item>
                <ContextMenu.Item
                  className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  onSelect={() => onCloseOthers(tab.id)}
                >
                  Close other tabs
                </ContextMenu.Item>
                <ContextMenu.Item
                  className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                  onSelect={onCloseAll}
                >
                  Close all tabs
                </ContextMenu.Item>
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        );
      })}
    </div>
  );
});
