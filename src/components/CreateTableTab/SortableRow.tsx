import type { PkStrategy } from '@/lib/column-types';
import {
  getDefaultOptions,
  getTypeDefByAlias,
  getTypeDefBySql,
  getTypes,
} from '@/lib/column-types';
import type { DbType, QueryResult } from '@/types';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { invoke } from '@tauri-apps/api/core';
import { AlertCircle, GripVertical, Link2, Trash2 } from 'lucide-react';
import { memo, useState } from 'react';
import type { ColumnDef, FkColInfo } from './types';

export interface SortableRowProps {
  col: ColumnDef;
  onChange: (id: string, updates: Partial<ColumnDef>) => void;
  onDelete: (id: string) => void;
  dbType: DbType;
  availableTables: string[];
  connectionName: string;
  database: string;
}

const AUTO_INC_SENTINEL = '__auto_increment__';

export default memo(function SortableRow({
  col,
  onChange,
  onDelete,
  dbType,
  availableTables,
  connectionName,
  database,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: col.id });

  const [fkColsInfo, setFkColsInfo] = useState<FkColInfo[]>([]);
  const [fkLoading, setFkLoading] = useState(false);
  const [fkError, setFkError] = useState<string | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const types = getTypes(dbType);
  const typeDef = getTypeDefBySql(dbType, col.type);
  const fkEnabled = col.fkTable !== undefined;

  const defaultOpts = getDefaultOptions(dbType, col.type, col.nullable);
  const selectedOpt =
    defaultOpts.find((o) => o.key === col.defaultMode) ?? defaultOpts[0];
  const needsValueInput =
    (selectedOpt.kind === 'literal' && selectedOpt.presetValue === undefined) ||
    (selectedOpt.kind === 'expression' &&
      selectedOpt.presetValue === undefined);

  // ── Helpers ──────────────────────────────────────────────────────────────

  function isTypeDisabled(t: ReturnType<typeof getTypes>[number]) {
    if (col.primary) return !!(t.pkForbidden || t.disabledWhenPk);
    return !!t.pkOnly;
  }

  function applyFirstPkStrategy(
    def: ReturnType<typeof getTypeDefBySql>,
    updates: Partial<ColumnDef>,
  ) {
    const first: PkStrategy | undefined = def?.pkStrategies?.[0];
    if (first?.autoIncrement) {
      updates.autoIncrement = true;
      updates.defaultValue = '';
    } else if (first) {
      updates.autoIncrement = undefined;
      updates.defaultValue = first.value;
    } else {
      updates.autoIncrement = undefined;
      updates.defaultValue = '';
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handlePkChange(newPrimary: boolean) {
    const updates: Partial<ColumnDef> = {
      primary: newPrimary,
      defaultMode: 'none',
      defaultValue: '',
    };

    if (newPrimary) {
      updates.nullable = false;
      if (typeDef?.disabledWhenPk && typeDef.serialPair) {
        updates.type = typeDef.serialPair;
        updates.typeParam1 = undefined;
        updates.typeParam2 = undefined;
      }
      const newDef = updates.type
        ? getTypeDefBySql(dbType, updates.type)
        : typeDef;
      applyFirstPkStrategy(newDef, updates);
    } else {
      if (typeDef?.pkOnly && typeDef.serialPair) {
        updates.type = typeDef.serialPair;
        updates.typeParam1 = undefined;
        updates.typeParam2 = undefined;
      }
      updates.autoIncrement = undefined;
    }

    onChange(col.id, updates);
  }

  function handleTypeChange(newType: string) {
    const def = getTypeDefBySql(dbType, newType);
    const updates: Partial<ColumnDef> = {
      type: newType,
      defaultMode: 'none',
      defaultValue: '',
    };

    if (def?.params === 'length') {
      updates.typeParam1 = def.defaultLength;
      updates.typeParam2 = undefined;
    } else if (def?.params === 'precision-scale') {
      updates.typeParam1 = def.defaultPrecision;
      updates.typeParam2 = def.defaultScale;
    } else {
      updates.typeParam1 = undefined;
      updates.typeParam2 = undefined;
    }

    if (col.primary) {
      applyFirstPkStrategy(def, updates);
    }

    onChange(col.id, updates);
  }

  function handleNullableChange(newNullable: boolean) {
    const updates: Partial<ColumnDef> = { nullable: newNullable };
    if (!newNullable && col.defaultMode === 'null') {
      updates.defaultMode = 'none';
      updates.defaultValue = '';
    }
    onChange(col.id, updates);
  }

  function handleDefaultModeChange(key: string) {
    onChange(col.id, { defaultMode: key, defaultValue: '' });
  }

  function handlePkStrategyChange(value: string) {
    if (value === AUTO_INC_SENTINEL) {
      onChange(col.id, { autoIncrement: true, defaultValue: '' });
    } else {
      onChange(col.id, { autoIncrement: undefined, defaultValue: value });
    }
  }

  function toggleFk() {
    if (fkEnabled) {
      onChange(col.id, { fkTable: undefined, fkColumn: undefined });
      setFkColsInfo([]);
      setFkError(null);
    } else {
      onChange(col.id, { fkTable: '', fkColumn: undefined });
    }
  }

  async function handleFkTableChange(table: string) {
    onChange(col.id, { fkTable: table, fkColumn: undefined });
    setFkColsInfo([]);
    if (!table) return;

    setFkLoading(true);
    setFkError(null);
    try {
      const sql =
        dbType === 'postgres'
          ? `SELECT column_name, udt_name, character_maximum_length, numeric_precision, numeric_scale FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}' ORDER BY ordinal_position`
          : `SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${database}' AND TABLE_NAME='${table}' ORDER BY ORDINAL_POSITION`;

      const result = await invoke<QueryResult>('execute_query', {
        connection: connectionName,
        database,
        sql,
      });

      setFkColsInfo(
        result.rows.map((r) => {
          const row = r as (string | number | null)[];
          return {
            name: String(row[0] ?? ''),
            rawType: String(row[1] ?? ''),
            maxLength: row[2] != null ? Number(row[2]) : undefined,
            precision: row[3] != null ? Number(row[3]) : undefined,
            scale: row[4] != null ? Number(row[4]) : undefined,
          };
        }),
      );
    } catch (e) {
      setFkError(String(e));
    } finally {
      setFkLoading(false);
    }
  }

  function handleFkColumnChange(colName: string) {
    if (!colName) {
      onChange(col.id, { fkColumn: undefined });
      return;
    }

    const info = fkColsInfo.find((c) => c.name === colName);
    const updates: Partial<ColumnDef> = { fkColumn: colName };

    if (info) {
      const targetDef = getTypeDefByAlias(dbType, info.rawType);
      if (targetDef) {
        updates.type = targetDef.sql;
        updates.defaultMode = 'none';
        updates.defaultValue = '';
        if (targetDef.params === 'length' && info.maxLength != null) {
          updates.typeParam1 = info.maxLength;
          updates.typeParam2 = undefined;
        } else if (targetDef.params === 'precision-scale') {
          updates.typeParam1 = info.precision;
          updates.typeParam2 = info.scale;
        } else {
          updates.typeParam1 = undefined;
          updates.typeParam2 = undefined;
        }
      }
    }

    onChange(col.id, updates);
  }

  // ── PK generation UI ─────────────────────────────────────────────────────

  const pkGenerationUi = (() => {
    if (!col.primary) return null;
    if (typeDef?.pkAutoIncrement) {
      return (
        <span className="w-44 shrink-0 text-xs text-muted-foreground italic px-1">
          auto-increment
        </span>
      );
    }
    if (typeDef?.pkStrategies?.length) {
      const currentValue = col.autoIncrement
        ? AUTO_INC_SENTINEL
        : col.defaultValue;
      return (
        <select
          className="w-44 shrink-0 rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          value={currentValue}
          onChange={(e) => handlePkStrategyChange(e.target.value)}
        >
          {typeDef.pkStrategies.map((s, i) => (
            <option
              key={i}
              value={s.autoIncrement ? AUTO_INC_SENTINEL : s.value}
            >
              {s.label}
            </option>
          ))}
        </select>
      );
    }
    return (
      <span className="w-44 shrink-0 text-xs text-muted-foreground px-1">
        —
      </span>
    );
  })();

  // ── Default value UI (non-PK) ─────────────────────────────────────────────

  const defaultValueUi = (() => {
    if (col.primary) return pkGenerationUi;

    const inputWidth =
      selectedOpt.inputType === 'datetime-local'
        ? 'w-36'
        : selectedOpt.inputType === 'date'
          ? 'w-28'
          : selectedOpt.inputType === 'time'
            ? 'w-24'
            : 'w-20';

    return (
      <div className="shrink-0 flex items-center gap-1">
        <select
          className={`${needsValueInput ? 'w-24' : 'w-44'} shrink-0 rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring`}
          value={col.defaultMode}
          onChange={(e) => handleDefaultModeChange(e.target.value)}
        >
          {defaultOpts.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        {needsValueInput && (
          <input
            type={selectedOpt.inputType ?? 'text'}
            className={`${inputWidth} shrink-0 rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring`}
            value={col.defaultValue}
            onChange={(e) => onChange(col.id, { defaultValue: e.target.value })}
            placeholder={selectedOpt.kind === 'expression' ? 'expression' : ''}
          />
        )}
      </div>
    );
  })();

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={setNodeRef} style={style} className="group">
      {/* Line 1 */}
      <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/40">
        {/* Drag handle */}
        <button
          type="button"
          className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>

        {/* Name */}
        <input
          type="text"
          className="w-28 shrink-0 rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          value={col.name}
          onChange={(e) => onChange(col.id, { name: e.target.value })}
          placeholder="column_name"
        />

        {/* Type */}
        <select
          className="w-36 shrink-0 rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          value={col.type}
          onChange={(e) => handleTypeChange(e.target.value)}
        >
          {types.map((t) => (
            <option key={t.sql} value={t.sql} disabled={isTypeDisabled(t)}>
              {t.label}
            </option>
          ))}
        </select>

        {/* Type param: length */}
        {typeDef?.params === 'length' && (
          <input
            type="number"
            className="w-16 shrink-0 rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            value={col.typeParam1 ?? typeDef.defaultLength ?? ''}
            min={1}
            onChange={(e) =>
              onChange(col.id, {
                typeParam1: e.target.value
                  ? parseInt(e.target.value)
                  : undefined,
              })
            }
          />
        )}

        {/* Type param: precision + scale */}
        {typeDef?.params === 'precision-scale' && (
          <>
            <input
              type="number"
              className="w-12 shrink-0 rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              value={col.typeParam1 ?? typeDef.defaultPrecision ?? ''}
              min={1}
              onChange={(e) =>
                onChange(col.id, {
                  typeParam1: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
            />
            <span className="text-xs text-muted-foreground shrink-0">,</span>
            <input
              type="number"
              className="w-12 shrink-0 rounded border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              value={col.typeParam2 ?? typeDef.defaultScale ?? ''}
              min={0}
              onChange={(e) =>
                onChange(col.id, {
                  typeParam2: e.target.value
                    ? parseInt(e.target.value)
                    : undefined,
                })
              }
            />
          </>
        )}

        {/* Spacer */}
        <div className="flex-1 min-w-0" />

        {/* Nullable */}
        <label
          className={`w-10 shrink-0 flex items-center gap-1 text-xs text-muted-foreground select-none ${
            col.primary ? 'opacity-40' : 'cursor-pointer'
          }`}
        >
          <input
            type="checkbox"
            checked={col.primary ? false : col.nullable}
            onChange={(e) => handleNullableChange(e.target.checked)}
            className="shrink-0"
            disabled={col.primary}
          />
          Null
        </label>

        {/* Default / PK generation */}
        {defaultValueUi}

        {/* Primary key */}
        <label className="w-8 shrink-0 flex items-center gap-1 text-xs text-muted-foreground select-none cursor-pointer">
          <input
            type="checkbox"
            checked={col.primary}
            onChange={(e) => handlePkChange(e.target.checked)}
            className="shrink-0"
            disabled={typeDef?.pkForbidden}
          />
          PK
        </label>

        {/* FK toggle */}
        <button
          type="button"
          className={`w-5 shrink-0 flex items-center justify-center transition-colors ${
            fkEnabled
              ? 'text-primary'
              : 'text-muted-foreground/40 hover:text-muted-foreground'
          }`}
          onClick={toggleFk}
          title={fkEnabled ? 'Remove foreign key' : 'Add foreign key'}
        >
          <Link2 size={13} />
        </button>

        {/* Delete */}
        <button
          type="button"
          className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
          onClick={() => onDelete(col.id)}
          title="Remove column"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Line 2: FK references */}
      {fkEnabled && (
        <div className="flex items-center gap-2 pl-10 pb-1.5 pr-2 text-xs text-muted-foreground">
          <span className="shrink-0">└─ References:</span>
          <select
            className="rounded border bg-background px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            value={col.fkTable ?? ''}
            onChange={(e) => void handleFkTableChange(e.target.value)}
          >
            <option value="">(select table)</option>
            {availableTables.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <span className="shrink-0">.</span>
          {fkLoading ? (
            <span className="animate-pulse">Loading…</span>
          ) : fkError ? (
            <span className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle size={11} className="shrink-0" />
              {fkError}
            </span>
          ) : (
            <select
              className="rounded border bg-background px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              value={col.fkColumn ?? ''}
              disabled={!col.fkTable || fkColsInfo.length === 0}
              onChange={(e) => handleFkColumnChange(e.target.value)}
            >
              <option value="">(select column)</option>
              {fkColsInfo.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
});
