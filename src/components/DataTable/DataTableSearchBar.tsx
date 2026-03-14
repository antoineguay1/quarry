import {
  ChevronDown,
  ChevronUp,
  History,
  Search,
  X,
} from 'lucide-react';
import { memo, type RefObject } from 'react';

interface Props {
  searchInputRef: RefObject<HTMLInputElement | null>;
  inputValue: string;
  setInputValue: (v: string) => void;
  searchQuery: string;
  commitSearch: (v: string) => void;
  navigate: (dir: 1 | -1) => void;
  closeSearch: () => void;
  allMatches: unknown[];
  currentMatchIndex: number;
  searchCaseSensitive: boolean;
  setSearchCaseSensitive: React.Dispatch<React.SetStateAction<boolean>>;
  historyOpen: boolean;
  setHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  historyButtonRef: RefObject<HTMLButtonElement | null>;
  historyRef: RefObject<HTMLDivElement | null>;
  searchHistory: string[];
  applyHistoryItem: (item: string) => void;
}

export default memo(function DataTableSearchBar({
  searchInputRef,
  inputValue,
  setInputValue,
  searchQuery,
  commitSearch,
  navigate,
  closeSearch,
  allMatches,
  currentMatchIndex,
  searchCaseSensitive,
  setSearchCaseSensitive,
  historyOpen,
  setHistoryOpen,
  historyButtonRef,
  historyRef,
  searchHistory,
  applyHistoryItem,
}: Props) {
  return (
    <div className="relative flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs">
      <Search className="size-3 text-muted-foreground shrink-0" />
      <input
        ref={searchInputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            closeSearch();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (inputValue.trim() !== searchQuery) {
              commitSearch(inputValue);
            } else {
              navigate(e.shiftKey ? -1 : 1);
            }
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            navigate(1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            navigate(-1);
          }
        }}
        placeholder="Search in table…"
        className="flex-1 bg-transparent outline-none font-mono placeholder:text-muted-foreground"
      />
      <button
        ref={historyButtonRef}
        type="button"
        onClick={() => setHistoryOpen((o) => !o)}
        title="Search history"
        className={`rounded p-0.5 transition-colors ${
          historyOpen
            ? 'bg-muted text-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        <History className="size-3" />
      </button>
      <button
        type="button"
        onClick={() => setSearchCaseSensitive((v) => !v)}
        title="Case sensitive"
        className={`rounded px-1 py-0.5 font-semibold transition-colors ${
          searchCaseSensitive
            ? 'bg-primary text-primary-foreground'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`}
      >
        Aa
      </button>
      {searchQuery && (
        <div className="flex items-center gap-0.5 shrink-0">
          <span className="text-muted-foreground tabular-nums mr-0.5">
            {allMatches.length === 0
              ? 'No matches'
              : `${currentMatchIndex + 1} of ${allMatches.length}`}
          </span>
          <button
            type="button"
            onClick={() => navigate(-1)}
            disabled={allMatches.length === 0}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title="Previous (Shift+Enter)"
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            disabled={allMatches.length === 0}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none"
            title="Next (Enter)"
          >
            <ChevronDown className="size-3" />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => closeSearch()}
        className="text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="size-3" />
      </button>
      {historyOpen && (
        <div
          ref={historyRef}
          className="absolute left-0 right-0 top-full mt-1 z-50 rounded-md border bg-popover shadow-md py-1"
        >
          {searchHistory.length === 0 ? (
            <p className="px-3 py-2 text-muted-foreground italic">No recent searches</p>
          ) : (
            searchHistory.map((item, i) => (
              <button
                key={i}
                type="button"
                onClick={() => applyHistoryItem(item)}
                className="w-full text-left flex items-center gap-2 px-3 py-1.5 hover:bg-muted transition-colors font-mono"
              >
                <History className="size-3 text-muted-foreground shrink-0" />
                <span className="truncate">{item}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
});
