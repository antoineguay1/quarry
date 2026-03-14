import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TabBar from './TabBar';
import type { TabEntry, SavedQuery } from '@/types';

const onActivate = vi.fn();
const onClose = vi.fn();
const onCloseOthers = vi.fn();
const onCloseAll = vi.fn();
const onPromote = vi.fn();

const defaultProps = {
  tabs: [] as TabEntry[],
  activeTabId: null as string | null,
  savedQueries: [] as SavedQuery[],
  onActivate,
  onClose,
  onCloseOthers,
  onCloseAll,
  onPromote,
};

function mkBrowseTab(overrides: Partial<TabEntry> = {}): TabEntry {
  return {
    id: 'conn::mydb::browse::users',
    type: 'browse',
    connectionName: 'conn',
    database: 'mydb',
    table: 'users',
    ...overrides,
  };
}

function mkSavedQueryTab(overrides: Partial<TabEntry> = {}): TabEntry {
  return {
    id: 'saved::q1',
    type: 'saved-query',
    connectionName: 'conn',
    savedQueryId: 'q1',
    ...overrides,
  };
}

function mkCreateTableTab(overrides: Partial<TabEntry> = {}): TabEntry {
  return {
    id: 'conn::mydb::create-table',
    type: 'create-table',
    connectionName: 'conn',
    database: 'mydb',
    ...overrides,
  };
}

function mkSchemaDiagramTab(overrides: Partial<TabEntry> = {}): TabEntry {
  return {
    id: 'conn::mydb::schema-diagram',
    type: 'schema-diagram',
    connectionName: 'conn',
    database: 'mydb',
    ...overrides,
  };
}

/** Returns the first tab trigger div (the clickable wrapper rendered by ContextMenu.Trigger). */
function getTabTrigger(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-state]') as HTMLElement;
}

