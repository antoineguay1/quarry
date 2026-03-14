import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { createRef } from 'react';
import FilterModal from './FilterModal';
import type { FilterDraft } from '@/hooks/useTableFilters';
import type { ColumnTypeCategory } from '@/types';

const defaultDraft: FilterDraft = {
  value: '',
  value2: '',
  operator: 'eq',
  caseSensitive: false,
  nullFilter: '',
};

function renderModal(
  colType: ColumnTypeCategory,
  draft: FilterDraft = defaultDraft,
  overrides: Partial<{
    hasCase: boolean;
    onClose: () => void;
    onApply: () => void;
    onClear: () => void;
    onChange: () => void;
  }> = {},
) {
  const ref = createRef<HTMLDivElement | null>();
  const handlers = {
    onClose: vi.fn(),
    onApply: vi.fn(),
    onClear: vi.fn(),
    onChange: vi.fn(),
    ...overrides,
  };
  render(
    <FilterModal
      col="test_col"
      colType={colType}
      hasCase={overrides.hasCase ?? true}
      filterDraft={draft}
      filterModalRef={ref}
      {...handlers}
    />,
  );
  return handlers;
}

describe('FilterModal — rendering', () => {
  it('colType=text: shows text input, no operator buttons', () => {
    renderModal('text');
    const input = screen.getByPlaceholderText('Filter…');
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.queryByTitle('Equals')).not.toBeInTheDocument();
  });

  it('colType=number: shows operator buttons', () => {
    renderModal('number');
    expect(screen.getByTitle('Equals')).toBeInTheDocument();
    expect(screen.getByTitle('Between')).toBeInTheDocument();
  });

  it('colType=number: between operator reveals second value input', () => {
    renderModal('number', { ...defaultDraft, operator: 'between', value: '5' });
    const inputs = screen.getAllByPlaceholderText('Value…');
    expect(inputs).toHaveLength(2);
  });

  it('colType=boolean: shows select dropdown, no text input', () => {
    renderModal('boolean');
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Filter…')).not.toBeInTheDocument();
  });

  it('colType=date: shows date input', () => {
    const { container } = render(
      <FilterModal
        col="c"
        colType="date"
        hasCase={false}
        filterDraft={defaultDraft}
        filterModalRef={createRef()}
        onClose={vi.fn()}
        onApply={vi.fn()}
        onClear={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(container.querySelector('input[type="date"]')).toBeInTheDocument();
  });

  it('colType=time: shows time input', () => {
    const { container } = render(
      <FilterModal
        col="c"
        colType="time"
        hasCase={false}
        filterDraft={defaultDraft}
        filterModalRef={createRef()}
        onClose={vi.fn()}
        onApply={vi.fn()}
        onClear={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(container.querySelector('input[type="time"]')).toBeInTheDocument();
  });

  it('colType=datetime: shows datetime-local input', () => {
    const { container } = render(
      <FilterModal
        col="c"
        colType="datetime"
        hasCase={false}
        filterDraft={defaultDraft}
        filterModalRef={createRef()}
        onClose={vi.fn()}
        onApply={vi.fn()}
        onClear={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(container.querySelector('input[type="datetime-local"]')).toBeInTheDocument();
  });

  it('IS NULL and IS NOT NULL buttons are always present', () => {
    renderModal('text');
    expect(screen.getByText('IS NULL')).toBeInTheDocument();
    expect(screen.getByText('IS NOT NULL')).toBeInTheDocument();
  });

  it('hasCase=false: case sensitive button is not shown', () => {
    renderModal('text', defaultDraft, { hasCase: false });
    expect(screen.queryByTitle('Case sensitive')).not.toBeInTheDocument();
  });

  it('hasCase=true and caseSensitive=false: case button is not active', () => {
    renderModal('text', { ...defaultDraft, caseSensitive: false }, { hasCase: true });
    const btn = screen.getByTitle('Case sensitive');
    expect(btn.className).not.toMatch(/bg-primary/);
  });

  it('hasCase=true and caseSensitive=true: case button has active style', () => {
    renderModal('text', { ...defaultDraft, caseSensitive: true }, { hasCase: true });
    const btn = screen.getByTitle('Case sensitive');
    expect(btn.className).toMatch(/bg-primary/);
  });

  it('date: between operator reveals second input', () => {
    renderModal('date', { ...defaultDraft, operator: 'between', value: '2024-01-01' });
    // Two date inputs present
    const { container } = render(
      <FilterModal
        col="c"
        colType="date"
        hasCase={false}
        filterDraft={{ ...defaultDraft, operator: 'between', value: '2024-01-01' }}
        filterModalRef={createRef()}
        onClose={vi.fn()}
        onApply={vi.fn()}
        onClear={vi.fn()}
        onChange={vi.fn()}
      />,
    );
    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(2);
    expect(screen.getAllByText('and')).toBeTruthy();
  });

  it('nullFilter active: hides value inputs for text type', () => {
    renderModal('text', { ...defaultDraft, nullFilter: 'is_null' });
    expect(screen.queryByPlaceholderText('Filter…')).not.toBeInTheDocument();
  });

  it('nullFilter active: hides value inputs for boolean type', () => {
    renderModal('boolean', { ...defaultDraft, nullFilter: 'is_null' });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('FilterModal — canApply / Apply button', () => {
  it('disabled when no value and no nullFilter', () => {
    renderModal('text');
    expect(screen.getByText('Apply')).toBeDisabled();
  });

  it('enabled when nullFilter is set', () => {
    renderModal('text', { ...defaultDraft, nullFilter: 'is_null' });
    expect(screen.getByText('Apply')).not.toBeDisabled();
  });

  it('enabled when a text value is entered', () => {
    renderModal('text', { ...defaultDraft, value: 'hello' });
    expect(screen.getByText('Apply')).not.toBeDisabled();
  });

  it('disabled for between operator with missing value2', () => {
    renderModal('number', { ...defaultDraft, operator: 'between', value: '5', value2: '' });
    expect(screen.getByText('Apply')).toBeDisabled();
  });

  it('enabled for between operator with both values', () => {
    renderModal('number', { ...defaultDraft, operator: 'between', value: '5', value2: '10' });
    expect(screen.getByText('Apply')).not.toBeDisabled();
  });
});

describe('FilterModal — interactions', () => {
  it('Clear button calls onClear with col', () => {
    const { onClear } = renderModal('text');
    fireEvent.click(screen.getByText('Clear'));
    expect(onClear).toHaveBeenCalledWith('test_col');
  });

  it('Apply button calls onApply with col', () => {
    const { onApply } = renderModal('text', { ...defaultDraft, value: 'x' });
    fireEvent.click(screen.getByText('Apply'));
    expect(onApply).toHaveBeenCalledWith('test_col');
  });

  it('container mouseDown stops propagation', () => {
    renderModal('text');
    const container = screen.getByPlaceholderText('Filter…').closest('div.absolute')!;
    const event = new MouseEvent('mousedown', { bubbles: true });
    const spy = vi.spyOn(event, 'stopPropagation');
    container.dispatchEvent(event);
    expect(spy).toHaveBeenCalled();
  });

  it('container click stops propagation', () => {
    renderModal('text');
    const container = screen.getByPlaceholderText('Filter…').closest('div.absolute')!;
    const event = new MouseEvent('click', { bubbles: true });
    const spy = vi.spyOn(event, 'stopPropagation');
    container.dispatchEvent(event);
    expect(spy).toHaveBeenCalled();
  });

  describe('text input', () => {
    it('onChange fires with updated value', () => {
      const { onChange } = renderModal('text');
      fireEvent.change(screen.getByPlaceholderText('Filter…'), { target: { value: 'abc' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ value: 'abc' }));
    });

    it('Enter key calls onApply (text type — no canApply gate)', () => {
      const { onApply } = renderModal('text', { ...defaultDraft, value: '' });
      fireEvent.keyDown(screen.getByPlaceholderText('Filter…'), { key: 'Enter' });
      expect(onApply).toHaveBeenCalledWith('test_col');
    });

    it('Escape key calls onClose', () => {
      const { onClose } = renderModal('text');
      fireEvent.keyDown(screen.getByPlaceholderText('Filter…'), { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('case sensitive button', () => {
    it('click toggles caseSensitive via onChange', () => {
      const { onChange } = renderModal('text', { ...defaultDraft, caseSensitive: false }, { hasCase: true });
      fireEvent.click(screen.getByTitle('Case sensitive'));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ caseSensitive: true }));
    });

    it('click when already true toggles to false', () => {
      const { onChange } = renderModal('text', { ...defaultDraft, caseSensitive: true }, { hasCase: true });
      fireEvent.click(screen.getByTitle('Case sensitive'));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ caseSensitive: false }));
    });
  });

  describe('null filter buttons', () => {
    it('IS NULL activates via onChange', () => {
      const { onChange } = renderModal('text');
      fireEvent.click(screen.getByText('IS NULL'));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ nullFilter: 'is_null' }));
    });

    it('IS NOT NULL activates via onChange', () => {
      const { onChange } = renderModal('text');
      fireEvent.click(screen.getByText('IS NOT NULL'));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ nullFilter: 'is_not_null' }));
    });

    it('clicking active IS NULL deactivates it', () => {
      const { onChange } = renderModal('text', { ...defaultDraft, nullFilter: 'is_null' });
      fireEvent.click(screen.getByText('IS NULL'));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ nullFilter: '' }));
    });

    it('clicking active IS NOT NULL deactivates it', () => {
      const { onChange } = renderModal('text', { ...defaultDraft, nullFilter: 'is_not_null' });
      fireEvent.click(screen.getByText('IS NOT NULL'));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ nullFilter: '' }));
    });
  });

  describe('boolean select', () => {
    it('onChange fires with selected value', () => {
      const { onChange } = renderModal('boolean');
      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'true' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ value: 'true' }));
    });
  });

  describe('number inputs', () => {
    it('operator button click calls onChange with new operator', () => {
      const { onChange } = renderModal('number');
      fireEvent.click(screen.getByTitle('Greater than'));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ operator: 'gt' }));
    });

    it('all number operator buttons are rendered', () => {
      renderModal('number');
      ['Equals', 'Greater than', 'Greater than or equal', 'Less than', 'Less than or equal', 'Between'].forEach(
        (title) => expect(screen.getByTitle(title)).toBeInTheDocument(),
      );
    });

    it('value input onChange fires', () => {
      const { onChange } = renderModal('number');
      const [input] = screen.getAllByPlaceholderText('Value…');
      fireEvent.change(input, { target: { value: '42' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ value: '42' }));
    });

    it('Enter on value input with canApply=true calls onApply', () => {
      const { onApply } = renderModal('number', { ...defaultDraft, value: '5' });
      const [input] = screen.getAllByPlaceholderText('Value…');
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onApply).toHaveBeenCalledWith('test_col');
    });

    it('Enter on value input with canApply=false does not call onApply', () => {
      const { onApply } = renderModal('number', { ...defaultDraft, value: '' });
      const [input] = screen.getAllByPlaceholderText('Value…');
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onApply).not.toHaveBeenCalled();
    });

    it('Escape on value input calls onClose', () => {
      const { onClose } = renderModal('number');
      const [input] = screen.getAllByPlaceholderText('Value…');
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });

    it('value2 input onChange fires', () => {
      const { onChange } = renderModal('number', { ...defaultDraft, operator: 'between', value: '1' });
      const inputs = screen.getAllByPlaceholderText('Value…');
      fireEvent.change(inputs[1], { target: { value: '99' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ value2: '99' }));
    });

    it('Enter on value2 input with canApply=true calls onApply', () => {
      const { onApply } = renderModal('number', {
        ...defaultDraft,
        operator: 'between',
        value: '1',
        value2: '10',
      });
      const inputs = screen.getAllByPlaceholderText('Value…');
      fireEvent.keyDown(inputs[1], { key: 'Enter' });
      expect(onApply).toHaveBeenCalledWith('test_col');
    });

    it('Enter on value2 input with canApply=false does not call onApply', () => {
      const { onApply } = renderModal('number', {
        ...defaultDraft,
        operator: 'between',
        value: '1',
        value2: '',
      });
      const inputs = screen.getAllByPlaceholderText('Value…');
      fireEvent.keyDown(inputs[1], { key: 'Enter' });
      expect(onApply).not.toHaveBeenCalled();
    });

    it('Escape on value2 input calls onClose', () => {
      const { onClose } = renderModal('number', { ...defaultDraft, operator: 'between', value: '1' });
      const inputs = screen.getAllByPlaceholderText('Value…');
      fireEvent.keyDown(inputs[1], { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('date inputs', () => {
    it('all date operator buttons are rendered', () => {
      renderModal('date');
      ['Equals', 'After', 'On or after', 'Before', 'On or before', 'Between'].forEach(
        (title) => expect(screen.getByTitle(title)).toBeInTheDocument(),
      );
    });

    it('operator button click calls onChange with new operator', () => {
      const { onChange } = renderModal('date');
      fireEvent.click(screen.getByTitle('After'));
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ operator: 'gt' }));
    });

    it('value input onChange fires', () => {
      const { onChange } = renderModal('date');
      const dateInput = document.querySelector('input[type="date"]')!;
      fireEvent.change(dateInput, { target: { value: '2024-01-15' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ value: '2024-01-15' }));
    });

    it('Enter on value input with canApply=true calls onApply', () => {
      renderModal('date', { ...defaultDraft, value: '2024-01-01' });
      const dateInput = document.querySelector('input[type="date"]')!;
      fireEvent.keyDown(dateInput, { key: 'Enter' });
      expect(screen.getByText('Apply')).not.toBeDisabled();
    });

    it('Escape on value input calls onClose', () => {
      const { onClose } = renderModal('date');
      const dateInput = document.querySelector('input[type="date"]')!;
      fireEvent.keyDown(dateInput, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });

    it('value2 input onChange fires', () => {
      const { onChange } = renderModal('date', { ...defaultDraft, operator: 'between', value: '2024-01-01' });
      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.change(inputs[1], { target: { value: '2024-12-31' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ value2: '2024-12-31' }));
    });

    it('Enter on value2 input with canApply=true calls onApply', () => {
      const { onApply } = renderModal('date', {
        ...defaultDraft,
        operator: 'between',
        value: '2024-01-01',
        value2: '2024-12-31',
      });
      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.keyDown(inputs[1], { key: 'Enter' });
      expect(onApply).toHaveBeenCalledWith('test_col');
    });

    it('Enter on value2 input with canApply=false does not call onApply', () => {
      const { onApply } = renderModal('date', {
        ...defaultDraft,
        operator: 'between',
        value: '2024-01-01',
        value2: '',
      });
      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.keyDown(inputs[1], { key: 'Enter' });
      expect(onApply).not.toHaveBeenCalled();
    });

    it('Escape on value2 input calls onClose', () => {
      const { onClose } = renderModal('date', { ...defaultDraft, operator: 'between', value: '2024-01-01' });
      const inputs = document.querySelectorAll('input[type="date"]');
      fireEvent.keyDown(inputs[1], { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
