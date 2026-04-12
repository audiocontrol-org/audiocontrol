import { useState, useRef, useEffect, useCallback } from 'react';
import { DeleteIcon, CloneIcon, RefreshIcon } from '@audiocontrol/editor-core';
import { cn } from '@/lib/utils';

interface ProgramListProps {
  programNames: string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onDelete?: (index: number) => void;
  onRename?: (index: number, newName: string) => Promise<void>;
  onClone?: (index: number) => void;
  onRefresh?: (index: number) => void;
  onRefreshAll?: () => void;
  isLoading: boolean;
}

function ActionButton({
  onClick,
  title,
  children,
  danger,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        'p-0.5 rounded transition-colors',
        danger
          ? 'text-gray-500 hover:text-red-400'
          : 'text-gray-500 hover:text-gray-200',
      )}
      title={title}
    >
      {children}
    </button>
  );
}

export function ProgramList({
  programNames,
  selectedIndex,
  onSelect,
  onDelete,
  onRename,
  onClone,
  onRefresh,
  onRefreshAll,
  isLoading,
}: ProgramListProps): JSX.Element {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingIndex !== null && !isSaving && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingIndex, isSaving]);

  const startRename = useCallback((index: number) => {
    if (isSaving) return;
    setEditingIndex(index);
    setEditValue(programNames[index] ?? '');
  }, [programNames, isSaving]);

  const commitRename = useCallback(async () => {
    if (editingIndex === null || isSaving) return;
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === programNames[editingIndex]?.trim() || !onRename) {
      setEditingIndex(null);
      return;
    }
    setIsSaving(true);
    try {
      await onRename(editingIndex, trimmed);
    } finally {
      setIsSaving(false);
      setEditingIndex(null);
    }
  }, [editingIndex, editValue, programNames, onRename, isSaving]);

  const cancelRename = useCallback(() => {
    if (isSaving) return;
    setEditingIndex(null);
  }, [isSaving]);

  if (isLoading) {
    return (
      <div className="card p-2">
        <div className="px-2 py-1 mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-300">Programs</span>
          {onRefreshAll && (
            <button
              onClick={onRefreshAll}
              disabled={isLoading}
              className="text-gray-500 hover:text-gray-200 disabled:opacity-50 transition-colors p-0.5 rounded"
              title="Reload all programs from device"
            >
              <RefreshIcon />
            </button>
          )}
        </div>
        <div className="ac-scroll-list flex items-center justify-center py-8">
          <span className="text-sm text-gray-500">Loading programs...</span>
        </div>
      </div>
    );
  }

  if (programNames.length === 0) {
    return (
      <div className="card p-2">
        <div className="px-2 py-1 mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-300">Programs</span>
          {onRefreshAll && (
            <button
              onClick={onRefreshAll}
              disabled={isLoading}
              className="text-gray-500 hover:text-gray-200 disabled:opacity-50 transition-colors p-0.5 rounded"
              title="Reload all programs from device"
            >
              <RefreshIcon />
            </button>
          )}
        </div>
        <div className="ac-scroll-list flex items-center justify-center py-8">
          <span className="text-sm text-gray-500">No programs loaded</span>
        </div>
      </div>
    );
  }

  const hasActions = onDelete || onRename || onClone || onRefresh;

  return (
    <div className="card p-2">
      <div className="px-2 py-1 mb-2">
        <span className="text-sm font-medium text-gray-300">Programs</span>
      </div>
      <div className="ac-scroll-list space-y-1">
        {programNames.map((name, index) => {
          const isSelected = index === selectedIndex;
          const isEmpty = name.trim() === '';

          const isEditing = editingIndex === index;

          return (
            <div
              key={index}
              className="group relative"
            >
              <button
                data-testid={`program-item-${index}`}
                onClick={() => onSelect(index)}
                onDoubleClick={() => { if (onRename && !isEmpty) startRename(index); }}
                className={cn(
                  'w-full px-3 py-2 rounded text-left text-sm transition-colors',
                  'hover:bg-gray-700/50',
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : isEmpty
                      ? 'text-gray-500/50'
                      : 'text-gray-300',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-6 text-right font-mono">
                    {index + 1}
                  </span>
                  {isEditing ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={isSaving ? `${editValue.trim()}…` : editValue}
                      maxLength={12}
                      readOnly={isSaving}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void commitRename();
                        if (e.key === 'Escape') cancelRename();
                        e.stopPropagation();
                      }}
                      onBlur={() => void commitRename()}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'flex-1 min-w-0 rounded px-1.5 py-0.5 text-sm font-mono uppercase outline-none',
                        isSaving
                          ? 'bg-gray-800 border border-gray-600 text-gray-400'
                          : 'bg-gray-900 border border-blue-500 text-gray-200',
                      )}
                    />
                  ) : (
                    <span
                      className={cn('truncate', isEmpty && 'italic')}
                      data-testid="program-name"
                    >
                      {isEmpty ? '(empty)' : name}
                    </span>
                  )}
                </div>
              </button>
              {hasActions && !isEmpty && !isEditing && (
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onRefresh && (
                    <ActionButton
                      onClick={(e) => { e.stopPropagation(); onRefresh(index); }}
                      title="Reload from device"
                    >
                      <RefreshIcon />
                    </ActionButton>
                  )}
                  {onClone && (
                    <ActionButton
                      onClick={(e) => { e.stopPropagation(); onClone(index); }}
                      title="Clone program"
                    >
                      <CloneIcon />
                    </ActionButton>
                  )}
                  {onDelete && (
                    <ActionButton
                      onClick={(e) => { e.stopPropagation(); onDelete(index); }}
                      title="Delete program"
                      danger
                    >
                      <DeleteIcon />
                    </ActionButton>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
