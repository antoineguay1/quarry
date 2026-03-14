import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sql, MySQL, PostgreSQL } from '@codemirror/lang-sql';
import { Prec } from '@codemirror/state';
import { keymap } from '@uiw/react-codemirror';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { useTheme } from '@/hooks/useTheme';
import SqlEditor from './SqlEditor';

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Capture props passed to CodeMirror on each render
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let lastProps: Record<string, any> = {};

vi.mock('@uiw/react-codemirror', () => {
  const mockKeymapOf = vi.fn((bindings: unknown) => ({ _type: 'keymap', bindings }));
  return {
    default: vi.fn((props: Record<string, unknown>) => {
      lastProps = props;
      return <div data-testid="codemirror" />;
    }),
    keymap: { of: mockKeymapOf },
  };
});

vi.mock('@uiw/codemirror-theme-vscode', () => ({
  vscodeDark: { _id: 'vscodeDark' },
  vscodeLight: { _id: 'vscodeLight' },
}));

vi.mock('@codemirror/lang-sql', () => ({
  sql: vi.fn(() => ({ _type: 'sql-ext' })),
  MySQL: { _id: 'MySQL' },
  PostgreSQL: { _id: 'PostgreSQL' },
}));

vi.mock('@codemirror/state', () => ({
  Prec: { highest: vi.fn((ext: unknown) => ({ _type: 'prec', ext })) },
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: vi.fn(() => ({ theme: 'light', toggleTheme: vi.fn() })),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const mockSql = vi.mocked(sql);
const mockPrecHighest = vi.mocked(Prec.highest);
const mockKeymapOf = vi.mocked(keymap.of);
const mockUseTheme = vi.mocked(useTheme);

function renderEditor(overrides: {
  value?: string;
  onChange?: (v: string) => void;
  onRun?: () => void;
  schema?: Record<string, string[]>;
  dialect?: 'pg' | 'mysql';
} = {}) {
  const props = {
    value: 'SELECT 1',
    onChange: vi.fn(),
    onRun: vi.fn(),
    ...overrides,
  };
  render(<SqlEditor {...props} />);
  return props;
}

beforeEach(() => {
  vi.clearAllMocks();
  lastProps = {};
  mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme: vi.fn() });
});

// ── 1. Rendering ───────────────────────────────────────────────────────────────

describe('rendering', () => {
  it('renders the CodeMirror element', () => {
    renderEditor();
    expect(document.querySelector('[data-testid="codemirror"]')).toBeTruthy();
  });

  it('passes value to CodeMirror', () => {
    renderEditor({ value: 'SELECT 42' });
    expect(lastProps.value).toBe('SELECT 42');
  });

  it('passes onChange to CodeMirror', () => {
    const onChange = vi.fn();
    renderEditor({ onChange });
    expect(lastProps.onChange).toBe(onChange);
  });

  it('passes height="100%" to CodeMirror', () => {
    renderEditor();
    expect(lastProps.height).toBe('100%');
  });

  it('passes correct className to CodeMirror', () => {
    renderEditor();
    expect(lastProps.className).toContain('rounded-md');
    expect(lastProps.className).toContain('border');
    expect(lastProps.className).toContain('h-full');
  });

  it('passes correct style with font family and size CSS vars', () => {
    renderEditor();
    expect(lastProps.style).toMatchObject({
      fontFamily: 'var(--font-mono, monospace)',
      fontSize: 'var(--quarry-font-size, 13px)',
    });
  });

  it('passes basicSetup with lineNumbers, foldGutter, highlightActiveLine all false', () => {
    renderEditor();
    expect(lastProps.basicSetup).toMatchObject({
      lineNumbers: false,
      foldGutter: false,
      highlightActiveLine: false,
    });
  });
});

// ── 2. Theme ───────────────────────────────────────────────────────────────────

describe('theme', () => {
  it('uses vscodeLight when theme is "light"', () => {
    mockUseTheme.mockReturnValue({ theme: 'light', toggleTheme: vi.fn() });
    renderEditor();
    expect(lastProps.theme).toBe(vscodeLight);
  });

  it('uses vscodeDark when theme is "dark"', () => {
    mockUseTheme.mockReturnValue({ theme: 'dark', toggleTheme: vi.fn() });
    renderEditor();
    expect(lastProps.theme).toBe(vscodeDark);
  });
});

// ── 3. SQL dialect ─────────────────────────────────────────────────────────────

describe('dialect', () => {
  it('defaults to PostgreSQL dialect', () => {
    renderEditor();
    expect(mockSql).toHaveBeenCalledWith(expect.objectContaining({ dialect: PostgreSQL }));
  });

  it('uses PostgreSQL when dialect="pg"', () => {
    renderEditor({ dialect: 'pg' });
    expect(mockSql).toHaveBeenCalledWith(expect.objectContaining({ dialect: PostgreSQL }));
  });

  it('uses MySQL when dialect="mysql"', () => {
    renderEditor({ dialect: 'mysql' });
    expect(mockSql).toHaveBeenCalledWith(expect.objectContaining({ dialect: MySQL }));
  });
});

// ── 4. Schema ──────────────────────────────────────────────────────────────────

describe('schema', () => {
  it('passes empty schema by default', () => {
    renderEditor();
    expect(mockSql).toHaveBeenCalledWith(expect.objectContaining({ schema: {} }));
  });

  it('passes provided schema to sql extension', () => {
    const schema = { users: ['id', 'name'], orders: ['id', 'total'] };
    renderEditor({ schema });
    expect(mockSql).toHaveBeenCalledWith(expect.objectContaining({ schema }));
  });
});

// ── 5. Extensions ──────────────────────────────────────────────────────────────

describe('extensions', () => {
  it('passes extensions array with two entries to CodeMirror', () => {
    renderEditor();
    expect(Array.isArray(lastProps.extensions)).toBe(true);
    expect(lastProps.extensions).toHaveLength(2);
  });

  it('first extension is the sql language extension', () => {
    renderEditor();
    expect(lastProps.extensions[0]).toEqual({ _type: 'sql-ext' });
  });

  it('second extension is wrapped with Prec.highest', () => {
    renderEditor();
    expect(mockPrecHighest).toHaveBeenCalled();
    expect(lastProps.extensions[1]).toEqual(expect.objectContaining({ _type: 'prec' }));
  });
});

// ── 6. Keymap / onRun ──────────────────────────────────────────────────────────

describe('onRun via Mod-Enter keymap', () => {
  it('registers a single Mod-Enter binding', () => {
    renderEditor();
    expect(mockKeymapOf).toHaveBeenCalled();
    const bindings = mockKeymapOf.mock.calls[0][0] as Array<{ key: string; run: () => boolean }>;
    expect(bindings).toHaveLength(1);
    expect(bindings[0].key).toBe('Mod-Enter');
  });

  it('Mod-Enter binding calls onRun and returns true', () => {
    const onRun = vi.fn();
    renderEditor({ onRun });

    const bindings = mockKeymapOf.mock.calls[0][0] as Array<{ key: string; run: () => boolean }>;
    const result = bindings[0].run();

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
  });
});
