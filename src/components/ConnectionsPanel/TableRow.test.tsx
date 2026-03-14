import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TableRow from './TableRow';

function defaultProps(overrides: Partial<Parameters<typeof TableRow>[0]> = {}) {
  return {
    table: 'users',
    isActive: false,
    onOpen: vi.fn(),
    onRefresh: vi.fn(),
    onRenameClick: vi.fn(),
    onDropClick: vi.fn(),
    onAddColumnClick: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('TableRow', () => {
  it('renders the table name', () => {
    render(<TableRow {...defaultProps()} />);
    expect(screen.getByText('users')).toBeInTheDocument();
  });

  it('applies active classes when isActive=true', () => {
    const { container } = render(<TableRow {...defaultProps({ isActive: true })} />);
    const row = container.querySelector('.bg-accent.text-accent-foreground.font-medium');
    expect(row).toBeInTheDocument();
  });

  it('applies text-foreground when isActive=false', () => {
    const { container } = render(<TableRow {...defaultProps({ isActive: false })} />);
    const row = container.querySelector('.text-foreground');
    expect(row).toBeInTheDocument();
    expect(container.querySelector('.bg-accent')).toBeNull();
  });

  it('single click calls onOpen with no args', () => {
    const onOpen = vi.fn();
    render(<TableRow {...defaultProps({ onOpen })} />);
    fireEvent.click(screen.getByText('users'));
    expect(onOpen).toHaveBeenCalledWith();
  });

  it('double click calls onOpen(false)', () => {
    const onOpen = vi.fn();
    render(<TableRow {...defaultProps({ onOpen })} />);
    fireEvent.dblClick(screen.getByText('users'));
    expect(onOpen).toHaveBeenCalledWith(false);
  });

  it('refresh button click calls onRefresh and stops propagation (no onOpen)', () => {
    const onOpen = vi.fn();
    const onRefresh = vi.fn();
    render(<TableRow {...defaultProps({ onOpen, onRefresh })} />);
    fireEvent.click(screen.getByTitle('Refresh'));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('rename button click calls onRenameClick and stops propagation', () => {
    const onOpen = vi.fn();
    const onRenameClick = vi.fn();
    render(<TableRow {...defaultProps({ onOpen, onRenameClick })} />);
    fireEvent.click(screen.getByTitle('Rename'));
    expect(onRenameClick).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('drop button click calls onDropClick and stops propagation', () => {
    const onOpen = vi.fn();
    const onDropClick = vi.fn();
    render(<TableRow {...defaultProps({ onOpen, onDropClick })} />);
    fireEvent.click(screen.getByTitle('Drop'));
    expect(onDropClick).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('right-click opens context menu with expected items', () => {
    render(<TableRow {...defaultProps()} />);
    fireEvent.contextMenu(screen.getByText('users'));
    expect(screen.getAllByText('Refresh').length).toBeGreaterThan(0);
    expect(screen.getByText('Add Column')).toBeInTheDocument();
    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Drop Table')).toBeInTheDocument();
  });

  it('context menu Refresh calls onRefresh', () => {
    const onRefresh = vi.fn();
    render(<TableRow {...defaultProps({ onRefresh })} />);
    fireEvent.contextMenu(screen.getByText('users'));
    // There are two "Refresh" elements (button + context menu); click the last one
    const items = screen.getAllByText('Refresh');
    fireEvent.click(items[items.length - 1]);
    expect(onRefresh).toHaveBeenCalled();
  });

  it('context menu Add Column calls onAddColumnClick', () => {
    const onAddColumnClick = vi.fn();
    render(<TableRow {...defaultProps({ onAddColumnClick })} />);
    fireEvent.contextMenu(screen.getByText('users'));
    fireEvent.click(screen.getByText('Add Column'));
    expect(onAddColumnClick).toHaveBeenCalled();
  });

  it('context menu Rename calls onRenameClick', () => {
    const onRenameClick = vi.fn();
    render(<TableRow {...defaultProps({ onRenameClick })} />);
    fireEvent.contextMenu(screen.getByText('users'));
    fireEvent.click(screen.getByText('Rename'));
    expect(onRenameClick).toHaveBeenCalled();
  });

  it('context menu Drop Table calls onDropClick', () => {
    const onDropClick = vi.fn();
    render(<TableRow {...defaultProps({ onDropClick })} />);
    fireEvent.contextMenu(screen.getByText('users'));
    fireEvent.click(screen.getByText('Drop Table'));
    expect(onDropClick).toHaveBeenCalled();
  });
});
