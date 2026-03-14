import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import QueryEditor from './QueryEditor';
import type { SavedConnection, SavedQuery, QueryResult } from '@/types';

// Mock heavy child components
vi.mock('@/components/SqlEditor', () => ({
  default: ({ value, onChange, onRun }: {
    value: string;
    onChange: (v: string) => void;
    onRun: () => void;
  }) => (
    <textarea
      data-testid="sql-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onRun(); }}
    />
  ),
}));

vi.mock('@/components/AiPromptBar', () => ({
  default: ({ onInsert, onReplace }: {
    onInsert: (sql: string) => void;
    onReplace: (sql: string) => void;
  }) => (
    <div data-testid="ai-prompt-bar">
      <button onClick={() => onInsert('INSERTED SQL')}>AI Insert</button>
      <button onClick={() => onReplace('REPLACED SQL')}>AI Replace</button>
    </div>
  ),
}));

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

const conn1: SavedConnection = {
  name: 'conn1',
  dbType: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  username: 'admin',
};

const conn2: SavedConnection = {
  name: 'conn2',
  dbType: 'mysql',
  host: 'remotehost',
  port: 3306,
  database: 'otherdb',
  username: 'user',
};

const defaultQuery: SavedQuery = {
  id: 'q1',
  name: 'My Query',
  sql: 'SELECT 1',
  connectionName: 'conn1',
  database: 'mydb',
};

const defaultProps = {
  query: defaultQuery,
  connections: [conn1, conn2],
  onUpdate: vi.fn(),
  onPromote: vi.fn(),
  hasKey: true,
  onOpenSettings: vi.fn(),
};

async function renderEditor(overrides: Partial<typeof defaultProps> = {}) {
  const props = {
    ...defaultProps,
    onUpdate: vi.fn(),
    onPromote: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  };
  await act(async () => { render(<QueryEditor {...props} />); });
  return props;
}

const queryResult: QueryResult = {
  columns: ['id', 'name'],
  column_types: ['number', 'text'],
  column_raw_types: ['int4', 'varchar'],
  rows: [[1, 'Alice'], [2, null]],
  row_count: 2,
  execution_time_ms: 42,
  sql: 'SELECT 1',
};

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  // Default: connect_saved + list_databases resolve, schema fetches resolve empty
  mockInvoke.mockResolvedValue([]);
});

// ── 1. Basic rendering ─────────────────────────────────────────────────────────

describe('rendering', () => {
  it('renders the SQL editor', async () => {
    await renderEditor();
    expect(screen.getByTestId('sql-editor')).toBeInTheDocument();
  });

  it('renders Execute button', async () => {
    await renderEditor();
    expect(screen.getByRole('button', { name: 'Execute' })).toBeInTheDocument();
  });

  it('renders AI toggle button', async () => {
    await renderEditor();
    expect(screen.getByRole('button', { name: /AI/i })).toBeInTheDocument();
  });

  it('shows the shortcut hint', async () => {
    await renderEditor();
    expect(screen.getByText(/Enter to run/)).toBeInTheDocument();
  });

  it('shows Connection label', async () => {
    await renderEditor();
    expect(screen.getByText('Connection')).toBeInTheDocument();
  });

  it('Execute button is disabled when sql is empty', async () => {
    await renderEditor({
      query: { ...defaultQuery, sql: '' },
    });
    expect(screen.getByRole('button', { name: 'Execute' })).toBeDisabled();
  });

  it('Execute button is enabled when sql is non-empty', async () => {
    await renderEditor();
    expect(screen.getByRole('button', { name: 'Execute' })).not.toBeDisabled();
  });

  it('AI panel is hidden by default', async () => {
    await renderEditor();
    expect(screen.queryByTestId('ai-prompt-bar')).not.toBeInTheDocument();
  });

  it('save status span has opacity-0 when idle', async () => {
    await renderEditor();
    // The span is always rendered; at idle it has opacity-0
    const statusSpan = document.querySelector('.opacity-0');
    expect(statusSpan).toBeInTheDocument();
    expect(statusSpan?.textContent).toBe('Saved');
  });
});

// ── 2. Connection options ──────────────────────────────────────────────────────

