import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { DeleteIcon, RefreshIcon, CloneIcon } from '@audiocontrol/editor-core';
import { formatMidiNote } from '@/lib/midi-note-parser';
import { cn } from '@/lib/utils';

interface KeygroupListProps {
  keygroups: (KeygroupHeader | undefined)[];
  keygroupCount: number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onAdd?: () => void;
  onDelete?: (index: number) => void;
  onRefresh?: () => void;
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
 * same shape. Lives outside `.ac-list-scroll` so the title + add /
 * refresh icons stay pinned as the user scrolls.
 */
function KeygroupListHeader({
  onAdd,
  onRefresh,
  isLoading,
}: {
  onAdd?: () => void;
  onRefresh?: () => void;
  isLoading: boolean;
}): JSX.Element {
  return (
    <div className="ac-akai-list-eyebrow">
      <span className="ac-akai-list-eyebrow-title">Keygroups</span>
      <div className="ac-akai-list-eyebrow-actions">
        {onAdd && (
          <button
            onClick={onAdd}
            disabled={isLoading}
            className="ac-akai-list-eyebrow-btn"
            title="Add keygroup"
            data-testid="add-keygroup-btn"
          >
            <CloneIcon />
          </button>
        )}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="ac-akai-list-eyebrow-btn"
            title="Reload keygroups from device"
          >
            <RefreshIcon />
          </button>
        )}
      </div>
    </div>
  );
}

export function KeygroupList({
  keygroups,
  keygroupCount,
  selectedIndex,
  onSelect,
  onAdd,
  onDelete,
  onRefresh,
  isLoading,
}: KeygroupListProps): JSX.Element {
  const canDeleteSelected = selectedIndex !== null && keygroupCount > 1;

  if (keygroupCount === 0) {
    return (
      <aside className="ac-list" aria-label="Keygroup list">
        <KeygroupListHeader onAdd={onAdd} onRefresh={onRefresh} isLoading={isLoading} />
        <div className="ac-list-scroll ac-akai-list-state">
          <span className="ac-akai-list-state-msg">No keygroups available. Select a program first.</span>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="ac-list"
      // KG1..KG11 = max 4 chars; widen the slot column slightly so
      // the label doesn't truncate or shift between 1-digit and
      // 2-digit indices.
      style={{ ['--ac-list-row-slot-width' as string]: '2.75rem' }}
      aria-label="Keygroup list"
    >
      <KeygroupListHeader onAdd={onAdd} onRefresh={onRefresh} isLoading={isLoading} />
      <div className="ac-list-scroll">
        {Array.from({ length: keygroupCount }, (_, i) => {
          const kg = keygroups[i];
          const isSelected = selectedIndex === i;
          const showDelete = onDelete && canDeleteSelected && isSelected;

          const handleClick = () => onSelect(i);
          const handleKeyDown = (e: React.KeyboardEvent) => {
            if (isLoading) return;
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick();
            }
          };

          return (
            <div
              key={i}
              data-testid={`keygroup-item-${i}`}
              role="button"
              tabIndex={isLoading ? -1 : 0}
              aria-disabled={isLoading}
              aria-selected={isSelected}
              className="ac-list-row ac-akai-list-row"
              onClick={isLoading ? undefined : handleClick}
              onKeyDown={handleKeyDown}
            >
              <span className="ac-list-slot">KG{i + 1}</span>
              <span className="ac-list-name">
                {kg
                  ? `${formatMidiNote(kg.LONOTE)}–${formatMidiNote(kg.HINOTE)}`
                  : '...'}
              </span>
              {showDelete && (
                <span className="ac-akai-list-row-actions">
                  <ActionButton
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDelete) onDelete(i);
                    }}
                    selected={isSelected}
                    title="Delete keygroup"
                    danger
                  >
                    <DeleteIcon />
                  </ActionButton>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
