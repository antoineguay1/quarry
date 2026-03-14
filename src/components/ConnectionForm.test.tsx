import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import ConnectionForm from './ConnectionForm';
import type { SavedConnection } from '@/types';

const savedConn: SavedConnection = {
  name: 'My DB',
  dbType: 'postgres',
  host: 'db.example.com',
  port: 5432,
  database: 'mydb',
  username: 'admin',
};

type Props = React.ComponentProps<typeof ConnectionForm>;

async function renderNew(overrides: Partial<Props> = {}) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <ConnectionForm onConnected={vi.fn()} onClose={vi.fn()} {...overrides} />,
    );
  });
  return result;
}

async function renderEdit(conn: SavedConnection = savedConn, overrides: Partial<Props> = {}) {
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <ConnectionForm
        onConnected={vi.fn()}
        onClose={vi.fn()}
        initialConnection={conn}
        {...overrides}
      />,
    );
  });
  return result;
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => vi.clearAllMocks());

// ── 1. Rendering – new connection ─────────────────────────────────────────────

describe('rendering – new connection', () => {
  it('shows "New Connection" title', async () => {
    await renderNew();
    expect(screen.getByText('New Connection')).toBeInTheDocument();
  });

  it('name input is empty by default', async () => {
    await renderNew();
    expect(screen.getByPlaceholderText('My Database')).toHaveValue('');
  });

  it('host defaults to "localhost"', async () => {
    await renderNew();
    expect(screen.getByDisplayValue('localhost')).toBeInTheDocument();
  });

  it('port defaults to 5432', async () => {
    await renderNew();
    expect(screen.getByDisplayValue('5432')).toBeInTheDocument();
  });

  it('"Connect" button is disabled when name is empty', async () => {
    await renderNew();
    expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
  });

  it('"Test Connection" button is present and enabled', async () => {
    await renderNew();
    expect(screen.getByRole('button', { name: 'Test Connection' })).not.toBeDisabled();
  });

  it('does not show "Leave password empty" message', async () => {
    await renderNew();
    expect(screen.queryByText(/Leave password empty/)).not.toBeInTheDocument();
  });

  it('password input is of type "password" initially', async () => {
    const { container } = await renderNew();
    expect(container.querySelector('input[type="password"]')).toBeInTheDocument();
  });
});

// ── 2. Rendering – edit mode ─────────────────────────────────────────────────