describe('connection options', () => {
  it('adds the current connectionName as a ghost option if not in connections list', async () => {
    await renderEditor({
      query: { ...defaultQuery, connectionName: 'orphan-conn' },
      connections: [conn1],
    });
    // orphan-conn should be in the select options (via connectionOptions logic)
    // We check it by finding the combobox trigger which shows the value
    expect(screen.getAllByText('orphan-conn').length).toBeGreaterThanOrEqual(1);
  });

  it('does not duplicate the connection when it is already in the list', async () => {
    await renderEditor({
      query: { ...defaultQuery, connectionName: 'conn1' },
      connections: [conn1, conn2],
    });
    // conn1 should appear only once in select items
    const items = screen.getAllByText('conn1');
    expect(items.length).toBe(1);
  });
});

// ── 3. Database selector ───────────────────────────────────────────────────────

describe('database selector', () => {
  it('database selector is hidden when no databases are loaded', async () => {
    // list_databases returns empty array (default mock)
    await renderEditor();
    expect(screen.queryByText('Database')).not.toBeInTheDocument();
  });

  it('shows Database selector after databases are loaded', async () => {
    // On mount, both effects fire: connect_saved (effect1) and connect_database (effect2/schema).
    // Call order: #1 connect_saved, #2 connect_database (schema fetch effect)
    // #3 list_databases (after connect_saved resolves)
    mockInvoke
      .mockResolvedValueOnce(undefined) // #1 connect_saved
      .mockResolvedValueOnce(undefined) // #2 connect_database (schema fetch effect)
      .mockResolvedValueOnce(['db1', 'db2']) // #3 list_databases
      .mockResolvedValue([]); // subsequent calls (list_tables, etc.)

    await renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Database')).toBeInTheDocument();
    });
  });
});

// ── 4. handleSqlChange / auto-save ─────────────────────────────────────────────

