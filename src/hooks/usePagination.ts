import type { FilterEntry, SortEntry } from '@/types';
import { useEffect, useState } from 'react';

export function usePagination({
  resetKey,
  sortEntries,
  filterEntries,
}: {
  resetKey: string;
  sortEntries: SortEntry[];
  filterEntries: FilterEntry[];
}) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [resetKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(0); }, [sortEntries, filterEntries]);
  return { page, setPage };
}
