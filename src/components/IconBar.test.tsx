import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import IconBar from './IconBar';

describe('IconBar', () => {
  it('renders all three buttons', () => {
    render(<IconBar activePanel={null} onToggle={vi.fn()} />);
    expect(screen.getByTitle('Connections')).toBeInTheDocument();
    expect(screen.getByTitle('Queries')).toBeInTheDocument();
    expect(screen.getByTitle('Settings')).toBeInTheDocument();
  });

  it('applies active styles to connections button when activePanel is connections', () => {
    render(<IconBar activePanel="connections" onToggle={vi.fn()} />);
    expect(screen.getByTitle('Connections').className).toContain('bg-accent');
    expect(screen.getByTitle('Queries').className).not.toContain('bg-accent text-accent-foreground');
    expect(screen.getByTitle('Settings').className).not.toContain('bg-accent text-accent-foreground');
  });

  it('applies active styles to queries button when activePanel is queries', () => {
    render(<IconBar activePanel="queries" onToggle={vi.fn()} />);
    expect(screen.getByTitle('Queries').className).toContain('bg-accent');
    expect(screen.getByTitle('Connections').className).not.toContain('bg-accent text-accent-foreground');
    expect(screen.getByTitle('Settings').className).not.toContain('bg-accent text-accent-foreground');
  });

  it('applies active styles to settings button when activePanel is settings', () => {
    render(<IconBar activePanel="settings" onToggle={vi.fn()} />);
    expect(screen.getByTitle('Settings').className).toContain('bg-accent');
    expect(screen.getByTitle('Connections').className).not.toContain('bg-accent text-accent-foreground');
    expect(screen.getByTitle('Queries').className).not.toContain('bg-accent text-accent-foreground');
  });

  it('applies inactive styles to all buttons when activePanel is null', () => {
    render(<IconBar activePanel={null} onToggle={vi.fn()} />);
    expect(screen.getByTitle('Connections').className).toContain('text-muted-foreground');
    expect(screen.getByTitle('Queries').className).toContain('text-muted-foreground');
    expect(screen.getByTitle('Settings').className).toContain('text-muted-foreground');
  });

  it('calls onToggle with connections when connections button is clicked', () => {
    const onToggle = vi.fn();
    render(<IconBar activePanel={null} onToggle={onToggle} />);
    fireEvent.click(screen.getByTitle('Connections'));
    expect(onToggle).toHaveBeenCalledWith('connections');
  });

  it('calls onToggle with queries when queries button is clicked', () => {
    const onToggle = vi.fn();
    render(<IconBar activePanel={null} onToggle={onToggle} />);
    fireEvent.click(screen.getByTitle('Queries'));
    expect(onToggle).toHaveBeenCalledWith('queries');
  });

  it('calls onToggle with settings when settings button is clicked', () => {
    const onToggle = vi.fn();
    render(<IconBar activePanel={null} onToggle={onToggle} />);
    fireEvent.click(screen.getByTitle('Settings'));
    expect(onToggle).toHaveBeenCalledWith('settings');
  });
});