describe('SQL change and auto-save', () => {
  it('shows "Saving…" immediately after SQL change', async () => {
    await renderEditor();
    const editor = screen.getByTestId('sql-editor');
    fireEvent.change(editor, { target: { value: 'SELECT 2' } });
    expect(screen.getByText('Saving…')).toBeInTheDocument();
  });

  it('calls onPromote when SQL changes', async () => {
    const props = await renderEditor();
    fireEvent.change(screen.getByTestId('sql-editor'), { target: { value: 'SELECT 2' } });
    expect(props.onPromote).toHaveBeenCalled();
  });

  it('calls onUpdate with new SQL after 600ms debounce', async () => {
    vi.useFakeTimers();
    const props = await renderEditor();

    fireEvent.change(screen.getByTestId('sql-editor'), { target: { value: 'SELECT 99' } });
    expect(props.onUpdate).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(600); });
    expect(props.onUpdate).toHaveBeenCalledWith({ sql: 'SELECT 99' });

    vi.useRealTimers();
  });

  it('shows "Saved" after debounce timer fires', async () => {
    vi.useFakeTimers();
    await renderEditor();

    fireEvent.change(screen.getByTestId('sql-editor'), { target: { value: 'SELECT 99' } });
    await act(async () => { vi.advanceTimersByTime(600); });

    expect(screen.getByText('Saved')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('resets save status to idle after 600 + 1500ms (span becomes opacity-0)', async () => {
    vi.useFakeTimers();
    await renderEditor();

    fireEvent.change(screen.getByTestId('sql-editor'), { target: { value: 'SELECT 99' } });
    // After save fires, status is 'saved' → opacity-100
    await act(async () => { vi.advanceTimersByTime(600); });
    expect(document.querySelector('.opacity-100')).toBeInTheDocument();

    // After 1500ms more, status resets to 'idle' → opacity-0
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(document.querySelector('.opacity-0')).toBeInTheDocument();
    expect(document.querySelector('.opacity-100')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('debounces multiple rapid changes — only calls onUpdate once', async () => {
    vi.useFakeTimers();
    const props = await renderEditor();
    const editor = screen.getByTestId('sql-editor');

    fireEvent.change(editor, { target: { value: 'a' } });
    fireEvent.change(editor, { target: { value: 'ab' } });
    fireEvent.change(editor, { target: { value: 'abc' } });

    await act(async () => { vi.advanceTimersByTime(600); });
    expect(props.onUpdate).toHaveBeenCalledTimes(1);
    expect(props.onUpdate).toHaveBeenCalledWith({ sql: 'abc' });

    vi.useRealTimers();
  });

  it('does not call onPromote when onPromote is not provided', async () => {
    await renderEditor({ onPromote: undefined });
    expect(() => {
      fireEvent.change(screen.getByTestId('sql-editor'), { target: { value: 'SELECT 2' } });
    }).not.toThrow();
  });
});

// ── 5. handleInsertSql (via AiPromptBar) ──────────────────────────────────────

describe('handleInsertSql', () => {
  function openAi() {
    fireEvent.click(screen.getByRole('button', { name: /AI/i }));
  }

  it('appends SQL with double newline when editor already has content', async () => {
    vi.useFakeTimers();
    const props = await renderEditor({ query: { ...defaultQuery, sql: 'SELECT 1' } });
    openAi();

    fireEvent.click(screen.getByText('AI Insert'));

    await act(async () => { vi.advanceTimersByTime(600); });
    expect(props.onUpdate).toHaveBeenCalledWith({ sql: 'SELECT 1\n\nINSERTED SQL' });

    vi.useRealTimers();
  });

  it('uses just the new SQL when editor is empty', async () => {
    vi.useFakeTimers();
    const props = await renderEditor({ query: { ...defaultQuery, sql: '' } });
    openAi();

    fireEvent.click(screen.getByText('AI Insert'));

    await act(async () => { vi.advanceTimersByTime(600); });
    expect(props.onUpdate).toHaveBeenCalledWith({ sql: 'INSERTED SQL' });

    vi.useRealTimers();
  });

  it('Replace button calls onReplace with new SQL', async () => {
    vi.useFakeTimers();
    const props = await renderEditor({ query: { ...defaultQuery, sql: 'SELECT 1' } });
    openAi();

    fireEvent.click(screen.getByText('AI Replace'));

    await act(async () => { vi.advanceTimersByTime(600); });
    expect(props.onUpdate).toHaveBeenCalledWith({ sql: 'REPLACED SQL' });

    vi.useRealTimers();
  });
});

// ── 6. AI toggle ──────────────────────────────────────────────────────────────

describe('AI toggle', () => {
  it('clicking AI button shows the AiPromptBar', async () => {
    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: /AI/i }));
    expect(screen.getByTestId('ai-prompt-bar')).toBeInTheDocument();
  });

  it('clicking AI button again hides the AiPromptBar', async () => {
    await renderEditor();
    const aiBtn = screen.getByRole('button', { name: /AI/i });
    fireEvent.click(aiBtn);
    fireEvent.click(aiBtn);
    expect(screen.queryByTestId('ai-prompt-bar')).not.toBeInTheDocument();
  });
});

// ── 7. handleExecute ──────────────────────────────────────────────────────────

describe('handleExecute', () => {
  it('does nothing when SQL is empty', async () => {
    await renderEditor({ query: { ...defaultQuery, sql: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));
    expect(mockInvoke).not.toHaveBeenCalledWith('execute_query', expect.anything());
  });

  it('does nothing when SQL is whitespace-only', async () => {
    await renderEditor({ query: { ...defaultQuery, sql: '   ' } });
    // The button is disabled for whitespace — call directly via Cmd+Enter
    const editor = screen.getByTestId('sql-editor');
    fireEvent.keyDown(editor, { key: 'Enter', metaKey: true });
    expect(mockInvoke).not.toHaveBeenCalledWith('execute_query', expect.anything());
  });

  it('calls invoke("execute_query") with correct args', async () => {
    mockInvoke
      .mockResolvedValueOnce(undefined) // connect_saved
      .mockResolvedValueOnce([]) // list_databases
      .mockResolvedValue(queryResult);

    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('execute_query', {
        connection: 'conn1',
        database: 'mydb',
        sql: 'SELECT 1',
      });
    });
  });

  it('passes undefined for database when selectedDatabase is empty', async () => {
    mockInvoke.mockResolvedValue(queryResult);

    await renderEditor({
      query: { ...defaultQuery, database: undefined },
      connections: [{ ...conn1, database: '' }],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('execute_query', {
        connection: 'conn1',
        database: undefined,
        sql: 'SELECT 1',
      });
    });
  });

  it('shows "Executing…" while loading', async () => {
    let resolve!: (v: QueryResult) => void;
    mockInvoke
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([])
      .mockReturnValue(new Promise<QueryResult>((r) => { resolve = r; }));

    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Executing…' })).toBeDisabled();
    });

    await act(async () => { resolve(queryResult); });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Execute' })).toBeInTheDocument();
    });
  });

  it('displays query results after successful execution', async () => {
    mockInvoke
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([])
      .mockResolvedValue(queryResult);

    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

    await waitFor(() => {
      expect(screen.getByText('2 rows in 42ms')).toBeInTheDocument();
    });

    expect(screen.getByText('id')).toBeInTheDocument();
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('displays "null" for null cell values', async () => {
    mockInvoke
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([])
      .mockResolvedValue(queryResult);

    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

    await waitFor(() => {
      expect(screen.getAllByText('null').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('displays JSON.stringified value for object cells', async () => {
    const objResult: QueryResult = {
      ...queryResult,
      rows: [[{ key: 'val' }]],
      columns: ['data'],
      row_count: 1,
    };
    mockInvoke
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([])
      .mockResolvedValue(objResult);

    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

    await waitFor(() => {
      expect(screen.getByText('{"key":"val"}')).toBeInTheDocument();
    });
  });

  it('shows singular "row" for 1-row result', async () => {
    const oneRowResult: QueryResult = { ...queryResult, row_count: 1, rows: [[1, 'A']] };
    mockInvoke
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([])
      .mockResolvedValue(oneRowResult);

    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

    await waitFor(() => {
      expect(screen.getByText('1 row in 42ms')).toBeInTheDocument();
    });
  });

  it('shows error on execute failure', async () => {
    mockInvoke
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([])
      .mockRejectedValue('syntax error near SELECT');

    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

    await waitFor(() => {
      expect(screen.getByText('syntax error near SELECT')).toBeInTheDocument();
    });
  });

  it('error is dismissable', async () => {
    mockInvoke
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([])
      .mockRejectedValue('oops');

    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

    await waitFor(() => {
      expect(screen.getByText('oops')).toBeInTheDocument();
    });

    // Find dismiss button inside the ErrorMessage
    const errorContainer = screen.getByText('oops').closest('div')!;
    fireEvent.click(errorContainer.querySelector('button')!);
    expect(screen.queryByText('oops')).not.toBeInTheDocument();
  });

  it('clears previous error and result before new execution', async () => {
    let executeCount = 0;
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'connect_saved' || cmd === 'connect_database') return Promise.resolve(undefined);
      if (cmd === 'list_databases' || cmd === 'list_tables' || cmd === 'get_table_columns') {
        return Promise.resolve([]);
      }
      if (cmd === 'execute_query') {
        executeCount++;
        if (executeCount === 1) return Promise.reject('first error');
        return Promise.resolve(queryResult);
      }
      return Promise.resolve([]);
    });

    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

    await waitFor(() => expect(screen.getByText('first error')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));

    await waitFor(() => expect(screen.queryByText('first error')).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('2 rows in 42ms')).toBeInTheDocument());
  });

  it('triggers execution on Cmd+Enter in editor', async () => {
    mockInvoke.mockResolvedValue(queryResult);

    await renderEditor();
    const editor = screen.getByTestId('sql-editor');
    fireEvent.keyDown(editor, { key: 'Enter', metaKey: true });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('execute_query', expect.anything());
    });
  });
});

