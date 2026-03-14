import { Button } from '@/components/ui/button';
import { getSettings } from '@/hooks/useSettings';
import type { ColumnInfo } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { Sparkles, X } from 'lucide-react';
import { useState } from 'react';

type Mode = 'generate' | 'explain' | 'fix' | 'refine';

export interface Props {
  sql: string;
  schema: Record<string, ColumnInfo[]>;
  dialect: 'pg' | 'mysql';
  error: string | null;
  hasKey: boolean;
  onInsert: (sql: string) => void;
  onReplace: (sql: string) => void;
  onOpenSettings: () => void;
}

function buildSchemaText(schema: Record<string, ColumnInfo[]>): string {
  return Object.entries(schema)
    .map(
      ([table, cols]) =>
        `${table}: ${cols.map((c) => `${c.name} (${c.dataType})`).join(', ')}`,
    )
    .join('\n');
}

export default function AiPromptBar({
  sql,
  schema,
  dialect,
  error,
  hasKey,
  onInsert,
  onReplace,
  onOpenSettings,
}: Props) {
  const [mode, setMode] = useState<Mode>('generate');
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<{
    type: 'sql' | 'text';
    content: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const dbLabel = dialect === 'mysql' ? 'MySQL' : 'PostgreSQL';
  const needsPrompt = mode === 'generate' || mode === 'refine';
  function canAskFor(m: Mode) {
    if (!hasKey || loading) return false;
    if (m === 'generate') return prompt.trim().length > 0;
    if (m === 'fix') return !!error && !!sql.trim();
    if (m === 'explain') return !!sql.trim();
    if (m === 'refine') return prompt.trim().length > 0;
    return false;
  }
  const canAsk = canAskFor(mode);

  async function handleAsk(targetMode: Mode = mode) {
    setLoading(true);
    setAiError(null);
    setResult(null);

    try {
      let system = '';
      let user = '';
      let resultType: 'sql' | 'text' = 'sql';
      const schemaText = buildSchemaText(schema);

      if (targetMode === 'generate') {
        system = `You are a SQL expert for ${dbLabel}. The database schema is:\n${schemaText}\n\nReturn ONLY valid SQL with no markdown fences and no explanation.`;
        user = prompt;
      } else if (targetMode === 'explain') {
        system = `You are a SQL expert. Explain what this ${dbLabel} query does in 2-3 concise sentences.`;
        user = sql;
        resultType = 'text';
      } else if (targetMode === 'fix') {
        system = `You are a SQL expert. Fix this ${dbLabel} SQL query. Return ONLY the corrected SQL with no markdown fences and no explanation.`;
        user = `Query:\n${sql}\n\nError: ${error}`;
      } else {
        system = `You are a SQL expert for ${dbLabel}. Modify the query based on the instruction. Return ONLY the modified SQL with no markdown fences and no explanation.`;
        user = `Query:\n${sql}\n\nInstruction: ${prompt}`;
      }

      const text = await invoke<string>('call_ai', { system, user, model: getSettings().aiModel });
      setResult({ type: resultType, content: text.trim() });
    } catch (e) {
      setAiError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function switchMode(m: Mode) {
    setMode(m);
    setResult(null);
    setAiError(null);
    if ((m === 'explain' || m === 'fix') && canAskFor(m)) {
      void handleAsk(m);
    }
  }

  if (!hasKey) {
    return (
      <div className="shrink-0 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Sparkles size={13} className="shrink-0" />
        <span>Add your Claude API key to use AI features.</span>
        <button
          className="text-primary underline underline-offset-2 hover:opacity-80"
          onClick={onOpenSettings}
        >
          Open Settings
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 rounded-md border bg-muted/30 p-2 space-y-2">
      {/* Mode tabs */}
      <div className="flex items-center gap-1">
        {(['generate', 'explain', 'fix', 'refine'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            disabled={m === 'fix' && !error}
            title={m === 'fix' && !error ? 'No error to fix' : undefined}
            className={`px-2 py-0.5 rounded text-xs capitalize transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
              mode === m
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            {loading && mode === m && (m === 'explain' || m === 'fix')
              ? '…'
              : m === 'fix'
                ? 'Fix error'
                : m}
          </button>
        ))}
      </div>

      {/* Prompt input for generate / refine */}
      {needsPrompt && (
        <div className="flex items-center gap-2">
          <input
            className="flex-1 h-7 rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
            placeholder={
              mode === 'generate'
                ? 'Describe the query you want…'
                : 'Describe the change…'
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canAsk) void handleAsk();
            }}
          />
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => void handleAsk()}
            disabled={!canAsk}
          >
            {loading ? '…' : 'Ask'}
          </Button>
        </div>
      )}

      {/* Error */}
      {aiError && (
        <div className="flex items-start gap-1.5 text-xs text-destructive">
          <X size={12} className="shrink-0 mt-0.5" />
          <span>{aiError}</span>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-1.5 select-text">
          {result.type === 'sql' ? (
            <>
              <pre className="rounded-md border bg-background p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {result.content}
              </pre>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => onInsert(result.content)}
                >
                  Insert
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => onReplace(result.content)}
                >
                  Replace
                </Button>
              </div>
            </>
          ) : (
            <p className="text-xs text-foreground leading-relaxed">
              {result.content}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
