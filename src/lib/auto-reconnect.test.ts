import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { withAutoReconnect } from './auto-reconnect';

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  mockInvoke.mockReset();
});

describe('withAutoReconnect', () => {
  it('happy path: returns result without invoking connect', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withAutoReconnect('conn', 'db', fn);
    expect(result).toBe('ok');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('reconnects and retries on "Not connected" error', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Not connected'))
      .mockResolvedValueOnce('retried');

    const result = await withAutoReconnect('myconn', 'mydb', fn);

    expect(result).toBe('retried');
    expect(mockInvoke).toHaveBeenCalledWith('connect_saved', { name: 'myconn' });
    expect(mockInvoke).toHaveBeenCalledWith('connect_database', { connection: 'myconn', database: 'mydb' });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('rethrows immediately on non-reconnect errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Syntax error'));
    await expect(withAutoReconnect('conn', 'db', fn)).rejects.toThrow('Syntax error');
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('rethrows invoke error when reconnect itself fails', async () => {
    mockInvoke.mockRejectedValue(new Error('Keychain error'));
    const fn = vi.fn().mockRejectedValue(new Error('Not connected'));
    await expect(withAutoReconnect('conn', 'db', fn)).rejects.toThrow('Keychain error');
  });
});
