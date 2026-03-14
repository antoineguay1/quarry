import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import SettingsPanel from './SettingsPanel';
import type { SavedConnection } from '@/types';

// Mock Radix Select with native select for reliable jsdom testing
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: any) => (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      data-testid="select"
    >
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: vi.fn(),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: vi.fn(),
}));

import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';

const mockInvoke = invoke as ReturnType<typeof vi.fn>;
const mockUpdateSetting = vi.fn();
const mockToggleTheme = vi.fn();
const mockOnSaveKey = vi.fn();
const mockOnDeleteKey = vi.fn();

const defaultSettings = {
  fontSize: 13,
  tableDensity: 'comfortable' as const,
  defaultPageSize: 100 as const,
  dateFormat: 'iso' as const,
  defaultConnection: '',
  aiModel: 'claude-haiku-4-5-20251001',
};

const savedConnections: SavedConnection[] = [
  { name: 'local-pg', dbType: 'postgres', host: 'localhost', port: 5432, database: 'mydb', username: 'user' },
  { name: 'prod-mysql', dbType: 'mysql', host: 'db.example.com', port: 3306, database: 'prod', username: 'admin' },
];

beforeEach(() => {
  vi.clearAllMocks();
  (useSettings as ReturnType<typeof vi.fn>).mockReturnValue({
    settings: { ...defaultSettings },
    updateSetting: mockUpdateSetting,
  });
  (useTheme as ReturnType<typeof vi.fn>).mockReturnValue({
    theme: 'light',
    toggleTheme: mockToggleTheme,
  });
  mockOnSaveKey.mockResolvedValue(undefined);
  mockOnDeleteKey.mockResolvedValue(undefined);
});

function renderPanel(overrides: { apiKey?: boolean; savedConnections?: SavedConnection[] } = {}) {
  render(
    <SettingsPanel
      savedConnections={overrides.savedConnections ?? []}
      apiKey={overrides.apiKey ?? false}
      onSaveKey={mockOnSaveKey}
      onDeleteKey={mockOnDeleteKey}
    />,
  );
}

// Helper to get all native selects rendered by our mock
function getSelects() {
  return screen.getAllByTestId('select') as HTMLSelectElement[];
}

