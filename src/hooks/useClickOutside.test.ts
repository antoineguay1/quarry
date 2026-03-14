import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useClickOutside } from './useClickOutside';

const created: HTMLElement[] = [];

function makeDiv() {
  const div = document.createElement('div');
  document.body.appendChild(div);
  created.push(div);
  return div;
}

function fireMousedown(target: EventTarget) {
  target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
}

afterEach(() => {
  created.forEach((el) => el.remove());
  created.length = 0;
});

describe('useClickOutside', () => {
  it('when open=false, click outside does NOT call onClose', () => {
    const onClose = vi.fn();
    const inner = makeDiv();
    renderHook(() => useClickOutside([{ current: inner }], false, onClose));
    fireMousedown(document.body);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('when open=true, click outside all refs calls onClose', () => {
    const onClose = vi.fn();
    const inner = makeDiv();
    const outer = makeDiv();
    renderHook(() => useClickOutside([{ current: inner }], true, onClose));
    fireMousedown(outer);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('when open=true, click inside ref does NOT call onClose', () => {
    const onClose = vi.fn();
    const inner = makeDiv();
    renderHook(() => useClickOutside([{ current: inner }], true, onClose));
    fireMousedown(inner);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('when open changes from true to false, listener is removed', () => {
    const onClose = vi.fn();
    const inner = makeDiv();
    const outer = makeDiv();
    const { rerender } = renderHook(
      ({ open }: { open: boolean }) =>
        useClickOutside([{ current: inner }], open, onClose),
      { initialProps: { open: true } }
    );
    rerender({ open: false });
    fireMousedown(outer);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('works with multiple refs: click inside any ref = no close, click outside = close', () => {
    const onClose = vi.fn();
    const div1 = makeDiv();
    const div2 = makeDiv();
    const outside = makeDiv();
    renderHook(() =>
      useClickOutside([{ current: div1 }, { current: div2 }], true, onClose)
    );
    fireMousedown(div1);
    fireMousedown(div2);
    expect(onClose).not.toHaveBeenCalled();
    fireMousedown(outside);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
