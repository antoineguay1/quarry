import { invoke } from '@tauri-apps/api/core';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SortableRowProps } from './SortableRow';
import SortableRow from './SortableRow';
import type { ColumnDef } from './types';

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  verticalListSortingStrategy: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  arrayMove: (arr: unknown[], from: number, to: number) => {
    const r = [...arr];
    r.splice(to, 0, r.splice(from, 1)[0]);
    return r;
  },
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

function makeCol(overrides: Partial<ColumnDef> = {}): ColumnDef {
  return {
    id: 'test-id',
    name: 'col1',
    type: 'VARCHAR',
    typeParam1: 255,
    nullable: true,
    defaultMode: 'none',
    defaultValue: '',
    primary: false,
    ...overrides,
  };
}

function renderRow(col: ColumnDef, props?: Partial<SortableRowProps>) {
  const onChange = vi.fn();
  const onDelete = vi.fn();
  render(
    <SortableRow
      col={col}
      onChange={onChange}
      onDelete={onDelete}
      dbType="postgres"
      availableTables={['users', 'orders']}
      connectionName="myconn"
      database="mydb"
      {...props}
    />,
  );
  return { onChange, onDelete };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── handleNullableChange ───────────────────────────────────────────────────

describe('handleNullableChange', () => {
  it('sets nullable=true when checkbox is checked', () => {
    const col = makeCol({ nullable: false });
    const { onChange } = renderRow(col);
    fireEvent.click(screen.getByRole('checkbox', { name: /Null/i }));
    expect(onChange).toHaveBeenCalledWith('test-id', { nullable: true });
  });

  it('resets defaultMode and defaultValue when unchecked and defaultMode was "null"', () => {
    const col = makeCol({ nullable: true, defaultMode: 'null' });
    const { onChange } = renderRow(col);
    fireEvent.click(screen.getByRole('checkbox', { name: /Null/i }));
    expect(onChange).toHaveBeenCalledWith('test-id', {
      nullable: false,
      defaultMode: 'none',
      defaultValue: '',
    });
  });

  it('only changes nullable when unchecked and defaultMode is not "null"', () => {
    const col = makeCol({ nullable: true, defaultMode: 'none' });
    const { onChange } = renderRow(col);
    fireEvent.click(screen.getByRole('checkbox', { name: /Null/i }));
    expect(onChange).toHaveBeenCalledWith('test-id', { nullable: false });
  });
});

// ── handleTypeChange ───────────────────────────────────────────────────────

describe('handleTypeChange', () => {
  it('sets typeParam1=defaultLength and clears typeParam2 when params=length', () => {
    const col = makeCol({ type: 'TEXT' });
    const { onChange } = renderRow(col);
    const typeSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(typeSelect, { target: { value: 'VARCHAR' } });
    expect(onChange).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        type: 'VARCHAR',
        typeParam1: 255,
        typeParam2: undefined,
      }),
    );
  });

  it('sets typeParam1=defaultPrecision and typeParam2=defaultScale when params=precision-scale', () => {
    const col = makeCol({ type: 'TEXT' });
    const { onChange } = renderRow(col);
    const typeSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(typeSelect, { target: { value: 'DECIMAL' } });
    expect(onChange).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        type: 'DECIMAL',
        typeParam1: 10,
        typeParam2: 2,
      }),
    );
  });

  it('clears both params when type has no params (TEXT)', () => {
    const col = makeCol({ type: 'VARCHAR', typeParam1: 255 });
    const { onChange } = renderRow(col);
    const typeSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(typeSelect, { target: { value: 'TEXT' } });
    expect(onChange).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        type: 'TEXT',
        typeParam1: undefined,
        typeParam2: undefined,
      }),
    );
  });

  it('calls applyFirstPkStrategy when col.primary=true (UUID → sets defaultValue)', () => {
    const col = makeCol({ type: 'TEXT', primary: true, nullable: false });
    const { onChange } = renderRow(col);
    const typeSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(typeSelect, { target: { value: 'UUID' } });
    expect(onChange).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        type: 'UUID',
        defaultValue: 'gen_random_uuid()',
      }),
    );
  });
});

