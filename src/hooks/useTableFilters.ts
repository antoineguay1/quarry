import { getSettings } from '@/hooks/useSettings';
import type { ColumnTypeCategory, FilterEntry, FilterOperator, SortEntry } from '@/types';
import { STORAGE_KEYS } from '@/lib/storage';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface FilterDraft {
  value: string;
  value2: string;
  operator: FilterOperator;
  caseSensitive: boolean;
  nullFilter: 'is_null' | 'is_not_null' | '';
}

const OPERATOR_TYPES: ColumnTypeCategory[] = ['date', 'time', 'datetime', 'number'];
const STORAGE_PREFIX = STORAGE_KEYS.TABLE_STATE_PREFIX;

function loadState(key: string): { sort: SortEntry[]; filter: FilterEntry[]; pageSize?: number } | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}::${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as { sort: SortEntry[]; filter: FilterEntry[]; pageSize?: number };
  } catch {
    return null;
  }
}

function saveState(key: string, sort: SortEntry[], filter: FilterEntry[], pageSize: number) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}::${key}`, JSON.stringify({ sort, filter, pageSize }));
  } catch {
    // ignore storage errors
  }
}

export interface UseTableFiltersResult {
  sortEntries: SortEntry[];
  setSortEntries: React.Dispatch<React.SetStateAction<SortEntry[]>>;
  filterEntries: FilterEntry[];
  setFilterEntries: React.Dispatch<React.SetStateAction<FilterEntry[]>>;
  pageSize: number;
  setPageSize: React.Dispatch<React.SetStateAction<number>>;
  openFilterCol: string | null;
  filterDraft: FilterDraft;
  setFilterDraft: React.Dispatch<React.SetStateAction<FilterDraft>>;
  filterModalRef: React.RefObject<HTMLDivElement | null>;
  handleSort: (col: string) => void;
  openFilterModal: (col: string) => void;
  applyFilter: (col: string, colType: ColumnTypeCategory) => void;
  clearFilter: (col: string) => void;
  closeFilter: () => void;
}

export function useTableFilters({
  initialFilters,
  resetKey,
  storageKey,
}: {
  initialFilters?: FilterEntry[];
  resetKey: string;
  storageKey: string;
}): UseTableFiltersResult {
  const [sortEntries, setSortEntries] = useState<SortEntry[]>(() => {
    if (initialFilters) return [];
    return loadState(storageKey)?.sort ?? [];
  });
  const [filterEntries, setFilterEntries] = useState<FilterEntry[]>(() => {
    if (initialFilters) return initialFilters;
    return loadState(storageKey)?.filter ?? [];
  });
  const [pageSize, setPageSize] = useState<number>(() => {
    return loadState(storageKey)?.pageSize ?? getSettings().defaultPageSize;
  });
  const [openFilterCol, setOpenFilterCol] = useState<string | null>(null);
  const [filterDraft, setFilterDraft] = useState<FilterDraft>({
    value: '',
    value2: '',
    operator: 'eq',
    caseSensitive: false,
    nullFilter: '',
  });
  const filterModalRef = useRef<HTMLDivElement | null>(null);

  // Persist sort/filter/pageSize to localStorage whenever they change
  useEffect(() => {
    saveState(storageKey, sortEntries, filterEntries, pageSize);
  }, [storageKey, sortEntries, filterEntries, pageSize]);

  // Render-time derived-state reset (no extra render)
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    if (initialFilters) {
      // FK navigation: use provided filters
      setSortEntries([]);
      setFilterEntries(initialFilters);
    } else {
      // Table/connection change: restore from localStorage
      const saved = loadState(storageKey);
      setSortEntries(saved?.sort ?? []);
      setFilterEntries(saved?.filter ?? []);
      setPageSize(saved?.pageSize ?? getSettings().defaultPageSize);
    }
    setOpenFilterCol(null);
    setFilterDraft({ value: '', value2: '', operator: 'eq', caseSensitive: false, nullFilter: '' });
  }

  const handleSort = useCallback((col: string) => {
    setSortEntries((prev) => {
      const idx = prev.findIndex((e) => e.col === col);
      if (idx === -1) return [...prev, { col, dir: 'asc' }];
      if (prev[idx].dir === 'asc')
        return prev.map((e, i) => (i === idx ? { col, dir: 'desc' } : e));
      return prev.filter((_, i) => i !== idx);
    });
  }, []);

  const openFilterModal = useCallback((col: string) => {
    setFilterEntries((prev) => {
      const existing = prev.find((e) => e.col === col);
      setFilterDraft({
        value: existing?.value ?? '',
        value2: existing?.value2 ?? '',
        operator: existing?.operator ?? 'eq',
        caseSensitive: existing?.caseSensitive ?? false,
        nullFilter: existing?.nullFilter ?? '',
      });
      setOpenFilterCol(col);
      return prev;
    });
  }, []);

  const applyFilter = useCallback((col: string, colType: ColumnTypeCategory) => {
    setFilterDraft((draft) => {
      if (draft.nullFilter !== '') {
        const entry: FilterEntry = {
          col,
          value: '',
          operator: 'eq',
          caseSensitive: false,
          colType,
          nullFilter: draft.nullFilter,
        };
        setFilterEntries((prev) => [...prev.filter((e) => e.col !== col), entry]);
        setOpenFilterCol(null);
        return draft;
      }

      const usesOperator = OPERATOR_TYPES.includes(colType);
      const operator = usesOperator ? draft.operator : 'eq';
      const hasValue = draft.value.trim() !== '';
      const validBetween = operator !== 'between' || draft.value2.trim() !== '';

      if (!hasValue || !validBetween) {
        setFilterEntries((prev) => prev.filter((e) => e.col !== col));
      } else {
        const entry: FilterEntry = {
          col,
          value: draft.value,
          value2: operator === 'between' ? draft.value2 : undefined,
          operator,
          caseSensitive: draft.caseSensitive,
          colType,
        };
        setFilterEntries((prev) => [...prev.filter((e) => e.col !== col), entry]);
      }
      setOpenFilterCol(null);
      return draft;
    });
  }, []);

  const clearFilter = useCallback((col: string) => {
    setFilterEntries((prev) => prev.filter((e) => e.col !== col));
    setOpenFilterCol(null);
  }, []);

  const closeFilter = useCallback(() => setOpenFilterCol(null), []);

  return {
    sortEntries,
    setSortEntries,
    filterEntries,
    setFilterEntries,
    pageSize,
    setPageSize,
    openFilterCol,
    filterDraft,
    setFilterDraft,
    filterModalRef,
    handleSort,
    openFilterModal,
    applyFilter,
    clearFilter,
    closeFilter,
  };
}
