import type { SidebarPanel } from '@/types';
import { Database, ScrollText, Settings } from 'lucide-react';

interface Props {
  activePanel: SidebarPanel | null;
  onToggle: (panel: SidebarPanel) => void;
}

export default function IconBar({ activePanel, onToggle }: Props) {
  return (
    <div className="w-10 flex flex-col items-center border-r py-2 gap-1 shrink-0">
      <button
        type="button"
        className={`p-2 rounded-md transition-colors ${
          activePanel === 'connections'
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
        }`}
        onClick={() => onToggle('connections')}
        title="Connections"
      >
        <Database size={16} />
      </button>
      <button
        type="button"
        className={`p-2 rounded-md transition-colors ${
          activePanel === 'queries'
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
        }`}
        onClick={() => onToggle('queries')}
        title="Queries"
      >
        <ScrollText size={16} />
      </button>
      <button
        type="button"
        className={`p-2 rounded-md transition-colors ${
          activePanel === 'settings'
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
        }`}
        onClick={() => onToggle('settings')}
        title="Settings"
      >
        <Settings size={16} />
      </button>
    </div>
  );
}