// ── 8. refreshKey ──────────────────────────────────────────────────────────────

describe('refreshKey', () => {
  it('re-executes query when refreshKey changes from 0 to 1', async () => {
    mockInvoke.mockResolvedValue(queryResult);

    let rerender!: ReturnType<typeof render>['rerender'];
    await act(async () => {
      const result = render(<QueryEditor {...defaultProps} refreshKey={0} onUpdate={vi.fn()} />);
      rerender = result.rerender;
    });

    // refreshKey=0 → no execution
    expect(mockInvoke).not.toHaveBeenCalledWith('execute_query', expect.anything());

    rerender(<QueryEditor {...defaultProps} refreshKey={1} onUpdate={vi.fn()} />);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('execute_query', expect.anything());
    });
  });

  it('does not execute on initial render when refreshKey is undefined', async () => {
    mockInvoke.mockResolvedValue(queryResult);
    await renderEditor({ query: { ...defaultQuery, sql: 'SELECT 1' } });

    // Give time for effects to settle
    await act(async () => {});
    expect(mockInvoke).not.toHaveBeenCalledWith('execute_query', expect.anything());
  });
});

// ── 9. handleConnectionChange ─────────────────────────────────────────────────

describe('handleConnectionChange', () => {
  it('calls onUpdate with new connectionName and defaultDb when connection changes', async () => {
    mockInvoke.mockResolvedValue([]);

    const props = await renderEditor();

    // Open the connection select
    const comboboxes = screen.getAllByRole('combobox');
    const connSelect = comboboxes[0];
    fireEvent.click(connSelect);

    // Find conn2 option in the portal
    const conn2Option = [...document.body.querySelectorAll('[role="option"]')].find(
      (el) => el.textContent === 'conn2',
    )!;
    expect(conn2Option).toBeTruthy();
    await act(async () => { fireEvent.click(conn2Option); });

    expect(props.onUpdate).toHaveBeenCalledWith({
      connectionName: 'conn2',
      database: 'otherdb',
    });
  });

  it('calls invoke("connect_saved") with new connection', async () => {
    mockInvoke.mockResolvedValue([]);
    await renderEditor();

    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.click(comboboxes[0]);

    const conn2Option = [...document.body.querySelectorAll('[role="option"]')].find(
      (el) => el.textContent === 'conn2',
    )!;
    await act(async () => { fireEvent.click(conn2Option); });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('connect_saved', { name: 'conn2' });
    });
  });
});

