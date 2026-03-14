import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/status-message';
import { invoke } from '@tauri-apps/api/core';
import { AlertTriangle } from 'lucide-react';
import ModalOverlay from './ModalOverlay';

interface Props {
  connectionName: string;
  database: string;
  dbType: 'postgres' | 'mysql';
  onDropped: () => void;
  onCancel: () => void;
}

export default function DropDatabaseModal({ connectionName, database, dbType, onDropped, onCancel }: Props) {
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDrop() {
    setLoading(true);
    setError(null);
    try {
      await invoke('disconnect_database', { connection: connectionName, database });
      const sql =
        dbType === 'mysql'
          ? `DROP DATABASE \`${database}\``
          : `DROP DATABASE "${database}"`;
      await invoke('execute_ddl', { connection: connectionName, database: null, sql });
      onDropped();
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }

  return (
    <ModalOverlay>
      <h2 className="text-base font-semibold">Drop Database</h2>

      <div className="flex gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <span>
          This is irreversible. All tables and data in{' '}
          <code className="font-mono font-semibold">{database}</code> will be permanently deleted.
        </span>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          Type <code className="font-mono text-foreground">{database}</code> to confirm:
        </label>
        <input
          type="text"
          className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={database}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && confirmation === database) void handleDrop();
          }}
        />
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={() => void handleDrop()}
          disabled={confirmation !== database || loading}
        >
          {loading ? 'Dropping…' : 'Drop Database'}
        </Button>
      </div>
    </ModalOverlay>
  );
}