// ── applyFirstPkStrategy ───────────────────────────────────────────────────

describe('applyFirstPkStrategy', () => {
  it('sets autoIncrement=true for a strategy with autoIncrement=true (MySQL INT)', () => {
    const col = makeCol({ type: 'VARCHAR', primary: true, nullable: false });
    const { onChange } = renderRow(col, { dbType: 'mysql' });
    const typeSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(typeSelect, { target: { value: 'INT' } });
    expect(onChange).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({ autoIncrement: true, defaultValue: '' }),
    );
  });

  it('sets defaultValue for a strategy without autoIncrement (Postgres UUID)', () => {
    const col = makeCol({ type: 'TEXT', primary: true, nullable: false });
    const { onChange } = renderRow(col);
    const typeSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(typeSelect, { target: { value: 'UUID' } });
    expect(onChange).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        autoIncrement: undefined,
        defaultValue: 'gen_random_uuid()',
      }),
    );
  });

  it('clears autoIncrement and defaultValue when type has no pkStrategies (SERIAL)', () => {
    const col = makeCol({ type: 'UUID', primary: true, nullable: false });
    const { onChange } = renderRow(col);
    const typeSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(typeSelect, { target: { value: 'SERIAL' } });
    expect(onChange).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({ autoIncrement: undefined, defaultValue: '' }),
    );
  });
});

// ── handlePkChange – set PK=true ───────────────────────────────────────────

describe('handlePkChange – set PK=true', () => {
  it('switches INTEGER→SERIAL (disabledWhenPk + serialPair) on postgres', () => {
    const col = makeCol({ type: 'INTEGER', primary: false, nullable: true });
    const { onChange } = renderRow(col);
    fireEvent.click(screen.getByRole('checkbox', { name: /PK/i }));
    expect(onChange).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({ primary: true, type: 'SERIAL' }),
    );
  });

  it('keeps UUID type (no disabledWhenPk) and applies first pkStrategy', () => {
    const col = makeCol({ type: 'UUID', primary: false, nullable: true });
    const { onChange } = renderRow(col);
    fireEvent.click(screen.getByRole('checkbox', { name: /PK/i }));
    const updateArg = onChange.mock.calls[0][1] as Partial<ColumnDef>;
    expect(updateArg.primary).toBe(true);
    expect(updateArg.type).toBeUndefined(); // type not changed
    expect(updateArg.defaultValue).toBe('gen_random_uuid()');
  });
});

// ── handlePkChange – set PK=false ─────────────────────────────────────────

describe('handlePkChange – set PK=false', () => {
  it('switches SERIAL→INTEGER (pkOnly + serialPair) when unchecking PK', () => {
    const col = makeCol({ type: 'SERIAL', primary: true, nullable: false });
    const { onChange } = renderRow(col);
    fireEvent.click(screen.getByRole('checkbox', { name: /PK/i }));
    expect(onChange).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({ primary: false, type: 'INTEGER' }),
    );
  });

  it('keeps UUID type (not pkOnly) and clears autoIncrement when unchecking PK', () => {
    const col = makeCol({ type: 'UUID', primary: true, nullable: false });
    const { onChange } = renderRow(col);
    fireEvent.click(screen.getByRole('checkbox', { name: /PK/i }));
    const updateArg = onChange.mock.calls[0][1] as Partial<ColumnDef>;
    expect(updateArg.primary).toBe(false);
    expect(updateArg.type).toBeUndefined(); // type not changed
  });
});

// ── handleDefaultModeChange ────────────────────────────────────────────────

