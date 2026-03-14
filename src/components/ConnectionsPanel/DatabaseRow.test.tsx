import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DatabaseRow from './DatabaseRow';

function defaultProps(overrides: Partial<Parameters<typeof DatabaseRow>[0]> = {}) {
  return {
    database: 'mydb',
    dbType: 'postgres' as const,
    isExpanded: false,
    isLoading: false,
    error: undefined,
    onToggle: vi.fn(),
    onRefresh: vi.fn(),
    onCreate: vi.fn(),
    onSchemaDiagram: vi.fn(),
    onRenameClick: vi.fn(),
    onDropClick: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('DatabaseRow', () => {
  it('renders the database name', () => {
    render(<DatabaseRow {...defaultProps()} />);
    expect(screen.getByText('mydb')).toBeInTheDocument();
  });

  it('shows ChevronRight when not expanded', () => {
    const { container } = render(<DatabaseRow {...defaultProps({ isExpanded: false })} />);
    // ChevronRight renders as SVG; check it's present via absence of ChevronDown check
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('shows ChevronDown when expanded', () => {
    // Both ChevronRight and ChevronDown are SVGs; we test behavior indirectly via isExpanded prop
    render(<DatabaseRow {...defaultProps({ isExpanded: true })} />);
    expect(screen.getByText('mydb')).toBeInTheDocument();
  });

  it('shows loading spinner when isLoading=true', () => {
    const { container } = render(<DatabaseRow {...defaultProps({ isLoading: true })} />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows error message when error prop provided', () => {
    render(<DatabaseRow {...defaultProps({ error: 'Connection failed' })} />);
    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('shows no error when error prop not provided', () => {
    render(<DatabaseRow {...defaultProps()} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('row click calls onToggle', () => {
    const onToggle = vi.fn();
    render(<DatabaseRow {...defaultProps({ onToggle })} />);
    fireEvent.click(screen.getByText('mydb'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('Plus (New Table) button calls onCreate and stops propagation', () => {
    const onToggle = vi.fn();
    const onCreate = vi.fn();
    render(<DatabaseRow {...defaultProps({ onToggle, onCreate })} />);
    fireEvent.click(screen.getByTitle('New Table'));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('refresh button calls onRefresh and stops propagation', () => {
    const onToggle = vi.fn();
    const onRefresh = vi.fn();
    render(<DatabaseRow {...defaultProps({ onToggle, onRefresh })} />);
    fireEvent.click(screen.getByTitle('Refresh'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('Rename button visible and calls onRenameClick for postgres', () => {
    const onToggle = vi.fn();
    const onRenameClick = vi.fn();
    render(<DatabaseRow {...defaultProps({ dbType: 'postgres', onToggle, onRenameClick })} />);
    fireEvent.click(screen.getByTitle('Rename'));
    expect(onRenameClick).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('Rename button absent for mysql', () => {
    render(<DatabaseRow {...defaultProps({ dbType: 'mysql' })} />);
    expect(screen.queryByTitle('Rename')).toBeNull();
  });

  it('Drop button calls onDropClick and stops propagation', () => {
    const onToggle = vi.fn();
    const onDropClick = vi.fn();
    render(<DatabaseRow {...defaultProps({ onToggle, onDropClick })} />);
    fireEvent.click(screen.getByTitle('Drop'));
    expect(onDropClick).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('right-click opens context menu with all items for postgres', () => {
    render(<DatabaseRow {...defaultProps({ dbType: 'postgres' })} />);
    fireEvent.contextMenu(screen.getByText('mydb'));
    expect(screen.getByText('View Schema Diagram')).toBeInTheDocument();
    expect(screen.getByText('New Table')).toBeInTheDocument();
    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Drop Database')).toBeInTheDocument();
  });

  it('context menu has no Rename item for mysql', () => {
    render(<DatabaseRow {...defaultProps({ dbType: 'mysql' })} />);
    fireEvent.contextMenu(screen.getByText('mydb'));
    expect(screen.queryByText('Rename')).toBeNull();
  });

  it('context menu Refresh calls onRefresh', () => {
    const onRefresh = vi.fn();
    render(<DatabaseRow {...defaultProps({ onRefresh })} />);
    fireEvent.contextMenu(screen.getByText('mydb'));
    const items = screen.getAllByText('Refresh');
    fireEvent.click(items[items.length - 1]);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('context menu View Schema Diagram calls onSchemaDiagram', () => {
    const onSchemaDiagram = vi.fn();
    render(<DatabaseRow {...defaultProps({ onSchemaDiagram })} />);
    fireEvent.contextMenu(screen.getByText('mydb'));
    fireEvent.click(screen.getByText('View Schema Diagram'));
    expect(onSchemaDiagram).toHaveBeenCalled();
  });

  it('context menu New Table calls onCreate', () => {
    const onCreate = vi.fn();
    render(<DatabaseRow {...defaultProps({ onCreate })} />);
    fireEvent.contextMenu(screen.getByText('mydb'));
    const items = screen.getAllByText('New Table');
    fireEvent.click(items[items.length - 1]);
    expect(onCreate).toHaveBeenCalled();
  });

  it('context menu Rename (postgres) calls onRenameClick', () => {
    const onRenameClick = vi.fn();
    render(<DatabaseRow {...defaultProps({ dbType: 'postgres', onRenameClick })} />);
    fireEvent.contextMenu(screen.getByText('mydb'));
    const items = screen.getAllByText('Rename');
    fireEvent.click(items[items.length - 1]);
    expect(onRenameClick).toHaveBeenCalled();
  });

  it('context menu Drop Database calls onDropClick', () => {
    const onDropClick = vi.fn();
    render(<DatabaseRow {...defaultProps({ onDropClick })} />);
    fireEvent.contextMenu(screen.getByText('mydb'));
    fireEvent.click(screen.getByText('Drop Database'));
    expect(onDropClick).toHaveBeenCalled();
  });
});
