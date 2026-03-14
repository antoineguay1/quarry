import { TableCell } from '@/components/ui/table';
import { useSettings } from '@/hooks/useSettings';
import type { ColumnKeyInfo, ColumnTypeCategory } from '@/types';
import { ExternalLink } from 'lucide-react';
import { memo, type JSX } from 'react';

interface Props {
  cell: unknown;
  colName: string;
  colWidth: number | undefined;
  rowIdx: number;
  colIdx: number;
  fkInfo: ColumnKeyInfo | undefined;
  colType: ColumnTypeCategory;
  searchQuery: string;
  renderCellContent: (
    text: string,
    rowIdx: number,
    colIdx: number
  ) => string | (string | JSX.Element)[];
  onNavigateFk?: (
    refTable: string,
    refCol: string,
    value: string,
    colType: ColumnTypeCategory
  ) => void;
}

function formatDate(
  value: string,
  colType: ColumnTypeCategory,
  format: 'iso' | 'locale' | 'relative',
): string {
  if (format === 'iso') return value;
  const normalized = value.includes('T') || !value.includes(' ') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  if (isNaN(date.getTime())) return value;

  if (format === 'locale') {
    if (colType === 'date') return date.toLocaleDateString();
    if (colType === 'time') return value;
    return date.toLocaleString();
  }

  // relative — not meaningful for time-only
  if (colType === 'time') return value;
  const diff = Date.now() - date.getTime();
  const abs = Math.abs(diff);
  if (abs < 45_000) return 'just now';
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const sign = diff < 0 ? 1 : -1;
  if (abs < 3_600_000) return rtf.format(sign * Math.round(abs / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(sign * Math.round(abs / 3_600_000), 'hour');
  if (abs < 2_592_000_000) return rtf.format(sign * Math.round(abs / 86_400_000), 'day');
  if (abs < 31_536_000_000) return rtf.format(sign * Math.round(abs / 2_592_000_000), 'month');
  return rtf.format(sign * Math.round(abs / 31_536_000_000), 'year');
}

export default memo(function CellContent({
  cell,
  colName: _colName,
  colWidth,
  rowIdx,
  colIdx,
  fkInfo,
  colType,
  searchQuery: _searchQuery,
  renderCellContent,
  onNavigateFk,
}: Props) {
  const { settings } = useSettings();

  const isFk =
    !!fkInfo?.fkRefTable && cell !== null && cell !== undefined && !!onNavigateFk;
  const rawStr =
    cell === null || cell === undefined
      ? null
      : String(typeof cell === 'object' ? JSON.stringify(cell) : cell);

  const isDateType = colType === 'date' || colType === 'datetime' || colType === 'time';
  const cellStr =
    rawStr !== null && isDateType && settings.dateFormat !== 'iso'
      ? formatDate(rawStr, colType, settings.dateFormat)
      : rawStr;

  return (
    <TableCell
      className="whitespace-nowrap font-mono truncate"
      style={{
        ...(colWidth ? { width: colWidth, minWidth: colWidth, maxWidth: colWidth } : {}),
        fontSize: 'var(--quarry-font-size, 13px)',
        paddingTop: 'var(--quarry-cell-py, 8px)',
        paddingBottom: 'var(--quarry-cell-py, 8px)',
      }}
    >
      {cellStr === null ? (
        <span className="text-muted-foreground italic">null</span>
      ) : isFk ? (
        <div className="group flex items-center gap-1 min-w-0">
          <span className="truncate flex-1 min-w-0">
            {renderCellContent(rawStr!, rowIdx, colIdx)}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigateFk!(
                fkInfo!.fkRefTable!,
                fkInfo!.fkRefColumn!,
                rawStr!,
                colType
              );
            }}
            className="shrink-0 opacity-0 group-hover:opacity-100 text-blue-500 hover:text-blue-700 transition-opacity"
            title={`Navigate to ${fkInfo!.fkRefTable}.${fkInfo!.fkRefColumn}`}
          >
            <ExternalLink className="size-3" />
          </button>
        </div>
      ) : (
        renderCellContent(cellStr, rowIdx, colIdx)
      )}
    </TableCell>
  );
});
