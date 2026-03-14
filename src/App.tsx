import ConfirmDeleteModal from '@/components/modals/ConfirmDeleteModal';
import ConnectionModal from '@/components/ConnectionForm';
import ConnectionsPanel from '@/components/ConnectionsPanel';
import CreateTableTab from '@/components/CreateTableTab';
import SchemaTab from '@/components/SchemaTab';
import DataTable from '@/components/DataTable';
import IconBar from '@/components/IconBar';
import QueryEditor from '@/components/QueryEditor';
import SavedQueriesPanel from '@/components/SavedQueriesPanel';
import SettingsPanel from '@/components/SettingsPanel';
import Sidebar from '@/components/Sidebar';
import TabBar from '@/components/TabBar';
import { useAiKey } from '@/hooks/useAiKey';
import { useConnectionActions } from '@/hooks/useConnectionActions';
import { useConnections } from '@/hooks/useConnections';
import { useSavedQueries } from '@/hooks/useSavedQueries';
import { useSessionRestore } from '@/hooks/useSessionRestore';
import { useSettings } from '@/hooks/useSettings';
import { useSidebar } from '@/hooks/useSidebar';
import { useTabs } from '@/hooks/useTabs';
import type { SidebarPanel } from '@/types';

export default function App() {
  const { settings } = useSettings();
  const { hasKey, saveKey, deleteKey } = useAiKey();
  const connections = useConnections();
  const tabsHook = useTabs();
  const sidebar = useSidebar();

  const queries = useSavedQueries({
    openSavedQuery: tabsHook.openSavedQuery,
    closeTab: tabsHook.closeTab,
    setTabs: tabsHook.setTabs,
    setActivePanel: sidebar.setActivePanel,
  });

  const actions = useConnectionActions(connections, tabsHook);
  useSessionRestore(connections, tabsHook, queries, sidebar.setActivePanel);

  const { tabs, activeTabId } = tabsHook;
  const { savedConnections } = connections;

  function handleTogglePanel(panel: SidebarPanel) {
    queries.setShowConnPicker(false);
    sidebar.togglePanel(panel);
  }

  const activeQueryId =
    tabs.find((t) => t.id === activeTabId)?.savedQueryId ?? null;

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden select-none">
      <IconBar activePanel={sidebar.activePanel} onToggle={handleTogglePanel} />

      {/* Sidebar panel */}
      {sidebar.activePanel !== null && (
        <Sidebar
          activePanel={sidebar.activePanel}
          sidebarWidth={sidebar.sidebarWidth}
          onResizeStart={sidebar.handleResizeStart}
          onNewConnection={() => actions.setModalOpen(true)}
          showConnPicker={queries.showConnPicker}
          onToggleConnPicker={() => {
            if (settings.defaultConnection && !queries.showConnPicker) {
              void queries.handleCreateQuery(settings.defaultConnection);
            } else {
              queries.setShowConnPicker((v) => !v);
            }
          }}
          savedConnections={savedConnections}
          onCreateQuery={(name) => void queries.handleCreateQuery(name)}
        >
          {sidebar.activePanel === 'connections' ? (
            <ConnectionsPanel
              savedConnections={savedConnections}
              expanded={connections.expanded}
              connLoading={connections.connLoading}
              connErrors={connections.connErrors}
              connDatabases={connections.connDatabases}
              shownDatabases={connections.shownDatabases}
              dbExpanded={connections.dbExpanded}
              dbTables={connections.dbTables}
              dbLoading={connections.dbLoading}
              dbErrors={connections.dbErrors}
              activeTabId={activeTabId}
              onToggleConnection={(conn) => void connections.toggleConnection(conn)}
              onToggleDatabase={(connName, db) => void connections.toggleDatabase(connName, db)}
              onSetDatabaseShown={actions.handleSetDatabaseShown}
              onEditConnection={actions.setEditConnection}
              onDeleteConnection={actions.setDeleteConfirm}
              onCreateQuery={(name) => void queries.handleCreateQuery(name)}
              onOpenTable={tabsHook.openTable}
              onRefreshConnection={(connName) => void connections.refreshConnection(connName)}
              onRefreshDatabase={(connName, dbName) => void connections.refreshDatabase(connName, dbName)}
              onRefreshTable={(connName, dbName, tableName) => {
                const tabId = `${connName}::${dbName}::browse::${tableName}`;
                if (tabs.find((t) => t.id === tabId)) {
                  tabsHook.refreshTab(tabId);
                }
                const schemaId = `schema::${connName}::${dbName}`;
                if (tabs.find((t) => t.id === schemaId)) {
                  tabsHook.refreshTab(schemaId);
                }
              }}
              onCreateTable={tabsHook.openCreateTable}
              onOpenSchemaDiagram={tabsHook.openSchemaDiagram}
              onRenameDatabase={actions.handleRenameDatabase}
              onDropDatabase={actions.handleDropDatabase}
            />
          ) : sidebar.activePanel === 'queries' ? (
            <SavedQueriesPanel
              queries={queries.savedQueries}
              activeQueryId={activeQueryId}
              onOpen={tabsHook.openSavedQuery}
              onDelete={(id) => queries.setDeleteQueryConfirm(id)}
              onRename={(id, name) => queries.handleUpdateQuery(id, { name })}
              pendingRenameId={queries.pendingRenameQueryId}
              onRenameStarted={() => queries.setPendingRenameQueryId(null)}
              savedConnections={savedConnections}
            />
          ) : (
            <SettingsPanel
              savedConnections={savedConnections}
              apiKey={hasKey}
              onSaveKey={saveKey}
              onDeleteKey={deleteKey}
            />
          )}
        </Sidebar>
      )}

      {/* Main area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tabs.length > 0 && (
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            savedQueries={queries.savedQueries}
            onActivate={tabsHook.setActiveTabId}
            onClose={tabsHook.closeTab}
            onPromote={tabsHook.promoteTab}
            onCloseOthers={(id) => {
              const tab = tabs.find((t) => t.id === id)!;
              tabsHook.setTabs([tab]);
              tabsHook.setActiveTabId(id);
            }}
            onCloseAll={() => {
              tabsHook.setTabs([]);
              tabsHook.setActiveTabId(null);
            }}
          />
        )}

        {/* Tab contents */}
        {tabs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a table or open a query from the sidebar
          </div>
        ) : (
          tabs.map((tab) => {
            const query =
              tab.type === 'saved-query'
                ? queries.savedQueries.find((q) => q.id === tab.savedQueryId)
                : undefined;
            return (
              <div
                key={tab.id}
                className={`flex-1 overflow-hidden flex flex-col ${
                  activeTabId === tab.id ? '' : 'hidden'
                }`}
              >
                {tab.type === 'browse' && tab.table && tab.database ? (
                  <div className="flex-1 overflow-hidden flex flex-col p-4">
                    <DataTable
                      connectionName={tab.connectionName}
                      database={tab.database}
                      table={tab.table}
                      dbType={savedConnections.find((c) => c.name === tab.connectionName)?.dbType}
                      initialFilters={tab.initialFilters}
                      filterKey={tab.filterKey}
                      refreshKey={tab.refreshKey}
                      onRefresh={() => tabsHook.refreshTab(tab.id)}
                      onColumnDropped={() => {
                        const schemaId = `schema::${tab.connectionName}::${tab.database}`;
                        if (tabs.find((t) => t.id === schemaId)) {
                          tabsHook.refreshTab(schemaId);
                        }
                      }}
                      onPromote={() => tabsHook.promoteTab(tab.id)}
                      onOpenSchemaDiagram={() => tabsHook.openSchemaDiagram(tab.connectionName, tab.database!)}
                      onNavigateFk={(refTable, refCol, value, colType) => {
                        tabsHook.promoteTab(tab.id);
                        tabsHook.navigateFk(
                          tab.connectionName,
                          tab.database!,
                          refTable,
                          refCol,
                          value,
                          colType
                        );
                      }}
                    />
                  </div>
                ) : query ? (
                  <div className="flex-1 overflow-hidden flex flex-col p-4">
                    <QueryEditor
                      query={query}
                      connections={savedConnections}
                      onUpdate={(updates) =>
                        queries.handleUpdateQuery(tab.savedQueryId!, updates)
                      }
                      onPromote={() => tabsHook.promoteTab(tab.id)}
                      refreshKey={tab.refreshKey}
                      hasKey={hasKey}
                      onOpenSettings={() => sidebar.setActivePanel('settings')}
                    />
                  </div>
                ) : tab.type === 'create-table' && tab.database ? (
                  <CreateTableTab
                    connectionName={tab.connectionName}
                    database={tab.database}
                    dbType={
                      savedConnections.find((c) => c.name === tab.connectionName)
                        ?.dbType ?? 'postgres'
                    }
                    availableTables={
                      connections.dbTables[`${tab.connectionName}::${tab.database}`] ?? []
                    }
                    onCreated={(tableName) => {
                      tabsHook.closeTab(tab.id);
                      void connections.refreshDatabase(tab.connectionName, tab.database!);
                      tabsHook.openTable(tab.connectionName, tab.database!, tableName, false);
                    }}
                    onClose={() => tabsHook.closeTab(tab.id)}
                  />
                ) : tab.type === 'schema-diagram' && tab.database ? (
                  <SchemaTab
                    connectionName={tab.connectionName}
                    database={tab.database}
                    refreshKey={tab.refreshKey}
                  />
                ) : null}
              </div>
            );
          })
        )}
      </div>

      {/* New Connection Modal */}
      {actions.modalOpen && (
        <ConnectionModal
          onConnected={actions.handleConnected}
          onClose={() => actions.setModalOpen(false)}
        />
      )}

      {/* Edit Connection Modal */}
      {actions.editConnection && (
        <ConnectionModal
          initialConnection={actions.editConnection}
          onConnected={actions.handleEditConnected}
          onClose={() => actions.setEditConnection(null)}
        />
      )}

      {/* Delete Query Confirmation Modal */}
      {queries.deleteQueryConfirm && (() => {
        const q = queries.savedQueries.find((q) => q.id === queries.deleteQueryConfirm);
        return (
          <ConfirmDeleteModal
            title="Delete Query"
            message={
              <>
                Are you sure you want to delete{' '}
                <span className="font-medium text-foreground">
                  "{q?.name ?? queries.deleteQueryConfirm}"
                </span>
                ? This action cannot be undone.
              </>
            }
            onConfirm={() => void queries.handleConfirmDeleteQuery()}
            onCancel={() => queries.setDeleteQueryConfirm(null)}
          />
        );
      })()}

      {/* Delete Connection Confirmation Modal */}
      {actions.deleteConfirm && (
        <ConfirmDeleteModal
          title="Delete Connection"
          message={
            <>
              Are you sure you want to delete{' '}
              <span className="font-medium text-foreground">
                "{actions.deleteConfirm}"
              </span>
              ? This action cannot be undone.
            </>
          }
          onConfirm={() => void actions.handleConfirmDelete()}
          onCancel={() => actions.setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}
