import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useTheme } from './useTheme';

describe('useTheme', () => {
  it('toggleTheme switches from current theme to the opposite', () => {
    const { result } = renderHook(() => useTheme());
    const before = result.current.theme;
    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).not.toBe(before);
    expect(['light', 'dark']).toContain(result.current.theme);
  });

  it('after toggleTheme, document.documentElement.classList reflects new theme', () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.toggleTheme(); });
    const isDark = document.documentElement.classList.contains('dark');
    expect(isDark).toBe(result.current.theme === 'dark');
  });

  it('after toggleTheme, localStorage reflects new theme', () => {
    const { result } = renderHook(() => useTheme());
    act(() => { result.current.toggleTheme(); });
    expect(localStorage.getItem('quarry-theme')).toBe(result.current.theme);
  });

  it('toggleTheme twice returns to original theme', () => {
    const { result } = renderHook(() => useTheme());
    const original = result.current.theme;
    act(() => { result.current.toggleTheme(); });
    act(() => { result.current.toggleTheme(); });
    expect(result.current.theme).toBe(original);
  });

  it('theme value returned by hook matches document class', () => {
    const { result } = renderHook(() => useTheme());
    const isDark = document.documentElement.classList.contains('dark');
    expect(result.current.theme).toBe(isDark ? 'dark' : 'light');
  });
});

describe('useTheme - getInitialTheme (module-level)', () => {
  it('reads stored "light" theme from localStorage on init', async () => {
    vi.resetModules();
    localStorage.setItem('quarry-theme', 'light');
    const { useTheme: freshUseTheme } = await import('./useTheme');
    const { result } = renderHook(() => freshUseTheme());
    expect(result.current.theme).toBe('light');
  });

  it('reads stored "dark" theme from localStorage on init', async () => {
    vi.resetModules();
    localStorage.setItem('quarry-theme', 'dark');
    const { useTheme: freshUseTheme } = await import('./useTheme');
    const { result } = renderHook(() => freshUseTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('falls back to matchMedia dark when localStorage has no valid theme', async () => {
    vi.resetModules();
    localStorage.removeItem('quarry-theme');
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    const { useTheme: freshUseTheme } = await import('./useTheme');
    const { result } = renderHook(() => freshUseTheme());
    expect(result.current.theme).toBe('dark');
  });

  it('falls back to matchMedia light when no stored theme and system prefers light', async () => {
    vi.resetModules();
    localStorage.removeItem('quarry-theme');
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    const { useTheme: freshUseTheme } = await import('./useTheme');
    const { result } = renderHook(() => freshUseTheme());
    expect(result.current.theme).toBe('light');
  });
});
