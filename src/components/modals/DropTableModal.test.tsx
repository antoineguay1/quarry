import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import DropTableModal from './DropTableModal';

const mockInvoke = vi.mocked(invoke);

const defaultProps = {
  connectionName: 'my-conn',
  database: 'mydb',
  table: 'users',
  dbType: 'postgres' as const,
  onDropped: vi.fn(),
  onCancel: vi.fn(),
};

function renderModal(props = {}) {
  return render(<DropTableModal {...defaultProps} {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DropTableModal', () => {
  it('renders title', () => {
    renderModal();
    expect(screen.getByRole('heading', { name: 'Drop Table' })).toBeInTheDocument();
  });

  it('shows table name in warning and label', () => {
    renderModal();
    expect(screen.getAllByText('users').length).toBeGreaterThan(0);
  });

  it('Drop Table button is disabled when confirmation is empty', () => {
    renderModal();
    expect(screen.getByRole('button', { name: 'Drop Table' })).toBeDisabled();
  });

  it('Drop Table button is disabled when confirmation does not match', () => {
    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'wrong' } });
    expect(screen.getByRole('button', { name: 'Drop Table' })).toBeDisabled();
  });

  it('Drop Table button is enabled when confirmation matches table name', () => {
    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'users' } });
    expect(screen.getByRole('button', { name: 'Drop Table' })).toBeEnabled();
  });

  it('Cancel button calls onCancel', () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls execute_ddl with postgres SQL on drop', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const onDropped = vi.fn();
    renderModal({ onDropped });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'users' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop Table' }));

    await waitFor(() => expect(onDropped).toHaveBeenCalledOnce());

    expect(mockInvoke).toHaveBeenCalledWith('execute_ddl', {
      connection: 'my-conn',
      database: 'mydb',
      sql: 'DROP TABLE "users"',
    });
  });

  it('uses backtick SQL for mysql', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const onDropped = vi.fn();
    renderModal({ dbType: 'mysql', onDropped });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'users' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop Table' }));

    await waitFor(() => expect(onDropped).toHaveBeenCalledOnce());

    expect(mockInvoke).toHaveBeenCalledWith('execute_ddl', {
      connection: 'my-conn',
      database: 'mydb',
      sql: 'DROP TABLE `users`',
    });
  });

  it('shows loading state while dropping', async () => {
    let resolve: () => void;
    mockInvoke.mockReturnValueOnce(new Promise<void>((r) => { resolve = r; }));

    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'users' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop Table' }));

    expect(await screen.findByRole('button', { name: 'Dropping…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    resolve!();
  });

  it('shows error and resets loading on failure', async () => {
    mockInvoke.mockRejectedValueOnce('connection refused');
    renderModal();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'users' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop Table' }));

    expect(await screen.findByText('connection refused')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Drop Table' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
  });

  it('dismisses error when X is clicked', async () => {
    mockInvoke.mockRejectedValueOnce('oops');
    renderModal();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'users' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop Table' }));

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
    fireEvent.change(input, { target: { value: 'users' } });
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

  it('does not call onDropped on error', async () => {
    mockInvoke.mockRejectedValueOnce('fail');
    const onDropped = vi.fn();
    renderModal({ onDropped });

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'users' } });
    fireEvent.click(screen.getByRole('button', { name: 'Drop Table' }));

    await screen.findByText('fail');
    expect(onDropped).not.toHaveBeenCalled();
  });
});