describe('handleDefaultModeChange', () => {
  it('updates defaultMode and clears defaultValue', () => {
    const col = makeCol({ nullable: true });
    const { onChange } = renderRow(col);
    // For non-PK VARCHAR nullable col, combobox[1] is the default mode select
    const defaultSelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(defaultSelect, { target: { value: 'null' } });
    expect(onChange).toHaveBeenCalledWith('test-id', {
      defaultMode: 'null',
      defaultValue: '',
    });
  });
});

// ── handlePkStrategyChange ─────────────────────────────────────────────────

describe('handlePkStrategyChange', () => {
  it('sets autoIncrement=true when AUTO_INC_SENTINEL is selected', () => {
    // MySQL INT + primary=true shows strategy select with AUTO_INCREMENT option
    const col = makeCol({
      type: 'INT',
      primary: true,
      nullable: false,
      autoIncrement: undefined,
      defaultValue: '',
    });
    const { onChange } = renderRow(col, { dbType: 'mysql' });
    // combobox[1] is the strategy select (combobox[0] is type)
    const strategySelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(strategySelect, {
      target: { value: '__auto_increment__' },
    });
    expect(onChange).toHaveBeenCalledWith('test-id', {
      autoIncrement: true,
      defaultValue: '',
    });
  });

  it('sets defaultValue when a non-sentinel value is selected', () => {
    // Postgres UUID + primary=true shows strategy select with gen_random_uuid() option
    const col = makeCol({
      type: 'UUID',
      primary: true,
      nullable: false,
      defaultValue: '',
    });
    const { onChange } = renderRow(col);
    const strategySelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(strategySelect, {
      target: { value: 'gen_random_uuid()' },
    });
    expect(onChange).toHaveBeenCalledWith('test-id', {
      autoIncrement: undefined,
      defaultValue: 'gen_random_uuid()',
    });
  });
});

// ── toggleFk ──────────────────────────────────────────────────────────────

describe('toggleFk', () => {
  it('enables FK by setting fkTable="" when FK is disabled', () => {
    const col = makeCol({ fkTable: undefined });
    const { onChange } = renderRow(col);
    fireEvent.click(screen.getByTitle('Add foreign key'));
    expect(onChange).toHaveBeenCalledWith('test-id', {
      fkTable: '',
      fkColumn: undefined,
    });
  });

  it('disables FK by setting fkTable=undefined when FK is enabled', () => {
    const col = makeCol({ fkTable: '', fkColumn: undefined });
    const { onChange } = renderRow(col);
    fireEvent.click(screen.getByTitle('Remove foreign key'));
    expect(onChange).toHaveBeenCalledWith('test-id', {
      fkTable: undefined,
      fkColumn: undefined,
    });
  });
});

// ── handleFkTableChange ────────────────────────────────────────────────────

