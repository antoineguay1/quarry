import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DataTableSearchBar from './DataTableSearchBar';

function defaultProps(
  overrides: Partial<Parameters<typeof DataTableSearchBar>[0]> = {},
) {
  return {
    searchInputRef: { current: null },
    inputValue: '',
    setInputValue: vi.fn(),
    searchQuery: '',
    commitSearch: vi.fn(),
    navigate: vi.fn(),
    closeSearch: vi.fn(),
    allMatches: [],
    currentMatchIndex: 0,
    searchCaseSensitive: false,
    setSearchCaseSensitive: vi.fn(),
    historyOpen: false,
    setHistoryOpen: vi.fn(),
    historyButtonRef: { current: null },
    historyRef: { current: null },
    searchHistory: [],
    applyHistoryItem: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('DataTableSearchBar', () => {
  describe('input', () => {
    it('calls setInputValue on change', () => {
      const setInputValue = vi.fn();
      render(<DataTableSearchBar {...defaultProps({ setInputValue })} />);
      fireEvent.change(screen.getByPlaceholderText('Search in table…'), {
        target: { value: 'foo' },
      });
      expect(setInputValue).toHaveBeenCalledWith('foo');
    });

    it('Escape calls closeSearch', () => {
      const closeSearch = vi.fn();
      render(<DataTableSearchBar {...defaultProps({ closeSearch })} />);
      fireEvent.keyDown(screen.getByPlaceholderText('Search in table…'), {
        key: 'Escape',
      });
      expect(closeSearch).toHaveBeenCalledTimes(1);
    });

    it('Enter with new value calls commitSearch(inputValue)', () => {
      const commitSearch = vi.fn();
      render(
        <DataTableSearchBar
          {...defaultProps({
            inputValue: 'foo',
            searchQuery: 'bar',
            commitSearch,
          })}
        />,
      );
      fireEvent.keyDown(screen.getByPlaceholderText('Search in table…'), {
        key: 'Enter',
      });
      expect(commitSearch).toHaveBeenCalledWith('foo');
    });

    it('Enter with same value as searchQuery calls navigate(1)', () => {
      const navigate = vi.fn();
      render(
        <DataTableSearchBar
          {...defaultProps({ inputValue: 'foo', searchQuery: 'foo', navigate })}
        />,
      );
      fireEvent.keyDown(screen.getByPlaceholderText('Search in table…'), {
        key: 'Enter',
      });
      expect(navigate).toHaveBeenCalledWith(1);
    });

    it('Shift+Enter calls navigate(-1)', () => {
      const navigate = vi.fn();
      render(
        <DataTableSearchBar
          {...defaultProps({ inputValue: 'foo', searchQuery: 'foo', navigate })}
        />,
      );
      fireEvent.keyDown(screen.getByPlaceholderText('Search in table…'), {
        key: 'Enter',
        shiftKey: true,
      });
      expect(navigate).toHaveBeenCalledWith(-1);
    });

    it('ArrowDown calls navigate(1)', () => {
      const navigate = vi.fn();
      render(<DataTableSearchBar {...defaultProps({ navigate })} />);
      fireEvent.keyDown(screen.getByPlaceholderText('Search in table…'), {
        key: 'ArrowDown',
      });
      expect(navigate).toHaveBeenCalledWith(1);
    });

    it('ArrowUp calls navigate(-1)', () => {
      const navigate = vi.fn();
      render(<DataTableSearchBar {...defaultProps({ navigate })} />);
      fireEvent.keyDown(screen.getByPlaceholderText('Search in table…'), {
        key: 'ArrowUp',
      });
      expect(navigate).toHaveBeenCalledWith(-1);
    });
  });

  describe('history button', () => {
    it('toggles historyOpen on click', () => {
      const setHistoryOpen = vi.fn();
      render(<DataTableSearchBar {...defaultProps({ setHistoryOpen })} />);
      fireEvent.click(screen.getByTitle('Search history'));
      expect(setHistoryOpen).toHaveBeenCalledTimes(1);
    });

    it('applies active styles when historyOpen=true', () => {
      render(<DataTableSearchBar {...defaultProps({ historyOpen: true })} />);
      const btn = screen.getByTitle('Search history');
      expect(btn.className).toContain('bg-muted');
    });
  });

  describe('case-sensitive toggle', () => {
    it('calls setSearchCaseSensitive on click', () => {
      const setSearchCaseSensitive = vi.fn();
      render(
        <DataTableSearchBar {...defaultProps({ setSearchCaseSensitive })} />,
      );
      fireEvent.click(screen.getByTitle('Case sensitive'));
      expect(setSearchCaseSensitive).toHaveBeenCalledTimes(1);
    });

    it('applies active styles when searchCaseSensitive=true', () => {
      render(
        <DataTableSearchBar {...defaultProps({ searchCaseSensitive: true })} />,
      );
      const btn = screen.getByTitle('Case sensitive');
      expect(btn.className).toContain('bg-primary');
    });
  });

  describe('match counter', () => {
    it('shows "No matches" when allMatches is empty and searchQuery is set', () => {
      render(
        <DataTableSearchBar
          {...defaultProps({
            searchQuery: 'foo',
            allMatches: [],
            currentMatchIndex: 0,
          })}
        />,
      );
      expect(screen.getByText('No matches')).toBeInTheDocument();
    });

    it('shows "N of M" when there are matches', () => {
      render(
        <DataTableSearchBar
          {...defaultProps({
            searchQuery: 'foo',
            allMatches: [{}, {}] as unknown[],
            currentMatchIndex: 1,
          })}
        />,
      );
      expect(screen.getByText('2 of 2')).toBeInTheDocument();
    });

    it('does not show match counter when searchQuery is empty', () => {
      render(
        <DataTableSearchBar
          {...defaultProps({ searchQuery: '', allMatches: [] })}
        />,
      );
      expect(screen.queryByText('No matches')).not.toBeInTheDocument();
    });
  });

  describe('navigation buttons', () => {
    it('prev/next navigation buttons disabled when no matches', () => {
      render(
        <DataTableSearchBar
          {...defaultProps({ searchQuery: 'foo', allMatches: [] })}
        />,
      );
      const prevBtn = screen.getByTitle('Previous (Shift+Enter)');
      const nextBtn = screen.getByTitle('Next (Enter)');
      expect(prevBtn).toBeDisabled();
      expect(nextBtn).toBeDisabled();
    });

    it('clicking next navigation button calls navigate(1)', () => {
      const navigate = vi.fn();
      render(
        <DataTableSearchBar
          {...defaultProps({
            searchQuery: 'foo',
            allMatches: [{}, {}] as unknown[],
            navigate,
          })}
        />,
      );
      fireEvent.click(screen.getByTitle('Next (Enter)'));
      expect(navigate).toHaveBeenCalledWith(1);
    });

    it('clicking prev navigation button calls navigate(-1)', () => {
      const navigate = vi.fn();
      render(
        <DataTableSearchBar
          {...defaultProps({
            searchQuery: 'foo',
            allMatches: [{}, {}] as unknown[],
            navigate,
          })}
        />,
      );
      fireEvent.click(screen.getByTitle('Previous (Shift+Enter)'));
      expect(navigate).toHaveBeenCalledWith(-1);
    });
  });

  describe('close button', () => {
    it('calls closeSearch when clicked', () => {
      const closeSearch = vi.fn();
      render(<DataTableSearchBar {...defaultProps({ closeSearch })} />);
      // The X close button (last button in the bar)
      const allBtns = screen.getAllByRole('button');
      const closeBtn = allBtns[allBtns.length - 1];
      fireEvent.click(closeBtn);
      expect(closeSearch).toHaveBeenCalledTimes(1);
    });
  });

  describe('history dropdown', () => {
    it('shows empty state when searchHistory is empty', () => {
      render(
        <DataTableSearchBar
          {...defaultProps({ historyOpen: true, searchHistory: [] })}
        />,
      );
      expect(screen.getByText('No recent searches')).toBeInTheDocument();
    });

    it('shows history items when searchHistory is not empty', () => {
      render(
        <DataTableSearchBar
          {...defaultProps({
            historyOpen: true,
            searchHistory: ['foo', 'bar'],
          })}
        />,
      );
      expect(screen.getByText('foo')).toBeInTheDocument();
      expect(screen.getByText('bar')).toBeInTheDocument();
    });

    it('clicking history item calls applyHistoryItem', () => {
      const applyHistoryItem = vi.fn();
      render(
        <DataTableSearchBar
          {...defaultProps({
            historyOpen: true,
            searchHistory: ['foo'],
            applyHistoryItem,
          })}
        />,
      );
      fireEvent.click(screen.getByText('foo'));
      expect(applyHistoryItem).toHaveBeenCalledWith('foo');
    });

    it('does not render history dropdown when historyOpen=false', () => {
      render(
        <DataTableSearchBar
          {...defaultProps({ historyOpen: false, searchHistory: ['foo'] })}
        />,
      );
      expect(screen.queryByText('foo')).not.toBeInTheDocument();
    });
  });
});