/** Returns the label span of the first tab. */
function getLabelSpan(container: HTMLElement): HTMLElement {
  return container.querySelector('span[class*="max-w"]') as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TabBar', () => {
  describe('empty state', () => {
    it('renders an empty container when no tabs', () => {
      const { container } = render(<TabBar {...defaultProps} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper.children).toHaveLength(0);
    });
  });

  describe('tab labels', () => {
    it('renders browse tab with connectionName / database.table', () => {
      const { container } = render(<TabBar {...defaultProps} tabs={[mkBrowseTab()]} />);
      const label = getLabelSpan(container);
      expect(label.textContent).toContain('conn');
      expect(label.textContent).toContain('mydb.users');
    });

    it('renders create-table tab with connectionName / database · New Table', () => {
      const { container } = render(<TabBar {...defaultProps} tabs={[mkCreateTableTab()]} />);
      const label = getLabelSpan(container);
      expect(label.textContent).toContain('conn');
      expect(label.textContent).toContain('New Table');
    });

    it('renders schema-diagram tab with connectionName / database · Schema', () => {
      const { container } = render(<TabBar {...defaultProps} tabs={[mkSchemaDiagramTab()]} />);
      const label = getLabelSpan(container);
      expect(label.textContent).toContain('conn');
      expect(label.textContent).toContain('Schema');
    });

    it('renders saved-query tab with query name from savedQueries', () => {
      const savedQueries: SavedQuery[] = [
        { id: 'q1', name: 'My Query', sql: 'SELECT 1', connectionName: 'conn' },
      ];
      render(<TabBar {...defaultProps} tabs={[mkSavedQueryTab()]} savedQueries={savedQueries} />);
      expect(screen.getByText('My Query')).toBeInTheDocument();
    });

    it('falls back to "Query" when savedQueryId is not in savedQueries', () => {
      render(<TabBar {...defaultProps} tabs={[mkSavedQueryTab()]} savedQueries={[]} />);
      expect(screen.getByText('Query')).toBeInTheDocument();
    });

    it('renders multiple tabs', () => {
      const tabs: TabEntry[] = [mkBrowseTab(), mkCreateTableTab({ id: 'other' })];
      const { container } = render(<TabBar {...defaultProps} tabs={tabs} />);
      const spans = container.querySelectorAll('span[class*="max-w"]');
      expect(spans[0].textContent).toContain('mydb.users');
      expect(spans[1].textContent).toContain('New Table');
    });
  });

  describe('active tab styling', () => {
    it('applies active classes when tab is active', () => {
      const tab = mkBrowseTab();
      const { container } = render(
        <TabBar {...defaultProps} tabs={[tab]} activeTabId={tab.id} />
      );
      const tabEl = getTabTrigger(container);
      expect(tabEl.className).toContain('bg-accent');
      expect(tabEl.className).toContain('font-medium');
      expect(tabEl.className).toContain('border-b-primary');
    });

    it('applies muted-foreground class for inactive tab', () => {
      const tab = mkBrowseTab();
      const { container } = render(
        <TabBar {...defaultProps} tabs={[tab]} activeTabId="other-tab" />
      );
      const tabEl = getTabTrigger(container);
      expect(tabEl.className).toContain('text-muted-foreground');
      expect(tabEl.className).not.toContain('font-medium');
    });
  });

  describe('preview tab', () => {
    it('applies italic style to preview tab text span', () => {
      const tab = mkBrowseTab({ preview: true });
      const { container } = render(<TabBar {...defaultProps} tabs={[tab]} />);
      expect(container.querySelector('span.italic')).toBeInTheDocument();
    });

    it('does not apply italic style to non-preview tab', () => {
      const tab = mkBrowseTab({ preview: false });
      const { container } = render(<TabBar {...defaultProps} tabs={[tab]} />);
      expect(container.querySelector('span.italic')).not.toBeInTheDocument();
    });
  });

  describe('click interactions', () => {
    it('calls onActivate with tab id on click', () => {
      const tab = mkBrowseTab();
      const { container } = render(<TabBar {...defaultProps} tabs={[tab]} />);
      fireEvent.click(getTabTrigger(container));
      expect(onActivate).toHaveBeenCalledWith(tab.id);
    });

    it('calls onPromote with tab id on double-click', () => {
      const tab = mkBrowseTab();
      const { container } = render(<TabBar {...defaultProps} tabs={[tab]} />);
      fireEvent.doubleClick(getTabTrigger(container));
      expect(onPromote).toHaveBeenCalledWith(tab.id);
    });

    it('calls onClose with tab id when X button is clicked', () => {
      const tab = mkBrowseTab();
      render(<TabBar {...defaultProps} tabs={[tab]} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onClose).toHaveBeenCalledWith(tab.id);
    });

    it('X button click does not trigger onActivate (stopPropagation)', () => {
      const tab = mkBrowseTab();
      render(<TabBar {...defaultProps} tabs={[tab]} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onActivate).not.toHaveBeenCalled();
    });

    it('renders one close button per tab', () => {
      const tabs: TabEntry[] = [mkBrowseTab(), mkCreateTableTab({ id: 'other' })];
      render(<TabBar {...defaultProps} tabs={tabs} />);
      expect(screen.getAllByRole('button')).toHaveLength(2);
    });
  });

  describe('context menu', () => {
    it('shows context menu items on right-click', async () => {
      const tab = mkBrowseTab();
      const { container } = render(<TabBar {...defaultProps} tabs={[tab]} />);
      fireEvent.contextMenu(getTabTrigger(container));
      expect(await screen.findByText('Close tab')).toBeInTheDocument();
      expect(screen.getByText('Close other tabs')).toBeInTheDocument();
      expect(screen.getByText('Close all tabs')).toBeInTheDocument();
    });

    it('calls onClose when "Close tab" is selected', async () => {
      const tab = mkBrowseTab();
      const { container } = render(<TabBar {...defaultProps} tabs={[tab]} />);
      fireEvent.contextMenu(getTabTrigger(container));
      fireEvent.click(await screen.findByText('Close tab'));
      expect(onClose).toHaveBeenCalledWith(tab.id);
    });

    it('calls onCloseOthers when "Close other tabs" is selected', async () => {
      const tab = mkBrowseTab();
      const { container } = render(<TabBar {...defaultProps} tabs={[tab]} />);
      fireEvent.contextMenu(getTabTrigger(container));
      fireEvent.click(await screen.findByText('Close other tabs'));
      expect(onCloseOthers).toHaveBeenCalledWith(tab.id);
    });

    it('calls onCloseAll when "Close all tabs" is selected', async () => {
      const tab = mkBrowseTab();
      const { container } = render(<TabBar {...defaultProps} tabs={[tab]} />);
      fireEvent.contextMenu(getTabTrigger(container));
      fireEvent.click(await screen.findByText('Close all tabs'));
      expect(onCloseAll).toHaveBeenCalled();
    });
  });
});
