import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import AddColumnModal from './AddColumnModal';
import type { DbType } from '@/types';

type Props = React.ComponentProps<typeof AddColumnModal>;

function renderModal(overrides: Partial<Props> = {}) {
  return render(
    <AddColumnModal
      connectionName="myconn"
      database="mydb"
      table="users"
      dbType="postgres"
      onAdded={vi.fn()}
      onCancel={vi.fn()}
      {...overrides}
    />
  );
}

function getSqlPreview() {
  return screen.getByText(/ALTER TABLE/);
}

beforeEach(() => vi.clearAllMocks());

// ── 1. Rendering basics ───────────────────────────────────────────────────────

describe('rendering basics', () => {
  it('shows the table name in the heading', () => {
    renderModal();
    expect(screen.getByText('users')).toBeInTheDocument();
  });

  it('"Add Column" button is disabled when column name is empty', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Add Column' })).toBeDisabled();
  });

  it('"Cancel" button is present and enabled', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
  });

  it('SQL preview element is present', () => {
    renderModal();
    expect(getSqlPreview()).toBeInTheDocument();
  });
});

// ── 2. SQL preview — postgres quoting ────────────────────────────────────────

describe('SQL preview — postgres quoting', () => {
  it('default state shows placeholder column name with VARCHAR(255)', () => {
    renderModal();
    expect(getSqlPreview().textContent).toBe(
      'ALTER TABLE "users" ADD COLUMN "column_name" VARCHAR(255);'
    );
  });

  it('uses typed column name in SQL', () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('column_name'), { target: { value: 'email' } });
    expect(getSqlPreview().textContent).toBe(
      'ALTER TABLE "users" ADD COLUMN "email" VARCHAR(255);'
    );
  });

  it('includes NOT NULL after unchecking nullable', () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('column_name'), { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(getSqlPreview().textContent).toContain('NOT NULL');
  });

  it('includes DEFAULT with literal value', () => {
    const { container } = renderModal();
    fireEvent.change(screen.getByPlaceholderText('column_name'), { target: { value: 'email' } });
    // Switch default mode to 'literal'
    const defaultSelect = container.querySelectorAll('select')[1];
    fireEvent.change(defaultSelect, { target: { value: 'literal' } });
    // Type a default value
    fireEvent.change(screen.getByPlaceholderText(''), { target: { value: 'hello@example.com' } });
    expect(getSqlPreview().textContent).toContain("DEFAULT 'hello@example.com'");
  });
});

// ── 3. SQL preview — mysql quoting ───────────────────────────────────────────

describe('SQL preview — mysql quoting', () => {
  it('uses backtick quoting for mysql', () => {
    renderModal({ dbType: 'mysql' as DbType });
    expect(getSqlPreview().textContent).toBe(
      'ALTER TABLE `users` ADD COLUMN `column_name` VARCHAR(255);'
    );
  });
});

// ── 4. Type params rendering ─────────────────────────────────────────────────

describe('type params rendering', () => {
  it('default VARCHAR shows one length number input', () => {
    const { container } = renderModal();
    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect(numberInputs).toHaveLength(1);
  });

  it('switching to DECIMAL shows two param inputs and a comma separator', () => {
    const { container } = renderModal();
    const typeSelect = container.querySelectorAll('select')[0];
    fireEvent.change(typeSelect, { target: { value: 'DECIMAL' } });
    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect(numberInputs).toHaveLength(2);
    expect(screen.getByText(',')).toBeInTheDocument();
  });

  it('switching to TEXT removes all param inputs', () => {
    const { container } = renderModal();
    const typeSelect = container.querySelectorAll('select')[0];
    fireEvent.change(typeSelect, { target: { value: 'TEXT' } });
    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect(numberInputs).toHaveLength(0);
  });
});

// ── 5. handleTypeChange — all 3 branches ─────────────────────────────────────

