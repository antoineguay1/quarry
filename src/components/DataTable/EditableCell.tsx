import { TableCell } from '@/components/ui/table';
import { useSettings } from '@/hooks/useSettings';
import type { ColumnKeyInfo, ColumnTypeCategory } from '@/types';
import { ExternalLink } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState, type JSX } from 'react';
import { ContextMenu } from 'radix-ui';

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
  // Editing props
  editable: boolean;
  isModified: boolean;
  isDeleted: boolean;
  modifiedValue: string | null | undefined; // undefined = not modified
  onModify?: (value: string | null) => void;
  isActive: boolean;
  isEditing: boolean;
  onActivate: () => void;
  onStartEdit: () => void;
  onStopEdit: () => void;
  onNavigate: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onRevert?: () => void;
  onCopy?: () => void;
}

export default memo(function EditableCell({
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
  editable,
  isModified,
  isDeleted,
  modifiedValue,
  onModify,
  isActive,
  isEditing,
  onActivate,
  onStartEdit,
  onStopEdit,
  onNavigate,
  onRevert,
  onCopy,
}: Props) {
  const { settings } = useSettings();
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const cellRef = useRef<HTMLTableCellElement>(null);

  const rawOriginal =
    cell === null || cell === undefined
      ? null
      : String(typeof cell === 'object' ? JSON.stringify(cell) : cell);

  const displayValue = modifiedValue !== undefined ? modifiedValue : rawOriginal;
  const isNullable = fkInfo?.isNullable ?? true;

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  // Focus cell when it becomes active
  useEffect(() => {
    if (isActive && !isEditing && cellRef.current) {
      cellRef.current.focus();
    }
  }, [isActive, isEditing]);

  const [editDraft, setEditDraft] = useState('');

  useEffect(() => {
    if (isEditing) {
      setEditDraft(displayValue ?? '');
    }
  }, [isEditing, displayValue]);

  const commitEdit = useCallback(() => {
    if (!onModify) return;
    onModify(editDraft);
    onStopEdit();
  }, [editDraft, onModify, onStopEdit]);

  const cancelEdit = useCallback(() => {
    onStopEdit();
  }, [onStopEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isEditing) {
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
        onNavigate('down');
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitEdit();
        onNavigate(e.shiftKey ? 'left' : 'right');
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && (e.ctrlKey || e.metaKey) && isNullable && onModify) {
        e.preventDefault();
        onModify(null);
        onStopEdit();
      }
      return;
    }

    // Not editing — cell is just active
    if (e.key === 'Enter' || e.key === 'F2') {
      if (editable && !isDeleted) {
        e.preventDefault();
        onStartEdit();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onNavigate('up');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onNavigate('down');
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onNavigate('left');
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onNavigate('right');
    } else if (e.key === 'Tab') {
      e.preventDefault();
      onNavigate(e.shiftKey ? 'left' : 'right');
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      if (editable && !isDeleted && onModify && isNullable) {
        e.preventDefault();
        onModify(null);
      }
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && editable && !isDeleted) {
      // Start editing on any printable character
      onStartEdit();
      setEditDraft(e.key);
    }
  }, [isEditing, editable, isDeleted, isNullable, cancelEdit, commitEdit, onNavigate, onStartEdit, onStopEdit, onModify]);

  const handleDoubleClick = useCallback(() => {
    if (editable && !isDeleted) {
      onActivate();
      onStartEdit();
    }
  }, [editable, isDeleted, onActivate, onStartEdit]);

  const handleClick = useCallback(() => {
    if (!isActive) {
      onActivate();
    }
  }, [isActive, onActivate]);

  const handleContextMenu = useCallback(() => {
    if (!isActive) {
      onActivate();
    }
  }, [isActive, onActivate]);

  const isFk =
    !!fkInfo?.fkRefTable && cell !== null && cell !== undefined && !!onNavigateFk;

  const rawStr =
    cell === null || cell === undefined
      ? null
      : String(typeof cell === 'object' ? JSON.stringify(cell) : cell);

  const isDateType = colType === 'date' || colType === 'datetime' || colType === 'time';
  const cellStr =
    rawStr !== null && isDateType && settings.dateFormat !== 'iso'
      ? rawStr // Use raw for editing context
      : rawStr;

  // Display modified value with formatting
  const displayStr = isModified ? (displayValue ?? null) : cellStr;

  // Background styling
  let bgClass = '';
  if (isModified && !isDeleted) bgClass = 'bg-blue-50 dark:bg-blue-950/50';
  if (isActive) bgClass += ' outline-2 outline outline-primary -outline-offset-2';

  const ctxItemClass =
    'flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground';

  const handleCopy = useCallback(() => {
    if (displayStr !== null) {
      navigator.clipboard.writeText(displayStr);
    }
    onCopy?.();
  }, [displayStr, onCopy]);

  const handleSetNull = useCallback(() => {
    onModify?.(null);
    if (isEditing) onStopEdit();
  }, [onModify, isEditing, onStopEdit]);

  const isMac = navigator.platform.includes('Mac');

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <TableCell
          ref={cellRef}
          className={`whitespace-nowrap font-mono truncate ${bgClass} ${editable && !isDeleted ? 'cursor-text' : ''}`}
          style={{
            ...(colWidth ? { width: colWidth, minWidth: colWidth, maxWidth: colWidth } : {}),
            fontSize: 'var(--quarry-font-size, 13px)',
            paddingTop: 'var(--quarry-cell-py, 8px)',
            paddingBottom: 'var(--quarry-cell-py, 8px)',
          }}
          tabIndex={isActive ? 0 : -1}
          onKeyDown={handleKeyDown}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
          onContextMenu={handleContextMenu}
        >
          {isEditing ? (
            colType === 'boolean' ? (
              <select
                ref={inputRef as React.RefObject<HTMLSelectElement>}
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onBlur={commitEdit}
                className="w-full min-w-0 border-none bg-transparent font-mono focus:outline-none"
                style={{ fontSize: 'var(--quarry-font-size, 13px)' }}
              >
                {isNullable && <option value="">NULL</option>}
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={colType === 'number' ? 'number' : 'text'}
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onBlur={commitEdit}
                className="w-full min-w-0 border-none bg-transparent font-mono focus:outline-none"
                style={{ fontSize: 'var(--quarry-font-size, 13px)' }}
                step={colType === 'number' ? 'any' : undefined}
              />
            )
          ) : displayStr === null ? (
            <span className="text-muted-foreground italic">null</span>
          ) : isFk && !isModified ? (
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
            renderCellContent(displayStr, rowIdx, colIdx)
          )}
        </TableCell>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="z-50 min-w-44 rounded-md border bg-popover p-1 shadow-md">
          <ContextMenu.Item className={ctxItemClass} onSelect={handleCopy} disabled={displayStr === null}>
            <span className="flex-1">Copy</span>
            <span className="ml-auto pl-4 text-xs text-muted-foreground">{isMac ? '⌘C' : 'Ctrl+C'}</span>
          </ContextMenu.Item>
          {editable && !isDeleted && (
            <>
              <ContextMenu.Item
                className={ctxItemClass}
                onSelect={() => { onActivate(); onStartEdit(); }}
              >
                <span className="flex-1">Edit</span>
                <span className="ml-auto pl-4 text-xs text-muted-foreground">F2</span>
              </ContextMenu.Item>
              {isNullable && (
                <ContextMenu.Item
                  className={ctxItemClass}
                  onSelect={handleSetNull}
                  disabled={displayStr === null}
                >
                  <span className="flex-1">Set NULL</span>
                  <span className="ml-auto pl-4 text-xs text-muted-foreground">{isMac ? '⌘⌫' : 'Ctrl+Del'}</span>
                </ContextMenu.Item>
              )}
              {isModified && onRevert && (
                <>
                  <ContextMenu.Separator className="my-1 h-px bg-border" />
                  <ContextMenu.Item className={ctxItemClass} onSelect={onRevert}>
                    Revert
                  </ContextMenu.Item>
                </>
              )}
            </>
          )}
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
});