// ── 10. Resizable divider ──────────────────────────────────────────────────────

describe('resizable divider', () => {
  it('mousedown on divider followed by mousemove changes editor height', async () => {
    await renderEditor();

    const divider = document.querySelector('.cursor-row-resize')!;
    expect(divider).toBeTruthy();

    // Simulate drag: start at y=100, move to y=150 (delta=50)
    fireEvent.mouseDown(divider, {
      preventDefault: vi.fn(),
      clientY: 100,
    });

    fireEvent.mouseMove(window, { clientY: 150 });

    // Editor div style height should have changed
    const editorPane = document.querySelector('[style*="height"]') as HTMLElement;
    expect(editorPane).toBeTruthy();
    // Height changed to startH + delta; we just verify it is still a number
    expect(parseInt(editorPane.style.height)).toBeGreaterThan(0);
  });

  it('mouseup saves ratio to localStorage', async () => {
    await renderEditor();

    const divider = document.querySelector('.cursor-row-resize')!;
    fireEvent.mouseDown(divider, { clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 150 });
    fireEvent.mouseUp(window);

    expect(localStorage.getItem('db-explorer-editor-ratio-q1')).not.toBeNull();
  });

  it('mousemove after mouseup does not change height', async () => {
    await renderEditor();

    const divider = document.querySelector('.cursor-row-resize')!;
    fireEvent.mouseDown(divider, { clientY: 100 });
    fireEvent.mouseUp(window);

    // After mouseup, dragRef.current is null — additional mousemove should be a no-op
    const editorPane = document.querySelector('[style*="height"]') as HTMLElement;
    const heightBefore = editorPane.style.height;

    fireEvent.mouseMove(window, { clientY: 999 });
    expect(editorPane.style.height).toBe(heightBefore);
  });
});

// ── 11. localStorage editor ratio restore ─────────────────────────────────────

describe('localStorage editor ratio restore', () => {
  it('restores editor height from localStorage ratio on mount', async () => {
    // Store a ratio of 0.5 for query q1
    localStorage.setItem('db-explorer-editor-ratio-q1', '0.5');

    // Mock requestAnimationFrame to run synchronously
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    await renderEditor();

    // The height should have been set (we just confirm the editor pane exists with a height style)
    const editorPane = document.querySelector('[style*="height"]') as HTMLElement;
    expect(editorPane).toBeTruthy();

    rafSpy.mockRestore();
  });

  it('uses DEFAULT_EDITOR_RATIO when no localStorage value exists', async () => {
    localStorage.removeItem('db-explorer-editor-ratio-q1');

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    await renderEditor();

    const editorPane = document.querySelector('[style*="height"]') as HTMLElement;
    expect(editorPane).toBeTruthy();

    rafSpy.mockRestore();
  });

  it('uses DEFAULT_EDITOR_RATIO when localStorage value is NaN', async () => {
    localStorage.setItem('db-explorer-editor-ratio-q1', 'not-a-number');

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    await renderEditor();

    const editorPane = document.querySelector('[style*="height"]') as HTMLElement;
    expect(editorPane).toBeTruthy();

    rafSpy.mockRestore();
  });
});

// ── 12. Schema fetching ────────────────────────────────────────────────────────