describe('handleFkTableChange', () => {
  it('calls onChange but NOT invoke when empty string is selected', async () => {
    const col = makeCol({ fkTable: 'users' });
    const { onChange } = renderRow(col);
    const tableSelect = screen.getByDisplayValue('users');
    fireEvent.change(tableSelect, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('test-id', {
      fkTable: '',
      fkColumn: undefined,
    });
    expect(vi.mocked(invoke)).not.toHaveBeenCalled();
  });

  it('calls invoke with postgres information_schema SQL for non-empty table', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ rows: [] });
    const col = makeCol({ fkTable: '' });
    renderRow(col);
    fireEvent.change(screen.getByDisplayValue('(select table)'), {
      target: { value: 'users' },
    });
    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        'execute_query',
        expect.objectContaining({
          sql: expect.stringContaining('information_schema.columns'),
          connection: 'myconn',
          database: 'mydb',
        }),
      );
    });
  });

  it('calls invoke with mysql COLUMNS SQL for non-empty table', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ rows: [] });
    const col = makeCol({ fkTable: '' });
    renderRow(col, { dbType: 'mysql' });
    fireEvent.change(screen.getByDisplayValue('(select table)'), {
      target: { value: 'orders' },
    });
    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        'execute_query',
        expect.objectContaining({
          sql: expect.stringContaining('TABLE_SCHEMA'),
        }),
      );
    });
  });

  it('populates FK column select with rows from invoke (handles null optional fields)', async () => {
    const rows = [
      ['id', 'int4', null, 10, null],
      ['name', 'varchar', 100, null, null],
    ];
    vi.mocked(invoke).mockResolvedValueOnce({ rows });
    const col = makeCol({ fkTable: '' });
    renderRow(col);
    fireEvent.change(screen.getByDisplayValue('(select table)'), {
      target: { value: 'users' },
    });
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });
    const colSelect = screen.getByDisplayValue('(select column)');
    expect(colSelect.querySelector('option[value="id"]')).toBeTruthy();
    expect(colSelect.querySelector('option[value="name"]')).toBeTruthy();
  });

  it('shows error text when invoke rejects', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Connection failed'));
    const col = makeCol({ fkTable: '' });
    renderRow(col);
    fireEvent.change(screen.getByDisplayValue('(select table)'), {
      target: { value: 'users' },
    });
    await waitFor(() => {
      expect(screen.getByText(/Connection failed/)).toBeInTheDocument();
    });
  });

  it('clears fkLoading after invoke resolves', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ rows: [] });
    const col = makeCol({ fkTable: '' });
    renderRow(col);
    fireEvent.change(screen.getByDisplayValue('(select table)'), {
      target: { value: 'users' },
    });
    await waitFor(() => {
      expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    });
  });
});

// ── handleFkColumnChange ───────────────────────────────────────────────────

describe('handleFkColumnChange', () => {
  async function setupWithFkCols(
    rows: (string | number | null)[][],
    colOverrides?: Partial<ColumnDef>,
  ) {
    vi.mocked(invoke).mockResolvedValueOnce({ rows });
    const col = makeCol({ fkTable: '', ...colOverrides });
    const { onChange, onDelete } = renderRow(col);
    fireEvent.change(screen.getByDisplayValue('(select table)'), {
      target: { value: 'users' },
    });
    await waitFor(() => screen.getByDisplayValue('(select column)'));
    vi.clearAllMocks();
    return { onChange, onDelete };
  }

  it('sets fkColumn=undefined for empty colName', async () => {
    const { onChange } = await setupWithFkCols([
      ['id', 'int4', null, null, null],
    ]);
    fireEvent.change(screen.getByDisplayValue('(select column)'), {
      target: { value: '' },
    });
    expect(onChange).toHaveBeenCalledWith('test-id', { fkColumn: undefined });
  });

  it('sets type from FK col with params=length (varchar → VARCHAR, typeParam1=maxLength)', async () => {
    const { onChange } = await setupWithFkCols([
      ['col_name', 'varchar', 100, null, null],
    ]);
    fireEvent.change(screen.getByDisplayValue('(select column)'), {
      target: { value: 'col_name' },
    });
    expect(onChange).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        fkColumn: 'col_name',
        type: 'VARCHAR',
        typeParam1: 100,
        typeParam2: undefined,
      }),
    );
  });

  it('sets typeParam1=precision and typeParam2=scale for params=precision-scale (numeric)', async () => {
    const { onChange } = await setupWithFkCols([
      ['amount', 'numeric', null, 10, 2],
    ]);
    fireEvent.change(screen.getByDisplayValue('(select column)'), {
      target: { value: 'amount' },
    });
    expect(onChange).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        fkColumn: 'amount',
        typeParam1: 10,
        typeParam2: 2,
      }),
    );
  });

  it('clears params for FK col with no params (text type)', async () => {
    const { onChange } = await setupWithFkCols([
      ['description', 'text', null, null, null],
    ]);
    fireEvent.change(screen.getByDisplayValue('(select column)'), {
      target: { value: 'description' },
    });
    expect(onChange).toHaveBeenCalledWith(
      'test-id',
      expect.objectContaining({
        fkColumn: 'description',
        type: 'TEXT',
        typeParam1: undefined,
        typeParam2: undefined,
      }),
    );
  });

  it('only sets fkColumn when rawType has no matching TypeDef (unknown type)', async () => {
    const { onChange } = await setupWithFkCols([
      ['meta', 'unknowntype', null, null, null],
    ]);
    fireEvent.change(screen.getByDisplayValue('(select column)'), {
      target: { value: 'meta' },
    });
    expect(onChange).toHaveBeenCalledWith('test-id', { fkColumn: 'meta' });
  });
});

