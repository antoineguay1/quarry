import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SavedConnection } from '@/types';
import Sidebar from './Sidebar';

const pgConn: SavedConnection = {
  name: 'prod-pg',
  dbType: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  username: 'admin',
};

const mysqlConn: SavedConnection = {
  name: 'dev-mysql',
  dbType: 'mysql',
  host: 'localhost',
  port: 3306,
  database: 'dev',
  username: 'root',
};

function renderSidebar(overrides: Partial<React.ComponentProps<typeof Sidebar>> = {}) {
  const props = {
    activePanel: 'connections' as const,
    sidebarWidth: 224,
    onResizeStart: vi.fn(),
    onNewConnection: vi.fn(),
    showConnPicker: false,
    onToggleConnPicker: vi.fn(),
    savedConnections: [],
    onCreateQuery: vi.fn(),
    children: <div data-testid="panel-content">content</div>,
    ...overrides,
  };
  return { ...render(<Sidebar {...props} />), props };
}

describe('Sidebar', () => {
  describe('panel header — connections', () => {
    it('shows "Connections" label', () => {
      renderSidebar({ activePanel: 'connections' });
      expect(screen.getByText('Connections')).toBeTruthy();
    });

    it('renders a New Connection button with correct title', () => {
      renderSidebar({ activePanel: 'connections' });
      expect(screen.getByTitle('New Connection')).toBeTruthy();
    });

    it('calls onNewConnection when button clicked', () => {
      const { props } = renderSidebar({ activePanel: 'connections' });
      fireEvent.click(screen.getByTitle('New Connection'));
      expect(props.onNewConnection).toHaveBeenCalledTimes(1);
    });

    it('does not render "Queries" or "Settings" label', () => {
      renderSidebar({ activePanel: 'connections' });
      expect(screen.queryByText('Queries')).toBeNull();
      expect(screen.queryByText('Settings')).toBeNull();
    });
  });

  describe('panel header — queries', () => {
    it('shows "Queries" label', () => {
      renderSidebar({ activePanel: 'queries' });
      expect(screen.getByText('Queries')).toBeTruthy();
    });

    it('renders a New Query button with correct title', () => {
      renderSidebar({ activePanel: 'queries' });
      expect(screen.getByTitle('New Query')).toBeTruthy();
    });

    it('calls onToggleConnPicker when New Query button clicked', () => {
      const { props } = renderSidebar({ activePanel: 'queries' });
      fireEvent.click(screen.getByTitle('New Query'));
      expect(props.onToggleConnPicker).toHaveBeenCalledTimes(1);
    });

    it('applies bg-accent class to button when showConnPicker is true', () => {
      renderSidebar({ activePanel: 'queries', showConnPicker: true });
      const btn = screen.getByTitle('New Query');
      // Check for the bare token (not 'hover:bg-accent' which is always present)
      expect(btn.className.split(/\s+/)).toContain('bg-accent');
    });

    it('does not apply bg-accent class when showConnPicker is false', () => {
      renderSidebar({ activePanel: 'queries', showConnPicker: false });
      const btn = screen.getByTitle('New Query');
      expect(btn.className.split(/\s+/)).not.toContain('bg-accent');
    });
  });

  describe('panel header — settings', () => {
    it('shows "Settings" label', () => {
      renderSidebar({ activePanel: 'settings' });
      expect(screen.getByText('Settings')).toBeTruthy();
    });

    it('does not render a + button', () => {
      renderSidebar({ activePanel: 'settings' });
      expect(screen.queryByTitle('New Connection')).toBeNull();
      expect(screen.queryByTitle('New Query')).toBeNull();
    });
  });

  describe('connection picker', () => {
    it('is hidden when activePanel is connections', () => {
      renderSidebar({
        activePanel: 'connections',
        showConnPicker: true,
        savedConnections: [pgConn],
      });
      expect(screen.queryByText('prod-pg')).toBeNull();
    });

    it('is hidden when showConnPicker is false', () => {
      renderSidebar({
        activePanel: 'queries',
        showConnPicker: false,
        savedConnections: [pgConn],
      });
      expect(screen.queryByText('prod-pg')).toBeNull();
    });

    it('shows "No connections saved yet" when list is empty', () => {
      renderSidebar({
        activePanel: 'queries',
        showConnPicker: true,
        savedConnections: [],
      });
      expect(screen.getByText('No connections saved yet')).toBeTruthy();
    });

    it('renders one button per saved connection', () => {
      renderSidebar({
        activePanel: 'queries',
        showConnPicker: true,
        savedConnections: [pgConn, mysqlConn],
      });
      expect(screen.getByText('prod-pg')).toBeTruthy();
      expect(screen.getByText('dev-mysql')).toBeTruthy();
    });

    it('calls onCreateQuery with connection name when a connection is clicked', () => {
      const { props } = renderSidebar({
        activePanel: 'queries',
        showConnPicker: true,
        savedConnections: [pgConn, mysqlConn],
      });
      fireEvent.click(screen.getByText('prod-pg'));
      expect(props.onCreateQuery).toHaveBeenCalledWith('prod-pg');
      expect(props.onCreateQuery).toHaveBeenCalledTimes(1);
    });

    it('renders DbTypeIcon for each connection', () => {
      const { container } = renderSidebar({
        activePanel: 'queries',
        showConnPicker: true,
        savedConnections: [pgConn, mysqlConn],
      });
      const icons = container.querySelectorAll('svg');
      // 2 connection icons inside the picker
      expect(icons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('layout', () => {
    it('applies sidebarWidth as inline style', () => {
      const { container } = renderSidebar({ sidebarWidth: 300 });
      const root = container.firstChild as HTMLElement;
      expect(root.style.width).toBe('300px');
    });

    it('renders children', () => {
      renderSidebar();
      expect(screen.getByTestId('panel-content')).toBeTruthy();
    });

    it('resize handle calls onResizeStart on mousedown', () => {
      const { container, props } = renderSidebar();
      // The resize handle is the last child div with cursor-col-resize
      const handle = container.querySelector('.cursor-col-resize') as HTMLElement;
      expect(handle).toBeTruthy();
      fireEvent.mouseDown(handle);
      expect(props.onResizeStart).toHaveBeenCalledTimes(1);
    });
  });
});
