import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SavedQueriesPanel from './SavedQueriesPanel';
import type { SavedQuery, SavedConnection } from '@/types';

function makeQuery(id: string, name: string, connectionName: string): SavedQuery {
  return { id, name, sql: 'SELECT 1', connectionName };
}

const connections: SavedConnection[] = [
  { name: 'prod', dbType: 'postgres', host: 'localhost', port: 5432, database: 'mydb', username: 'user' },
];

const defaultQueries = [
  makeQuery('1', 'Get Users', 'prod'),
  makeQuery('2', 'Get Orders', 'staging'),
];

function renderPanel(props: Partial<Parameters<typeof SavedQueriesPanel>[0]> = {}) {
  return render(
    <SavedQueriesPanel
      queries={defaultQueries}
      activeQueryId={null}
      onOpen={vi.fn()}
      onDelete={vi.fn()}
      onRename={vi.fn()}
      savedConnections={connections}
      {...props}
    />
  );
}

function getItemFor(name: string) {
  return screen.getByText(name).closest('[class*="flex items-center"]') as HTMLElement;
}

describe('SavedQueriesPanel', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders all queries', () => {
    renderPanel();
    expect(screen.getByText('Get Users')).toBeInTheDocument();
    expect(screen.getByText('Get Orders')).toBeInTheDocument();
  });

  it('search filters by name (case-insensitive)', () => {
    renderPanel();
    fireEvent.change(screen.getByPlaceholderText('Search…'), { target: { value: 'users' } });
    expect(screen.getByText('Get Users')).toBeInTheDocument();
    expect(screen.queryByText('Get Orders')).not.toBeInTheDocument();
  });

  it('search filters by connectionName', () => {
    renderPanel();
    fireEvent.change(screen.getByPlaceholderText('Search…'), { target: { value: 'staging' } });
    expect(screen.getByText('Get Orders')).toBeInTheDocument();
    expect(screen.queryByText('Get Users')).not.toBeInTheDocument();
  });

  it('dead connection label has destructive color class', () => {
    renderPanel();
    const connLabel = screen.getByText('staging');
    expect(connLabel.className).toContain('destructive');
  });

  it('dead connection has title "Connection no longer exists"', () => {
    renderPanel();
    const connLabel = screen.getByText('staging');
    expect(connLabel).toHaveAttribute('title', 'Connection no longer exists');
  });

  it('live connection label has no destructive class', () => {
    renderPanel();
    const connLabel = screen.getByText('prod');
    expect(connLabel.className).not.toContain('destructive');
    expect(connLabel).not.toHaveAttribute('title');
  });

  it('empty queries list shows empty-state text', () => {
    renderPanel({ queries: [] });
    expect(screen.getByText(/No queries yet/)).toBeInTheDocument();
  });

  it('empty queries list shows no search input', () => {
    renderPanel({ queries: [] });
    expect(screen.queryByPlaceholderText('Search…')).not.toBeInTheDocument();
  });

  it('single click calls onOpen with preview=true', () => {
    const onOpen = vi.fn();
    renderPanel({ onOpen });
    fireEvent.click(screen.getByText('Get Users'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), true);
  });

  it('double click calls onOpen with preview=false', () => {
    const onOpen = vi.fn();
    renderPanel({ onOpen });
    fireEvent.dblClick(screen.getByText('Get Users'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), false);
  });

  it('active query item has bg-accent class', () => {
    const { container } = renderPanel({ activeQueryId: '1' });
    const activeItem = container.querySelector('.bg-accent.text-accent-foreground');
    expect(activeItem).toBeInTheDocument();
  });

  describe('delete button', () => {
    it('calls onDelete with query id', () => {
      const onDelete = vi.fn();
      renderPanel({ onDelete });
      const item = getItemFor('Get Users');
      const deleteBtn = item.querySelectorAll('button')[1];
      fireEvent.click(deleteBtn);
      expect(onDelete).toHaveBeenCalledWith('1');
    });

    it('does not trigger onOpen when delete clicked', () => {
      const onOpen = vi.fn();
      const onDelete = vi.fn();
      renderPanel({ onOpen, onDelete });
      const item = getItemFor('Get Users');
      const deleteBtn = item.querySelectorAll('button')[1];
      fireEvent.click(deleteBtn);
      expect(onOpen).not.toHaveBeenCalled();
    });
  });

  describe('rename via pencil button', () => {
    it('shows inline input with current name when pencil clicked', () => {
      renderPanel();
      const item = getItemFor('Get Users');
      const renameBtn = item.querySelector('button[title="Rename"]')!;
      fireEvent.click(renameBtn);
      const input = item.querySelector('input') as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.value).toBe('Get Users');
    });

    it('calls onRename with trimmed name on Enter', () => {
      const onRename = vi.fn();
      renderPanel({ onRename });
      const item = getItemFor('Get Users');
      fireEvent.click(item.querySelector('button[title="Rename"]')!);
      const input = item.querySelector('input')!;
      fireEvent.change(input, { target: { value: '  Renamed  ' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onRename).toHaveBeenCalledWith('1', 'Renamed');
    });

    it('calls onRename on blur', () => {
      const onRename = vi.fn();
      renderPanel({ onRename });
      const item = getItemFor('Get Users');
      fireEvent.click(item.querySelector('button[title="Rename"]')!);
      const input = item.querySelector('input')!;
      fireEvent.change(input, { target: { value: 'Blurred' } });
      fireEvent.blur(input);
      expect(onRename).toHaveBeenCalledWith('1', 'Blurred');
    });

    it('cancels edit on Escape without calling onRename', () => {
      const onRename = vi.fn();
      renderPanel({ onRename });
      const item = getItemFor('Get Users');
      fireEvent.click(item.querySelector('button[title="Rename"]')!);
      const input = item.querySelector('input')!;
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(onRename).not.toHaveBeenCalled();
      expect(screen.getByText('Get Users')).toBeInTheDocument();
    });

    it('does not call onRename when name is blank', () => {
      const onRename = vi.fn();
      renderPanel({ onRename });
      const item = getItemFor('Get Users');
      fireEvent.click(item.querySelector('button[title="Rename"]')!);
      const input = item.querySelector('input')!;
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onRename).not.toHaveBeenCalled();
    });

    it('clicking input does not trigger onOpen', () => {
      const onOpen = vi.fn();
      renderPanel({ onOpen });
      const item = getItemFor('Get Users');
      fireEvent.click(item.querySelector('button[title="Rename"]')!);
      const input = item.querySelector('input')!;
      fireEvent.click(input);
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('single click on item row while editing does not call onOpen', () => {
      const onOpen = vi.fn();
      renderPanel({ onOpen });
      const item = getItemFor('Get Users');
      fireEvent.click(item.querySelector('button[title="Rename"]')!);
      fireEvent.click(item);
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('double click on item row while editing does not call onOpen', () => {
      const onOpen = vi.fn();
      renderPanel({ onOpen });
      const item = getItemFor('Get Users');
      fireEvent.click(item.querySelector('button[title="Rename"]')!);
      fireEvent.dblClick(item);
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('keyDown inside rename input stops propagation', () => {
      renderPanel();
      const item = getItemFor('Get Users');
      fireEvent.click(item.querySelector('button[title="Rename"]')!);
      const input = item.querySelector('input')!;
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      const spy = vi.spyOn(event, 'stopPropagation');
      input.dispatchEvent(event);
      expect(spy).toHaveBeenCalled();
    });

    it('scrolls editing item into view', () => {
      const scrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = scrollIntoView;
      renderPanel();
      const item = getItemFor('Get Users');
      fireEvent.click(item.querySelector('button[title="Rename"]')!);
      expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
    });
  });

  describe('pendingRenameId', () => {
    it('starts rename mode for the matching query', () => {
      const onRenameStarted = vi.fn();
      const { container } = renderPanel({ pendingRenameId: '2', onRenameStarted });
      // When editing, the name text is replaced by an input with the query's name as value
      const input = container.querySelector('input[value="Get Orders"]');
      expect(input).toBeInTheDocument();
      expect(onRenameStarted).toHaveBeenCalled();
    });

    it('does nothing when pendingRenameId is null', () => {
      const onRenameStarted = vi.fn();
      renderPanel({ pendingRenameId: null, onRenameStarted });
      expect(onRenameStarted).not.toHaveBeenCalled();
    });

    it('does nothing when pendingRenameId does not match any query', () => {
      const onRenameStarted = vi.fn();
      renderPanel({ pendingRenameId: 'nonexistent', onRenameStarted });
      expect(onRenameStarted).not.toHaveBeenCalled();
    });
  });
});
