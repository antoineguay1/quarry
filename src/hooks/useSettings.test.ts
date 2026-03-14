import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useSettings, getSettings } from './useSettings';
import { STORAGE_KEYS } from '@/lib/storage';

describe('useSettings', () => {
  it('updateSetting("fontSize", 14) sets --quarry-font-size CSS variable to "14px"', () => {
    const { result } = renderHook(() => useSettings());
    act(() => {
      result.current.updateSetting('fontSize', 14);
    });
    expect(
      document.documentElement.style.getPropertyValue('--quarry-font-size')
    ).toBe('14px');
  });

  it('updateSetting("tableDensity", "compact") sets --quarry-cell-py to "4px"', () => {
    const { result } = renderHook(() => useSettings());
    act(() => {
      result.current.updateSetting('tableDensity', 'compact');
    });
    expect(
      document.documentElement.style.getPropertyValue('--quarry-cell-py')
    ).toBe('4px');
  });

  it('updateSetting("tableDensity", "comfortable") sets --quarry-cell-py to "8px"', () => {
    const { result } = renderHook(() => useSettings());
    act(() => {
      result.current.updateSetting('tableDensity', 'comfortable');
    });
    expect(
      document.documentElement.style.getPropertyValue('--quarry-cell-py')
    ).toBe('8px');
  });

  it('updateSetting persists to localStorage', () => {
    const { result } = renderHook(() => useSettings());
    act(() => {
      result.current.updateSetting('fontSize', 16);
    });
    const stored = JSON.parse(
      localStorage.getItem(STORAGE_KEYS.SETTINGS) ?? '{}'
    ) as { fontSize?: number };
    expect(stored.fontSize).toBe(16);
  });

  it('getSettings() returns current settings without a hook', () => {
    const { result } = renderHook(() => useSettings());
    act(() => {
      result.current.updateSetting('fontSize', 12);
    });
    expect(getSettings().fontSize).toBe(12);
  });

  it('loads settings from localStorage and merges with defaults on module init', async () => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({ fontSize: 16 }));
    vi.resetModules();
    const { getSettings: fresh } = await import('./useSettings');
    expect(fresh().fontSize).toBe(16);
    expect(fresh().defaultPageSize).toBe(100); // default merged in
    vi.resetModules();
  });

  it('corrupt localStorage falls back to defaults on module init', async () => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, 'invalid{{{json');
    vi.resetModules();
    const { getSettings: fresh } = await import('./useSettings');
    expect(fresh().fontSize).toBe(13); // DEFAULT.fontSize
    vi.resetModules();
  });
});
