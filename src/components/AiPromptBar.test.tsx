import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import AiPromptBar, { type Props } from './AiPromptBar';
import type { ColumnInfo } from '@/types';

vi.mock('@/hooks/useSettings', () => ({
  getSettings: () => ({ aiModel: 'claude-haiku-4-5-20251001' }),
}));

const mockInvoke = invoke as ReturnType<typeof vi.fn>;

const schema: Record<string, ColumnInfo[]> = {
  users: [
    { name: 'id', dataType: 'int' },
    { name: 'email', dataType: 'text' },
  ],
};

const defaultProps = {
  sql: 'SELECT * FROM users',
  schema,
  dialect: 'pg' as const,
  error: null as string | null,
  hasKey: true,
  onInsert: vi.fn<(sql: string) => void>(),
  onReplace: vi.fn<(sql: string) => void>(),
  onOpenSettings: vi.fn<() => void>(),
};

function renderBar(overrides: Partial<Props> = {}) {
  const props = { ...defaultProps, onInsert: vi.fn<(sql: string) => void>(), onReplace: vi.fn<(sql: string) => void>(), onOpenSettings: vi.fn<() => void>(), ...overrides };
  render(<AiPromptBar {...props} />);
  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AiPromptBar — no key banner', () => {
  it('renders no-key banner when hasKey=false', () => {
    renderBar({ hasKey: false });
    expect(screen.getByText(/Add your Claude API key/)).toBeInTheDocument();
  });

  it('Open Settings button calls onOpenSettings', () => {
    const props = renderBar({ hasKey: false });
    fireEvent.click(screen.getByText('Open Settings'));
    expect(props.onOpenSettings).toHaveBeenCalled();
  });

  it('does not render mode tabs when hasKey=false', () => {
    renderBar({ hasKey: false });
    expect(screen.queryByText('generate')).not.toBeInTheDocument();
  });
});

describe('AiPromptBar — mode tabs rendering', () => {
  it('renders all four mode tabs', () => {
    renderBar();
    expect(screen.getByText('generate')).toBeInTheDocument();
    expect(screen.getByText('explain')).toBeInTheDocument();
    expect(screen.getByText('Fix error')).toBeInTheDocument();
    expect(screen.getByText('refine')).toBeInTheDocument();
  });

  it('generate tab is active by default', () => {
    renderBar();
    const generateBtn = screen.getByText('generate');
    expect(generateBtn.className).toMatch(/bg-primary/);
  });

  it('fix tab is disabled when no error', () => {
    renderBar({ error: null });
    const fixBtn = screen.getByText('Fix error');
    expect(fixBtn).toBeDisabled();
  });

  it('fix tab is enabled when error is present', () => {
    renderBar({ error: 'syntax error' });
    const fixBtn = screen.getByText('Fix error');
    expect(fixBtn).not.toBeDisabled();
  });

  it('fix tab has tooltip when no error', () => {
    renderBar({ error: null });
    const fixBtn = screen.getByText('Fix error');
    expect(fixBtn).toHaveAttribute('title', 'No error to fix');
  });
});

describe('AiPromptBar — prompt input (generate/refine modes)', () => {
  it('shows prompt input in generate mode', () => {
    renderBar();
    expect(screen.getByPlaceholderText('Describe the query you want…')).toBeInTheDocument();
  });

  it('shows refine placeholder when in refine mode', () => {
    renderBar();
    fireEvent.click(screen.getByText('refine'));
    expect(screen.getByPlaceholderText('Describe the change…')).toBeInTheDocument();
  });

  it('Ask button is disabled when prompt is empty', () => {
    renderBar();
    expect(screen.getByText('Ask')).toBeDisabled();
  });

  it('Ask button is enabled when prompt has text', () => {
    renderBar();
    fireEvent.change(screen.getByPlaceholderText('Describe the query you want…'), {
      target: { value: 'get all users' },
    });
    expect(screen.getByText('Ask')).not.toBeDisabled();
  });

  it('no prompt input shown for explain mode', async () => {
    renderBar();
    fireEvent.click(screen.getByText('explain'));
    await act(async () => {}); // flush auto-triggered explain invoke
    expect(screen.queryByPlaceholderText('Describe the query you want…')).not.toBeInTheDocument();
    expect(screen.queryByText('Ask')).not.toBeInTheDocument();
  });
});

