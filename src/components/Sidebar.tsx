import DbTypeIcon from '@/components/DbTypeIcon';
import { Button } from '@/components/ui/button';
import type { SavedConnection, SidebarPanel } from '@/types';
import { Plus } from 'lucide-react';

interface SidebarProps {
  activePanel: SidebarPanel;
  sidebarWidth: number;
  onResizeStart: (e: React.MouseEvent) => void;
  onNewConnection: () => void;
  showConnPicker: boolean;
  onToggleConnPicker: () => void;
  savedConnections: SavedConnection[];
  onCreateQuery: (name: string) => void;
  children: React.ReactNode;
}

export default function Sidebar({
  activePanel,
  sidebarWidth,
  onResizeStart,
  onNewConnection,
  showConnPicker,
  onToggleConnPicker,
  savedConnections,
  onCreateQuery,
  children,
}: SidebarProps) {
  return (
    <div
      style={{ width: sidebarWidth }}
      className="flex flex-col border-r shrink-0 relative"
    >
      {/* Panel header */}
      <div className="px-3 py-2 border-b flex items-center justify-between gap-2 shrink-0">
        {activePanel === 'connections' ? (
          <>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Connections
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={onNewConnection}
              title="New Connection"
            >
              <Plus size={13} />
            </Button>
          </>
        ) : activePanel === 'queries' ? (
          <>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Queries
            </span>
            <Button
              variant="ghost"
              size="icon"
              className={`h-6 w-6 shrink-0 ${
                showConnPicker ? 'bg-accent' : ''
              }`}
              onClick={onToggleConnPicker}
              title="New Query"
            >
              <Plus size={13} />
            </Button>
          </>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Settings
          </span>
        )}
      </div>

      {/* Connection picker for new query */}
      {activePanel === 'queries' && showConnPicker && (
        <div className="border-b shrink-0">
          {savedConnections.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">
              No connections saved yet
            </p>
          ) : (
            savedConnections.map((conn) => (
              <button
                key={conn.name}
                type="button"
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                onClick={() => onCreateQuery(conn.name)}
              >
                <DbTypeIcon type={conn.dbType} size={12} />
                <span className="flex-1 truncate">{conn.name}</span>
              </button>
            ))
          )}
        </div>
      )}

      {/* Panel content */}
      {children}

      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors"
        onMouseDown={onResizeStart}
      />
    </div>
  );
}
