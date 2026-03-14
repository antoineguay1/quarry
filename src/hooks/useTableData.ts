import type {
  ColumnInfo,
  ColumnKeyInfo,
  ColumnTypeCategory,
  DbType,
  FilterEntry,
  QueryResult,
  SortEntry,
} from '@/types';
import { withAutoReconnect } from '@/lib/auto-reconnect';
import { rawTypeToCategory } from '@/lib/column-types';
import { invoke } from '@tauri-apps/api/core';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseTableDataResult {
  result: QueryResult | null;
  error: string | null;
  loading: boolean;
  totalCount: number | null;
  totalCountLoading: boolean;
  loadTotalCount: () => void;
  columnTypes: Record<string, ColumnTypeCategory>;
  columnRawTypes: Record<string, string>;
  columnKeys: Record<string, ColumnKeyInfo>;
}

export function useTableData(
  connectionName: string,
  database: string,
  table: string,
  sortEntries: SortEntry[],
  filterEntries: FilterEntry[],
  refreshKey?: number,
  pageSize = 100,
  page = 0,
  dbType?: DbType
): UseTableDataResult {
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [totalCountLoading, setTotalCountLoading] = useState(false);
  const [columnTypes, setColumnTypes] = useState<
    Record<string, ColumnTypeCategory>
  >({});
  const [columnRawTypes, setColumnRawTypes] = useState<Record<string, string>>(
    {}
  );
  const [columnKeys, setColumnKeys] = useState<Record<string, ColumnKeyInfo>>(
    {}
  );

  // Reset total count when the table or filters change
  useEffect(() => {
    setTotalCount(null);
    setTotalCountLoading(false);
  }, [connectionName, database, table, filterEntries]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTotalCount = useCallback(() => {
    setTotalCountLoading(true);
    invoke<number>('count_rows', { connection: connectionName, database, table, filterEntries })
      .then((count) => { setTotalCount(count); })
      .catch(() => { /* non-critical */ })
      .finally(() => { setTotalCountLoading(false); });
  }, [connectionName, database, table, filterEntries]);

  // Cache column names so the header remains visible when a filter returns 0 rows.
  // The backend returns empty columns with 0 rows; we preserve the last known columns
  // for the same table and patch the result before storing it.
  // Clear also on refreshKey change: after ADD/DROP COLUMN the schema changed, so
  // the cache must not mask the empty-columns fallback that fetches fresh schema.
  const cachedColumnsRef = useRef<string[]>([]);
  useEffect(() => {
    cachedColumnsRef.current = [];
  }, [connectionName, database, table, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const offset = page * pageSize;
        const data = await withAutoReconnect(connectionName, database, () =>
          invoke<QueryResult>('get_table_data', {
            connection: connectionName,
            database,
            table,
            sortEntries,
            filterEntries,
            limit: pageSize,
            offset,
          }),
        );
        if (!cancelled) {
          if (data.columns.length > 0) {
            cachedColumnsRef.current = data.columns;
          }
          let resolvedResult =
            data.columns.length === 0 && cachedColumnsRef.current.length > 0
              ? { ...data, columns: cachedColumnsRef.current }
              : data;

          // If still no columns (truly empty table, first load), fetch schema separately
          let fallbackTypeMap: Record<string, ColumnTypeCategory> | null = null;
          let fallbackRawMap: Record<string, string> | null = null;
          if (resolvedResult.columns.length === 0) {
            try {
              const columnInfos = await invoke<ColumnInfo[]>('get_table_columns', {
                connection: connectionName,
                database,
                table,
              });
              if (!cancelled && columnInfos.length > 0) {
                const colNames = columnInfos.map((c) => c.name);
                cachedColumnsRef.current = colNames;
                resolvedResult = { ...resolvedResult, columns: colNames };
                fallbackTypeMap = Object.fromEntries(
                  columnInfos.map((c) => [c.name, rawTypeToCategory(c.dataType, dbType)])
                );
                fallbackRawMap = Object.fromEntries(
                  columnInfos.map((c) => [c.name, c.dataType])
                );
              }
            } catch {
              // non-critical — headers will be absent but data still renders
            }
          }

          if (!cancelled) {
            setResult(resolvedResult);
            setError(null);
            if (data.row_count < pageSize) {
              setTotalCount(page * pageSize + data.row_count);
            }
            if (data.column_types.length > 0) {
              const typeMap: Record<string, ColumnTypeCategory> = {};
              const rawMap: Record<string, string> = {};
              resolvedResult.columns.forEach((col, i) => {
                typeMap[col] = (data.column_types[i] ?? 'text') as ColumnTypeCategory;
                rawMap[col] = data.column_raw_types[i] ?? '';
              });
              setColumnTypes(typeMap);
              setColumnRawTypes(rawMap);
            } else if (fallbackTypeMap && fallbackRawMap) {
              setColumnTypes(fallbackTypeMap);
              setColumnRawTypes(fallbackRawMap);
            }
          }
        }
      } catch (e: unknown) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [connectionName, database, table, sortEntries, filterEntries, refreshKey, pageSize, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    const fetchKeys = () =>
      withAutoReconnect(connectionName, database, () =>
        invoke<ColumnKeyInfo[]>('get_column_keys', { connection: connectionName, database, table }),
      );
    fetchKeys()
      .then((keys) => {
        if (!cancelled) {
          const map: Record<string, ColumnKeyInfo> = {};
          for (const k of keys) map[k.columnName] = k;
          setColumnKeys(map);
        }
      })
      .catch(() => { /* non-critical */ });
    return () => { cancelled = true; };
  }, [connectionName, database, table, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return { result, error, loading, totalCount, totalCountLoading, loadTotalCount, columnTypes, columnRawTypes, columnKeys };
}
