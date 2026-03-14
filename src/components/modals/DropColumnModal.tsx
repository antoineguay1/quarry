import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/status-message';
import type { DbType } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import ModalOverlay from './ModalOverlay';

interface Props {
  connectionName: string;
  database: string;
  table: string;
  column: string;
  dbType: DbType;
  onDropped: () => void;
  onCancel: () => void;
}

export default function DropColumnModal({ connectionName, database, table, column, dbType, onDropped, onCancel }: Props) {
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const q = dbType === 'postgres' ? (n: string) => `"${n}"` : (n: string) => `\`${n}\``;

  async function handleDrop() {
    setLoading(true);
    setError(null);
    try {
      await invoke('execute_ddl', {
        connection: connectionName,
        database,
        sql: `ALTER TABLE ${q(table)} DROP COLUMN ${q(column)}`,
      });
      onDropped();
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }

  return (
    <ModalOverlay>
      <h2 className="text-base font-semibold">Drop Column</h2>

      <div className="flex gap-2 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <span>
          This is irreversible. All data in column{' '}
          <code className="font-mono font-semibold">{column}</code> of{' '}
          <code className="font-mono font-semibold">{table}</code> will be permanently deleted.
        </span>
      </div>

      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">
          Type <code className="font-mono text-foreground">{column}</code> to confirm:
        </label>
        <input
          type="text"
          autoFocus
          className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={column}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && confirmation === column) void handleDrop();
          }}
        />
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button
          variant="destructive"
          onClick={() => void handleDrop()}
          disabled={confirmation !== column || loading}
        >
          {loading ? 'Dropping…' : 'Drop Column'}
        </Button>
      </div>
    </ModalOverlay>
  );
}
