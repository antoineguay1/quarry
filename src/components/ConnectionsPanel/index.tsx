import AddColumnModal from '@/components/modals/AddColumnModal';
import DropDatabaseModal from '@/components/modals/DropDatabaseModal';
import DropTableModal from '@/components/modals/DropTableModal';
import RenameDatabaseModal from '@/components/modals/RenameDatabaseModal';
import RenameTableModal from '@/components/modals/RenameTableModal';
import type { SavedConnection } from '@/types';
import { Terminal } from 'lucide-react';
import { memo, useState } from 'react';
import ConnectionRow from './ConnectionRow';
import DatabaseRow from './DatabaseRow';
import TableRow from './TableRow';

interface Props {
  savedConnections: SavedConnection[];
  expanded: Set<string>;
  connLoading: Record<string, boolean>;
  connErrors: Record<string, string>;
  connDatabases: Record<string, string[]>;
  shownDatabases: Record<string, string[]>;
  dbExpanded: Set<string>;
  dbTables: Record<string, string[]>;
  dbLoading: Record<string, boolean>;
  dbErrors: Record<string, string>;
  activeTabId: string | null;
  onToggleConnection: (conn: SavedConnection) => void;
  onToggleDatabase: (connectionName: string, database: string) => void;
  onSetDatabaseShown: (connectionName: string, database: string, visible: boolean) => void;
  onEditConnection: (conn: SavedConnection) => void;
  onDeleteConnection: (name: string) => void;
  onCreateQuery: (connectionName: string) => void;
  onOpenTable: (connectionName: string, database: string, table: string, preview?: boolean) => void;
  onRefreshConnection: (connName: string) => void;
  onRefreshDatabase: (connName: string, dbName: string) => void;
  onRefreshTable: (connName: string, dbName: string, tableName: string) => void;
  onCreateTable: (connectionName: string, database: string) => void;
  onOpenSchemaDiagram: (connectionName: string, database: string) => void;
  onRenameDatabase: (connName: string, oldName: string, newName: string) => void;
  onDropDatabase: (connName: string, dbName: string) => void;
}

interface TableModalState {
  kind: 'rename' | 'drop' | 'add-column';
  connectionName: string;
  database: string;
  table: string;
  dbType: 'postgres' | 'mysql';
}

interface DatabaseModalState {
  kind: 'rename' | 'drop';
  connectionName: string;
  database: string;
  dbType: 'postgres' | 'mysql';
}

