import { Button } from '@/components/ui/button';
import { ErrorMessage } from '@/components/ui/status-message';
import {
  buildDefaultSql,
  buildTypeSql,
  getDefaultOptions,
  getTypeDefBySql,
  getTypes,
} from '@/lib/column-types';
import type { DbType } from '@/types';
import { invoke } from '@tauri-apps/api/core';
import { useState } from 'react';
import ModalOverlay from './ModalOverlay';

interface Props {
  connectionName: string;
  database: string;
  table: string;
  dbType: DbType;
  onAdded: () => void;
  onCancel: () => void;
}

export default function AddColumnModal({ connectionName, database, table, dbType, onAdded, onCancel }: Props) {
  const q = dbType === 'postgres' ? (n: string) => `"${n}"` : (n: string) => `\`${n}\``;
  const types = getTypes(dbType).filter((t) => !t.pkOnly);

  const defaultTypeDef = types.find((t) => t.sql === 'VARCHAR') ?? types[0];
  const [colName, setColName] = useState('');
  const [colType, setColType] = useState(defaultTypeDef.sql);
  const [typeParam1, setTypeParam1] = useState<number | undefined>(defaultTypeDef.defaultLength ?? defaultTypeDef.defaultPrecision);
  const [typeParam2, setTypeParam2] = useState<number | undefined>(defaultTypeDef.defaultScale);
  const [nullable, setNullable] = useState(true);
  const [defaultMode, setDefaultMode] = useState('none');
  const [defaultValue, setDefaultValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typeDef = getTypeDefBySql(dbType, colType);
  const defaultOpts = getDefaultOptions(dbType, colType, nullable);
  const selectedOpt = defaultOpts.find((o) => o.key === defaultMode) ?? defaultOpts[0];
  const needsValueInput =
    (selectedOpt.kind === 'literal' && selectedOpt.presetValue === undefined) ||
    (selectedOpt.kind === 'expression' && selectedOpt.presetValue === undefined);

  const typeSql = typeDef ? buildTypeSql(typeDef, typeParam1, typeParam2) : colType;
  const defaultSql = buildDefaultSql(selectedOpt, defaultValue);
  const colParts = [q(colName || 'column_name'), typeSql];
  if (!nullable) colParts.push('NOT NULL');
  if (defaultSql) colParts.push(defaultSql);
  const previewSql = `ALTER TABLE ${q(table)} ADD COLUMN ${colParts.join(' ')};`;

  function handleTypeChange(newType: string) {
    const def = getTypeDefBySql(dbType, newType);
    setColType(newType);
    setDefaultMode('none');
    setDefaultValue('');
    if (def?.params === 'length') {
      setTypeParam1(def.defaultLength);
      setTypeParam2(undefined);
    } else if (def?.params === 'precision-scale') {
      setTypeParam1(def.defaultPrecision);
      setTypeParam2(def.defaultScale);
    } else {
      setTypeParam1(undefined);
      setTypeParam2(undefined);
    }
  }

  function handleNullableChange(newNullable: boolean) {
    setNullable(newNullable);
    if (!newNullable && defaultMode === 'null') {
      setDefaultMode('none');
      setDefaultValue('');
    }
  }

  async function handleSubmit() {
    if (!colName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await invoke('execute_ddl', { connection: connectionName, database, sql: previewSql });
      onAdded();
    } catch (e) {
      setError(String(e));
      setLoading(false);
    }
  }

  return (
    <ModalOverlay size="lg">
      <h2 className="text-base font-semibold">
        Add Column to <code className="font-mono text-sm">{table}</code>
      </h2>

      <div className="grid grid-cols-2 gap-3">
        {/* Column name */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Column name</label>
          <input
            type="text"
            autoFocus
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={colName}
            onChange={(e) => setColName(e.target.value)}
            placeholder="column_name"
            onKeyDown={(e) => { if (e.key === 'Enter' && colName.trim()) void handleSubmit(); }}
          />
        </div>

        {/* Type + params */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Type</label>
          <div className="flex items-center gap-1">
            <select
              className="flex-1 min-w-0 rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={colType}
              onChange={(e) => handleTypeChange(e.target.value)}
            >
              {types.map((t) => (
                <option key={t.sql} value={t.sql}>{t.label}</option>
              ))}
            </select>
            {typeDef?.params === 'length' && (
              <input
                type="number"
                className="w-16 shrink-0 rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={typeParam1 ?? ''}
                min={1}
                onChange={(e) => setTypeParam1(e.target.value ? parseInt(e.target.value) : undefined)}
              />
            )}
            {typeDef?.params === 'precision-scale' && (
              <>
                <input
                  type="number"
                  className="w-12 shrink-0 rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={typeParam1 ?? ''}
                  min={1}
                  onChange={(e) => setTypeParam1(e.target.value ? parseInt(e.target.value) : undefined)}
                />
                <span className="text-xs text-muted-foreground shrink-0">,</span>
                <input
                  type="number"
                  className="w-12 shrink-0 rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  value={typeParam2 ?? ''}
                  min={0}
                  onChange={(e) => setTypeParam2(e.target.value ? parseInt(e.target.value) : undefined)}
                />
              </>
            )}
          </div>
        </div>

        {/* Nullable */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Nullable</label>
          <label className="flex items-center gap-2 text-sm cursor-pointer pt-1.5">
            <input
              type="checkbox"
              checked={nullable}
              onChange={(e) => handleNullableChange(e.target.checked)}
            />
            Allow NULL
          </label>
        </div>

        {/* Default value */}
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Default value</label>
          <div className="flex items-center gap-1">
            <select
              className={`${needsValueInput ? 'w-28 shrink-0' : 'w-full'} rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring`}
              value={defaultMode}
              onChange={(e) => { setDefaultMode(e.target.value); setDefaultValue(''); }}
            >
              {defaultOpts.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            {needsValueInput && (
              <input
                type={selectedOpt.inputType ?? 'text'}
                className="flex-1 min-w-0 rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={defaultValue}
                onChange={(e) => setDefaultValue(e.target.value)}
                placeholder={selectedOpt.kind === 'expression' ? 'expression' : ''}
              />
            )}
          </div>
        </div>
      </div>

      {/* SQL Preview */}
      <div className="rounded-md bg-muted/60 px-3 py-2">
        <p className="text-[10px] text-muted-foreground mb-0.5">SQL Preview</p>
        <code className="text-xs font-mono break-all">{previewSql}</code>
      </div>

      {error && <ErrorMessage message={error} onDismiss={() => setError(null)} />}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel} disabled={loading}>Cancel</Button>
        <Button onClick={() => void handleSubmit()} disabled={!colName.trim() || loading}>
          {loading ? 'Adding…' : 'Add Column'}
        </Button>
      </div>
    </ModalOverlay>
  );
}