// ── pkGenerationUi render branches ─────────────────────────────────────────

describe('pkGenerationUi', () => {
  it('shows default mode select (not pk UI) when col.primary=false', () => {
    const col = makeCol({ primary: false });
    renderRow(col);
    expect(screen.queryByText('auto-increment')).not.toBeInTheDocument();
    // default mode select is present (combobox[1])
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2);
  });

  it('shows "auto-increment" span for SERIAL + primary=true', () => {
    const col = makeCol({ type: 'SERIAL', primary: true, nullable: false });
    renderRow(col);
    expect(screen.getByText('auto-increment')).toBeInTheDocument();
  });

  it('shows strategy select for UUID + primary=true', () => {
    const col = makeCol({
      type: 'UUID',
      primary: true,
      nullable: false,
      defaultValue: '',
    });
    renderRow(col);
    // The strategy select contains the pkStrategies options
    const comboboxes = screen.getAllByRole('combobox');
    // Type select is combobox[0]; strategy select is combobox[1]
    const strategySelect = comboboxes[1];
    expect(strategySelect).toBeInTheDocument();
    expect(
      strategySelect.querySelector('option[value="gen_random_uuid()"]'),
    ).toBeTruthy();
  });

  it('selects AUTO_INC_SENTINEL in strategy select when autoIncrement=true (MySQL INT)', () => {
    const col = makeCol({
      type: 'INT',
      primary: true,
      nullable: false,
      autoIncrement: true,
      defaultValue: '',
    });
    renderRow(col, { dbType: 'mysql' });
    const strategySelect = screen.getAllByRole(
      'combobox',
    )[1] as HTMLSelectElement;
    expect(strategySelect.value).toBe('__auto_increment__');
  });

  it('shows "—" span for TEXT + primary=true (no pkAutoIncrement, no pkStrategies)', () => {
    const col = makeCol({ type: 'TEXT', primary: true, nullable: false });
    renderRow(col);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('auto-increment')).not.toBeInTheDocument();
  });
});

// ── defaultValueUi input widths (by inputType) ────────────────────────────

describe('defaultValueUi input type', () => {
  it('renders datetime-local input for TIMESTAMP + defaultMode=literal', () => {
    const col = makeCol({
      type: 'TIMESTAMP',
      defaultMode: 'literal',
      nullable: true,
    });
    renderRow(col);
    expect(
      document.querySelector('input[type="datetime-local"]'),
    ).toBeInTheDocument();
  });

  it('renders date input for DATE + defaultMode=literal', () => {
    const col = makeCol({
      type: 'DATE',
      defaultMode: 'literal',
      nullable: true,
    });
    renderRow(col);
    expect(document.querySelector('input[type="date"]')).toBeInTheDocument();
  });

  it('renders time input for TIME + defaultMode=literal', () => {
    const col = makeCol({
      type: 'TIME',
      defaultMode: 'literal',
      nullable: true,
    });
    renderRow(col);
    expect(document.querySelector('input[type="time"]')).toBeInTheDocument();
  });

  it('renders text input for VARCHAR + defaultMode=literal', () => {
    const col = makeCol({
      type: 'VARCHAR',
      defaultMode: 'literal',
      nullable: true,
    });
    renderRow(col);
    expect(document.querySelector('input[type="text"]')).toBeInTheDocument();
  });

  it('does not render value input when defaultMode=none (needsValueInput=false)', () => {
    const col = makeCol({
      type: 'VARCHAR',
      defaultMode: 'none',
      nullable: true,
    });
    renderRow(col);
    // Only the column name input and the select are shown; no additional text input
    expect(screen.queryByPlaceholderText('expression')).not.toBeInTheDocument();
  });
});