export default memo(function ConnectionsPanel({
  savedConnections,
  expanded,
  connLoading,
  connErrors,
  connDatabases,
  shownDatabases,
  dbExpanded,
  dbTables,
  dbLoading,
  dbErrors,
  activeTabId,
  onToggleConnection,
  onToggleDatabase,
  onSetDatabaseShown,
  onEditConnection,
  onDeleteConnection,
  onCreateQuery,
  onOpenTable,
  onRefreshConnection,
  onRefreshDatabase,
  onRefreshTable,
  onCreateTable,
  onOpenSchemaDiagram,
  onRenameDatabase,
  onDropDatabase,
}: Props) {
  const [tableModal, setTableModal] = useState<TableModalState | null>(null);
  const [dbModal, setDbModal] = useState<DatabaseModalState | null>(null);

  function getDbType(connName: string): 'postgres' | 'mysql' {
    return savedConnections.find((c) => c.name === connName)?.dbType ?? 'postgres';
  }

  return (
    <div className="flex-1 overflow-y-auto py-1">
      {savedConnections.length === 0 && (
        <p className="px-3 py-4 text-xs text-muted-foreground text-center">No connections yet</p>
      )}

      {savedConnections.map((conn) => {
        const isExpanded = expanded.has(conn.name);
        const isLoading = !!connLoading[conn.name];
        const error = connErrors[conn.name];
        const allDbs = connDatabases[conn.name];
        const shownDbs = shownDatabases[conn.name] ?? [];

        return (
          <div key={conn.name}>
            <ConnectionRow
              conn={conn}
              isExpanded={isExpanded}
              isLoading={isLoading}
              error={error}
              allDbs={allDbs}
              shownDbs={shownDbs}
              onToggle={() => onToggleConnection(conn)}
              onSetShown={(db, visible) => onSetDatabaseShown(conn.name, db, visible)}
              onEdit={() => onEditConnection(conn)}
              onDelete={() => onDeleteConnection(conn.name)}
              onCreateQuery={() => onCreateQuery(conn.name)}
              onRefresh={() => onRefreshConnection(conn.name)}
            />

            {isExpanded && (
              <div>
                {shownDbs.length === 0 && allDbs && (
                  <p className="pl-9 py-1 text-xs text-muted-foreground">
                    No databases shown — click [{shownDbs.length}/{allDbs.length}] to add one
                  </p>
                )}
                {shownDbs.map((database) => {
                  const dbKey = `${conn.name}::${database}`;
                  const isDbExpanded = dbExpanded.has(dbKey);
                  const isDbLoading = !!dbLoading[dbKey];
                  const dbError = dbErrors[dbKey];
                  const tables = dbTables[dbKey];
                  const dbType = getDbType(conn.name);

                  return (
                    <div key={database}>
                      <DatabaseRow
                        database={database}
                        dbType={dbType}
                        isExpanded={isDbExpanded}
                        isLoading={isDbLoading}
                        error={dbError}
                        onToggle={() => onToggleDatabase(conn.name, database)}
                        onRefresh={() => onRefreshDatabase(conn.name, database)}
                        onCreate={() => onCreateTable(conn.name, database)}
                        onSchemaDiagram={() => onOpenSchemaDiagram(conn.name, database)}
                        onRenameClick={() => setDbModal({ kind: 'rename', connectionName: conn.name, database, dbType: 'postgres' })}
                        onDropClick={() => setDbModal({ kind: 'drop', connectionName: conn.name, database, dbType })}
                      />

                      {isDbExpanded && tables && (
                        <div>
                          <button
                            type="button"
                            className="w-full flex items-center gap-1.5 pl-14 pr-3 py-1 text-sm truncate hover:bg-accent transition-colors text-muted-foreground"
                            onClick={() => onCreateQuery(conn.name)}
                          >
                            <Terminal size={12} className="shrink-0" />
                            New Query
                          </button>
                          {tables.length === 0 ? (
                            <p className="pl-14 py-1 text-xs text-muted-foreground">No tables found</p>
                          ) : (
                            tables.map((table) => (
                              <TableRow
                                key={table}
                                table={table}
                                isActive={activeTabId === `${conn.name}::${database}::browse::${table}`}
                                onOpen={(preview) => onOpenTable(conn.name, database, table, preview)}
                                onRefresh={() => onRefreshTable(conn.name, database, table)}
                                onRenameClick={() => setTableModal({ kind: 'rename', connectionName: conn.name, database, table, dbType })}
                                onDropClick={() => setTableModal({ kind: 'drop', connectionName: conn.name, database, table, dbType })}
                                onAddColumnClick={() => setTableModal({ kind: 'add-column', connectionName: conn.name, database, table, dbType })}
                              />
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {dbModal?.kind === 'rename' && (
        <RenameDatabaseModal
          connectionName={dbModal.connectionName}
          database={dbModal.database}
          onRenamed={(newName) => {
            onRenameDatabase(dbModal.connectionName, dbModal.database, newName);
            setDbModal(null);
          }}
          onCancel={() => setDbModal(null)}
        />
      )}

      {dbModal?.kind === 'drop' && (
        <DropDatabaseModal
          connectionName={dbModal.connectionName}
          database={dbModal.database}
          dbType={dbModal.dbType}
          onDropped={() => {
            onDropDatabase(dbModal.connectionName, dbModal.database);
            setDbModal(null);
          }}
          onCancel={() => setDbModal(null)}
        />
      )}

      {tableModal?.kind === 'rename' && (
        <RenameTableModal
          connectionName={tableModal.connectionName}
          database={tableModal.database}
          table={tableModal.table}
          dbType={tableModal.dbType}
          onRenamed={(newName) => {
            onRefreshDatabase(tableModal.connectionName, tableModal.database);
            setTableModal(null);
            onRefreshTable(tableModal.connectionName, tableModal.database, newName);
          }}
          onCancel={() => setTableModal(null)}
        />
      )}

      {tableModal?.kind === 'drop' && (
        <DropTableModal
          connectionName={tableModal.connectionName}
          database={tableModal.database}
          table={tableModal.table}
          dbType={tableModal.dbType}
          onDropped={() => {
            onRefreshDatabase(tableModal.connectionName, tableModal.database);
            setTableModal(null);
          }}
          onCancel={() => setTableModal(null)}
        />
      )}

      {tableModal?.kind === 'add-column' && (
        <AddColumnModal
          connectionName={tableModal.connectionName}
          database={tableModal.database}
          table={tableModal.table}
          dbType={tableModal.dbType}
          onAdded={() => {
            onRefreshTable(tableModal.connectionName, tableModal.database, tableModal.table);
            setTableModal(null);
          }}
          onCancel={() => setTableModal(null)}
        />
      )}
    </div>
  );
});