describe('rendering – edit mode', () => {
  it('shows "Edit Connection" title', async () => {
    await renderEdit();
    expect(screen.getByText('Edit Connection')).toBeInTheDocument();
  });

  it('pre-fills name from initialConnection', async () => {
    await renderEdit();
    expect(screen.getByDisplayValue('My DB')).toBeInTheDocument();
  });

  it('pre-fills host from initialConnection', async () => {
    await renderEdit();
    expect(screen.getByDisplayValue('db.example.com')).toBeInTheDocument();
  });

  it('pre-fills port from initialConnection', async () => {
    await renderEdit();
    expect(screen.getByDisplayValue('5432')).toBeInTheDocument();
  });

  it('pre-fills database from initialConnection', async () => {
    await renderEdit();
    expect(screen.getByDisplayValue('mydb')).toBeInTheDocument();
  });

  it('pre-fills username from initialConnection', async () => {
    await renderEdit();
    expect(screen.getByDisplayValue('admin')).toBeInTheDocument();
  });

  it('shows "Leave password empty" message', async () => {
    await renderEdit();
    expect(screen.getByText(/Leave password empty/)).toBeInTheDocument();
  });

  it('password placeholder is "••••••••"', async () => {
    await renderEdit();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('"Connect" button is enabled when name is pre-filled', async () => {
    await renderEdit();
    expect(screen.getByRole('button', { name: 'Connect' })).not.toBeDisabled();
  });
});

// ── 3. Close button ───────────────────────────────────────────────────────────

describe('close button', () => {
  it('clicking X calls onClose', async () => {
    const onClose = vi.fn();
    const { container } = await renderNew({ onClose });
    const header = container.querySelector('.flex.items-center.justify-between')!;
    fireEvent.click(header.querySelector('button')!);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

// ── 4. Form field changes ─────────────────────────────────────────────────────

describe('form field changes', () => {
  it('typing in name enables the Connect button', async () => {
    await renderNew();
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: 'My Conn' } });
    expect(screen.getByRole('button', { name: 'Connect' })).not.toBeDisabled();
  });

  it('Connect button re-disables when name becomes empty', async () => {
    await renderNew();
    const nameInput = screen.getByPlaceholderText('My Database');
    fireEvent.change(nameInput, { target: { value: 'My Conn' } });
    fireEvent.change(nameInput, { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
  });

  it('Connect button is disabled when name is only whitespace', async () => {
    await renderNew();
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: 'Connect' })).toBeDisabled();
  });

  it('typing in host updates the input value', async () => {
    await renderNew();
    const hostInput = screen.getByPlaceholderText('localhost');
    fireEvent.change(hostInput, { target: { value: '192.168.1.1' } });
    expect(hostInput).toHaveValue('192.168.1.1');
  });

  it('typing in port updates the input value', async () => {
    const { container } = await renderNew();
    const portInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(portInput, { target: { value: '3307' } });
    expect(portInput).toHaveValue(3307);
  });

  it('typing in database updates the input value', async () => {
    await renderNew();
    const dbInput = screen.getByPlaceholderText('my_database');
    fireEvent.change(dbInput, { target: { value: 'testdb' } });
    expect(dbInput).toHaveValue('testdb');
  });

  it('typing in username updates the input value', async () => {
    await renderNew();
    const userInput = screen.getByPlaceholderText('postgres');
    fireEvent.change(userInput, { target: { value: 'myuser' } });
    expect(userInput).toHaveValue('myuser');
  });

  it('typing in password updates the input value', async () => {
    const { container } = await renderNew();
    const pwInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(pwInput, { target: { value: 'secret' } });
    expect(pwInput).toHaveValue('secret');
  });
});

// ── 5. DB type select ────────────────────────────────────────────────────────

describe('DB type select', () => {
  it('initial DB type is postgres (port 5432)', async () => {
    const { container } = await renderNew();
    const portInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(portInput).toHaveValue(5432);
  });

  it('selecting MySQL sets port to 3306', async () => {
    const { container } = await renderNew();
    // Open the Radix Select by clicking the trigger
    fireEvent.click(screen.getByRole('combobox'));
    // Select the MySQL option from the portal
    const mysqlOption = [...document.body.querySelectorAll('[role="option"]')].find(
      (el) => el.textContent === 'MySQL',
    )!;
    fireEvent.click(mysqlOption);
    const portInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(portInput).toHaveValue(3306);
  });

  it('selecting postgres from MySQL restores port to 5432', async () => {
    const { container } = await renderNew();
    // Select MySQL first
    fireEvent.click(screen.getByRole('combobox'));
    const mysqlOption = [...document.body.querySelectorAll('[role="option"]')].find(
      (el) => el.textContent === 'MySQL',
    )!;
    fireEvent.click(mysqlOption);
    // Select postgres back
    fireEvent.click(screen.getByRole('combobox'));
    const postgresOption = [...document.body.querySelectorAll('[role="option"]')].find(
      (el) => el.textContent === 'PostgreSQL',
    )!;
    fireEvent.click(postgresOption);
    const portInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(portInput).toHaveValue(5432);
  });

  it('edit mode pre-selects mysql db type', async () => {
    const mysqlConn: SavedConnection = { ...savedConn, dbType: 'mysql', port: 3306 };
    const { container } = await renderEdit(mysqlConn);
    const portInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(portInput).toHaveValue(3306);
  });
});

// ── 6. Show/hide password toggle ─────────────────────────────────────────────

describe('show/hide password toggle', () => {
  it('password is hidden by default', async () => {
    const { container } = await renderNew();
    expect(container.querySelector('input[type="password"]')).toBeInTheDocument();
    expect(container.querySelector('input[type="text"]')).not.toBeInTheDocument();
  });

  it('clicking the eye button shows the password', async () => {
    const { container } = await renderNew();
    const eyeBtn = container.querySelector('.relative button') as HTMLButtonElement;
    fireEvent.click(eyeBtn);
    // After toggle, the password input should be type="text"
    expect(container.querySelector('input[type="text"]')).toBeInTheDocument();
    expect(container.querySelector('input[type="password"]')).not.toBeInTheDocument();
  });

  it('clicking the eye button twice hides the password again', async () => {
    const { container } = await renderNew();
    const eyeBtn = container.querySelector('.relative button') as HTMLButtonElement;
    fireEvent.click(eyeBtn);
    fireEvent.click(eyeBtn);
    expect(container.querySelector('input[type="password"]')).toBeInTheDocument();
  });
});

// ── 7. Test Connection – new connection ──────────────────────────────────────

describe('Test Connection – new connection', () => {
  it('calls invoke("test_connection") with password and savedName: null', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const { container } = await renderNew();
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: 'Conn' } });
    const pwInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(pwInput, { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));
    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('test_connection', {
        dbType: 'postgres',
        host: 'localhost',
        port: 5432,
        database: '',
        username: '',
        password: 'secret',
        savedName: null,
      }),
    );
  });

  it('success: shows "Connection successful." message', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await renderNew();
    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));
    await waitFor(() =>
      expect(screen.getByText('Connection successful.')).toBeInTheDocument(),
    );
  });

  it('failure: shows error message and testStatus becomes "fail"', async () => {
    vi.mocked(invoke).mockRejectedValue('Connection refused');
    await renderNew();
    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));
    await waitFor(() =>
      expect(screen.getByText('Connection refused')).toBeInTheDocument(),
    );
  });

  it('while testing: button shows "Testing…" and is disabled', async () => {
    vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));
    await renderNew();
    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Testing/ })).toBeDisabled(),
    );
  });

  it('while testing: Connect button is NOT disabled (only Test button is)', async () => {
    vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));
    await renderNew();
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Testing/ })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Connect' })).not.toBeDisabled();
  });
});