describe('handleTypeChange', () => {
  it('switching to VARCHAR (length) → SQL has VARCHAR(255)', () => {
    const { container } = renderModal();
    const typeSelect = container.querySelectorAll('select')[0];
    // Switch away then back to VARCHAR
    fireEvent.change(typeSelect, { target: { value: 'TEXT' } });
    fireEvent.change(typeSelect, { target: { value: 'VARCHAR' } });
    expect(getSqlPreview().textContent).toContain('VARCHAR(255)');
  });

  it('switching to DECIMAL (precision-scale) → SQL has DECIMAL(10,2)', () => {
    const { container } = renderModal();
    const typeSelect = container.querySelectorAll('select')[0];
    fireEvent.change(typeSelect, { target: { value: 'DECIMAL' } });
    expect(getSqlPreview().textContent).toContain('DECIMAL(10,2)');
  });

  it('switching to TEXT (no params) → SQL has bare TEXT', () => {
    const { container } = renderModal();
    const typeSelect = container.querySelectorAll('select')[0];
    fireEvent.change(typeSelect, { target: { value: 'TEXT' } });
    expect(getSqlPreview().textContent).toContain('TEXT');
    expect(getSqlPreview().textContent).not.toContain('TEXT(');
  });

  it('changing type resets defaultMode to none and clears defaultValue input', () => {
    const { container } = renderModal();
    // Set a default mode that shows a text input
    const defaultSelect = container.querySelectorAll('select')[1];
    fireEvent.change(defaultSelect, { target: { value: 'literal' } });
    const valueInput = screen.getByPlaceholderText('');
    fireEvent.change(valueInput, { target: { value: 'somevalue' } });
    expect(getSqlPreview().textContent).toContain('DEFAULT');
    // Now change type → resets default
    const typeSelect = container.querySelectorAll('select')[0];
    fireEvent.change(typeSelect, { target: { value: 'TEXT' } });
    expect(getSqlPreview().textContent).not.toContain('DEFAULT');
  });
});

// ── 6. handleNullableChange ───────────────────────────────────────────────────

describe('handleNullableChange', () => {
  it('unchecking nullable when defaultMode is not null adds NOT NULL without resetting default', () => {
    const { container } = renderModal();
    // Set a literal default first
    const defaultSelect = container.querySelectorAll('select')[1];
    fireEvent.change(defaultSelect, { target: { value: 'literal' } });
    fireEvent.change(screen.getByPlaceholderText(''), { target: { value: 'foo' } });
    // Uncheck nullable
    fireEvent.click(screen.getByRole('checkbox'));
    const sql = getSqlPreview().textContent ?? '';
    expect(sql).toContain('NOT NULL');
    expect(sql).toContain("DEFAULT 'foo'");
  });

  it('unchecking nullable when defaultMode is null resets to none', () => {
    const { container } = renderModal();
    // Set default mode to 'null'
    const defaultSelect = container.querySelectorAll('select')[1];
    fireEvent.change(defaultSelect, { target: { value: 'null' } });
    expect(getSqlPreview().textContent).toContain('DEFAULT NULL');
    // Uncheck nullable
    fireEvent.click(screen.getByRole('checkbox'));
    expect(getSqlPreview().textContent).not.toContain('DEFAULT NULL');
    expect(getSqlPreview().textContent).toContain('NOT NULL');
  });
});

// ── 7. Default value options — needsValueInput branches ──────────────────────