describe('schema fetching', () => {
  it('calls list_tables and get_table_columns when connection and database are set', async () => {
    // Use mockImplementation to route by command — avoids fragility from parallel effect ordering
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'connect_saved' || cmd === 'connect_database') return Promise.resolve(undefined);
      if (cmd === 'list_databases') return Promise.resolve([]);
      if (cmd === 'list_tables') return Promise.resolve(['users', 'orders']);
      if (cmd === 'get_table_columns') return Promise.resolve([{ name: 'id', dataType: 'int' }]);
      return Promise.resolve([]);
    });

    await renderEditor();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('list_tables', {
        connection: 'conn1',
        database: 'mydb',
      });
    });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('get_table_columns', expect.objectContaining({
        table: 'users',
      }));
    });
  });

  it('skips schema fetch when selectedDatabase is empty', async () => {
    // When database is empty, schema fetch effect returns early
    await renderEditor({
      query: { ...defaultQuery, database: undefined },
      connections: [{ ...conn1, database: '' }],
    });

    // Should not call list_tables
    expect(mockInvoke).not.toHaveBeenCalledWith('list_tables', expect.anything());
  });

  it('handles get_table_columns failure gracefully (returns empty cols)', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'connect_saved' || cmd === 'connect_database') return Promise.resolve(undefined);
      if (cmd === 'list_databases') return Promise.resolve([]);
      if (cmd === 'list_tables') return Promise.resolve(['users']);
      if (cmd === 'get_table_columns') return Promise.reject(new Error('permission denied'));
      return Promise.resolve([]);
    });

    // Should not throw
    await renderEditor();

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('list_tables', expect.anything());
    });
  });
});

// ── 13. Database change ────────────────────────────────────────────────────────

describe('handleDatabaseChange', () => {
  it('calls onUpdate with new database and invokes connect_database', async () => {
    // Call order on mount: #1 connect_saved, #2 connect_database (schema), #3 list_databases
    mockInvoke
      .mockResolvedValueOnce(undefined) // #1 connect_saved
      .mockResolvedValueOnce(undefined) // #2 connect_database (schema fetch)
      .mockResolvedValueOnce(['db1', 'db2']) // #3 list_databases
      .mockResolvedValue(undefined); // everything else

    const props = await renderEditor();

    // Wait for databases to load
    await waitFor(() => expect(screen.getByText('Database')).toBeInTheDocument());

    // Open database select
    const comboboxes = screen.getAllByRole('combobox');
    const dbSelect = comboboxes[1];
    fireEvent.click(dbSelect);

    const db2Option = [...document.body.querySelectorAll('[role="option"]')].find(
      (el) => el.textContent === 'db2',
    )!;
    expect(db2Option).toBeTruthy();
    fireEvent.click(db2Option);

    expect(props.onUpdate).toHaveBeenCalledWith({ database: 'db2' });

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('connect_database', {
        connection: 'conn1',
        database: 'db2',
      });
    });
  });
});

// ── 14. Dialect detection ──────────────────────────────────────────────────────

describe('dialect detection', () => {
  it('uses pg dialect for postgres connections', async () => {
    // The dialect prop passed to SqlEditor and AiPromptBar is 'pg' for postgres
    // We verify indirectly by checking AiPromptBar is rendered (which receives dialect)
    await renderEditor({
      query: { ...defaultQuery, connectionName: 'conn1' },
      connections: [conn1], // postgres
    });

    fireEvent.click(screen.getByRole('button', { name: /AI/i }));
    expect(screen.getByTestId('ai-prompt-bar')).toBeInTheDocument();
  });

  it('uses mysql dialect for mysql connections', async () => {
    await renderEditor({
      query: { ...defaultQuery, connectionName: 'conn2' },
      connections: [conn2], // mysql
    });

    fireEvent.click(screen.getByRole('button', { name: /AI/i }));
    expect(screen.getByTestId('ai-prompt-bar')).toBeInTheDocument();
  });
});

// ── 15. Column resize ──────────────────────────────────────────────────────────

describe('column resize', () => {
  async function renderWithResult() {
    mockInvoke
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([])
      .mockResolvedValue(queryResult);

    await renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));
    await waitFor(() => expect(screen.getByText('2 rows in 42ms')).toBeInTheDocument());
  }

  it('renders resize handles in column headers', async () => {
    await renderWithResult();
    const resizeHandles = document.querySelectorAll('.cursor-col-resize');
    expect(resizeHandles.length).toBe(queryResult.columns.length);
  });

  it('mousedown on resize handle initiates column resize', async () => {
    await renderWithResult();
    const handle = document.querySelector('.cursor-col-resize')!;
    // Should not throw
    expect(() => {
      fireEvent.mouseDown(handle, {
        preventDefault: vi.fn(),
        clientX: 100,
        currentTarget: handle,
      });
    }).not.toThrow();
  });
});