describe('SettingsPanel — Appearance section', () => {
  it('renders the Appearance heading', () => {
    renderPanel();
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('shows "Light" label when theme is light', () => {
    renderPanel();
    expect(screen.getByText('Light')).toBeInTheDocument();
  });

  it('shows "Dark" label when theme is dark', () => {
    (useTheme as ReturnType<typeof vi.fn>).mockReturnValue({
      theme: 'dark',
      toggleTheme: mockToggleTheme,
    });
    renderPanel();
    expect(screen.getByText('Dark')).toBeInTheDocument();
  });

  it('clicking theme button calls toggleTheme', () => {
    renderPanel();
    fireEvent.click(screen.getByText('Light'));
    expect(mockToggleTheme).toHaveBeenCalledOnce();
  });

  it('renders Font size label', () => {
    renderPanel();
    expect(screen.getByText('Font size')).toBeInTheDocument();
  });

  it('font size select has correct current value', () => {
    renderPanel();
    const [fontSizeSelect] = getSelects();
    expect(fontSizeSelect.value).toBe('13');
  });

  it('font size select contains all size options', () => {
    renderPanel();
    const [fontSizeSelect] = getSelects();
    const values = Array.from(fontSizeSelect.options).map((o) => o.value);
    expect(values).toEqual(['12', '13', '14', '16']);
  });

  it('changing font size calls updateSetting with numeric value', () => {
    renderPanel();
    const [fontSizeSelect] = getSelects();
    fireEvent.change(fontSizeSelect, { target: { value: '14' } });
    expect(mockUpdateSetting).toHaveBeenCalledWith('fontSize', 14);
  });
});

describe('SettingsPanel — Data Table section', () => {
  it('renders the Data Table heading', () => {
    renderPanel();
    expect(screen.getByText('Data Table')).toBeInTheDocument();
  });

  it('renders Default page size label', () => {
    renderPanel();
    expect(screen.getByText('Default page size')).toBeInTheDocument();
  });

  it('page size select has correct current value', () => {
    renderPanel();
    const [, pageSizeSelect] = getSelects();
    expect(pageSizeSelect.value).toBe('100');
  });

  it('page size select contains all options', () => {
    renderPanel();
    const [, pageSizeSelect] = getSelects();
    const values = Array.from(pageSizeSelect.options).map((o) => o.value);
    expect(values).toEqual(['50', '100', '200', '500']);
  });

  it('changing page size calls updateSetting with numeric value', () => {
    renderPanel();
    const [, pageSizeSelect] = getSelects();
    fireEvent.change(pageSizeSelect, { target: { value: '200' } });
    expect(mockUpdateSetting).toHaveBeenCalledWith('defaultPageSize', 200);
  });

  it('renders Row density label', () => {
    renderPanel();
    expect(screen.getByText('Row density')).toBeInTheDocument();
  });

  it('row density select has correct current value', () => {
    renderPanel();
    const [, , densitySelect] = getSelects();
    expect(densitySelect.value).toBe('comfortable');
  });

  it('changing row density calls updateSetting', () => {
    renderPanel();
    const [, , densitySelect] = getSelects();
    fireEvent.change(densitySelect, { target: { value: 'compact' } });
    expect(mockUpdateSetting).toHaveBeenCalledWith('tableDensity', 'compact');
  });

  it('renders Date format label', () => {
    renderPanel();
    expect(screen.getByText('Date format')).toBeInTheDocument();
  });

  it('date format select has correct current value', () => {
    renderPanel();
    const [, , , dateFormatSelect] = getSelects();
    expect(dateFormatSelect.value).toBe('iso');
  });

  it('date format select contains all options', () => {
    renderPanel();
    const [, , , dateFormatSelect] = getSelects();
    const values = Array.from(dateFormatSelect.options).map((o) => o.value);
    expect(values).toEqual(['iso', 'locale', 'relative']);
  });

  it('changing date format to locale calls updateSetting', () => {
    renderPanel();
    const [, , , dateFormatSelect] = getSelects();
    fireEvent.change(dateFormatSelect, { target: { value: 'locale' } });
    expect(mockUpdateSetting).toHaveBeenCalledWith('dateFormat', 'locale');
  });

  it('changing date format to relative calls updateSetting', () => {
    renderPanel();
    const [, , , dateFormatSelect] = getSelects();
    fireEvent.change(dateFormatSelect, { target: { value: 'relative' } });
    expect(mockUpdateSetting).toHaveBeenCalledWith('dateFormat', 'relative');
  });
});

describe('SettingsPanel — Query Editor section', () => {
  it('renders the Query Editor heading', () => {
    renderPanel();
    expect(screen.getByText('Query Editor')).toBeInTheDocument();
  });

  it('renders Default connection label', () => {
    renderPanel();
    expect(screen.getByText('Default connection')).toBeInTheDocument();
  });

  it('connection select value is "__none__" when defaultConnection is empty', () => {
    renderPanel();
    const [, , , , connectionSelect] = getSelects();
    expect(connectionSelect.value).toBe('__none__');
  });

  it('connection select has "Show picker" option', () => {
    renderPanel();
    const [, , , , connectionSelect] = getSelects();
    expect(connectionSelect.querySelector('option[value="__none__"]')).toHaveTextContent('Show picker');
  });

  it('connection select shows saved connections as options', () => {
    renderPanel({ savedConnections });
    const [, , , , connectionSelect] = getSelects();
    const values = Array.from(connectionSelect.options).map((o) => o.value);
    expect(values).toContain('local-pg');
    expect(values).toContain('prod-mysql');
  });

  it('selecting a connection calls updateSetting with connection name', () => {
    renderPanel({ savedConnections });
    const [, , , , connectionSelect] = getSelects();
    fireEvent.change(connectionSelect, { target: { value: 'local-pg' } });
    expect(mockUpdateSetting).toHaveBeenCalledWith('defaultConnection', 'local-pg');
  });

  it('selecting "__none__" calls updateSetting with empty string', () => {
    (useSettings as ReturnType<typeof vi.fn>).mockReturnValue({
      settings: { ...defaultSettings, defaultConnection: 'local-pg' },
      updateSetting: mockUpdateSetting,
    });
    renderPanel({ savedConnections });
    const [, , , , connectionSelect] = getSelects();
    fireEvent.change(connectionSelect, { target: { value: '__none__' } });
    expect(mockUpdateSetting).toHaveBeenCalledWith('defaultConnection', '');
  });
});

describe('SettingsPanel — AI Assistant section (no API key)', () => {
  it('renders the AI Assistant heading', () => {
    renderPanel({ apiKey: false });
    expect(screen.getByText('AI Assistant')).toBeInTheDocument();
  });

  it('shows password input with placeholder when no API key', () => {
    renderPanel({ apiKey: false });
    const input = screen.getByPlaceholderText('sk-ant-...');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows hint text about OS keychain', () => {
    renderPanel({ apiKey: false });
    expect(screen.getByText(/Stored in the OS keychain/)).toBeInTheDocument();
  });

  it('Save button is disabled when input is empty', () => {
    renderPanel({ apiKey: false });
    expect(screen.getByText('Save')).toBeDisabled();
  });

  it('Save button is enabled when input has text', () => {
    renderPanel({ apiKey: false });
    fireEvent.change(screen.getByPlaceholderText('sk-ant-...'), {
      target: { value: 'sk-ant-abc123' },
    });
    expect(screen.getByText('Save')).not.toBeDisabled();
  });

  it('clicking Save calls onSaveKey with trimmed value and clears input', async () => {
    renderPanel({ apiKey: false });
    const input = screen.getByPlaceholderText('sk-ant-...');
    fireEvent.change(input, { target: { value: '  sk-ant-abc  ' } });
    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });
    expect(mockOnSaveKey).toHaveBeenCalledWith('sk-ant-abc');
    expect(input).toHaveValue('');
  });

  it('pressing Enter on input calls onSaveKey', async () => {
    renderPanel({ apiKey: false });
    const input = screen.getByPlaceholderText('sk-ant-...');
    fireEvent.change(input, { target: { value: 'sk-ant-key' } });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(mockOnSaveKey).toHaveBeenCalledWith('sk-ant-key');
  });

  it('pressing Enter on empty input does NOT call onSaveKey', () => {
    renderPanel({ apiKey: false });
    const input = screen.getByPlaceholderText('sk-ant-...');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockOnSaveKey).not.toHaveBeenCalled();
  });

  it('pressing other keys does not trigger save', () => {
    renderPanel({ apiKey: false });
    const input = screen.getByPlaceholderText('sk-ant-...');
    fireEvent.change(input, { target: { value: 'sk-ant-key' } });
    fireEvent.keyDown(input, { key: 'a' });
    expect(mockOnSaveKey).not.toHaveBeenCalled();
  });

  it('eye button toggles input type from password to text', () => {
    renderPanel({ apiKey: false });
    const input = screen.getByPlaceholderText('sk-ant-...');
    expect(input).toHaveAttribute('type', 'password');
    // Eye button is the button without text content between input and Save
    const allButtons = screen.getAllByRole('button');
    const eyeButton = allButtons.find((b) => b.textContent === '')!;
    fireEvent.click(eyeButton);
    expect(input).toHaveAttribute('type', 'text');
  });

  it('clicking eye button twice restores password type', () => {
    renderPanel({ apiKey: false });
    const input = screen.getByPlaceholderText('sk-ant-...');
    const allButtons = screen.getAllByRole('button');
    const eyeButton = allButtons.find((b) => b.textContent === '')!;
    fireEvent.click(eyeButton);
    fireEvent.click(eyeButton);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('does NOT render Model select when no API key', () => {
    renderPanel({ apiKey: false });
    expect(screen.queryByText('Model')).not.toBeInTheDocument();
  });

  it('does NOT call list_ai_models when no API key', () => {
    renderPanel({ apiKey: false });
    expect(mockInvoke).not.toHaveBeenCalledWith('list_ai_models');
  });
});

describe('SettingsPanel — AI Assistant section (with API key)', () => {
  beforeEach(() => {
    mockInvoke.mockResolvedValue([]);
  });

  it('shows "Saved in keychain" when API key is set', () => {
    renderPanel({ apiKey: true });
    expect(screen.getByText('Saved in keychain')).toBeInTheDocument();
  });

  it('shows Remove button that calls onDeleteKey', async () => {
    renderPanel({ apiKey: true });
    await act(async () => {
      fireEvent.click(screen.getByText('Remove'));
    });
    expect(mockOnDeleteKey).toHaveBeenCalledOnce();
  });

  it('shows "Claude API key" label', () => {
    renderPanel({ apiKey: true });
    expect(screen.getByText('Claude API key')).toBeInTheDocument();
  });

  it('shows Model row when API key is set', () => {
    renderPanel({ apiKey: true });
    expect(screen.getByText('Model')).toBeInTheDocument();
  });

  it('does NOT show password input when API key is set', () => {
    renderPanel({ apiKey: true });
    expect(screen.queryByPlaceholderText('sk-ant-...')).not.toBeInTheDocument();
  });

  it('calls list_ai_models on mount when apiKey is true', async () => {
    renderPanel({ apiKey: true });
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('list_ai_models');
    });
  });

  it('uses fetched models when list_ai_models returns non-empty list', async () => {
    const fetchedModels = [
      { id: 'claude-sonnet-4-6', display_name: 'Claude Sonnet 4.6' },
    ];
    mockInvoke.mockResolvedValue(fetchedModels);
    renderPanel({ apiKey: true });

    await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith('list_ai_models'));

    const selects = getSelects();
    // Model select is the last select (after font size, page size, density, date format, connection)
    const modelSelect = selects[selects.length - 1];
    const options = Array.from(modelSelect.options).map((o) => o.text);
    expect(options).toContain('Claude Sonnet 4.6');
    // Fallback haiku model should not appear since we got non-empty list
    expect(options).not.toContain('Claude Haiku 4.5');
  });

  it('keeps fallback models when list_ai_models returns empty array', async () => {
    mockInvoke.mockResolvedValue([]);
    renderPanel({ apiKey: true });

    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());

    const selects = getSelects();
    const modelSelect = selects[selects.length - 1];
    const options = Array.from(modelSelect.options).map((o) => o.text);
    expect(options).toContain('Claude Haiku 4.5');
  });

  it('keeps fallback models when list_ai_models fails', async () => {
    mockInvoke.mockRejectedValue(new Error('network error'));
    renderPanel({ apiKey: true });

    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
    await act(async () => {});

    const selects = getSelects();
    const modelSelect = selects[selects.length - 1];
    const options = Array.from(modelSelect.options).map((o) => o.text);
    expect(options).toContain('Claude Haiku 4.5');
  });

  it('updates aiModel setting when current model not in fetched list', async () => {
    const fetchedModels = [
      { id: 'claude-sonnet-4-6', display_name: 'Claude Sonnet 4.6' },
      { id: 'claude-opus-4-6', display_name: 'Claude Opus 4.6' },
    ];
    mockInvoke.mockResolvedValue(fetchedModels);
    renderPanel({ apiKey: true });

    await waitFor(() => {
      expect(mockUpdateSetting).toHaveBeenCalledWith('aiModel', 'claude-sonnet-4-6');
    });
  });

  it('does NOT update aiModel setting when current model is in fetched list', async () => {
    const fetchedModels = [
      { id: 'claude-haiku-4-5-20251001', display_name: 'Claude Haiku 4.5' },
      { id: 'claude-sonnet-4-6', display_name: 'Claude Sonnet 4.6' },
    ];
    mockInvoke.mockResolvedValue(fetchedModels);
    renderPanel({ apiKey: true });

    await waitFor(() => expect(mockInvoke).toHaveBeenCalled());
    await act(async () => {});
    expect(mockUpdateSetting).not.toHaveBeenCalledWith('aiModel', expect.anything());
  });

  it('changing model calls updateSetting', () => {
    renderPanel({ apiKey: true });
    const selects = getSelects();
    // Model select is the last select (after font size, page size, density, date format, connection)
    const modelSelect = selects[selects.length - 1];
    fireEvent.change(modelSelect, { target: { value: 'claude-sonnet-4-6' } });
    expect(mockUpdateSetting).toHaveBeenCalledWith('aiModel', 'claude-sonnet-4-6');
  });
});

describe('SettingsPanel — Keyboard Shortcuts section', () => {
  it('renders the Keyboard Shortcuts heading', () => {
    renderPanel();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('renders all shortcut action labels', () => {
    renderPanel();
    expect(screen.getByText('Run query')).toBeInTheDocument();
    expect(screen.getByText('Search in table')).toBeInTheDocument();
    expect(screen.getByText('Next search result')).toBeInTheDocument();
    expect(screen.getByText('Previous search result')).toBeInTheDocument();
    expect(screen.getByText('Close search')).toBeInTheDocument();
  });

  it('renders all shortcut key badges', () => {
    renderPanel();
    expect(screen.getByText('⌘ Enter')).toBeInTheDocument();
    expect(screen.getByText('⌘ F')).toBeInTheDocument();
    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('⇧ Enter')).toBeInTheDocument();
    expect(screen.getByText('Escape')).toBeInTheDocument();
  });
});
