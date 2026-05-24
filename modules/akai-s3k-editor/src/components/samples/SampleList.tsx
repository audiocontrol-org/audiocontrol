import { useState, useRef, useEffect, useCallback } from 'react';
import { DeleteIcon, RefreshIcon, CloneIcon } from '@audiocontrol/editor-core';
import { cn } from '@/lib/utils';

interface SampleListProps {
  sampleNames: string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onDelete?: (index: number) => void;
  onRename?: (index: number, newName: string) => Promise<void>;
  onClone?: (index: number) => void;
  onRefresh?: (index: number) => void;
  onRefreshAll?: () => void;
  onOpenInLoopEditor?: (index: number) => void;
  onOpenInSampleEditor?: (index: number) => void;
  onOpenInChopper?: (index: number) => void;
  isLoading: boolean;
}

function ActionButton({
  onClick,
  title,
  children,
  danger,
  selected,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
  selected?: boolean;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={cn(
        'ac-list-action-btn',
        selected && 'ac-list-action-btn--selected',
        danger && 'ac-list-action-btn--danger',
      )}
      title={title}
    >
      {children}
    </button>
  );
}

/**
 * Eyebrow row above the list scroll pane — see ProgramList for the
 * same shape. Pinned outside the scroll pane so the refresh-all
 * affordance stays accessible as the user pages through samples.
 */
function SampleListHeader({
  onRefreshAll,
  isLoading,
}: {
  onRefreshAll?: () => void;
  isLoading: boolean;
}): JSX.Element {
  return (
    <div className="ac-akai-list-eyebrow">
      <span className="ac-akai-list-eyebrow-title">Samples</span>
      {onRefreshAll && (
        <button
          onClick={onRefreshAll}
          disabled={isLoading}
          className="ac-akai-list-eyebrow-btn"
          title="Reload all samples from device"
        >
          <RefreshIcon />
        </button>
      )}
    </div>
  );
}

export function SampleList({
  sampleNames,
  selectedIndex,
  onSelect,
  onDelete,
  onRename,
  onClone,
  onRefresh,
  onRefreshAll,
  onOpenInLoopEditor,
  onOpenInSampleEditor,
  onOpenInChopper,
  isLoading,
}: SampleListProps): JSX.Element {
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
    setEditValue(sampleNames[index] ?? '');
  }, [sampleNames, isSaving]);

  const commitRename = useCallback(async () => {
    if (editingIndex === null || isSaving) return;
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === sampleNames[editingIndex]?.trim() || !onRename) {
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
  }, [editingIndex, editValue, sampleNames, onRename, isSaving]);

  const cancelRename = useCallback(() => {
    if (isSaving) return;
    setEditingIndex(null);
  }, [isSaving]);

  if (isLoading) {
    return (
      <aside className="ac-list" aria-label="Sample list">
        <SampleListHeader onRefreshAll={onRefreshAll} isLoading={isLoading} />
        <div className="ac-list-scroll ac-akai-list-state">
          <span className="ac-akai-list-state-msg">Loading samples...</span>
        </div>
      </aside>
    );
  }

  if (sampleNames.length === 0) {
    return (
      <aside className="ac-list" aria-label="Sample list">
        <SampleListHeader onRefreshAll={onRefreshAll} isLoading={isLoading} />
        <div className="ac-list-scroll ac-akai-list-state">
          <span className="ac-akai-list-state-msg">No samples loaded</span>
        </div>
      </aside>
    );
  }

  const hasActions = onDelete || onRename || onClone || onRefresh
    || onOpenInLoopEditor || onOpenInSampleEditor || onOpenInChopper;

  return (
    <aside className="ac-list" aria-label="Sample list">
      <SampleListHeader onRefreshAll={onRefreshAll} isLoading={isLoading} />
      <div className="ac-list-scroll">
        {sampleNames.map((name, index) => {
          const isSelected = index === selectedIndex;
          const isEmpty = name.trim() === '';
          const isEditing = editingIndex === index;

          const handleClick = () => onSelect(index);
          const handleDoubleClick = () => {
            if (onRename && !isEmpty) startRename(index);
          };
          const handleKeyDown = (e: React.KeyboardEvent) => {
            if (isEditing) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick();
            }
          };

          const displayName = isEmpty ? '(empty)' : name;
          const nameClass = isEmpty
            ? 'ac-list-name ac-list-name--empty'
            : 'ac-list-name';

          return (
            <div
              key={index}
              data-testid={`sample-item-${index}`}
              role="button"
              tabIndex={0}
              aria-selected={isSelected}
              className="ac-list-row ac-akai-list-row"
              onClick={isEditing ? undefined : handleClick}
              onDoubleClick={isEditing ? undefined : handleDoubleClick}
              onKeyDown={handleKeyDown}
            >
              <span className="ac-list-slot">{index + 1}</span>
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
                  className={cn('ac-akai-list-rename', isSaving && 'ac-akai-list-rename--saving')}
                />
              ) : (
                <span className={nameClass} data-testid="sample-name">
                  {displayName}
                </span>
              )}
              {hasActions && !isEmpty && !isEditing && (
                <span className="ac-akai-list-row-actions">
                  {onRefresh && (
                    <ActionButton
                      onClick={(e) => { e.stopPropagation(); onRefresh(index); }}
                      title="Reload from device"
                      selected={isSelected}
                    >
                      <RefreshIcon />
                    </ActionButton>
                  )}
                  {onClone && (
                    <ActionButton
                      onClick={(e) => { e.stopPropagation(); onClone(index); }}
                      title="Clone sample"
                      selected={isSelected}
                    >
                      <CloneIcon />
                    </ActionButton>
                  )}
                  {onDelete && (
                    <ActionButton
                      onClick={(e) => { e.stopPropagation(); onDelete(index); }}
                      selected={isSelected}
                      title="Delete sample"
                      danger
                    >
                      <DeleteIcon />
                    </ActionButton>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