// ── 8. Test Connection – edit mode ───────────────────────────────────────────

describe('Test Connection – edit mode', () => {
  it('no new password: calls invoke with password: null, savedName set', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await renderEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));
    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('test_connection', {
        dbType: 'postgres',
        host: 'db.example.com',
        port: 5432,
        database: 'mydb',
        username: 'admin',
        password: null,
        savedName: 'My DB',
      }),
    );
  });

  it('new password typed: calls invoke with password and savedName: null', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const { container } = await renderEdit();
    const pwInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(pwInput, { target: { value: 'newpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));
    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('test_connection', {
        dbType: 'postgres',
        host: 'db.example.com',
        port: 5432,
        database: 'mydb',
        username: 'admin',
        password: 'newpass',
        savedName: null,
      }),
    );
  });
});

// ── 9. Success message dismissal ─────────────────────────────────────────────

describe('success message dismissal', () => {
  it('clicking dismiss on success message clears it', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    await renderNew();
    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));
    await waitFor(() =>
      expect(screen.getByText('Connection successful.')).toBeInTheDocument(),
    );
    // Dismiss the success message
    const successEl = screen.getByText('Connection successful.').closest('div')!;
    fireEvent.click(successEl.querySelector('button')!);
    expect(screen.queryByText('Connection successful.')).not.toBeInTheDocument();
  });
});

// ── 10. handleSubmit – new connection ─────────────────────────────────────────

