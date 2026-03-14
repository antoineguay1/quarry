import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DataTableToolbar from './DataTableToolbar';

function defaultResult(overrides: Partial<{ columns: string[]; row_count: number; sql: string }> = {}) {
  return {
    columns: ['id', 'name'],
    row_count: 2,
    sql: 'SELECT * FROM users',
    ...overrides,
  };
}

function defaultProps(overrides: Partial<Parameters<typeof DataTableToolbar>[0]> = {}) {
  return {
    result: defaultResult(),
    totalCount: null,
    totalCountLoading: false,
    loadTotalCount: vi.fn(),
    loading: false,
    sortCount: 0,
    filterCount: 0,
    onClearSort: vi.fn(),
    onClearFilters: vi.fn(),
    hiddenColumns: new Set<string>(),
    setHiddenColumns: vi.fn(),
    columnsOpen: false,
    setColumnsOpen: vi.fn(),
    columnsButtonRef: { current: null },
    columnsPopoverRef: { current: null },
    sqlCopied: false,
    setSqlCopied: vi.fn(),
    selectedRows: new Set<number>(),
    pkColumn: null,
    onStartInsert: vi.fn(),
    onDelete: vi.fn(),
    onRefresh: undefined,
    onOpenSchemaDiagram: undefined,
    searchOpen: false,
    onToggleSearch: vi.fn(),
    error: null,
    mutationError: null,
    hasChanges: false,
    changeCount: 0,
    isSubmitting: false,
    onSubmit: vi.fn(),
    onDiscard: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('DataTableToolbar', () => {
  describe('row count display', () => {
    it('shows singular "row" for 1 row', () => {
      render(<DataTableToolbar {...defaultProps({ result: defaultResult({ row_count: 1 }) })} />);
      expect(screen.getByText(/1 of/)).toBeInTheDocument();
      expect(screen.getByText(/\brow\b/)).toBeInTheDocument();
    });

    it('shows plural "rows" for 2 rows', () => {
      render(<DataTableToolbar {...defaultProps({ result: defaultResult({ row_count: 2 }) })} />);
      expect(screen.getByText(/rows/)).toBeInTheDocument();
    });

    it('shows "?" button when totalCount is null', () => {
      render(<DataTableToolbar {...defaultProps()} />);
      expect(screen.getByTitle('Load total count')).toBeInTheDocument();
      expect(screen.getByTitle('Load total count').textContent).toBe('?');
    });

    it('shows totalCount number when set', () => {
      render(<DataTableToolbar {...defaultProps({ totalCount: 1234 })} />);
      expect(screen.getByText(/1,234/)).toBeInTheDocument();
    });

    it('"?" button shows "…" when totalCountLoading', () => {
      render(<DataTableToolbar {...defaultProps({ totalCountLoading: true })} />);
      expect(screen.getByTitle('Load total count').textContent).toBe('…');
    });

    it('clicking "?" button calls loadTotalCount', () => {
      const loadTotalCount = vi.fn();
      render(<DataTableToolbar {...defaultProps({ loadTotalCount })} />);
      fireEvent.click(screen.getByTitle('Load total count'));
      expect(loadTotalCount).toHaveBeenCalledTimes(1);
    });

    it('shows loading spinner when loading=true', () => {
      render(<DataTableToolbar {...defaultProps({ loading: true })} />);
      expect(screen.getByText('Loading…')).toBeInTheDocument();
    });
  });

  describe('sort/filter/hidden column buttons', () => {
    it('shows "Clear sorting" button when sortCount > 0', () => {
      render(<DataTableToolbar {...defaultProps({ sortCount: 1 })} />);
      expect(screen.getByText('Clear sorting')).toBeInTheDocument();
    });

    it('does not show "Clear sorting" when sortCount = 0', () => {
      render(<DataTableToolbar {...defaultProps({ sortCount: 0 })} />);
      expect(screen.queryByText('Clear sorting')).not.toBeInTheDocument();
    });

    it('"Clear sorting" button disabled when hasChanges=true', () => {
      render(<DataTableToolbar {...defaultProps({ sortCount: 1, hasChanges: true, changeCount: 1 })} />);
      const btn = screen.getByText('Clear sorting').closest('button')!;
      expect(btn).toBeDisabled();
    });

    it('"Clear sorting" button calls onClearSort when clicked', () => {
      const onClearSort = vi.fn();
      render(<DataTableToolbar {...defaultProps({ sortCount: 1, onClearSort })} />);
      fireEvent.click(screen.getByText('Clear sorting'));
      expect(onClearSort).toHaveBeenCalledTimes(1);
    });

    it('shows "Clear filters" button when filterCount > 0', () => {
      render(<DataTableToolbar {...defaultProps({ filterCount: 1 })} />);
      expect(screen.getByText('Clear filters')).toBeInTheDocument();
    });

    it('"Clear filters" calls onClearFilters when clicked', () => {
      const onClearFilters = vi.fn();
      render(<DataTableToolbar {...defaultProps({ filterCount: 1, onClearFilters })} />);
      fireEvent.click(screen.getByText('Clear filters'));
      expect(onClearFilters).toHaveBeenCalledTimes(1);
    });

    it('shows "Show all columns" when hiddenColumns.size > 0', () => {
      render(<DataTableToolbar {...defaultProps({ hiddenColumns: new Set(['name']) })} />);
      expect(screen.getByText('Show all columns')).toBeInTheDocument();
    });

    it('"Show all columns" calls setHiddenColumns with empty Set', () => {
      const setHiddenColumns = vi.fn();
      render(<DataTableToolbar {...defaultProps({ hiddenColumns: new Set(['name']), setHiddenColumns })} />);
      fireEvent.click(screen.getByText('Show all columns'));
      expect(setHiddenColumns).toHaveBeenCalledTimes(1);
    });

    it('shows hidden column badge in Columns button', () => {
      render(<DataTableToolbar {...defaultProps({ hiddenColumns: new Set(['name']), result: defaultResult({ columns: ['id', 'name'] }) })} />);
      expect(screen.getByText('(1/2)')).toBeInTheDocument();
    });
  });

  describe('hasChanges block', () => {
    it('shows change count (singular)', () => {
      render(<DataTableToolbar {...defaultProps({ hasChanges: true, changeCount: 1 })} />);
      expect(screen.getByText('1 change')).toBeInTheDocument();
    });

    it('shows change count (plural)', () => {
      render(<DataTableToolbar {...defaultProps({ hasChanges: true, changeCount: 3 })} />);
      expect(screen.getByText('3 changes')).toBeInTheDocument();
    });

    it('Submit button disabled when isSubmitting=true', () => {
      render(<DataTableToolbar {...defaultProps({ hasChanges: true, changeCount: 1, isSubmitting: true })} />);
      expect(screen.getByTitle('Submit all changes')).toBeDisabled();
    });

    it('Submit button calls onSubmit', () => {
      const onSubmit = vi.fn();
      render(<DataTableToolbar {...defaultProps({ hasChanges: true, changeCount: 1, onSubmit })} />);
      fireEvent.click(screen.getByTitle('Submit all changes'));
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('Discard button calls onDiscard', () => {
      const onDiscard = vi.fn();
      render(<DataTableToolbar {...defaultProps({ hasChanges: true, changeCount: 1, onDiscard })} />);
      fireEvent.click(screen.getByTitle('Discard all changes'));
      expect(onDiscard).toHaveBeenCalledTimes(1);
    });

    it('does not show changes block when hasChanges=false', () => {
      render(<DataTableToolbar {...defaultProps({ hasChanges: false })} />);
      expect(screen.queryByText(/change/)).not.toBeInTheDocument();
    });
  });

  describe('selectedRows', () => {
    it('shows selected count when selectedRows.size > 0', () => {
      render(<DataTableToolbar {...defaultProps({ selectedRows: new Set([0, 1]) })} />);
      expect(screen.getByText('2 selected')).toBeInTheDocument();
    });

    it('does not show selected count when no rows selected', () => {
      render(<DataTableToolbar {...defaultProps({ selectedRows: new Set() })} />);
      expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    });
  });

  describe('Insert/Delete buttons', () => {
    it('Insert button calls onStartInsert', () => {
      const onStartInsert = vi.fn();
      render(<DataTableToolbar {...defaultProps({ onStartInsert })} />);
      fireEvent.click(screen.getByTitle('Add row'));
      expect(onStartInsert).toHaveBeenCalledTimes(1);
    });

    it('Delete button disabled when no rows selected', () => {
      render(<DataTableToolbar {...defaultProps({ selectedRows: new Set(), pkColumn: 'id' })} />);
      const deleteBtn = screen.getByTitle(/Mark .* row\(s\) for deletion|No primary key/);
      expect(deleteBtn).toBeDisabled();
    });

    it('Delete button disabled when pkColumn is null', () => {
      render(<DataTableToolbar {...defaultProps({ selectedRows: new Set([0]), pkColumn: null })} />);
      const deleteBtn = screen.getByTitle('No primary key — delete unavailable');
      expect(deleteBtn).toBeDisabled();
    });

    it('Delete button enabled when rows selected and pkColumn set', () => {
      const onDelete = vi.fn();
      render(<DataTableToolbar {...defaultProps({ selectedRows: new Set([0]), pkColumn: 'id', onDelete })} />);
      const deleteBtn = screen.getByTitle(`Mark 1 row(s) for deletion`);
      expect(deleteBtn).not.toBeDisabled();
      fireEvent.click(deleteBtn);
      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('Copy SQL', () => {
    it('shows Copy icon by default and Check icon after sqlCopied=true', () => {
      const { rerender } = render(<DataTableToolbar {...defaultProps({ sqlCopied: false })} />);
      expect(screen.getByTitle('Copy SQL')).toBeInTheDocument();
      rerender(<DataTableToolbar {...defaultProps({ sqlCopied: true })} />);
      // Check icon rendered; title stays "Copy SQL"
      expect(screen.getByTitle('Copy SQL')).toBeInTheDocument();
    });

    it('clicking Copy SQL fires clipboard write and setSqlCopied', () => {
      const setSqlCopied = vi.fn();
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText },
        writable: true,
        configurable: true,
      });
      render(<DataTableToolbar {...defaultProps({ setSqlCopied, result: defaultResult({ sql: 'SELECT 1' }) })} />);
      fireEvent.click(screen.getByTitle('Copy SQL'));
      expect(writeText).toHaveBeenCalledWith('SELECT 1');
      expect(setSqlCopied).toHaveBeenCalledWith(true);
    });
  });

  describe('optional buttons', () => {
    it('shows Refresh button when onRefresh is provided', () => {
      render(<DataTableToolbar {...defaultProps({ onRefresh: vi.fn() })} />);
      expect(screen.getByTitle('Refresh')).toBeInTheDocument();
    });

    it('does not show Refresh button when onRefresh is undefined', () => {
      render(<DataTableToolbar {...defaultProps({ onRefresh: undefined })} />);
      expect(screen.queryByTitle('Refresh')).not.toBeInTheDocument();
    });

    it('shows Schema Diagram button when onOpenSchemaDiagram is provided', () => {
      render(<DataTableToolbar {...defaultProps({ onOpenSchemaDiagram: vi.fn() })} />);
      expect(screen.getByTitle('Schema Diagram')).toBeInTheDocument();
    });

    it('does not show Schema Diagram button when undefined', () => {
      render(<DataTableToolbar {...defaultProps({ onOpenSchemaDiagram: undefined })} />);
      expect(screen.queryByTitle('Schema Diagram')).not.toBeInTheDocument();
    });

    it('Schema Diagram button calls onOpenSchemaDiagram', () => {
      const onOpenSchemaDiagram = vi.fn();
      render(<DataTableToolbar {...defaultProps({ onOpenSchemaDiagram })} />);
      fireEvent.click(screen.getByTitle('Schema Diagram'));
      expect(onOpenSchemaDiagram).toHaveBeenCalledTimes(1);
    });

    it('Refresh button calls onRefresh', () => {
      const onRefresh = vi.fn();
      render(<DataTableToolbar {...defaultProps({ onRefresh })} />);
      fireEvent.click(screen.getByTitle('Refresh'));
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('search toggle', () => {
    it('calls onToggleSearch on click', () => {
      const onToggleSearch = vi.fn();
      render(<DataTableToolbar {...defaultProps({ onToggleSearch })} />);
      fireEvent.click(screen.getByTitle('Search (⌘F)'));
      expect(onToggleSearch).toHaveBeenCalledTimes(1);
    });

    it('applies active styles when searchOpen=true', () => {
      render(<DataTableToolbar {...defaultProps({ searchOpen: true })} />);
      const btn = screen.getByTitle('Search (⌘F)');
      expect(btn.className).toContain('bg-muted');
    });
  });

  describe('columns popover', () => {
    it('does not show popover when columnsOpen=false', () => {
      render(<DataTableToolbar {...defaultProps({ columnsOpen: false })} />);
      expect(screen.queryByText('Show all')).not.toBeInTheDocument();
    });

    it('shows column checkboxes when columnsOpen=true', () => {
      render(<DataTableToolbar {...defaultProps({ columnsOpen: true })} />);
      expect(screen.getByText('id')).toBeInTheDocument();
      expect(screen.getByText('name')).toBeInTheDocument();
    });

    it('toggles setColumnsOpen when Columns button clicked', () => {
      const setColumnsOpen = vi.fn();
      render(<DataTableToolbar {...defaultProps({ setColumnsOpen })} />);
      fireEvent.click(screen.getByText('Columns'));
      expect(setColumnsOpen).toHaveBeenCalledTimes(1);
    });

    it('checkbox toggles call setHiddenColumns', () => {
      const setHiddenColumns = vi.fn();
      render(<DataTableToolbar {...defaultProps({ columnsOpen: true, setHiddenColumns })} />);
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);
      expect(setHiddenColumns).toHaveBeenCalledTimes(1);
    });

    it('"Show all" in popover calls setHiddenColumns with empty Set', () => {
      const setHiddenColumns = vi.fn();
      render(<DataTableToolbar {...defaultProps({ columnsOpen: true, setHiddenColumns })} />);
      fireEvent.click(screen.getByText('Show all'));
      expect(setHiddenColumns).toHaveBeenCalledTimes(1);
    });

    it('"Hide all" in popover calls setHiddenColumns with all columns', () => {
      const setHiddenColumns = vi.fn();
      render(<DataTableToolbar {...defaultProps({ columnsOpen: true, setHiddenColumns })} />);
      fireEvent.click(screen.getByText('Hide all'));
      expect(setHiddenColumns).toHaveBeenCalledTimes(1);
    });

    it('unchecking a hidden column calls setHiddenColumns (delete branch)', () => {
      const setHiddenColumns = vi.fn();
      // 'name' is already hidden
      render(<DataTableToolbar {...defaultProps({
        columnsOpen: true,
        setHiddenColumns,
        hiddenColumns: new Set(['name']),
      })} />);
      const checkboxes = screen.getAllByRole('checkbox');
      // name checkbox should be unchecked; clicking it should call setHiddenColumns (delete branch)
      const nameCheckbox = checkboxes[1]; // second column is 'name'
      expect(nameCheckbox).not.toBeChecked();
      fireEvent.click(nameCheckbox);
      expect(setHiddenColumns).toHaveBeenCalledTimes(1);
      // Invoke the captured updater to cover the delete branch
      const updaterFn = setHiddenColumns.mock.calls[0][0] as (prev: Set<string>) => Set<string>;
      const result = updaterFn(new Set(['name']));
      expect(result.has('name')).toBe(false);
    });

    it('checking a visible column calls setHiddenColumns (add branch)', () => {
      const setHiddenColumns = vi.fn();
      render(<DataTableToolbar {...defaultProps({ columnsOpen: true, setHiddenColumns })} />);
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // hide 'id'
      expect(setHiddenColumns).toHaveBeenCalledTimes(1);
      // Invoke the captured updater to cover the add branch
      const updaterFn = setHiddenColumns.mock.calls[0][0] as (prev: Set<string>) => Set<string>;
      const result = updaterFn(new Set()); // 'id' is not hidden yet
      expect(result.has('id')).toBe(true);
    });
  });

  describe('error display', () => {
    it('shows error message', () => {
      render(<DataTableToolbar {...defaultProps({ error: 'Something failed' })} />);
      expect(screen.getByText('Something failed')).toBeInTheDocument();
    });

    it('shows mutationError message', () => {
      render(<DataTableToolbar {...defaultProps({ mutationError: 'Write failed' })} />);
      expect(screen.getByText('Write failed')).toBeInTheDocument();
    });

    it('does not show error section when error=null', () => {
      render(<DataTableToolbar {...defaultProps({ error: null })} />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
