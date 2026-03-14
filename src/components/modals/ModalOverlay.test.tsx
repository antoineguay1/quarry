import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ModalOverlay from './ModalOverlay';

describe('ModalOverlay', () => {
  it('renders children', () => {
    render(<ModalOverlay><span>hello</span></ModalOverlay>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('applies max-w-sm class when size is sm (default)', () => {
    const { container } = render(<ModalOverlay><span>content</span></ModalOverlay>);
    const inner = container.firstChild?.firstChild as HTMLElement;
    expect(inner.className).toContain('max-w-sm');
    expect(inner.className).not.toContain('max-w-lg');
  });

  it('applies max-w-lg class when size is lg', () => {
    const { container } = render(<ModalOverlay size="lg"><span>content</span></ModalOverlay>);
    const inner = container.firstChild?.firstChild as HTMLElement;
    expect(inner.className).toContain('max-w-lg');
    expect(inner.className).not.toContain('max-w-sm');
  });

  it('outer div has fixed positioning and overlay classes', () => {
    const { container } = render(<ModalOverlay><span /></ModalOverlay>);
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain('fixed');
    expect(outer.className).toContain('inset-0');
    expect(outer.className).toContain('z-50');
  });
});
