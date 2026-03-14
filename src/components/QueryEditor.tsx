import AiPromptBar from '@/components/AiPromptBar';
import SqlEditor from '@/components/SqlEditor';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ErrorMessage } from '@/components/ui/status-message';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useColumnResize } from '@/hooks/useColumnResize';
import { STORAGE_KEYS } from '@/lib/storage';
import type {
  ColumnInfo,
  QueryResult,
  SavedConnection,
  SavedQuery,
} from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { Sparkles } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_EDITOR_RATIO = 0.4;

interface Props {
  query: SavedQuery;
  connections: SavedConnection[];
  onUpdate: (updates: Partial<Omit<SavedQuery, 'id'>>) => void;
  onPromote?: () => void;
  refreshKey?: number;
  hasKey: boolean;
  onOpenSettings: () => void;
}

export default function QueryEditor({
  query,
  connections,
  onUpdate,
  onPromote,
  refreshKey,
  hasKey,
  onOpenSettings,
}: Props) {
  const [sql, setSql] = useState(query.sql);
  const [selectedConnection, setSelectedConnection] = useState(
    query.connectionName,
  );
  const defaultDb =
    connections.find((c) => c.name === query.connectionName)?.database ?? '';
  const [selectedDatabase, setSelectedDatabase] = useState(
    query.database ?? defaultDb,
  );
  const [databases, setDatabases] = useState<string[]>([]);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { colWidths, setColWidths, startResize } = useColumnResize();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>(
    'idle',
  );
  const [schema, setSchema] = useState<Record<string, string[]>>({});
  const [aiSchema, setAiSchema] = useState<Record<string, ColumnInfo[]>>({});
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editorHeight, setEditorHeight] = useState(240);
  const editorHeightRef = useRef(editorHeight);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startH: number } | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const storageKey = `${STORAGE_KEYS.EDITOR_RATIO_PREFIX}-${query.id}`;

  // Sync ref so drag-end closure always sees the latest height
  useEffect(() => {
    editorHeightRef.current = editorHeight;
  }, [editorHeight]);

  // Restore saved ratio once the container is laid out
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    const ratio = stored ? parseFloat(stored) : NaN;
    const r = isNaN(ratio) ? DEFAULT_EDITOR_RATIO : ratio;
    requestAnimationFrame(() => {
      if (containerRef.current) {
        const h = containerRef.current.clientHeight;
        if (h > 0) setEditorHeight(Math.max(80, r * h));
      }
    });
  }, [storageKey]);

  const onDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startY: e.clientY, startH: editorHeightRef.current };

      function onMouseMove(ev: MouseEvent) {
        if (!dragRef.current) return;
        const delta = ev.clientY - dragRef.current.startY;
        setEditorHeight(Math.max(80, dragRef.current.startH + delta));
      }

      function onMouseUp() {
        dragRef.current = null;
        if (containerRef.current) {
          const ratio =
            editorHeightRef.current / containerRef.current.clientHeight;
          localStorage.setItem(storageKey, String(ratio));
        }
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [storageKey],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    };
  }, []);

  // Load database list whenever the connection changes
  useEffect(() => {
    if (!selectedConnection) return;
    let cancelled = false;
    invoke('connect_saved', { name: selectedConnection })
      .catch((e) => console.warn('Pre-connect failed:', e))
      .then(() =>
        invoke<string[]>('list_databases', { connection: selectedConnection }),
      )
      .then((dbs) => {
        if (!cancelled) setDatabases(dbs as string[]);
      })
      .catch((e) => console.warn('List databases failed:', e));
    return () => {
      cancelled = true;
    };
  }, [selectedConnection]);

  // Fetch schema (tables + columns) for autocomplete whenever connection or database changes
  useEffect(() => {
    if (!selectedConnection || !selectedDatabase) return;
    let cancelled = false;

    async function fetchSchema() {
      try {
        await invoke('connect_database', {
          connection: selectedConnection,
          database: selectedDatabase,
        }).catch((e) => console.warn('Pre-connect database failed:', e));
        const tables = await invoke<string[]>('list_tables', {
          connection: selectedConnection,
          database: selectedDatabase,
        });
        if (cancelled) return;
        const entries = await Promise.all(
          tables.map(async (table) => {
            try {
              const cols = await invoke<ColumnInfo[]>('get_table_columns', {
                connection: selectedConnection,
                database: selectedDatabase,
                table,
              });
              return [table, cols] as [string, ColumnInfo[]];
            } catch {
              return [table, []] as [string, ColumnInfo[]];
            }
          }),
        );
        if (!cancelled) {
          const full = Object.fromEntries(entries);
          setAiSchema(full);
          setSchema(
            Object.fromEntries(
              entries.map(([t, cols]) => [t, cols.map((c) => c.name)]),
            ),
          );
        }
      } catch {
        // ignore schema fetch errors — editor still works without autocomplete
      }
    }

    void fetchSchema();
    return () => {
      cancelled = true;
    };
  }, [selectedConnection, selectedDatabase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-execute query when refreshKey is incremented (skip on initial mount / undefined)
  useEffect(() => {
    if (!refreshKey) return;
    void handleExecute();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ensure selected connection is always a valid option
  const connectionOptions = connections.some(
    (c) => c.name === selectedConnection,
  )
    ? connections
    : [{ name: selectedConnection } as SavedConnection, ...connections];

  function handleSqlChange(newSql: string) {
    setSql(newSql);
    onPromote?.();
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaveStatus('saving');
    saveTimerRef.current = setTimeout(() => {
      setSaveStatus('saved');
      if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
      saveStatusTimerRef.current = setTimeout(
        () => setSaveStatus('idle'),
        1500,
      );
      onUpdate({ sql: newSql });
    }, 600);
  }

  function handleInsertSql(newSql: string) {
    const appended = sql.trim() ? sql.trimEnd() + '\n\n' + newSql : newSql;
    handleSqlChange(appended);
  }

  function handleConnectionChange(newConn: string) {
    const newDefaultDb =
      connections.find((c) => c.name === newConn)?.database ?? '';
    setSelectedConnection(newConn);
    setSelectedDatabase(newDefaultDb);
    onUpdate({ connectionName: newConn, database: newDefaultDb || undefined });
    void invoke('connect_saved', { name: newConn }).catch((e) => console.warn('Pre-connect failed:', e));
  }

  function handleDatabaseChange(newDb: string) {
    setSelectedDatabase(newDb);
    onUpdate({ database: newDb });
    void invoke('connect_database', {
      connection: selectedConnection,
      database: newDb,
    }).catch((e) => console.warn('Pre-connect database failed:', e));
  }

  async function handleExecute() {
    if (!sql.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setColWidths({});
    try {
      const data = await invoke<QueryResult>('execute_query', {
        connection: selectedConnection,
        database: selectedDatabase || undefined,
        sql,
      });
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  const isMac = /mac/i.test(navigator.userAgent);
  const shortcutHint = isMac ? '⌘ Enter to run' : 'Ctrl+Enter to run';
  const activeConn = connections.find((c) => c.name === selectedConnection);
  const dialect = activeConn?.dbType === 'mysql' ? 'mysql' : 'pg';

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      {/* Toolbar: connection selectors + execute + AI toggle */}
      <div className="flex items-center gap-2 shrink-0 pb-3">
        <span className="text-xs text-muted-foreground shrink-0">
          Connection
        </span>
        <Select
          value={selectedConnection}
          onValueChange={handleConnectionChange}
        >
          <SelectTrigger className="h-7 text-xs w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {connectionOptions.map((c) => (
              <SelectItem key={c.name} value={c.name}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {databases.length > 0 && (
          <>
            <span className="text-xs text-muted-foreground shrink-0">
              Database
            </span>
            <Select
              value={selectedDatabase}
              onValueChange={handleDatabaseChange}
            >
              <SelectTrigger className="h-7 text-xs w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {databases.map((db) => (
                  <SelectItem key={db} value={db}>
                    {db}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span
            className={`text-xs text-muted-foreground transition-opacity duration-300 ${saveStatus === 'idle' ? 'opacity-0' : saveStatus === 'saving' ? 'opacity-60' : 'opacity-100'}`}
          >
            {saveStatus === 'saving' ? 'Saving…' : 'Saved'}
          </span>
          <span className="text-xs text-muted-foreground">{shortcutHint}</span>
          <Button
            onClick={() => void handleExecute()}
            disabled={loading || !sql.trim()}
          >
            {loading ? 'Executing…' : 'Execute'}
          </Button>
          <button
            onClick={() => setAiOpen((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
              aiOpen
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            }`}
          >
            <Sparkles size={12} />
            AI
          </button>
        </div>
      </div>

      {/* Editor pane */}
      <div
        className="shrink-0 overflow-hidden"
        style={{ height: editorHeight }}
      >
        <SqlEditor
          value={sql}
          onChange={handleSqlChange}
          onRun={() => void handleExecute()}
          schema={schema}
          dialect={dialect}
        />
      </div>

      {/* AI prompt bar */}
      {aiOpen && (
        <AiPromptBar
          sql={sql}
          schema={aiSchema}
          dialect={dialect}
          error={error}
          hasKey={hasKey}
          onInsert={handleInsertSql}
          onReplace={handleSqlChange}
          onOpenSettings={onOpenSettings}
        />
      )}

      {/* Resizable divider */}
      <div
        className="h-1.5 shrink-0 cursor-row-resize bg-border hover:bg-primary/40 active:bg-primary/60 transition-colors my-1 rounded"
        onMouseDown={onDividerMouseDown}
      />

      {/* Results pane */}
      <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">
        {error && (
          <ErrorMessage message={error} mono onDismiss={() => setError(null)} />
        )}

        {result && (
          <div className="flex flex-col gap-1 h-full min-h-0">
            <div className="text-xs text-muted-foreground shrink-0">
              {result.row_count} row{result.row_count !== 1 ? 's' : ''} in{' '}
              {result.execution_time_ms}ms
            </div>
            <div className="flex-1 min-h-0 rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {result.columns.map((col) => (
                      <TableHead
                        key={col}
                        className="whitespace-nowrap relative"
                        style={
                          colWidths[col]
                            ? {
                                width: colWidths[col],
                                minWidth: colWidths[col],
                                maxWidth: colWidths[col],
                              }
                            : undefined
                        }
                      >
                        {col}
                        <div
                          className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 transition-colors z-10"
                          onMouseDown={(e) => startResize(e, col)}
                        />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((row, ri) => (
                    <TableRow key={ri}>
                      {row.map((cell, ci) => {
                        const colName = result.columns[ci];
                        const w = colWidths[colName];
                        return (
                          <TableCell
                            key={ci}
                            className="whitespace-nowrap font-mono text-xs truncate"
                            style={
                              w
                                ? { width: w, minWidth: w, maxWidth: w }
                                : undefined
                            }
                          >
                            {cell === null || cell === undefined ? (
                              <span className="text-muted-foreground italic">
                                null
                              </span>
                            ) : (
                              String(
                                typeof cell === 'object'
                                  ? JSON.stringify(cell)
                                  : cell,
                              )
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
