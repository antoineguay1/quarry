import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/status-message';
import { invoke } from '@tauri-apps/api/core';
import { AlertTriangle } from 'lucide-react';
import ModalOverlay from './ModalOverlay';

interface Props {
  connectionName: string;
  database: string;
  onRenamed: (newName: string) => void;
  onCancel: () => void;
}

export default function RenameDatabaseModal({ connectionName, database, onRenamed, onCancel }: Props) {
  const [newName, setNewName] = useState(database);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRename() {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === database) return;
    setLoading(true);
    setError(null);
    try {
      await invoke('disconnect_database', { connection: connectionName, database });
      await invoke('execute_ddl', {
        connection: connectionName,
        database: null,
        sql: `ALTER DATABASE "${database}" RENAME TO "${trimmed}"`,
      });
      onRenamed(trimmed);
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }

  return (
    <ModalOverlay>
      <h2 className="text-base font-semibold">Rename Database</h2>

      <div className="flex gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 p-3 text-sm text-amber-600 dark:text-amber-400">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <span>
          Open tabs for <code className="font-mono">{database}</code> will be disconnected.
          Applications referencing the old name will break.
        </span>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">New name</label>
        <input
          type="text"
          className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          autoFocus
          onFocus={(e) => e.target.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleRename();
            if (e.key === 'Escape') onCancel();
          }}
        />
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleRename()}
          disabled={!newName.trim() || newName.trim() === database || loading}
        >
          {loading ? 'Renaming…' : 'Rename'}
        </Button>
      </div>
    </ModalOverlay>
  );
}
