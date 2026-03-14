import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { useAiKey } from './useAiKey';

describe('useAiKey', () => {
  it('hasKey is false when get_ai_key resolves to null', async () => {
    vi.mocked(invoke).mockResolvedValue(null);
    const { result } = renderHook(() => useAiKey());
    await act(async () => {});
    expect(result.current.hasKey).toBe(false);
  });

  it('hasKey is true when get_ai_key resolves to a string', async () => {
    vi.mocked(invoke).mockResolvedValue('sk-test-key');
    const { result } = renderHook(() => useAiKey());
    await act(async () => {});
    expect(result.current.hasKey).toBe(true);
  });

  it('hasKey is false when get_ai_key rejects', async () => {
    vi.mocked(invoke).mockRejectedValue(new Error('keychain error'));
    const { result } = renderHook(() => useAiKey());
    await act(async () => {});
    expect(result.current.hasKey).toBe(false);
  });

  it('saveKey calls invoke save_ai_key and sets hasKey to true', async () => {
    vi.mocked(invoke).mockResolvedValue(null);
    const { result } = renderHook(() => useAiKey());
    await act(async () => {});

    vi.mocked(invoke).mockResolvedValue(undefined);
    await act(async () => {
      await result.current.saveKey('my-api-key');
    });

    expect(vi.mocked(invoke)).toHaveBeenCalledWith('save_ai_key', { key: 'my-api-key' });
    expect(result.current.hasKey).toBe(true);
  });

  it('deleteKey calls invoke delete_ai_key and sets hasKey to false', async () => {
    vi.mocked(invoke).mockResolvedValue('sk-test');
    const { result } = renderHook(() => useAiKey());
    await act(async () => {});
    expect(result.current.hasKey).toBe(true);

    vi.mocked(invoke).mockResolvedValue(undefined);
    await act(async () => {
      await result.current.deleteKey();
    });

    expect(vi.mocked(invoke)).toHaveBeenCalledWith('delete_ai_key');
    expect(result.current.hasKey).toBe(false);
  });
});