describe('handleSubmit – new connection', () => {
  it('empty name: does not call invoke', async () => {
    await renderNew();
    fireEvent.submit(screen.getByRole('button', { name: 'Connect' }).closest('form')!);
    expect(vi.mocked(invoke)).not.toHaveBeenCalled();
  });

  it('whitespace-only name: does not call invoke', async () => {
    await renderNew();
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: '  ' } });
    // Connect button is disabled for whitespace, but submit form directly
    fireEvent.submit(screen.getByRole('button', { name: 'Connect' }).closest('form')!);
    expect(vi.mocked(invoke)).not.toHaveBeenCalled();
  });

  it('success: calls save_connection, connect_saved, then onConnected', async () => {
    const onConnected = vi.fn();
    vi.mocked(invoke).mockResolvedValue(undefined);
    const { container } = await renderNew({ onConnected });
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: 'My Conn' } });
    fireEvent.change(screen.getByPlaceholderText('my_database'), { target: { value: 'testdb' } });
    const pwInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(pwInput, { target: { value: 'pass123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(onConnected).toHaveBeenCalledWith('My Conn', 'testdb'));
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('save_connection', {
      connection: {
        name: 'My Conn',
        dbType: 'postgres',
        host: 'localhost',
        port: 5432,
        database: 'testdb',
        username: '',
      },
      password: 'pass123',
    });
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('connect_saved', { name: 'My Conn' });
  });

  it('name is trimmed before submit', async () => {
    const onConnected = vi.fn();
    vi.mocked(invoke).mockResolvedValue(undefined);
    await renderNew({ onConnected });
    fireEvent.change(screen.getByPlaceholderText('My Database'), {
      target: { value: '  Trimmed Name  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(onConnected).toHaveBeenCalledWith('Trimmed Name', ''));
  });

  it('error: shows error message and Connect button re-enables', async () => {
    vi.mocked(invoke).mockRejectedValue('Auth failed');
    await renderNew();
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: 'conn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(screen.getByText('Auth failed')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Connect' })).not.toBeDisabled();
  });

  it('while connecting: button shows "Connecting…" and is disabled', async () => {
    vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));
    await renderNew();
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: 'conn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Connecting…' })).toBeDisabled(),
    );
  });
});

// ── 11. handleSubmit – edit mode ─────────────────────────────────────────────

describe('handleSubmit – edit mode', () => {
  it('success: calls update_connection, connect_saved, then onConnected', async () => {
    const onConnected = vi.fn();
    vi.mocked(invoke).mockResolvedValue(undefined);
    await renderEdit(savedConn, { onConnected });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(onConnected).toHaveBeenCalledWith('My DB', 'mydb'));
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('update_connection', {
      oldName: 'My DB',
      connection: {
        name: 'My DB',
        dbType: 'postgres',
        host: 'db.example.com',
        port: 5432,
        database: 'mydb',
        username: 'admin',
      },
      newPassword: null,
    });
    expect(vi.mocked(invoke)).toHaveBeenCalledWith('connect_saved', { name: 'My DB' });
  });

  it('sends newPassword when a new password is typed', async () => {
    vi.mocked(invoke).mockResolvedValue(undefined);
    const { container } = await renderEdit();
    const pwInput = container.querySelector('input[type="password"]') as HTMLInputElement;
    fireEvent.change(pwInput, { target: { value: 'newpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('update_connection', expect.objectContaining({
        newPassword: 'newpass',
      })),
    );
  });

  it('error: shows error message', async () => {
    vi.mocked(invoke).mockRejectedValue('Update failed');
    await renderEdit();
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(screen.getByText('Update failed')).toBeInTheDocument());
  });
});

// ── 12. Error dismissal ───────────────────────────────────────────────────────

describe('error dismissal', () => {
  it('clicking X on error message clears it', async () => {
    vi.mocked(invoke).mockRejectedValue('Oops');
    await renderNew();
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: 'conn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(screen.getByText('Oops')).toBeInTheDocument());
    const errorEl = screen.getByText('Oops').closest('div')!;
    fireEvent.click(errorEl.querySelector('button')!);
    await waitFor(() => expect(screen.queryByText('Oops')).not.toBeInTheDocument());
  });

  it('a new submit clears a previous error', async () => {
    vi.mocked(invoke).mockRejectedValueOnce('First error').mockResolvedValue(undefined);
    const onConnected = vi.fn();
    await renderNew({ onConnected });
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: 'conn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(screen.getByText('First error')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(onConnected).toHaveBeenCalled());
    expect(screen.queryByText('First error')).not.toBeInTheDocument();
  });
});

// ── 13. Test clears error / error clears test ─────────────────────────────────

describe('error state interactions', () => {
  it('clicking Test clears a previous submit error', async () => {
    vi.mocked(invoke).mockRejectedValueOnce('Connect error').mockResolvedValue(undefined);
    await renderNew();
    fireEvent.change(screen.getByPlaceholderText('My Database'), { target: { value: 'conn' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
    await waitFor(() => expect(screen.getByText('Connect error')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Connect' })); // re-enable might be needed
    // Click Test which should clear error
    await waitFor(() => expect(screen.getByRole('button', { name: 'Connect' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Test Connection' }));
    await waitFor(() => expect(screen.queryByText('Connect error')).not.toBeInTheDocument());
  });
});
