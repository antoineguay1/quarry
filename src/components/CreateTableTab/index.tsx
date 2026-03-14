import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/status-message';
import type { DbType } from '@/types';
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { invoke } from '@tauri-apps/api/core';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { generateSql } from './generate-sql';
import SortableRow from './SortableRow';
import type { ColumnDef } from './types';

interface Props {
  connectionName: string;
  database: string;
  dbType: DbType;
  availableTables: string[];
  onCreated: (tableName: string) => void;
  onClose: () => void;
}

export default function CreateTableTab({
  connectionName,
  database,
  dbType,
  availableTables,
  onCreated,
  onClose,
}: Props) {
  const [tableName, setTableName] = useState('new_table');
  const [columns, setColumns] = useState<ColumnDef[]>(() => [
    {
      id: crypto.randomUUID(),
      name: 'id',
      type: dbType === 'postgres' ? 'SERIAL' : 'INT',
      nullable: false,
      defaultMode: 'none',
      defaultValue: '',
      primary: true,
      autoIncrement: dbType === 'mysql' ? true : undefined,
    },
    {
      id: crypto.randomUUID(),
      name: 'name',
      type: 'VARCHAR',
      typeParam1: 255,
      nullable: true,
      defaultMode: 'none',
      defaultValue: '',
      primary: false,
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sqlOpen, setSqlOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));
  const sql = generateSql(tableName, columns, dbType);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumns((prev) => {
        const oldIdx = prev.findIndex((c) => c.id === active.id);
        const newIdx = prev.findIndex((c) => c.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  }, []);

  const handleChange = useCallback((id: string, updates: Partial<ColumnDef>) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    setColumns((prev) => prev.filter((c) => c.id !== id));
  }, []);

  function handleAddColumn() {
    setColumns((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: `column${prev.length + 1}`,
        type: 'VARCHAR',
        typeParam1: 255,
        nullable: true,
        defaultMode: 'none',
        defaultValue: '',
        primary: false,
      },
    ]);
  }

  async function handleCreate() {
    const trimmed = tableName.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      await invoke('execute_ddl', {
        connection: connectionName,
        database,
        sql,
      });
      onCreated(trimmed);
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden p-4 gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-muted-foreground shrink-0">
            Table name
          </label>
          <input
            type="text"
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-48"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            placeholder="table_name"
            autoFocus
            onFocus={(e) => e.target.select()}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {database} · {dbType}
        </span>
      </div>

      {/* Column list */}
      <div className="flex-1 overflow-auto border rounded-lg min-h-0">
        {/* Column header */}
        <div className="flex items-center gap-2 px-2 py-1.5 border-b bg-muted/30 text-xs font-medium text-muted-foreground sticky top-0">
          <span className="w-3.5 shrink-0" />
          <span className="w-28 shrink-0">Name</span>
          <span className="flex-1">Type / Params</span>
          <span className="w-10 shrink-0">Null</span>
          <span className="w-44 shrink-0">Default</span>
          <span className="w-8 shrink-0">PK</span>
          <span className="w-5 shrink-0">FK</span>
          <span className="w-3.25 shrink-0" />
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={columns.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {columns.map((col) => (
              <SortableRow
                key={col.id}
                col={col}
                onChange={handleChange}
                onDelete={handleDelete}
                dbType={dbType}
                availableTables={availableTables}
                connectionName={connectionName}
                database={database}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Add column */}
        <div className="px-2 py-1.5">
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={handleAddColumn}
          >
            <Plus size={13} />
            Add column
          </button>
        </div>
      </div>

      {/* SQL preview (collapsible) */}
      <div className="shrink-0 border rounded-lg overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
          onClick={() => setSqlOpen((v) => !v)}
        >
          {sqlOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          Generated SQL
        </button>
        {sqlOpen && (
          <pre className="px-3 pb-3 text-xs font-mono text-foreground whitespace-pre-wrap overflow-x-auto bg-muted/20 border-t">
            {sql}
          </pre>
        )}
      </div>

      {/* Actions */}
      {error && <ErrorMessage message={error} />}
      <div className="flex items-center justify-end gap-2 shrink-0">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={() => void handleCreate()}
          disabled={!tableName.trim() || columns.length === 0 || loading}
        >
          {loading ? 'Creating…' : 'Create Table'}
        </Button>
      </div>
    </div>
  );
}