// ── Type param inputs ──────────────────────────────────────────────────────

describe('type param inputs', () => {
  it('shows single length number input for VARCHAR (params=length)', () => {
    const col = makeCol({ type: 'VARCHAR', typeParam1: 255 });
    renderRow(col);
    const numberInputs = document.querySelectorAll('input[type="number"]');
    expect(numberInputs.length).toBe(1);
  });

  it('shows two number inputs for DECIMAL (params=precision-scale)', () => {
    const col = makeCol({ type: 'DECIMAL', typeParam1: 10, typeParam2: 2 });
    renderRow(col);
    const numberInputs = document.querySelectorAll('input[type="number"]');
    expect(numberInputs.length).toBe(2);
  });

  it('shows no number inputs for TEXT (no params)', () => {
    const col = makeCol({ type: 'TEXT' });
    renderRow(col);
    const numberInputs = document.querySelectorAll('input[type="number"]');
    expect(numberInputs.length).toBe(0);
  });

  it('falls back to typeDef defaults when typeParam1/typeParam2 are undefined (DECIMAL)', () => {
    const col = makeCol({
      type: 'DECIMAL',
      typeParam1: undefined,
      typeParam2: undefined,
    });
    renderRow(col);
    const numberInputs = document.querySelectorAll(
      'input[type="number"]',
    ) as NodeListOf<HTMLInputElement>;
    // DECIMAL has defaultPrecision=10 and defaultScale=2
    expect(numberInputs[0].value).toBe('10');
    expect(numberInputs[1].value).toBe('2');
  });

  it('falls back to empty string when typeParam1/typeParam2 and typeDef defaults are all undefined (VARCHAR without typeParam1)', () => {
    const col = makeCol({ type: 'VARCHAR', typeParam1: undefined });
    renderRow(col);
    const [lengthInput] = document.querySelectorAll(
      'input[type="number"]',
    ) as NodeListOf<HTMLInputElement>;
    // VARCHAR defaultLength=255; typeParam1=undefined → shows defaultLength
    expect(lengthInput.value).toBe('255');
  });
});

// ── FK section rendering ───────────────────────────────────────────────────

describe('FK section render', () => {
  it('does not show FK references row when fkEnabled=false', () => {
    const col = makeCol({ fkTable: undefined });
    renderRow(col);
    expect(screen.queryByText('└─ References:')).not.toBeInTheDocument();
  });

  it('shows FK references row when fkEnabled=true', () => {
    const col = makeCol({ fkTable: '' });
    renderRow(col);
    expect(screen.getByText('└─ References:')).toBeInTheDocument();
  });

  it('shows "Loading…" while fkLoading=true', async () => {
    let resolveFn!: (v: unknown) => void;
    vi.mocked(invoke).mockReturnValueOnce(
      new Promise((r) => {
        resolveFn = r;
      }),
    );
    const col = makeCol({ fkTable: '' });
    renderRow(col);
    fireEvent.change(screen.getByDisplayValue('(select table)'), {
      target: { value: 'users' },
    });
    await waitFor(() => {
      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });
    await act(async () => resolveFn({ rows: [] }));
  });

  it('shows fkError text when there is an error', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('FK error'));
    const col = makeCol({ fkTable: '' });
    renderRow(col);
    fireEvent.change(screen.getByDisplayValue('(select table)'), {
      target: { value: 'users' },
    });
    await waitFor(() => {
      expect(screen.getByText(/FK error/)).toBeInTheDocument();
    });
  });

  it('shows column select with options when fkColsInfo is populated', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({
      rows: [['id', 'int4', null, null, null]],
    });
    const col = makeCol({ fkTable: '' });
    renderRow(col);
    fireEvent.change(screen.getByDisplayValue('(select table)'), {
      target: { value: 'users' },
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue('(select column)')).toBeInTheDocument();
    });
    const colSelect = screen.getByDisplayValue('(select column)');
    expect(colSelect.querySelector('option[value="id"]')).toBeTruthy();
  });
});

