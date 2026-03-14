import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useColumnResize } from './useColumnResize';

afterEach(() => {
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
});

function makeThWithHandle() {
  const th = document.createElement('th');
  // getBoundingClientRect returns 0 by default in jsdom; stub width
  th.getBoundingClientRect = () =>
    ({ width: 120 } as DOMRect);
  document.body.appendChild(th);
  return th;
}

function startResizeOnCol(
  startResize: (e: React.MouseEvent, col: string) => void,
  th: HTMLElement,
  col: string,
  clientX: number
) {
  startResize(
    {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      clientX,
      currentTarget: th,
    } as unknown as React.MouseEvent,
    col
  );
}

describe('useColumnResize', () => {
  it('initial colWidths is empty', () => {
    const { result } = renderHook(() => useColumnResize());
    expect(result.current.colWidths).toEqual({});
  });

  it('startResize sets document.body.style.cursor to col-resize', () => {
    const { result } = renderHook(() => useColumnResize());
    const th = makeThWithHandle();
    act(() => { startResizeOnCol(result.current.startResize, th, 'name', 100); });
    expect(document.body.style.cursor).toBe('col-resize');
    act(() => { document.dispatchEvent(new MouseEvent('mouseup')); });
    th.remove();
  });

  it('mousemove after startResize updates colWidths for the column', () => {
    const { result } = renderHook(() => useColumnResize());
    const th = makeThWithHandle(); // width = 120
    act(() => { startResizeOnCol(result.current.startResize, th, 'age', 100); });
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200 }));
    });
    // startW=120, startX=100, clientX=200 → 120 + 100 = 220
    expect(result.current.colWidths['age']).toBe(220);
    act(() => { document.dispatchEvent(new MouseEvent('mouseup')); });
    th.remove();
  });

  it('width is clamped to min 50px when dragged far left', () => {
    const { result } = renderHook(() => useColumnResize());
    const th = makeThWithHandle(); // width = 120
    act(() => { startResizeOnCol(result.current.startResize, th, 'email', 100); });
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0 }));
    });
    // startW=120, startX=100, clientX=0 → 120 - 100 = 20 → clamped to 50
    expect(result.current.colWidths['email']).toBe(50);
    act(() => { document.dispatchEvent(new MouseEvent('mouseup')); });
    th.remove();
  });

  it('mouseup clears cursor and further mousemoves have no effect', () => {
    const { result } = renderHook(() => useColumnResize());
    const th = makeThWithHandle();
    act(() => { startResizeOnCol(result.current.startResize, th, 'id', 100); });
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));
    });
    const widthAfterMove = result.current.colWidths['id'];
    act(() => { document.dispatchEvent(new MouseEvent('mouseup')); });
    expect(document.body.style.cursor).toBe('');
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 300 }));
    });
    expect(result.current.colWidths['id']).toBe(widthAfterMove);
    th.remove();
  });

  it('startResize when currentTarget is not inside a <th> uses fallback width 150', () => {
    const { result } = renderHook(() => useColumnResize());
    const div = document.createElement('div');
    document.body.appendChild(div);
    act(() => {
      result.current.startResize(
        {
          preventDefault: vi.fn(),
          stopPropagation: vi.fn(),
          clientX: 100,
          currentTarget: div,
        } as unknown as React.MouseEvent,
        'col'
      );
    });
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200 }));
    });
    // startW=150 (fallback), startX=100, clientX=200 → 150 + 100 = 250
    expect(result.current.colWidths['col']).toBe(250);
    act(() => { document.dispatchEvent(new MouseEvent('mouseup')); });
    div.remove();
  });

  it('onMove is a no-op after mouseup clears resizingRef', () => {
    const { result } = renderHook(() => useColumnResize());
    const th = makeThWithHandle();
    act(() => { startResizeOnCol(result.current.startResize, th, 'x', 100); });
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200 }));
    });
    const widthAfterFirstMove = result.current.colWidths['x'];
    act(() => { document.dispatchEvent(new MouseEvent('mouseup')); });
    // mousemove after mouseup should be ignored (resizingRef is null)
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 400 }));
    });
    expect(result.current.colWidths['x']).toBe(widthAfterFirstMove);
    th.remove();
  });

  it('onMove early-return guard fires when resizingRef is null but listener is still attached', () => {
    const { result } = renderHook(() => useColumnResize());
    const th = makeThWithHandle();
    act(() => { startResizeOnCol(result.current.startResize, th, 'guard', 100); });
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 200 }));
    });
    // startW=120, startX=100, clientX=200 → 220
    const widthSnapshot = result.current.colWidths['guard'];

    // Intercept removeEventListener so the mousemove listener survives mouseup.
    // This lets us call onMove while resizingRef.current is null, covering the
    // early-return guard branch.
    const origRemove = document.removeEventListener.bind(document);
    const spy = vi.spyOn(document, 'removeEventListener').mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
        if (type !== 'mousemove') origRemove(type, listener as EventListener, options as boolean);
      }
    );

    act(() => { document.dispatchEvent(new MouseEvent('mouseup')); });
    // resizingRef.current is now null; onMove listener still attached
    spy.mockRestore();

    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 400 }));
    });
    // onMove returns early → width unchanged
    expect(result.current.colWidths['guard']).toBe(widthSnapshot);
    th.remove();
  });
});
