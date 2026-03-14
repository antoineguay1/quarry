import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import RenameDatabaseModal from './RenameDatabaseModal';

const mockInvoke = vi.mocked(invoke);

const defaultProps = {
  connectionName: 'my-conn',
  database: 'mydb',
  onRenamed: vi.fn(),
  onCancel: vi.fn(),
};

function renderModal(props = {}) {
  return render(<RenameDatabaseModal {...defaultProps} {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RenameDatabaseModal', () => {
  it('renders title', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Rename Database' })).toBeInTheDocument();
  });

  it('shows database name in warning', () => {
    renderModal();
    expect(screen.getByText('mydb')).toBeInTheDocument();
  });

  it('input is initialized with current database name', () => {
    renderModal();
    expect(screen.getByRole('textbox')).toHaveValue('mydb');
  });

  it('Rename button is disabled when name is unchanged', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeDisabled();
  });

  it('Rename button is disabled when input is empty', () => {
    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Rename' })).toBeDisabled();
  });

  it('Rename button is disabled when input is only whitespace', () => {
    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Rename' })).toBeDisabled();
  });

  it('Rename button is enabled when name is changed', () => {
    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'newdb' } });
    expect(screen.getByRole('button', { name: 'Rename' })).toBeEnabled();
  });

  it('Cancel button calls onCancel', () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls disconnect_database and execute_ddl, then onRenamed on success', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const onRenamed = vi.fn();
    renderModal({ onRenamed });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'newdb' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith('newdb'));

    expect(mockInvoke).toHaveBeenCalledWith('disconnect_database', {
      connection: 'my-conn',
      database: 'mydb',
    });
    expect(mockInvoke).toHaveBeenCalledWith('execute_ddl', {
      connection: 'my-conn',
      database: null,
      sql: 'ALTER DATABASE "mydb" RENAME TO "newdb"',
    });
  });

  it('trims whitespace from new name before renaming', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const onRenamed = vi.fn();
    renderModal({ onRenamed });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  newdb  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith('newdb'));

    expect(mockInvoke).toHaveBeenCalledWith('execute_ddl', {
      connection: 'my-conn',
      database: null,
      sql: 'ALTER DATABASE "mydb" RENAME TO "newdb"',
    });
  });

  it('shows loading state while renaming', async () => {
    let resolve: () => void;
    mockInvoke.mockReturnValueOnce(new Promise<void>((r) => { resolve = r; }));

    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'newdb' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    expect(await screen.findByRole('button', { name: 'Renaming…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    resolve!();
  });

  it('shows error and resets loading on failure', async () => {
    mockInvoke.mockRejectedValueOnce('connection refused');
    renderModal();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'newdb' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    expect(await screen.findByText('connection refused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('does not call onRenamed on error', async () => {
    mockInvoke.mockRejectedValueOnce('fail');
    const onRenamed = vi.fn();
    renderModal({ onRenamed });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'newdb' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    await screen.findByText('fail');
    expect(onRenamed).not.toHaveBeenCalled();
  });

  it('dismisses error when X is clicked', async () => {
    mockInvoke.mockRejectedValueOnce('oops');
    renderModal();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'newdb' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    const errorDiv = await screen.findByText('oops');
    const dismissBtn = errorDiv.closest('div')!.querySelector('button')!;
    fireEvent.click(dismissBtn);
    expect(screen.queryByText('oops')).not.toBeInTheDocument();
  });

  it('triggers rename on Enter when name is changed', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const onRenamed = vi.fn();
    renderModal({ onRenamed });

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'newdb' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith('newdb'));
  });

  it('does not trigger rename on Enter when name is unchanged', async () => {
    renderModal();

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Enter' });

    await new Promise((r) => setTimeout(r, 50));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('calls onCancel on Escape key', () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });

    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