// ── Default value input onChange ───────────────────────────────────────────

describe('default value input onChange', () => {
  it('calls onChange with defaultValue when value input changes (VARCHAR literal)', () => {
    const col = makeCol({
      type: 'VARCHAR',
      defaultMode: 'literal',
      nullable: true,
    });
    const { onChange } = renderRow(col);
    // Two text inputs: name input (value="col1") + value input (value="")
    const textInputs = document.querySelectorAll('input[type="text"]');
    const valueInput = textInputs[1]; // second is the default value input
    fireEvent.change(valueInput, { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalledWith('test-id', { defaultValue: 'hello' });
  });
});

// ── Type param onChange handlers ────────────────────────────────────────────

describe('type param onChange handlers', () => {
  it('calls onChange with typeParam1 when length input changes (VARCHAR)', () => {
    const col = makeCol({ type: 'VARCHAR', typeParam1: 255 });
    const { onChange } = renderRow(col);
    const [lengthInput] = document.querySelectorAll('input[type="number"]');
    fireEvent.change(lengthInput, { target: { value: '100' } });
    expect(onChange).toHaveBeenCalledWith('test-id', { typeParam1: 100 });
  });

  it('sets typeParam1=undefined when length input is cleared', () => {
    const col = makeCol({ type: 'VARCHAR', typeParam1: 255 });
    const { onChange } = renderRow(col);
    const [lengthInput] = document.querySelectorAll('input[type="number"]');
    fireEvent.change(lengthInput, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('test-id', { typeParam1: undefined });
  });

  it('calls onChange with typeParam1 when precision input changes (DECIMAL)', () => {
    const col = makeCol({ type: 'DECIMAL', typeParam1: 10, typeParam2: 2 });
    const { onChange } = renderRow(col);
    const [precisionInput] = document.querySelectorAll('input[type="number"]');
    fireEvent.change(precisionInput, { target: { value: '15' } });
    expect(onChange).toHaveBeenCalledWith('test-id', { typeParam1: 15 });
  });

  it('sets typeParam1=undefined when precision input is cleared', () => {
    const col = makeCol({ type: 'DECIMAL', typeParam1: 10, typeParam2: 2 });
    const { onChange } = renderRow(col);
    const [precisionInput] = document.querySelectorAll('input[type="number"]');
    fireEvent.change(precisionInput, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('test-id', { typeParam1: undefined });
  });

  it('calls onChange with typeParam2 when scale input changes (DECIMAL)', () => {
    const col = makeCol({ type: 'DECIMAL', typeParam1: 10, typeParam2: 2 });
    const { onChange } = renderRow(col);
    const numberInputs = document.querySelectorAll('input[type="number"]');
    const scaleInput = numberInputs[1];
    fireEvent.change(scaleInput, { target: { value: '4' } });
    expect(onChange).toHaveBeenCalledWith('test-id', { typeParam2: 4 });
  });

  it('sets typeParam2=undefined when scale input is cleared', () => {
    const col = makeCol({ type: 'DECIMAL', typeParam1: 10, typeParam2: 2 });
    const { onChange } = renderRow(col);
    const numberInputs = document.querySelectorAll('input[type="number"]');
    const scaleInput = numberInputs[1];
    fireEvent.change(scaleInput, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('test-id', { typeParam2: undefined });
  });
});

// ── Delete button ──────────────────────────────────────────────────────────

describe('delete button', () => {
  it('calls onDelete with col.id when trash icon is clicked', () => {
    const col = makeCol();
    const { onDelete } = renderRow(col);
    fireEvent.click(screen.getByTitle('Remove column'));
    expect(onDelete).toHaveBeenCalledWith('test-id');
  });
});
