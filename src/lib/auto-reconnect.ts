import { invoke } from '@tauri-apps/api/core';

export async function withAutoReconnect<T>(
  connectionName: string,
  database: string,
  fn_: () => Promise<T>,
): Promise<T> {
  try {
    return await fn_();
  } catch (err) {
    if (String(err).includes('Not connected')) {
      await invoke('connect_saved', { name: connectionName });
      await invoke('connect_database', { connection: connectionName, database });
      return fn_();
    }
    throw err;
  }
}
