import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import type { SavedConnection } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { Eye, EyeOff, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AiModel {
  id: string;
  display_name: string;
}

const FALLBACK_MODELS: AiModel[] = [
  { id: 'claude-haiku-4-5-20251001', display_name: 'Claude Haiku 4.5' },
  { id: 'claude-sonnet-4-6', display_name: 'Claude Sonnet 4.6' },
  { id: 'claude-opus-4-6', display_name: 'Claude Opus 4.6' },
];

interface Props {
  savedConnections: SavedConnection[];
  apiKey: boolean;
  onSaveKey: (key: string) => Promise<void>;
  onDeleteKey: () => Promise<void>;
}

export default function SettingsPanel({
  savedConnections,
  apiKey,
  onSaveKey,
  onDeleteKey,
}: Props) {
  const { theme, toggleTheme } = useTheme();
  const { settings, updateSetting } = useSettings();
  const [keyInput, setKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiModels, setAiModels] = useState<AiModel[]>(FALLBACK_MODELS);

  useEffect(() => {
    if (!apiKey) return;
    invoke<AiModel[]>('list_ai_models')
      .then((models) => {
        if (models.length === 0) return;
        setAiModels(models);
        if (!models.some((m) => m.id === settings.aiModel)) {
          updateSetting('aiModel', models[0].id);
        }
      })
      .catch(() => { /* keep fallback */ });
  }, [apiKey]);

  async function handleSaveKey() {
    if (!keyInput.trim()) return;
    setSaving(true);
    try {
      await onSaveKey(keyInput.trim());
      setKeyInput('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-5">
      {/* Appearance */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Appearance
        </p>
        <SettingRow label="Theme">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 text-xs text-foreground hover:opacity-70 transition-opacity"
          >
            {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
            {theme === 'dark' ? 'Dark' : 'Light'}
          </button>
        </SettingRow>
        <SettingRow label="Font size">
          <Select
            value={String(settings.fontSize)}
            onValueChange={(v) =>
              updateSetting('fontSize', Number(v) as 12 | 13 | 14 | 16)
            }
          >
            <SelectTrigger className="h-6 text-xs w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {([12, 13, 14, 16] as const).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </section>

      {/* Data Table */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Data Table
        </p>
        <SettingRow label="Default page size">
          <Select
            value={String(settings.defaultPageSize)}
            onValueChange={(v) =>
              updateSetting('defaultPageSize', Number(v) as 50 | 100 | 200 | 500)
            }
          >
            <SelectTrigger className="h-6 text-xs w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {([50, 100, 200, 500] as const).map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Row density">
          <Select
            value={settings.tableDensity}
            onValueChange={(v) =>
              updateSetting('tableDensity', v as 'compact' | 'comfortable')
            }
          >
            <SelectTrigger className="h-6 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="comfortable">Comfortable</SelectItem>
              <SelectItem value="compact">Compact</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Date format">
          <Select
            value={settings.dateFormat}
            onValueChange={(v) =>
              updateSetting('dateFormat', v as 'iso' | 'locale' | 'relative')
            }
          >
            <SelectTrigger className="h-6 text-xs w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="iso">ISO 8601</SelectItem>
              <SelectItem value="locale">Locale</SelectItem>
              <SelectItem value="relative">Relative</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </section>

      {/* Query Editor */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Query Editor
        </p>
        <SettingRow label="Default connection">
          <Select
            value={settings.defaultConnection || '__none__'}
            onValueChange={(v) =>
              updateSetting('defaultConnection', v === '__none__' ? '' : v)
            }
          >
            <SelectTrigger className="h-6 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Show picker</SelectItem>
              {savedConnections.map((c) => (
                <SelectItem key={c.name} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </section>

      {/* AI Assistant */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          AI Assistant
        </p>
        {apiKey && (
          <SettingRow label="Model">
            <Select
              value={settings.aiModel}
              onValueChange={(v) => updateSetting('aiModel', v)}
            >
              <SelectTrigger className="h-6 text-xs w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aiModels.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
        )}
        {apiKey ? (
          <SettingRow label="Claude API key">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Saved in keychain</span>
              <button
                onClick={() => void onDeleteKey()}
                className="text-xs text-destructive hover:opacity-70 transition-opacity"
              >
                Remove
              </button>
            </div>
          </SettingRow>
        ) : (
          <div className="space-y-1.5 py-1">
            <div className="flex items-center gap-1.5">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="sk-ant-..."
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && keyInput.trim() && !saving)
                    void handleSaveKey();
                }}
                className="flex-1 h-6 rounded border bg-background px-2 text-xs font-mono outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={() => setShowKey((v) => !v)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button
                onClick={() => void handleSaveKey()}
                disabled={!keyInput.trim() || saving}
                className="text-xs text-primary hover:opacity-70 disabled:opacity-30 transition-opacity"
              >
                Save
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              API key from console.anthropic.com. Stored in the OS keychain.
            </p>
          </div>
        )}
      </section>

      {/* Keyboard Shortcuts */}
      <section>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Keyboard Shortcuts
        </p>
        <div className="space-y-1.5">
          {(
            [
              ['Run query', '⌘ Enter'],
              ['Search in table', '⌘ F'],
              ['Next search result', 'Enter'],
              ['Previous search result', '⇧ Enter'],
              ['Close search', 'Escape'],
            ] as const
          ).map(([action, shortcut]) => (
            <div key={action} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{action}</span>
              <kbd className="px-1.5 py-0.5 rounded border bg-muted text-foreground font-mono text-[10px]">
                {shortcut}
              </kbd>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-xs text-foreground">{label}</span>
      {children}
    </div>
  );
}
