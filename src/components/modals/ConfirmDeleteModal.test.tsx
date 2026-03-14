import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConfirmDeleteModal from './ConfirmDeleteModal';

describe('ConfirmDeleteModal', () => {
  it('renders title and message', () => {
    render(
      <ConfirmDeleteModal
        title="Delete Connection"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Delete Connection')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('renders message as ReactNode', () => {
    render(
      <ConfirmDeleteModal
        title="Delete"
        message={<strong>bold message</strong>}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('bold message').tagName).toBe('STRONG');
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDeleteModal
        title="Delete"
        message="msg"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onConfirm when Delete is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteModal
        title="Delete"
        message="msg"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('does not call onConfirm when Cancel is clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDeleteModal
        title="Delete"
        message="msg"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('does not call onCancel when Delete is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDeleteModal
        title="Delete"
        message="msg"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
