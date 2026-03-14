import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SavedConnection } from '@/types';
import ConnectionRow from './ConnectionRow';

function makeConn(name = 'prod', dbType: SavedConnection['dbType'] = 'postgres'): SavedConnection {
  return { name, dbType, host: 'localhost', port: 5432, database: 'mydb', username: 'user' };
}

function defaultProps(overrides: Partial<Parameters<typeof ConnectionRow>[0]> = {}) {
  return {
    conn: makeConn(),
    isExpanded: false,
    isLoading: false,
    error: undefined,
    allDbs: undefined,
    shownDbs: [],
    onToggle: vi.fn(),
    onSetShown: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onCreateQuery: vi.fn(),
    onRefresh: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('ConnectionRow', () => {
  it('renders the connection name', () => {
    render(<ConnectionRow {...defaultProps()} />);
    expect(screen.getByText('prod')).toBeInTheDocument();
  });

  it('shows loading spinner when isLoading=true', () => {
    const { container } = render(<ConnectionRow {...defaultProps({ isLoading: true })} />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows error message when error prop provided', () => {
    render(<ConnectionRow {...defaultProps({ error: 'Auth failed' })} />);
    expect(screen.getByText('Auth failed')).toBeInTheDocument();
  });

  it('no error section when no error', () => {
    render(<ConnectionRow {...defaultProps()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('row click calls onToggle', () => {
    const onToggle = vi.fn();
    render(<ConnectionRow {...defaultProps({ onToggle })} />);
    fireEvent.click(screen.getByText('prod'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('refresh button calls onRefresh and stops propagation', () => {
    const onToggle = vi.fn();
    const onRefresh = vi.fn();
    render(<ConnectionRow {...defaultProps({ onToggle, onRefresh })} />);
    fireEvent.click(screen.getByTitle('Refresh'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('edit button calls onEdit and stops propagation', () => {
    const onToggle = vi.fn();
    const onEdit = vi.fn();
    render(<ConnectionRow {...defaultProps({ onToggle, onEdit })} />);
    fireEvent.click(screen.getByTitle('Edit'));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('delete button calls onDelete and stops propagation', () => {
    const onToggle = vi.fn();
    const onDelete = vi.fn();
    render(<ConnectionRow {...defaultProps({ onToggle, onDelete })} />);
    fireEvent.click(screen.getByTitle('Delete'));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('no badge when allDbs is undefined', () => {
    render(<ConnectionRow {...defaultProps({ allDbs: undefined })} />);
    expect(screen.queryByTitle('Manage shown databases')).toBeNull();
  });

  it('badge displays shownDbs.length/allDbs.length', () => {
    render(<ConnectionRow {...defaultProps({ allDbs: ['db1', 'db2', 'db3'], shownDbs: ['db1'] })} />);
    expect(screen.getByTitle('Manage shown databases')).toHaveTextContent('1/3');
  });

  it('badge click does NOT call onToggle (stops propagation)', () => {
    const onToggle = vi.fn();
    render(<ConnectionRow {...defaultProps({ allDbs: ['db1'], shownDbs: [], onToggle })} />);
    fireEvent.click(screen.getByTitle('Manage shown databases'));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('popover opens and shows all databases as checkboxes when badge clicked', () => {
    render(<ConnectionRow {...defaultProps({ allDbs: ['db1', 'db2'], shownDbs: ['db1'] })} />);
    fireEvent.click(screen.getByTitle('Manage shown databases'));
    expect(screen.getByLabelText('db1') ?? screen.getByText('db1')).toBeInTheDocument();
    expect(screen.getByText('db2')).toBeInTheDocument();
  });

  it('checkbox checked state matches shownDbs membership', () => {
    render(<ConnectionRow {...defaultProps({ allDbs: ['db1', 'db2'], shownDbs: ['db1'] })} />);
    fireEvent.click(screen.getByTitle('Manage shown databases'));
    const checkboxes = screen.getAllByRole('checkbox');
    const db1Checkbox = checkboxes.find((cb) => (cb as HTMLInputElement).closest('label')?.textContent?.includes('db1'));
    const db2Checkbox = checkboxes.find((cb) => (cb as HTMLInputElement).closest('label')?.textContent?.includes('db2'));
    expect(db1Checkbox).toBeChecked();
    expect(db2Checkbox).not.toBeChecked();
  });

  it('checkbox change calls onSetShown(db, checked)', () => {
    const onSetShown = vi.fn();
    render(<ConnectionRow {...defaultProps({ allDbs: ['db1', 'db2'], shownDbs: ['db1'], onSetShown })} />);
    fireEvent.click(screen.getByTitle('Manage shown databases'));
    const checkboxes = screen.getAllByRole('checkbox');
    const db2Checkbox = checkboxes.find((cb) => (cb as HTMLInputElement).closest('label')?.textContent?.includes('db2'))!;
    fireEvent.click(db2Checkbox);
    expect(onSetShown).toHaveBeenCalledWith('db2', true);
  });

  it('right-click opens context menu with expected items', () => {
    render(<ConnectionRow {...defaultProps()} />);
    fireEvent.contextMenu(screen.getByText('prod'));
    expect(screen.getByText('New Query')).toBeInTheDocument();
    expect(screen.getByText('Edit Connection')).toBeInTheDocument();
    expect(screen.getByText('Delete Connection')).toBeInTheDocument();
  });

  it('context menu Refresh calls onRefresh', () => {
    const onRefresh = vi.fn();
    render(<ConnectionRow {...defaultProps({ onRefresh })} />);
    fireEvent.contextMenu(screen.getByText('prod'));
    const items = screen.getAllByText('Refresh');
    fireEvent.click(items[items.length - 1]);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('context menu New Query calls onCreateQuery', () => {
    const onCreateQuery = vi.fn();
    render(<ConnectionRow {...defaultProps({ onCreateQuery })} />);
    fireEvent.contextMenu(screen.getByText('prod'));
    fireEvent.click(screen.getByText('New Query'));
    expect(onCreateQuery).toHaveBeenCalled();
  });

  it('context menu Edit Connection calls onEdit', () => {
    const onEdit = vi.fn();
    render(<ConnectionRow {...defaultProps({ onEdit })} />);
    fireEvent.contextMenu(screen.getByText('prod'));
    fireEvent.click(screen.getByText('Edit Connection'));
    expect(onEdit).toHaveBeenCalled();
  });

  it('context menu Delete Connection calls onDelete', () => {
    const onDelete = vi.fn();
    render(<ConnectionRow {...defaultProps({ onDelete })} />);
    fireEvent.contextMenu(screen.getByText('prod'));
    fireEvent.click(screen.getByText('Delete Connection'));
    expect(onDelete).toHaveBeenCalled();
  });
});
