import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useSidebar } from './useSidebar';
import { STORAGE_KEYS } from '@/lib/storage';

describe('useSidebar', () => {
  it('defaults to width=224 and panel="connections" when no localStorage', () => {
    const { result } = renderHook(() => useSidebar());
    expect(result.current.sidebarWidth).toBe(224);
    expect(result.current.activePanel).toBe('connections');
  });

  it('restores width and panel from localStorage on init', () => {
    localStorage.setItem(
      STORAGE_KEYS.SIDEBAR,
      JSON.stringify({ width: 350, panel: 'queries' })
    );
    const { result } = renderHook(() => useSidebar());
    expect(result.current.sidebarWidth).toBe(350);
    expect(result.current.activePanel).toBe('queries');
  });

  it('togglePanel opens that panel', () => {
    const { result } = renderHook(() => useSidebar());
    act(() => { result.current.setActivePanel(null); });
    act(() => { result.current.togglePanel('connections'); });
    expect(result.current.activePanel).toBe('connections');
  });

  it('togglePanel on active panel collapses it to null', () => {
    const { result } = renderHook(() => useSidebar());
    // default is 'connections'
    act(() => { result.current.togglePanel('connections'); });
    expect(result.current.activePanel).toBeNull();
  });

  it('togglePanel switches to a different panel', () => {
    const { result } = renderHook(() => useSidebar());
    act(() => { result.current.togglePanel('queries'); });
    expect(result.current.activePanel).toBe('queries');
  });

  it('state is persisted to localStorage after change', async () => {
    const { result } = renderHook(() => useSidebar());
    act(() => { result.current.togglePanel('queries'); });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.SIDEBAR) ?? '{}') as {
      width: number;
      panel: string | null;
    };
    expect(stored.panel).toBe('queries');
    expect(stored.width).toBe(224);
  });

  it('handleResizeStart: mousemove updates sidebarWidth', () => {
    const { result } = renderHook(() => useSidebar());
    act(() => {
      result.current.handleResizeStart({
        preventDefault: vi.fn(),
        clientX: 200,
      } as unknown as React.MouseEvent);
    });
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 300 }));
    });
    // startWidth=224, startX=200, clientX=300 → 224 + 100 = 324
    expect(result.current.sidebarWidth).toBe(324);
  });

  it('sidebarWidth is clamped to min=160 and max=480', () => {
    const { result } = renderHook(() => useSidebar());
    // min clamp: move far left
    act(() => {
      result.current.handleResizeStart({
        preventDefault: vi.fn(),
        clientX: 200,
      } as unknown as React.MouseEvent);
    });
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0 }));
    });
    expect(result.current.sidebarWidth).toBe(160);

    // max clamp: move far right (mouseup to clean up first, then restart)
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup'));
    });
    act(() => {
      result.current.handleResizeStart({
        preventDefault: vi.fn(),
        clientX: 160,
      } as unknown as React.MouseEvent);
    });
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 800 }));
    });
    expect(result.current.sidebarWidth).toBe(480);

    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup'));
    });
  });
});
