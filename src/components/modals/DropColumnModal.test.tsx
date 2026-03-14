import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import DropColumnModal from './DropColumnModal';

const mockInvoke = vi.mocked(invoke);

const defaultProps = {
  connectionName: 'my-conn',
  database: 'mydb',
  table: 'users',
  column: 'email',
  dbType: 'postgres' as const,
  onDropped: vi.fn(),
  onCancel: vi.fn(),
};

function renderModal(props = {}) {
  return render(<DropColumnModal {...defaultProps} {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DropColumnModal', () => {
  it('renders heading, warning, label, input, and buttons', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Drop Column' })).toBeInTheDocument();
    expect(screen.getByText(/irreversible/i)).toBeInTheDocument();
    expect(screen.getAllByText('email').length).toBeGreaterThan(0);
    expect(screen.getAllByText('users').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drop Column' })).toBeInTheDocument();
  });

  it('Drop Column button is disabled when input is empty', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Drop Column' })).toBeDisabled();
  });

  it('Drop Column button is disabled when confirmation does not match column', () => {
    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'em' } });
    expect(screen.getByRole('button', { name: 'Drop Column' })).toBeDisabled();
  });

  it('Drop Column button is enabled when confirmation matches column', () => {
    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'email' } });
    expect(screen.getByRole('button', { name: 'Drop Column' })).toBeEnabled();
  });

  it('Cancel button calls onCancel', () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls execute_ddl with postgres SQL and calls onDropped on success', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const onDropped = vi.fn();
    renderModal({ onDropped });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop Column' }));

    await waitFor(() => expect(onDropped).toHaveBeenCalledOnce());
    expect(mockInvoke).toHaveBeenCalledWith('execute_ddl', {
      connection: 'my-conn',
      database: 'mydb',
      sql: 'ALTER TABLE "users" DROP COLUMN "email"',
    });
  });

  it('calls execute_ddl with mysql backtick SQL on success', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const onDropped = vi.fn();
    renderModal({ dbType: 'mysql', onDropped });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop Column' }));

    await waitFor(() => expect(onDropped).toHaveBeenCalledOnce());
    expect(mockInvoke).toHaveBeenCalledWith('execute_ddl', {
      connection: 'my-conn',
      database: 'mydb',
      sql: 'ALTER TABLE `users` DROP COLUMN `email`',
    });
  });

  it('shows loading state while dropping', async () => {
    let resolve: () => void;
    mockInvoke.mockReturnValueOnce(new Promise<void>((r) => { resolve = r; }));

    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop Column' }));

    expect(await screen.findByRole('button', { name: 'Dropping…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    resolve!();
  });

  it('shows error and resets loading on failure', async () => {
    mockInvoke.mockRejectedValueOnce('column not found');
    renderModal();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop Column' }));

    expect(await screen.findByText('column not found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drop Column' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('does not call onDropped on error', async () => {
    mockInvoke.mockRejectedValueOnce('fail');
    const onDropped = vi.fn();
    renderModal({ onDropped });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop Column' }));

    await screen.findByText('fail');
    expect(onDropped).not.toHaveBeenCalled();
  });

  it('dismisses error when X is clicked', async () => {
    mockInvoke.mockRejectedValueOnce('oops');
    renderModal();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop Column' }));

    const errorDiv = await screen.findByText('oops');
    const dismissBtn = errorDiv.closest('div')!.querySelector('button')!;
    fireEvent.click(dismissBtn);
    expect(screen.queryByText('oops')).not.toBeInTheDocument();
  });

  it('triggers drop on Enter when confirmation matches', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const onDropped = vi.fn();
    renderModal({ onDropped });

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'email' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(onDropped).toHaveBeenCalledOnce());
  });

  it('does not trigger drop on Enter when confirmation does not match', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const onDropped = vi.fn();
    renderModal({ onDropped });

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'wrong' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await new Promise((r) => setTimeout(r, 50));
    expect(onDropped).not.toHaveBeenCalled();
  });
});
