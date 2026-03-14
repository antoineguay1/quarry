import type { QueryResult } from '@/types';
import { JSX, useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface MatchLocation {
  rowIdx: number;
  colIdx: number;
  start: number;
  end: number;
}

export interface UseTableSearchResult {
  searchOpen: boolean;
  setSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  inputValue: string;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  searchQuery: string;
  searchCaseSensitive: boolean;
  setSearchCaseSensitive: React.Dispatch<React.SetStateAction<boolean>>;
  currentMatchIndex: number;
  allMatches: MatchLocation[];
  rowsWithMatches: Set<number>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  tableContainerRef: React.RefObject<HTMLDivElement | null>;
  historyRef: React.RefObject<HTMLDivElement | null>;
  historyButtonRef: React.RefObject<HTMLButtonElement | null>;
  searchHistory: string[];
  historyOpen: boolean;
  setHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  navigate: (dir: 1 | -1) => void;
  commitSearch: (value: string) => void;
  applyHistoryItem: (item: string) => void;
  closeSearch: () => void;
  renderCellContent: (
    text: string,
    rowIdx: number,
    colIdx: number
  ) => string | (string | JSX.Element)[];
}

const HISTORY_LIMIT = 10;

function loadHistory(historyKey: string): string[] {
  try {
    const raw = localStorage.getItem(`quarry-search-history::${historyKey}`);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(historyKey: string, history: string[]) {
  try {
    localStorage.setItem(`quarry-search-history::${historyKey}`, JSON.stringify(history));
  } catch {}
}

export function useTableSearch({
  result,
  hiddenColumns,
  resetKey,
  historyKey,
}: {
  result: QueryResult | null;
  hiddenColumns: Set<string>;
  resetKey: string;
  historyKey: string;
}): UseTableSearchResult {
  const [searchOpen, setSearchOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => loadHistory(historyKey));

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const historyButtonRef = useRef<HTMLButtonElement | null>(null);

  // Reload history when the table identity changes
  const [prevHistoryKey, setPrevHistoryKey] = useState(historyKey);
  if (prevHistoryKey !== historyKey) {
    setPrevHistoryKey(historyKey);
    setSearchHistory(loadHistory(historyKey));
  }

  // Render-time derived-state reset on table/filter change (no extra render)
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setSearchOpen(false);
    setInputValue('');
    setSearchQuery('');
    setCurrentMatchIndex(0);
    setHistoryOpen(false);
  }

  // Reset currentMatchIndex when search query or case sensitivity changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery, searchCaseSensitive]);

  // Cmd/Ctrl+F to open search; Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false);
        setInputValue('');
        setSearchQuery('');
        setHistoryOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  const commitSearch = useCallback((value: string) => {
    const trimmed = value.trim();
    setSearchQuery(trimmed);
    setHistoryOpen(false);
    if (trimmed) {
      setSearchHistory((prev) => {
        const next = [trimmed, ...prev.filter((h) => h !== trimmed)].slice(0, HISTORY_LIMIT);
        saveHistory(historyKey, next);
        return next;
      });
    }
  }, [historyKey]);

  const applyHistoryItem = useCallback((item: string) => {
    setInputValue(item);
    setSearchQuery(item);
    setHistoryOpen(false);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setInputValue('');
    setSearchQuery('');
    setHistoryOpen(false);
  }, []);

  const { allMatches, matchesByCellKey, rowsWithMatches } = useMemo<{
    allMatches: MatchLocation[];
    matchesByCellKey: Record<string, number[]>;
    rowsWithMatches: Set<number>;
  }>(() => {
    if (!searchQuery || !result) {
      return {
        allMatches: [],
        matchesByCellKey: {},
        rowsWithMatches: new Set(),
      };
    }
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const flags = searchCaseSensitive ? 'g' : 'gi';
    const allMatches: MatchLocation[] = [];
    const matchesByCellKey: Record<string, number[]> = {};
    const rowsWithMatches = new Set<number>();

    result.rows.forEach((row, rowIdx) => {
      row.forEach((cell, colIdx) => {
        const colName = result.columns[colIdx];
        if (hiddenColumns.has(colName)) return;
        if (cell === null || cell === undefined) return;
        const s =
          typeof cell === 'object' ? JSON.stringify(cell) : String(cell);
        const regex = new RegExp(escaped, flags);
        const key = `${rowIdx}:${colIdx}`;
        let m: RegExpExecArray | null;
        while ((m = regex.exec(s)) !== null) {
          if (!matchesByCellKey[key]) matchesByCellKey[key] = [];
          matchesByCellKey[key].push(allMatches.length);
          allMatches.push({
            rowIdx,
            colIdx,
            start: m.index,
            end: m.index + m[0].length,
          });
          rowsWithMatches.add(rowIdx);
          if (m[0].length === 0) regex.lastIndex++;
        }
      });
    });

    return { allMatches, matchesByCellKey, rowsWithMatches };
  }, [searchQuery, searchCaseSensitive, result, hiddenColumns]);

  // Scroll current match into view whenever it changes
  useEffect(() => {
    const el = tableContainerRef.current?.querySelector(
      '[data-current-match="true"]'
    );
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [currentMatchIndex, allMatches]);

  const navigate = useCallback((dir: 1 | -1) => {
    if (allMatches.length === 0) return;
    setCurrentMatchIndex(
      (i) => (i + dir + allMatches.length) % allMatches.length
    );
  }, [allMatches.length]);

  const renderCellContent = useCallback((
    text: string,
    rowIdx: number,
    colIdx: number
  ): string | (string | JSX.Element)[] => {
    if (!searchQuery) return text;
    const key = `${rowIdx}:${colIdx}`;
    const globalIndices = matchesByCellKey[key];
    if (!globalIndices || globalIndices.length === 0) return text;

    const parts: (string | JSX.Element)[] = [];
    let lastEnd = 0;
    for (const gIdx of globalIndices) {
      const { start, end } = allMatches[gIdx];
      if (start > lastEnd) parts.push(text.slice(lastEnd, start));
      const isCurrent = gIdx === currentMatchIndex;
      parts.push(
        <mark
          key={gIdx}
          data-current-match={isCurrent ? 'true' : undefined}
          className={
            isCurrent
              ? 'bg-orange-400 text-orange-950 rounded-[2px]'
              : 'bg-yellow-300 text-yellow-950 rounded-[2px]'
          }
        >
          {text.slice(start, end)}
        </mark>
      );
      lastEnd = end;
    }
    if (lastEnd < text.length) parts.push(text.slice(lastEnd));
    return parts;
  }, [searchQuery, matchesByCellKey, allMatches, currentMatchIndex]);

  return {
    searchOpen,
    setSearchOpen,
    inputValue,
    setInputValue,
    searchQuery,
    searchCaseSensitive,
    setSearchCaseSensitive,
    currentMatchIndex,
    allMatches,
    rowsWithMatches,
    searchInputRef,
    tableContainerRef,
    historyRef,
    historyButtonRef,
    searchHistory,
    historyOpen,
    setHistoryOpen,
    navigate,
    commitSearch,
    applyHistoryItem,
    closeSearch,
    renderCellContent,
  };
}
