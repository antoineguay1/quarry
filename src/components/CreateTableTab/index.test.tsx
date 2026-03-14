import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import CreateTableTab from './index';

// Capture the onDragEnd prop so we can trigger it in tests
const dndCallbacks: { onDragEnd?: (e: { active: { id: string }; over: { id: string } | null }) => void } = {};

vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd?: (e: unknown) => void }) => {
    dndCallbacks.onDragEnd = onDragEnd as typeof dndCallbacks.onDragEnd;
    return children;
  },
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

const defaultProps = {
  connectionName: 'myconn',
  database: 'mydb',
  dbType: 'postgres' as const,
  availableTables: ['users', 'orders'],
  onCreated: vi.fn(),
  onClose: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CreateTableTab', () => {
  describe('initialization', () => {
    it('shows table name input with default value "new_table"', () => {
      render(<CreateTableTab {...defaultProps} />);
      expect(screen.getByDisplayValue('new_table')).toBeInTheDocument();
    });

    it('shows database and dbType badge', () => {
      render(<CreateTableTab {...defaultProps} />);
      expect(screen.getByText('mydb · postgres')).toBeInTheDocument();
    });

    it('initializes with SERIAL id column for postgres (SQL preview shows SERIAL)', () => {
      render(<CreateTableTab {...defaultProps} />);
      fireEvent.click(screen.getByText('Generated SQL'));
      expect(document.querySelector('pre')!.textContent).toContain('SERIAL');
    });

    it('initializes with INT id column with AUTO_INCREMENT for mysql (SQL preview)', () => {
      render(<CreateTableTab {...defaultProps} dbType="mysql" />);
      fireEvent.click(screen.getByText('Generated SQL'));
      expect(document.querySelector('pre')!.textContent).toContain('AUTO_INCREMENT');
    });
  });

  it('updates table name when input changes', () => {
    render(<CreateTableTab {...defaultProps} />);
    const input = screen.getByDisplayValue('new_table') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'my_table' } });
    expect(input.value).toBe('my_table');
  });

  it('adds a new column row when "Add column" is clicked', () => {
    render(<CreateTableTab {...defaultProps} />);
    const before = screen.getAllByPlaceholderText('column_name').length;
    fireEvent.click(screen.getByText('Add column'));
    expect(screen.getAllByPlaceholderText('column_name').length).toBe(before + 1);
  });

  describe('SQL preview toggle', () => {
    it('hides SQL pre element initially', () => {
      render(<CreateTableTab {...defaultProps} />);
      expect(document.querySelector('pre')).toBeNull();
    });

    it('shows SQL after clicking "Generated SQL"', () => {
      render(<CreateTableTab {...defaultProps} />);
      fireEvent.click(screen.getByText('Generated SQL'));
      expect(document.querySelector('pre')).toBeInTheDocument();
    });

    it('hides SQL again after clicking "Generated SQL" twice', () => {
      render(<CreateTableTab {...defaultProps} />);
      fireEvent.click(screen.getByText('Generated SQL'));
      fireEvent.click(screen.getByText('Generated SQL'));
      expect(document.querySelector('pre')).toBeNull();
    });
  });

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<CreateTableTab {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Create Table button is disabled when tableName is blank (spaces only)', () => {
    render(<CreateTableTab {...defaultProps} />);
    fireEvent.change(screen.getByDisplayValue('new_table'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Create Table' })).toBeDisabled();
  });

  it('Create Table button is disabled when all columns are deleted', () => {
    render(<CreateTableTab {...defaultProps} />);
    const trashBtns = screen.getAllByTitle('Remove column');
    for (const btn of trashBtns) {
      fireEvent.click(btn);
    }
    expect(screen.getByRole('button', { name: 'Create Table' })).toBeDisabled();
  });

  it('calls invoke("execute_ddl") with correct args on create', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    render(<CreateTableTab {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Table' }));
    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith(
        'execute_ddl',
        expect.objectContaining({ connection: 'myconn', database: 'mydb' }),
      );
    });
  });

  it('calls onCreated with trimmed tableName after successful invoke', async () => {
    const onCreated = vi.fn();
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    render(<CreateTableTab {...defaultProps} onCreated={onCreated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Table' }));
    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('new_table');
    });
  });

  it('shows error message when invoke rejects', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('DB error'));
    render(<CreateTableTab {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Table' }));
    await waitFor(() => {
      expect(screen.getByText(/DB error/)).toBeInTheDocument();
    });
  });

  it('re-enables Create Table button after invoke failure', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('DB error'));
    render(<CreateTableTab {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Table' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create Table' })).not.toBeDisabled();
    });
  });

  it('shows "Creating…" text while invoke is pending', async () => {
    let resolveFn!: () => void;
    vi.mocked(invoke).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveFn = resolve;
      }),
    );
    render(<CreateTableTab {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Table' }));
    await waitFor(() => {
      expect(screen.getByText('Creating…')).toBeInTheDocument();
    });
    resolveFn();
  });

  it('disables Cancel button while loading', async () => {
    let resolveFn!: () => void;
    vi.mocked(invoke).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveFn = resolve;
      }),
    );
    render(<CreateTableTab {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Table' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });
    resolveFn();
  });

  it('handleChange: updating a column name input updates the generated SQL', () => {
    render(<CreateTableTab {...defaultProps} />);
    // The second column is "name" (VARCHAR); change its name to trigger handleChange
    const nameInputs = screen.getAllByPlaceholderText('column_name');
    fireEvent.change(nameInputs[0], { target: { value: 'email' } });
    fireEvent.click(screen.getByText('Generated SQL'));
    expect(document.querySelector('pre')!.textContent).toContain('email');
  });

  it('handleDragEnd: triggers when active.id !== over.id (columns reorder)', () => {
    // Mock crypto.randomUUID to get predictable IDs for the initial columns
    vi.spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('col-id-1' as ReturnType<typeof crypto.randomUUID>)
      .mockReturnValueOnce('col-name-1' as ReturnType<typeof crypto.randomUUID>);

    render(<CreateTableTab {...defaultProps} />);

    // Trigger drag end — swap the two initial columns
    act(() => {
      dndCallbacks.onDragEnd?.({ active: { id: 'col-id-1' }, over: { id: 'col-name-1' } });
    });

    // After reorder, the SQL should still be generated (no crash)
    fireEvent.click(screen.getByText('Generated SQL'));
    expect(document.querySelector('pre')!.textContent).toContain('CREATE TABLE');

    vi.restoreAllMocks();
  });

  it('handleDragEnd: does nothing when over is null', () => {
    render(<CreateTableTab {...defaultProps} />);
    act(() => {
      dndCallbacks.onDragEnd?.({ active: { id: 'any' }, over: null });
    });
    // Component still renders normally
    expect(screen.getByDisplayValue('new_table')).toBeInTheDocument();
  });

  it('handleDragEnd: does nothing when active.id === over.id', () => {
    render(<CreateTableTab {...defaultProps} />);
    act(() => {
      dndCallbacks.onDragEnd?.({ active: { id: 'same' }, over: { id: 'same' } });
    });
    expect(screen.getByDisplayValue('new_table')).toBeInTheDocument();
  });
});
