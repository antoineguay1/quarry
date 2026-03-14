import { invoke } from '@tauri-apps/api/core';
import { useCallback, useEffect, useState } from 'react';

export function useAiKey() {
  const [hasKey, setHasKey] = useState(false);

  useEffect(() => {
    invoke<string | null>('get_ai_key')
      .then((key) => setHasKey(key !== null))
      .catch(() => setHasKey(false));
  }, []);

  const saveKey = useCallback(async (key: string) => {
    await invoke('save_ai_key', { key });
    setHasKey(true);
  }, []);

  const deleteKey = useCallback(async () => {
    await invoke('delete_ai_key');
    setHasKey(false);
  }, []);

  return { hasKey, saveKey, deleteKey };
}