describe('AiPromptBar — handleAsk (generate)', () => {
  it('calls invoke with generate system prompt and returns SQL result', async () => {
    mockInvoke.mockResolvedValue('SELECT id FROM users');
    renderBar();

    fireEvent.change(screen.getByPlaceholderText('Describe the query you want…'), {
      target: { value: 'get all users' },
    });
    fireEvent.click(screen.getByText('Ask'));

    await waitFor(() => {
      expect(screen.getByText('SELECT id FROM users')).toBeInTheDocument();
    });

    expect(mockInvoke).toHaveBeenCalledWith('call_ai', expect.objectContaining({
      system: expect.stringContaining('PostgreSQL'),
      user: 'get all users',
      model: 'claude-haiku-4-5-20251001',
    }));
  });

  it('schema is included in system prompt', async () => {
    mockInvoke.mockResolvedValue('SELECT 1');
    renderBar();

    fireEvent.change(screen.getByPlaceholderText('Describe the query you want…'), {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByText('Ask'));

    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
    const [, args] = mockInvoke.mock.calls[0];
    expect(args.system).toContain('users: id (int), email (text)');
  });

  it('uses MySQL label when dialect=mysql', async () => {
    mockInvoke.mockResolvedValue('SELECT 1');
    renderBar({ dialect: 'mysql' });

    fireEvent.change(screen.getByPlaceholderText('Describe the query you want…'), {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByText('Ask'));

    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
    const [, args] = mockInvoke.mock.calls[0];
    expect(args.system).toContain('MySQL');
  });

  it('Enter key in prompt input triggers ask', async () => {
    mockInvoke.mockResolvedValue('SELECT 1');
    renderBar();

    const input = screen.getByPlaceholderText('Describe the query you want…');
    fireEvent.change(input, { target: { value: 'list users' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
  });

  it('Enter key does nothing when prompt is empty', async () => {
    renderBar();
    const input = screen.getByPlaceholderText('Describe the query you want…');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('shows loading indicator while waiting', async () => {
    let resolve!: (v: string) => void;
    mockInvoke.mockReturnValue(new Promise<string>((r) => { resolve = r; }));
    renderBar();

    fireEvent.change(screen.getByPlaceholderText('Describe the query you want…'), {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByText('Ask'));

    expect(screen.getByText('…')).toBeInTheDocument();

    await act(async () => { resolve('SELECT 1'); });
    await waitFor(() => expect(screen.queryByText('…')).not.toBeInTheDocument());
  });

  it('shows error on invoke failure', async () => {
    mockInvoke.mockRejectedValue(new Error('API error'));
    renderBar();

    fireEvent.change(screen.getByPlaceholderText('Describe the query you want…'), {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByText('Ask'));

    await waitFor(() => {
      expect(screen.getByText('Error: API error')).toBeInTheDocument();
    });
  });

  it('trims whitespace from result', async () => {
    mockInvoke.mockResolvedValue('  SELECT 1  ');
    renderBar();

    fireEvent.change(screen.getByPlaceholderText('Describe the query you want…'), {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByText('Ask'));

    await waitFor(() => {
      expect(screen.getByText('SELECT 1')).toBeInTheDocument();
    });
  });
});

describe('AiPromptBar — SQL result actions', () => {
  async function renderWithSqlResult(overrides: Partial<typeof defaultProps> = {}) {
    mockInvoke.mockResolvedValue('SELECT id FROM users');
    const props = renderBar(overrides);

    fireEvent.change(screen.getByPlaceholderText('Describe the query you want…'), {
      target: { value: 'get ids' },
    });
    fireEvent.click(screen.getByText('Ask'));

    await waitFor(() => screen.getByText('SELECT id FROM users'));
    return props;
  }

  it('shows Insert and Replace buttons for SQL result', async () => {
    await renderWithSqlResult();
    expect(screen.getByText('Insert')).toBeInTheDocument();
    expect(screen.getByText('Replace')).toBeInTheDocument();
  });

  it('Insert button calls onInsert with result content', async () => {
    const props = await renderWithSqlResult();
    fireEvent.click(screen.getByText('Insert'));
    expect(props.onInsert).toHaveBeenCalledWith('SELECT id FROM users');
  });

  it('Replace button calls onReplace with result content', async () => {
    const props = await renderWithSqlResult();
    fireEvent.click(screen.getByText('Replace'));
    expect(props.onReplace).toHaveBeenCalledWith('SELECT id FROM users');
  });
});

describe('AiPromptBar — explain mode', () => {
  it('auto-triggers ask when switching to explain with sql', async () => {
    mockInvoke.mockResolvedValue('This query selects all users.');
    renderBar({ sql: 'SELECT * FROM users' });

    fireEvent.click(screen.getByText('explain'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('call_ai', expect.objectContaining({
        system: expect.stringContaining('Explain what this'),
        user: 'SELECT * FROM users',
      }));
    });
  });

  it('shows text result (not SQL buttons) for explain mode', async () => {
    mockInvoke.mockResolvedValue('This query fetches everything.');
    renderBar({ sql: 'SELECT * FROM users' });

    fireEvent.click(screen.getByText('explain'));

    await waitFor(() => {
      expect(screen.getByText('This query fetches everything.')).toBeInTheDocument();
    });
    expect(screen.queryByText('Insert')).not.toBeInTheDocument();
    expect(screen.queryByText('Replace')).not.toBeInTheDocument();
  });

  it('does NOT auto-trigger explain when sql is empty', () => {
    renderBar({ sql: '' });
    fireEvent.click(screen.getByText('explain'));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('shows loading "…" in the explain tab button while loading', async () => {
    let resolve!: (v: string) => void;
    mockInvoke.mockReturnValue(new Promise<string>((r) => { resolve = r; }));
    renderBar({ sql: 'SELECT 1' });

    fireEvent.click(screen.getByText('explain'));

    // While loading, the explain tab shows "…" instead of "explain"
    expect(screen.getByText('…')).toBeInTheDocument();

    await act(async () => { resolve('Done'); });
    await waitFor(() => expect(screen.queryByText('…')).not.toBeInTheDocument());
  });
});

describe('AiPromptBar — fix mode', () => {
  it('auto-triggers ask when switching to fix with error and sql', async () => {
    mockInvoke.mockResolvedValue('SELECT id FROM users WHERE id = 1');
    renderBar({ sql: 'SELECT * FORM users', error: 'syntax error near FORM' });

    fireEvent.click(screen.getByText('Fix error'));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('call_ai', expect.objectContaining({
        system: expect.stringContaining('Fix this'),
        user: expect.stringContaining('syntax error near FORM'),
      }));
    });
  });

  it('user message includes both query and error', async () => {
    mockInvoke.mockResolvedValue('SELECT id FROM users');
    renderBar({ sql: 'BAD SQL', error: 'oops' });

    fireEvent.click(screen.getByText('Fix error'));

    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
    const [, args] = mockInvoke.mock.calls[0];
    expect(args.user).toContain('BAD SQL');
    expect(args.user).toContain('oops');
  });

  it('does NOT auto-trigger fix when sql is empty', () => {
    renderBar({ sql: '', error: 'some error' });
    fireEvent.click(screen.getByText('Fix error'));
    // fix tab is disabled because sql is empty — but let's verify via not being called
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe('AiPromptBar — refine mode', () => {
  it('calls invoke with refine system prompt', async () => {
    mockInvoke.mockResolvedValue('SELECT id FROM users LIMIT 10');
    renderBar({ sql: 'SELECT * FROM users' });

    fireEvent.click(screen.getByText('refine'));
    const input = screen.getByPlaceholderText('Describe the change…');
    fireEvent.change(input, { target: { value: 'add a limit of 10' } });
    fireEvent.click(screen.getByText('Ask'));

    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
    const [, args] = mockInvoke.mock.calls[0];
    expect(args.system).toContain('Modify the query');
    expect(args.user).toContain('SELECT * FROM users');
    expect(args.user).toContain('add a limit of 10');
  });

  it('Ask button is disabled when prompt is empty in refine mode', () => {
    renderBar({ sql: 'SELECT 1' });
    fireEvent.click(screen.getByText('refine'));
    expect(screen.getByText('Ask')).toBeDisabled();
  });
});

describe('AiPromptBar — mode switching clears state', () => {
  it('switching mode clears previous result', async () => {
    mockInvoke.mockResolvedValue('SELECT 1');
    renderBar();

    fireEvent.change(screen.getByPlaceholderText('Describe the query you want…'), {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByText('Ask'));
    await waitFor(() => screen.getByText('SELECT 1'));

    // Switch to refine — result should be cleared
    fireEvent.click(screen.getByText('refine'));
    expect(screen.queryByText('SELECT 1')).not.toBeInTheDocument();
  });

  it('switching mode clears previous error', async () => {
    mockInvoke.mockRejectedValue(new Error('fail'));
    renderBar();

    fireEvent.change(screen.getByPlaceholderText('Describe the query you want…'), {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByText('Ask'));
    await waitFor(() => screen.getByText('Error: fail'));

    fireEvent.click(screen.getByText('refine'));
    expect(screen.queryByText('Error: fail')).not.toBeInTheDocument();
  });
});
