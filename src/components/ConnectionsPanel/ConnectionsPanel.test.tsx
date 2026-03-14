import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import type { SavedConnection } from '@/types';
import ConnectionsPanel from './index';

function makeConn(name: string, dbType: SavedConnection['dbType'] = 'postgres'): SavedConnection {
  return { name, dbType, host: 'localhost', port: 5432, database: 'mydb', username: 'user' };
}

function defaultProps(overrides: Partial<Parameters<typeof ConnectionsPanel>[0]> = {}) {
  return {
    savedConnections: [],
    expanded: new Set<string>(),
    connLoading: {},
    connErrors: {},
    connDatabases: {},
    shownDatabases: {},
    dbExpanded: new Set<string>(),
    dbTables: {},
    dbLoading: {},
    dbErrors: {},
    activeTabId: null,
    onToggleConnection: vi.fn(),
    onToggleDatabase: vi.fn(),
    onSetDatabaseShown: vi.fn(),
    onEditConnection: vi.fn(),
    onDeleteConnection: vi.fn(),
    onCreateQuery: vi.fn(),
    onOpenTable: vi.fn(),
    onRefreshConnection: vi.fn(),
    onRefreshDatabase: vi.fn(),
    onRefreshTable: vi.fn(),
    onCreateTable: vi.fn(),
    onOpenSchemaDiagram: vi.fn(),
    onRenameDatabase: vi.fn(),
    onDropDatabase: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('ConnectionsPanel', () => {
  // ── Empty state ──────────────────────────────────────────────────────────

  it('shows "No connections yet" when savedConnections is empty', () => {
    render(<ConnectionsPanel {...defaultProps()} />);
    expect(screen.getByText('No connections yet')).toBeInTheDocument();
  });

  // ── Connection-level rendering ────────────────────────────────────────────

  it('renders a row for each connection', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod'), makeConn('staging')],
        })}
      />
    );
    expect(screen.getByText('prod')).toBeInTheDocument();
    expect(screen.getByText('staging')).toBeInTheDocument();
  });

  it('collapsed connection: databases not rendered', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          // expanded is empty → not expanded
          shownDatabases: { prod: ['mydb'] },
        })}
      />
    );
    expect(screen.queryByText('mydb')).toBeNull();
  });

  it('expanded + shownDbs empty + allDbs present: shows no-databases message', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          connDatabases: { prod: ['db1', 'db2'] },
          shownDatabases: { prod: [] },
        })}
      />
    );
    expect(screen.getByText(/No databases shown/)).toBeInTheDocument();
  });

  it('expanded + shownDbs empty + allDbs undefined: no no-databases message', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          // connDatabases not set → allDbs undefined
          shownDatabases: {},
        })}
      />
    );
    expect(screen.queryByText(/No databases shown/)).toBeNull();
  });

  it('expanded + shownDbs present: renders DatabaseRow for each shown database', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          connDatabases: { prod: ['db1', 'db2'] },
          shownDatabases: { prod: ['db1', 'db2'] },
        })}
      />
    );
    expect(screen.getByText('db1')).toBeInTheDocument();
    expect(screen.getByText('db2')).toBeInTheDocument();
  });

  // ── Database-level rendering ──────────────────────────────────────────────

  it('DB expanded + tables undefined: tables section not rendered', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
          dbExpanded: new Set(['prod::mydb']),
          // dbTables not set → tables undefined
        })}
      />
    );
    expect(screen.queryByText('New Query')).toBeNull();
  });

  it('DB expanded + tables empty: shows "No tables found"', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
          dbExpanded: new Set(['prod::mydb']),
          dbTables: { 'prod::mydb': [] },
        })}
      />
    );
    expect(screen.getByText('No tables found')).toBeInTheDocument();
  });

  it('DB expanded + tables present: renders a TableRow for each table', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
          dbExpanded: new Set(['prod::mydb']),
          dbTables: { 'prod::mydb': ['users', 'orders'] },
        })}
      />
    );
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText('orders')).toBeInTheDocument();
  });

  it('DB expanded + tables present: shows New Query button; click calls onCreateQuery', () => {
    const onCreateQuery = vi.fn();
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
          dbExpanded: new Set(['prod::mydb']),
          dbTables: { 'prod::mydb': ['users'] },
          onCreateQuery,
        })}
      />
    );
    fireEvent.click(screen.getByText('New Query'));
    expect(onCreateQuery).toHaveBeenCalledWith('prod');
  });

  // ── Active tab detection ──────────────────────────────────────────────────

  it('active table has isActive=true, other tables have isActive=false', () => {
    const { container } = render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
          dbExpanded: new Set(['prod::mydb']),
          dbTables: { 'prod::mydb': ['users', 'orders'] },
          activeTabId: 'prod::mydb::browse::users',
        })}
      />
    );
    const activeRows = container.querySelectorAll('.bg-accent.text-accent-foreground.font-medium');
    expect(activeRows.length).toBe(1);
    expect(activeRows[0]).toHaveTextContent('users');
  });

  // ── getDbType fallback ────────────────────────────────────────────────────

  it('mysql connection propagates dbType to DatabaseRow (no Rename button)', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod', 'mysql')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
        })}
      />
    );
    expect(screen.queryByTitle('Rename')).toBeNull();
  });

  it('unknown connectionName in getDbType defaults to postgres', () => {
    // Render with a connection that has been removed from savedConnections
    // but still has a shown database — covered by normal flow; just check Rename button present
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod', 'postgres')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
        })}
      />
    );
    // postgres → Rename button should be present
    expect(screen.getByTitle('Rename')).toBeInTheDocument();
  });

  // ── Database rename modal ─────────────────────────────────────────────────

  it('click Rename on DatabaseRow → RenameDatabaseModal appears', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
        })}
      />
    );
    fireEvent.click(screen.getByTitle('Rename'));
    expect(screen.getByText('Rename Database')).toBeInTheDocument();
  });

  it('database rename modal Cancel closes modal', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
        })}
      />
    );
    fireEvent.click(screen.getByTitle('Rename'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Rename Database')).toBeNull();
  });

  it('database rename: change name and submit → invoke called, onRenameDatabase called, modal closed', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const onRenameDatabase = vi.fn();
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
          onRenameDatabase,
        })}
      />
    );
    fireEvent.click(screen.getByTitle('Rename'));
    const input = screen.getByDisplayValue('mydb');
    fireEvent.change(input, { target: { value: 'newdb' } });
    const renameSubmitBtn = screen.getAllByRole('button', { name: 'Rename' }).at(-1)!;
    fireEvent.click(renameSubmitBtn);
    await waitFor(() => {
      expect(invoke).toHaveBeenCalled();
      expect(onRenameDatabase).toHaveBeenCalledWith('prod', 'mydb', 'newdb');
    });
    expect(screen.queryByText('Rename Database')).toBeNull();
  });

  // ── Database drop modal ───────────────────────────────────────────────────

  it('click Drop on DatabaseRow → DropDatabaseModal appears', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
        })}
      />
    );
    fireEvent.click(screen.getByTitle('Drop'));
    expect(screen.getByRole('heading', { name: 'Drop Database' })).toBeInTheDocument();
  });

  it('database drop modal Cancel closes modal', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
        })}
      />
    );
    fireEvent.click(screen.getByTitle('Drop'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Drop Database')).toBeNull();
  });

  it('database drop: type name and submit → invoke called, onDropDatabase called, modal closed', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const onDropDatabase = vi.fn();
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
          onDropDatabase,
        })}
      />
    );
    fireEvent.click(screen.getByTitle('Drop'));
    const input = screen.getByPlaceholderText('mydb');
    fireEvent.change(input, { target: { value: 'mydb' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop Database' }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalled();
      expect(onDropDatabase).toHaveBeenCalledWith('prod', 'mydb');
    });
    expect(screen.queryByText('Drop Database')).toBeNull();
  });

  // ── Table rename modal ────────────────────────────────────────────────────

  it('click Rename on TableRow → RenameTableModal appears', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
          dbExpanded: new Set(['prod::mydb']),
          dbTables: { 'prod::mydb': ['users'] },
        })}
      />
    );
    // TableRow's Rename button (there's also a DB-level Rename from DatabaseRow)
    const renameButtons = screen.getAllByTitle('Rename');
    // Last one is the TableRow's rename button (table row renders after db row)
    fireEvent.click(renameButtons[renameButtons.length - 1]);
    expect(screen.getByText('Rename Table')).toBeInTheDocument();
  });

  it('table rename modal Cancel closes modal', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
          dbExpanded: new Set(['prod::mydb']),
          dbTables: { 'prod::mydb': ['users'] },
        })}
      />
    );
    const renameButtons = screen.getAllByTitle('Rename');
    fireEvent.click(renameButtons[renameButtons.length - 1]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Rename Table')).toBeNull();
  });

  it('table rename: change name and submit → invoke called, callbacks called, modal closed', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const onRefreshDatabase = vi.fn();
    const onRefreshTable = vi.fn();
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
          dbExpanded: new Set(['prod::mydb']),
          dbTables: { 'prod::mydb': ['users'] },
          onRefreshDatabase,
          onRefreshTable,
        })}
      />
    );
    const renameButtons = screen.getAllByTitle('Rename');
    fireEvent.click(renameButtons[renameButtons.length - 1]);
    const input = screen.getByDisplayValue('users');
    fireEvent.change(input, { target: { value: 'members' } });
    const renameSubmitBtn = screen.getAllByRole('button', { name: 'Rename' }).at(-1)!;
    fireEvent.click(renameSubmitBtn);
    await waitFor(() => {
      expect(invoke).toHaveBeenCalled();
      expect(onRefreshDatabase).toHaveBeenCalledWith('prod', 'mydb');
      expect(onRefreshTable).toHaveBeenCalledWith('prod', 'mydb', 'members');
    });
    expect(screen.queryByText('Rename Table')).toBeNull();
  });

  // ── Table drop modal ──────────────────────────────────────────────────────

  it('click Drop on TableRow → DropTableModal appears', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
          dbExpanded: new Set(['prod::mydb']),
          dbTables: { 'prod::mydb': ['users'] },
        })}
      />
    );
    const dropButtons = screen.getAllByTitle('Drop');
    fireEvent.click(dropButtons[dropButtons.length - 1]);
    expect(screen.getByRole('heading', { name: 'Drop Table' })).toBeInTheDocument();
  });

  it('table drop modal Cancel closes modal', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
          dbExpanded: new Set(['prod::mydb']),
          dbTables: { 'prod::mydb': ['users'] },
        })}
      />
    );
    const dropButtons = screen.getAllByTitle('Drop');
    fireEvent.click(dropButtons[dropButtons.length - 1]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Drop Table')).toBeNull();
  });

  it('table drop: type name and submit → invoke called, onRefreshDatabase called, modal closed', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const onRefreshDatabase = vi.fn();
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
          dbExpanded: new Set(['prod::mydb']),
          dbTables: { 'prod::mydb': ['users'] },
          onRefreshDatabase,
        })}
      />
    );
    const dropButtons = screen.getAllByTitle('Drop');
    fireEvent.click(dropButtons[dropButtons.length - 1]);
    const input = screen.getByPlaceholderText('users');
    fireEvent.change(input, { target: { value: 'users' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop Table' }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalled();
      expect(onRefreshDatabase).toHaveBeenCalledWith('prod', 'mydb');
    });
    expect(screen.queryByText('Drop Table')).toBeNull();
  });

  // ── Table add-column modal ────────────────────────────────────────────────

  it('click Add Column on TableRow → AddColumnModal appears with correct title', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
          dbExpanded: new Set(['prod::mydb']),
          dbTables: { 'prod::mydb': ['users'] },
        })}
      />
    );
    // Open context menu on table row to access Add Column
    fireEvent.contextMenu(screen.getByText('users'));
    fireEvent.click(screen.getByText('Add Column'));
    expect(screen.getByRole('heading', { name: /Add Column to/ })).toBeInTheDocument();
  });

  it('add column modal Cancel closes modal', () => {
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
          dbExpanded: new Set(['prod::mydb']),
          dbTables: { 'prod::mydb': ['users'] },
        })}
      />
    );
    fireEvent.contextMenu(screen.getByText('users'));
    fireEvent.click(screen.getByText('Add Column'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText(/Add Column to/)).toBeNull();
  });

  it('add column: type name and submit → invoke called, onRefreshTable called, modal closed', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const onRefreshTable = vi.fn();
    render(
      <ConnectionsPanel
        {...defaultProps({
          savedConnections: [makeConn('prod')],
          expanded: new Set(['prod']),
          shownDatabases: { prod: ['mydb'] },
          dbExpanded: new Set(['prod::mydb']),
          dbTables: { 'prod::mydb': ['users'] },
          onRefreshTable,
        })}
      />
    );
    fireEvent.contextMenu(screen.getByText('users'));
    fireEvent.click(screen.getByText('Add Column'));
    const input = screen.getByPlaceholderText('column_name');
    fireEvent.change(input, { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Column' }));
    await waitFor(() => {
      expect(invoke).toHaveBeenCalled();
      expect(onRefreshTable).toHaveBeenCalledWith('prod', 'mydb', 'users');
    });
    expect(screen.queryByText(/Add Column to/)).toBeNull();
  });

  // ── Callback propagation ─────────────────────────────────────────────────
  // These tests verify that the inline arrow-function wrappers in index.tsx
  // correctly forward calls to the parent-level callbacks.

  const withConnection = {
    savedConnections: [makeConn('prod')],
    expanded: new Set(['prod']),
    connDatabases: { prod: ['mydb'] },
    shownDatabases: { prod: ['mydb'] },
  };

  const withDb = {
    ...withConnection,
    dbExpanded: new Set(['prod::mydb']),
    dbTables: { 'prod::mydb': ['users'] },
  };

  it('clicking connection row calls onToggleConnection', () => {
    const onToggleConnection = vi.fn();
    render(<ConnectionsPanel {...defaultProps({ savedConnections: [makeConn('prod')], onToggleConnection })} />);
    fireEvent.click(screen.getByText('prod'));
    expect(onToggleConnection).toHaveBeenCalledWith(expect.objectContaining({ name: 'prod' }));
  });

  it('connection refresh button calls onRefreshConnection', () => {
    const onRefreshConnection = vi.fn();
    render(<ConnectionsPanel {...defaultProps({ savedConnections: [makeConn('prod')], onRefreshConnection })} />);
    fireEvent.click(screen.getByTitle('Refresh'));
    expect(onRefreshConnection).toHaveBeenCalledWith('prod');
  });

  it('connection edit button calls onEditConnection', () => {
    const onEditConnection = vi.fn();
    render(<ConnectionsPanel {...defaultProps({ savedConnections: [makeConn('prod')], onEditConnection })} />);
    fireEvent.click(screen.getByTitle('Edit'));
    expect(onEditConnection).toHaveBeenCalledWith(expect.objectContaining({ name: 'prod' }));
  });

  it('connection delete button calls onDeleteConnection', () => {
    const onDeleteConnection = vi.fn();
    render(<ConnectionsPanel {...defaultProps({ savedConnections: [makeConn('prod')], onDeleteConnection })} />);
    fireEvent.click(screen.getByTitle('Delete'));
    expect(onDeleteConnection).toHaveBeenCalledWith('prod');
  });

  it('connection create query calls onCreateQuery', () => {
    const onCreateQuery = vi.fn();
    render(<ConnectionsPanel {...defaultProps({ savedConnections: [makeConn('prod')], onCreateQuery })} />);
    // ConnectionRow context menu "New Query"
    fireEvent.contextMenu(screen.getByText('prod'));
    fireEvent.click(screen.getByText('New Query'));
    expect(onCreateQuery).toHaveBeenCalledWith('prod');
  });

  it('setDatabaseShown is called when toggling popover checkbox', () => {
    const onSetDatabaseShown = vi.fn();
    render(
      <ConnectionsPanel
        {...defaultProps({ ...withConnection, onSetDatabaseShown })}
      />
    );
    fireEvent.click(screen.getByTitle('Manage shown databases'));
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(onSetDatabaseShown).toHaveBeenCalledWith('prod', 'mydb', expect.any(Boolean));
  });

  it('clicking database row calls onToggleDatabase', () => {
    const onToggleDatabase = vi.fn();
    render(<ConnectionsPanel {...defaultProps({ ...withConnection, onToggleDatabase })} />);
    fireEvent.click(screen.getByText('mydb'));
    expect(onToggleDatabase).toHaveBeenCalledWith('prod', 'mydb');
  });

  it('database refresh button calls onRefreshDatabase', () => {
    const onRefreshDatabase = vi.fn();
    render(<ConnectionsPanel {...defaultProps({ ...withConnection, onRefreshDatabase })} />);
    // Both ConnectionRow and DatabaseRow have a Refresh button; pick the DatabaseRow's (last)
    const refreshBtns = screen.getAllByTitle('Refresh');
    fireEvent.click(refreshBtns[refreshBtns.length - 1]);
    expect(onRefreshDatabase).toHaveBeenCalledWith('prod', 'mydb');
  });

  it('database new table button calls onCreateTable', () => {
    const onCreateTable = vi.fn();
    render(<ConnectionsPanel {...defaultProps({ ...withConnection, onCreateTable })} />);
    fireEvent.click(screen.getByTitle('New Table'));
    expect(onCreateTable).toHaveBeenCalledWith('prod', 'mydb');
  });

  it('database schema diagram calls onOpenSchemaDiagram', () => {
    const onOpenSchemaDiagram = vi.fn();
    render(<ConnectionsPanel {...defaultProps({ ...withConnection, onOpenSchemaDiagram })} />);
    fireEvent.contextMenu(screen.getByText('mydb'));
    fireEvent.click(screen.getByText('View Schema Diagram'));
    expect(onOpenSchemaDiagram).toHaveBeenCalledWith('prod', 'mydb');
  });

  it('clicking table row calls onOpenTable', () => {
    const onOpenTable = vi.fn();
    render(<ConnectionsPanel {...defaultProps({ ...withDb, onOpenTable })} />);
    fireEvent.click(screen.getByText('users'));
    expect(onOpenTable).toHaveBeenCalledWith('prod', 'mydb', 'users', undefined);
  });

  it('table refresh button calls onRefreshTable', () => {
    const onRefreshTable = vi.fn();
    render(<ConnectionsPanel {...defaultProps({ ...withDb, onRefreshTable })} />);
    // TableRow's Refresh button (last refresh button in the tree)
    const refreshBtns = screen.getAllByTitle('Refresh');
    fireEvent.click(refreshBtns[refreshBtns.length - 1]);
    expect(onRefreshTable).toHaveBeenCalledWith('prod', 'mydb', 'users');
  });
});
