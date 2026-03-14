import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DataTablePagination from './DataTablePagination';

function defaultProps(overrides: Partial<Parameters<typeof DataTablePagination>[0]> = {}) {
  return {
    page: 0,
    setPage: vi.fn(),
    pageSize: 50,
    setPageSize: vi.fn(),
    totalCount: null,
    totalCountLoading: false,
    loadTotalCount: vi.fn(),
    rowCount: 50,
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('DataTablePagination', () => {
  it('shows current page number', () => {
    render(<DataTablePagination {...defaultProps({ page: 2, totalCount: 300 })} />);
    expect(screen.getByText(/Page 3 of 6/)).toBeInTheDocument();
  });

  it('shows calculated total pages when totalCount is a number', () => {
    render(<DataTablePagination {...defaultProps({ totalCount: 200, pageSize: 50 })} />);
    expect(screen.getByText(/Page 1 of 4/)).toBeInTheDocument();
  });

  it('shows "?" button when totalCount is null', () => {
    render(<DataTablePagination {...defaultProps({ totalCount: null })} />);
    expect(screen.getByTitle('Load total count')).toBeInTheDocument();
    expect(screen.getByTitle('Load total count').textContent).toBe('?');
  });

  it('"?" button shows "…" when totalCountLoading', () => {
    render(<DataTablePagination {...defaultProps({ totalCount: null, totalCountLoading: true })} />);
    expect(screen.getByTitle('Load total count').textContent).toBe('…');
  });

  it('"?" button is disabled when totalCountLoading', () => {
    render(<DataTablePagination {...defaultProps({ totalCount: null, totalCountLoading: true })} />);
    expect(screen.getByTitle('Load total count')).toBeDisabled();
  });

  it('clicking "?" button calls loadTotalCount', () => {
    const loadTotalCount = vi.fn();
    render(<DataTablePagination {...defaultProps({ loadTotalCount })} />);
    fireEvent.click(screen.getByTitle('Load total count'));
    expect(loadTotalCount).toHaveBeenCalledTimes(1);
  });

  it('previous button is disabled at page 0', () => {
    render(<DataTablePagination {...defaultProps({ page: 0, totalCount: 100 })} />);
    // buttons order when totalCount set: [prev, next]
    const btns = screen.getAllByRole('button');
    expect(btns[0]).toBeDisabled();
  });

  it('previous button is enabled when page > 0', () => {
    const setPage = vi.fn();
    render(<DataTablePagination {...defaultProps({ page: 2, totalCount: 200, setPage })} />);
    const btns = screen.getAllByRole('button');
    const prevBtn = btns[0];
    expect(prevBtn).not.toBeDisabled();
    fireEvent.click(prevBtn);
    expect(setPage).toHaveBeenCalledTimes(1);
  });

  it('next button is disabled when rowCount < pageSize', () => {
    render(<DataTablePagination {...defaultProps({ rowCount: 20, pageSize: 50, totalCount: 20 })} />);
    const btns = screen.getAllByRole('button');
    const nextBtn = btns[btns.length - 1];
    expect(nextBtn).toBeDisabled();
  });

  it('next button is enabled when rowCount >= pageSize', () => {
    const setPage = vi.fn();
    render(<DataTablePagination {...defaultProps({ rowCount: 50, pageSize: 50, totalCount: 100, page: 0, setPage })} />);
    const btns = screen.getAllByRole('button');
    const nextBtn = btns[btns.length - 1];
    expect(nextBtn).not.toBeDisabled();
    fireEvent.click(nextBtn);
    expect(setPage).toHaveBeenCalledTimes(1);
  });

  it('all nav buttons disabled when disabled=true', () => {
    render(<DataTablePagination {...defaultProps({ disabled: true, page: 2, rowCount: 50, totalCount: 200 })} />);
    const btns = screen.getAllByRole('button');
    btns.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('rows-per-page select fires setPageSize and setPage(0)', () => {
    const setPageSize = vi.fn();
    const setPage = vi.fn();
    render(<DataTablePagination {...defaultProps({ setPageSize, setPage })} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '100' } });
    expect(setPageSize).toHaveBeenCalledWith(100);
    expect(setPage).toHaveBeenCalledWith(0);
  });

  it('rows-per-page select is disabled when disabled=true', () => {
    render(<DataTablePagination {...defaultProps({ disabled: true })} />);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('shows "1 of 1" page when totalCount=0', () => {
    render(<DataTablePagination {...defaultProps({ totalCount: 0, pageSize: 50 })} />);
    // Math.max(1, Math.ceil(0/50)) = 1
    expect(screen.getByText(/Page 1 of 1/)).toBeInTheDocument();
  });

  it('calculates total pages correctly for non-round totalCount', () => {
    render(<DataTablePagination {...defaultProps({ totalCount: 201, pageSize: 50 })} />);
    expect(screen.getByText(/Page 1 of 5/)).toBeInTheDocument();
  });

  it('rows-per-page select has all expected options', () => {
    render(<DataTablePagination {...defaultProps()} />);
    const select = screen.getByRole('combobox');
    const options = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(options).toEqual(['50', '100', '200', '500']);
  });

  it('nav buttons show title when disabled=true', () => {
    render(<DataTablePagination {...defaultProps({ disabled: true, page: 2, rowCount: 50, totalCount: 200 })} />);
    const btns = screen.getAllByRole('button');
    const navBtns = btns.filter((b) => b.title === 'Submit or discard changes first');
    expect(navBtns).toHaveLength(2);
  });

  it('nav buttons have no title when not disabled', () => {
    render(<DataTablePagination {...defaultProps({ page: 2, totalCount: 200 })} />);
    const btns = screen.getAllByRole('button');
    btns.forEach((btn) => {
      expect(btn.title).not.toBe('Submit or discard changes first');
    });
  });

  it('previous button updater clamps at 0', () => {
    const setPage = vi.fn();
    render(<DataTablePagination {...defaultProps({ page: 1, totalCount: 100, setPage })} />);
    const btns = screen.getAllByRole('button');
    fireEvent.click(btns[0]);
    const updater = setPage.mock.calls[0][0] as (p: number) => number;
    expect(updater(1)).toBe(0);
    expect(updater(0)).toBe(0); // clamps at 0
  });

  it('next button updater increments page', () => {
    const setPage = vi.fn();
    render(<DataTablePagination {...defaultProps({ rowCount: 50, pageSize: 50, totalCount: 200, page: 0, setPage })} />);
    const btns = screen.getAllByRole('button');
    fireEvent.click(btns[btns.length - 1]);
    const updater = setPage.mock.calls[0][0] as (p: number) => number;
    expect(updater(0)).toBe(1);
    expect(updater(3)).toBe(4);
  });
});