describe('default value options — needsValueInput', () => {
  it('BOOLEAN + TRUE: no value input shown (presetValue set)', () => {
    const { container } = renderModal();
    const typeSelect = container.querySelectorAll('select')[0];
    fireEvent.change(typeSelect, { target: { value: 'BOOLEAN' } });
    const defaultSelect = container.querySelectorAll('select')[1];
    fireEvent.change(defaultSelect, { target: { value: 'true' } });
    // No default-value input since presetValue is set (placeholder '' would be the value input)
    expect(screen.queryByPlaceholderText('')).not.toBeInTheDocument();
    expect(getSqlPreview().textContent).toContain('DEFAULT TRUE');
  });

  it('VARCHAR + literal: shows text input (inputType=text)', () => {
    const { container } = renderModal();
    const defaultSelect = container.querySelectorAll('select')[1];
    fireEvent.change(defaultSelect, { target: { value: 'literal' } });
    // The value input has placeholder="" (not 'column_name' which is the name input)
    expect(screen.getByPlaceholderText('')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('')).toHaveAttribute('type', 'text');
  });

  it('INTEGER + literal: shows number input (inputType=number)', () => {
    const { container } = renderModal();
    const typeSelect = container.querySelectorAll('select')[0];
    fireEvent.change(typeSelect, { target: { value: 'INTEGER' } });
    const defaultSelect = container.querySelectorAll('select')[1];
    fireEvent.change(defaultSelect, { target: { value: 'literal' } });
    // One number input for the default value (param inputs are gone for INTEGER)
    const numberInputs = container.querySelectorAll('input[type="number"]');
    expect(numberInputs).toHaveLength(1);
  });

  it('DATE + current_date: no value input shown (expression with presetValue)', () => {
    const { container } = renderModal();
    const typeSelect = container.querySelectorAll('select')[0];
    fireEvent.change(typeSelect, { target: { value: 'DATE' } });
    const defaultSelect = container.querySelectorAll('select')[1];
    fireEvent.change(defaultSelect, { target: { value: 'current_date' } });
    // presetValue is set so no extra input needed
    expect(screen.queryByPlaceholderText('expression')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('')).not.toBeInTheDocument();
    expect(getSqlPreview().textContent).toContain('DEFAULT CURRENT_DATE');
  });

  it('VARCHAR + expression: shows expression text input', () => {
    const { container } = renderModal();
    const defaultSelect = container.querySelectorAll('select')[1];
    fireEvent.change(defaultSelect, { target: { value: 'expression' } });
    expect(screen.getByPlaceholderText('expression')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('expression')).toHaveAttribute('type', 'text');
  });

  it('JSON + expression: shows expression text input (no presetValue)', () => {
    const { container } = renderModal();
    const typeSelect = container.querySelectorAll('select')[0];
    fireEvent.change(typeSelect, { target: { value: 'JSON' } });
    const defaultSelect = container.querySelectorAll('select')[1];
    fireEvent.change(defaultSelect, { target: { value: 'expression' } });
    // expression kind with no presetValue → text input shown
    const exprInput = screen.getByPlaceholderText('expression');
    expect(exprInput).toBeInTheDocument();
    fireEvent.change(exprInput, { target: { value: '{}' } });
    expect(getSqlPreview().textContent).toContain('DEFAULT {}');
  });
});

// ── 8. handleSubmit — all paths ───────────────────────────────────────────────

