import type { FilterDraft } from '@/hooks/useTableFilters';
import type { ColumnTypeCategory, FilterOperator } from '@/types';
import { CaseSensitive } from 'lucide-react';
import type { RefObject } from 'react';

interface Props {
  col: string;
  colType: ColumnTypeCategory;
  hasCase: boolean;
  filterDraft: FilterDraft;
  filterModalRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onApply: (col: string) => void;
  onClear: (col: string) => void;
  onChange: (draft: FilterDraft) => void;
}

const DATE_OPERATORS: { op: FilterOperator; label: string; title: string }[] = [
  { op: 'eq',      label: '=',  title: 'Equals' },
  { op: 'gt',      label: '>',  title: 'After' },
  { op: 'gte',     label: '≥',  title: 'On or after' },
  { op: 'lt',      label: '<',  title: 'Before' },
  { op: 'lte',     label: '≤',  title: 'On or before' },
  { op: 'between', label: '↔',  title: 'Between' },
];

const NUMBER_OPERATORS: { op: FilterOperator; label: string; title: string }[] = [
  { op: 'eq',      label: '=',  title: 'Equals' },
  { op: 'gt',      label: '>',  title: 'Greater than' },
  { op: 'gte',     label: '≥',  title: 'Greater than or equal' },
  { op: 'lt',      label: '<',  title: 'Less than' },
  { op: 'lte',     label: '≤',  title: 'Less than or equal' },
  { op: 'between', label: '↔',  title: 'Between' },
];

function dateInputType(colType: ColumnTypeCategory): string {
  if (colType === 'date') return 'date';
  if (colType === 'time') return 'time';
  return 'datetime-local';
}

export default function FilterModal({
  col,
  colType,
  hasCase,
  filterDraft,
  filterModalRef,
  onClose,
  onApply,
  onClear,
  onChange,
}: Props) {
  const isDateType = colType === 'date' || colType === 'time' || colType === 'datetime';
  const isNumberType = colType === 'number';
  const inputType = dateInputType(colType);

  const canApply =
    filterDraft.nullFilter !== '' ||
    (filterDraft.value.trim() !== '' &&
      (filterDraft.operator !== 'between' || filterDraft.value2.trim() !== ''));

  return (
    <div
      ref={filterModalRef}
      className="absolute top-full left-0 z-50 mt-1 min-w-56 rounded-md border bg-popover shadow-md p-2 flex flex-col gap-2"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {filterDraft.nullFilter === '' && (colType === 'boolean' ? (
        <select
          value={filterDraft.value}
          onChange={(e) => onChange({ ...filterDraft, value: e.target.value })}
          className="rounded border px-2 py-1 text-xs bg-background"
        >
          <option value="">Any</option>
          <option value="true">True</option>
          <option value="false">False</option>
        </select>
      ) : isNumberType ? (
        <>
          <div className="flex gap-0.5">
            {NUMBER_OPERATORS.map(({ op, label, title }) => (
              <button
                key={op}
                type="button"
                title={title}
                onClick={() => onChange({ ...filterDraft, operator: op })}
                className={`flex-1 rounded px-1 py-0.5 text-xs font-mono font-medium transition-colors ${
                  filterDraft.operator === op
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="number"
            value={filterDraft.value}
            onChange={(e) => onChange({ ...filterDraft, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canApply) onApply(col);
              if (e.key === 'Escape') onClose();
            }}
            className="rounded border px-2 py-1 text-xs bg-background w-full"
            placeholder="Value…"
            autoFocus
          />
          {filterDraft.operator === 'between' && (
            <>
              <span className="text-xs text-muted-foreground text-center">and</span>
              <input
                type="number"
                value={filterDraft.value2}
                onChange={(e) => onChange({ ...filterDraft, value2: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canApply) onApply(col);
                  if (e.key === 'Escape') onClose();
                }}
                className="rounded border px-2 py-1 text-xs bg-background w-full"
                placeholder="Value…"
              />
            </>
          )}
        </>
      ) : isDateType ? (
        <>
          <div className="flex gap-0.5">
            {DATE_OPERATORS.map(({ op, label, title }) => (
              <button
                key={op}
                type="button"
                title={title}
                onClick={() => onChange({ ...filterDraft, operator: op })}
                className={`flex-1 rounded px-1 py-0.5 text-xs font-mono font-medium transition-colors ${
                  filterDraft.operator === op
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type={inputType}
            value={filterDraft.value}
            onChange={(e) => onChange({ ...filterDraft, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canApply) onApply(col);
              if (e.key === 'Escape') onClose();
            }}
            className="rounded border px-2 py-1 text-xs bg-background w-full"
            autoFocus
          />
          {filterDraft.operator === 'between' && (
            <>
              <span className="text-xs text-muted-foreground text-center">and</span>
              <input
                type={inputType}
                value={filterDraft.value2}
                onChange={(e) => onChange({ ...filterDraft, value2: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canApply) onApply(col);
                  if (e.key === 'Escape') onClose();
                }}
                className="rounded border px-2 py-1 text-xs bg-background w-full"
              />
            </>
          )}
        </>
      ) : (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={filterDraft.value}
            onChange={(e) => onChange({ ...filterDraft, value: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onApply(col);
              if (e.key === 'Escape') onClose();
            }}
            className="rounded border px-2 py-1 text-xs bg-background flex-1 min-w-0"
            placeholder="Filter…"
            autoFocus
          />
          {hasCase && (
            <button
              onClick={() => onChange({ ...filterDraft, caseSensitive: !filterDraft.caseSensitive })}
              className={`rounded p-1 transition-colors ${
                filterDraft.caseSensitive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
              title="Case sensitive"
            >
              <CaseSensitive className="size-3" />
            </button>
          )}
        </div>
      ))}
      <div className="flex gap-0.5 border-t pt-2">
        {(['is_null', 'is_not_null'] as const).map((nf) => (
          <button
            key={nf}
            type="button"
            onClick={() =>
              onChange({ ...filterDraft, nullFilter: filterDraft.nullFilter === nf ? '' : nf })
            }
            className={`flex-1 rounded px-1.5 py-0.5 text-xs font-mono transition-colors ${
              filterDraft.nullFilter === nf
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            {nf === 'is_null' ? 'IS NULL' : 'IS NOT NULL'}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1 justify-end">
        <button
          onClick={() => onClear(col)}
          className="rounded px-2 py-0.5 text-xs hover:bg-muted transition-colors"
        >
          Clear
        </button>
        <button
          onClick={() => onApply(col)}
          disabled={!canApply}
          className="rounded px-2 py-0.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:pointer-events-none"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
