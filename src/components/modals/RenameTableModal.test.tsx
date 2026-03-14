import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import RenameTableModal from './RenameTableModal';

const mockInvoke = vi.mocked(invoke);

const defaultProps = {
  connectionName: 'my-conn',
  database: 'mydb',
  table: 'users',
  dbType: 'postgres' as const,
  onRenamed: vi.fn(),
  onCancel: vi.fn(),
};

function renderModal(props = {}) {
  return render(<RenameTableModal {...defaultProps} {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RenameTableModal', () => {
  it('renders title', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Rename Table' })).toBeInTheDocument();
  });

  it('shows warning message', () => {
    renderModal();
    expect(screen.getByText(/may break applications or queries/i)).toBeInTheDocument();
  });

  it('input is pre-filled with current table name', () => {
    renderModal();
    expect(screen.getByRole('textbox')).toHaveValue('users');
  });

  it('Rename button is disabled when name is empty', () => {
    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Rename' })).toBeDisabled();
  });

  it('Rename button is disabled when name is only whitespace', () => {
    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Rename' })).toBeDisabled();
  });

  it('Rename button is disabled when name equals current table name', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeDisabled();
  });

  it('Rename button is enabled when name differs from current table name', () => {
    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new_users' } });
    expect(screen.getByRole('button', { name: 'Rename' })).toBeEnabled();
  });

  it('Cancel button calls onCancel', () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('Escape key calls onCancel', () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls execute_ddl with postgres SQL on rename', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const onRenamed = vi.fn();
    renderModal({ onRenamed });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new_users' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith('new_users'));

    expect(mockInvoke).toHaveBeenCalledWith('execute_ddl', {
      connection: 'my-conn',
      database: 'mydb',
      sql: 'ALTER TABLE "users" RENAME TO "new_users"',
    });
  });

  it('uses backtick SQL for mysql', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const onRenamed = vi.fn();
    renderModal({ dbType: 'mysql', onRenamed });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new_users' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith('new_users'));

    expect(mockInvoke).toHaveBeenCalledWith('execute_ddl', {
      connection: 'my-conn',
      database: 'mydb',
      sql: 'RENAME TABLE `users` TO `new_users`',
    });
  });

  it('trims whitespace from new name before renaming', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const onRenamed = vi.fn();
    renderModal({ onRenamed });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  new_users  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith('new_users'));
    expect(mockInvoke).toHaveBeenCalledWith('execute_ddl', expect.objectContaining({
      sql: 'ALTER TABLE "users" RENAME TO "new_users"',
    }));
  });

  it('shows loading state while renaming', async () => {
    let resolve: () => void;
    mockInvoke.mockReturnValueOnce(new Promise<void>((r) => { resolve = r; }));

    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new_users' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    expect(await screen.findByRole('button', { name: 'Renaming…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    resolve!();
  });

  it('shows error and resets loading on failure', async () => {
    mockInvoke.mockRejectedValueOnce('permission denied');
    renderModal();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new_users' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    expect(await screen.findByText('permission denied')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('dismisses error when X is clicked', async () => {
    mockInvoke.mockRejectedValueOnce('oops');
    renderModal();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new_users' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    const errorDiv = await screen.findByText('oops');
    const dismissBtn = errorDiv.closest('div')!.querySelector('button')!;
    fireEvent.click(dismissBtn);
    expect(screen.queryByText('oops')).not.toBeInTheDocument();
  });

  it('does not call onRenamed on error', async () => {
    mockInvoke.mockRejectedValueOnce('fail');
    const onRenamed = vi.fn();
    renderModal({ onRenamed });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'new_users' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    await screen.findByText('fail');
    expect(onRenamed).not.toHaveBeenCalled();
  });

  it('triggers rename on Enter key', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const onRenamed = vi.fn();
    renderModal({ onRenamed });

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'new_users' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith('new_users'));
  });

  it('does not trigger rename on Enter when name is unchanged', async () => {
    const onRenamed = vi.fn();
    renderModal({ onRenamed });

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });

    await new Promise((r) => setTimeout(r, 50));
    expect(onRenamed).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});