describe('handleSubmit', () => {
  it('Enter key with empty colName is a no-op', () => {
    renderModal();
    const nameInput = screen.getByPlaceholderText('column_name');
    fireEvent.keyDown(nameInput, { key: 'Enter' });
    expect(vi.mocked(invoke)).not.toHaveBeenCalled();
  });

  it('success: invoke called with correct args, onAdded called', async () => {
    const onAdded = vi.fn();
    vi.mocked(invoke).mockResolvedValue(undefined);
    renderModal({ onAdded });
    fireEvent.change(screen.getByPlaceholderText('column_name'), { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Column' }));
    await waitFor(() => expect(onAdded).toHaveBeenCalled());
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('execute_ddl', {
      connection: 'myconn',
      database: 'mydb',
      sql: 'ALTER TABLE "users" ADD COLUMN "email" VARCHAR(255);',
    });
  });

  it('error: shows error message, loading reset, onAdded NOT called', async () => {
    const onAdded = vi.fn();
    vi.mocked(invoke).mockRejectedValue('DB error');
    renderModal({ onAdded });
    fireEvent.change(screen.getByPlaceholderText('column_name'), { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Column' }));
    await waitFor(() => expect(screen.getByText('DB error')).toBeInTheDocument());
    expect(onAdded).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Add Column' })).not.toBeDisabled();
  });
});

// ── 9. Loading state ──────────────────────────────────────────────────────────

describe('loading state', () => {
  it('while pending: button shows "Adding…" and both buttons are disabled', async () => {
    vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('column_name'), { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Column' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Adding…' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Adding…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});

// ── 10. Cancel button ─────────────────────────────────────────────────────────

describe('cancel button', () => {
  it('clicking Cancel calls onCancel prop', () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});

// ── 11. Error dismissal ───────────────────────────────────────────────────────

describe('error dismissal', () => {
  it('clicking X clears the error message', async () => {
    vi.mocked(invoke).mockRejectedValue('DB error');
    renderModal();
    fireEvent.change(screen.getByPlaceholderText('column_name'), { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Column' }));
    await waitFor(() => expect(screen.getByText('DB error')).toBeInTheDocument());
    // The dismiss button is inside the error container (no accessible label — just an X icon)
    const dismissBtn = screen.getByText('DB error')
      .closest('[class*="destructive"]')!
      .querySelector('button')!;
    fireEvent.click(dismissBtn);
    expect(screen.queryByText('DB error')).not.toBeInTheDocument();
  });
});

// ── 12. Param inputs onChange ─────────────────────────────────────────────────

describe('param inputs onChange', () => {
  it('typing in length input updates SQL length', () => {
    const { container } = renderModal();
    const lengthInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(lengthInput, { target: { value: '100' } });
    expect(getSqlPreview().textContent).toContain('VARCHAR(100)');
  });

  it('clearing length input removes the (N) param from SQL', () => {
    const { container } = renderModal();
    const lengthInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(lengthInput, { target: { value: '' } });
    expect(getSqlPreview().textContent).toContain('VARCHAR;');
    expect(getSqlPreview().textContent).not.toContain('VARCHAR(');
  });

  it('typing in precision input updates SQL precision', () => {
    const { container } = renderModal();
    const typeSelect = container.querySelectorAll('select')[0];
    fireEvent.change(typeSelect, { target: { value: 'DECIMAL' } });
    const [precisionInput] = container.querySelectorAll('input[type="number"]');
    fireEvent.change(precisionInput, { target: { value: '20' } });
    expect(getSqlPreview().textContent).toContain('DECIMAL(20,2)');
  });

  it('clearing precision input removes precision from SQL', () => {
    const { container } = renderModal();
    const typeSelect = container.querySelectorAll('select')[0];
    fireEvent.change(typeSelect, { target: { value: 'DECIMAL' } });
    const [precisionInput] = container.querySelectorAll('input[type="number"]');
    fireEvent.change(precisionInput, { target: { value: '' } });
    // Without param1, buildTypeSql falls back to bare DECIMAL
    expect(getSqlPreview().textContent).toContain('DECIMAL;');
    expect(getSqlPreview().textContent).not.toContain('DECIMAL(');
  });

  it('typing in scale input updates SQL scale', () => {
    const { container } = renderModal();
    const typeSelect = container.querySelectorAll('select')[0];
    fireEvent.change(typeSelect, { target: { value: 'DECIMAL' } });
    const [, scaleInput] = container.querySelectorAll('input[type="number"]');
    fireEvent.change(scaleInput, { target: { value: '4' } });
    expect(getSqlPreview().textContent).toContain('DECIMAL(10,4)');
  });

  it('clearing scale input removes scale param from SQL', () => {
    const { container } = renderModal();
    const typeSelect = container.querySelectorAll('select')[0];
    fireEvent.change(typeSelect, { target: { value: 'DECIMAL' } });
    const [, scaleInput] = container.querySelectorAll('input[type="number"]');
    fireEvent.change(scaleInput, { target: { value: '' } });
    // Without param2, buildTypeSql falls back to bare DECIMAL
    expect(getSqlPreview().textContent).toContain('DECIMAL;');
    expect(getSqlPreview().textContent).not.toContain('DECIMAL(');
  });
});
