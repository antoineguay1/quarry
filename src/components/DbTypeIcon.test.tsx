import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DbTypeIcon from './DbTypeIcon';

describe('DbTypeIcon', () => {
  it('renders a postgres icon with correct attributes', () => {
    const { container } = render(<DbTypeIcon type="postgres" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg).toHaveAttribute('aria-label', 'PostgreSQL');
    expect(svg).toHaveAttribute('fill', '#336791');
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
  });

  it('renders a mysql icon with correct attributes', () => {
    const { container } = render(<DbTypeIcon type="mysql" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg).toHaveAttribute('aria-label', 'MySQL');
    expect(svg).toHaveAttribute('fill', '#00618A');
    expect(svg).toHaveAttribute('viewBox', '0 0 128 128');
  });

  it('uses default size of 14', () => {
    const { container } = render(<DbTypeIcon type="postgres" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '14');
    expect(svg).toHaveAttribute('height', '14');
  });

  it('applies custom size', () => {
    const { container } = render(<DbTypeIcon type="postgres" size={24} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });

  it('applies custom className', () => {
    const { container } = render(<DbTypeIcon type="postgres" className="custom-class" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('custom-class');
    expect(svg?.getAttribute('class')).toContain('shrink-0');
  });

  it('always includes shrink-0 class', () => {
    const { container } = render(<DbTypeIcon type="mysql" />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('class')).toContain('shrink-0');
  });

  it('renders the correct path for postgres', () => {
    const { container } = render(<DbTypeIcon type="postgres" />);
    const path = container.querySelector('path');
    expect(path?.getAttribute('d')).toMatch(/^M23\.5594/);
  });

  it('renders the correct path for mysql', () => {
    const { container } = render(<DbTypeIcon type="mysql" />);
    const path = container.querySelector('path');
    expect(path?.getAttribute('d')).toMatch(/^M117\.688/);
  });

  it('is findable by aria-label', () => {
    render(
      <>
        <DbTypeIcon type="postgres" />
        <DbTypeIcon type="mysql" />
      </>,
    );
    expect(screen.getByLabelText('PostgreSQL')).toBeTruthy();
    expect(screen.getByLabelText('MySQL')).toBeTruthy();
  });
});
