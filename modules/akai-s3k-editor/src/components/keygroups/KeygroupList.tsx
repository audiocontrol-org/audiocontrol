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
      <div className="card p-2">
        <div className="px-2 py-1 mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-300">Keygroups</span>
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="text-gray-500 hover:text-gray-200 disabled:opacity-50 transition-colors p-0.5 rounded"
              title="Reload keygroups from device"
            >
              <RefreshIcon />
            </button>
          )}
        </div>
        <div className="ac-list-scroll flex items-center justify-center py-8">
          <span className="text-sm text-gray-500">No keygroups available. Select a program first.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card p-2">
      <div className="px-2 py-1 mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-300">Keygroups</span>
        <div className="flex items-center gap-1">
          {onAdd && (
            <button
              onClick={onAdd}
              disabled={isLoading}
              className="text-gray-500 hover:text-gray-200 disabled:opacity-50 transition-colors p-0.5 rounded"
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
              className="text-gray-500 hover:text-gray-200 disabled:opacity-50 transition-colors p-0.5 rounded"
              title="Reload keygroups from device"
            >
              <RefreshIcon />
            </button>
          )}
        </div>
      </div>
      <div className="ac-list-scroll space-y-1">
        {Array.from({ length: keygroupCount }, (_, i) => {
          const kg = keygroups[i];
          const isSelected = selectedIndex === i;

          return (
            <div key={i} className="group relative">
              <button
                onClick={() => onSelect(i)}
                disabled={isLoading}
                data-testid={`keygroup-item-${i}`}
                className={cn(
                  'w-full px-3 py-2 rounded text-left text-sm transition-colors',
                  'hover:bg-gray-700/50',
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300',
                  isLoading && 'opacity-50',
                )}
              >
                <div className="flex items-center gap-3 pr-8">
                  <span className="text-xs text-gray-500 w-6 text-right font-mono">
                    {i + 1}
                  </span>
                  <span className="truncate font-mono">
                    KG {i + 1}
                  </span>
                  {kg ? (
                    <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
                      {formatMidiNote(kg.LONOTE)}–{formatMidiNote(kg.HINOTE)}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-600 ml-auto">...</span>
                  )}
                </div>
              </button>
              {onDelete && canDeleteSelected && isSelected && (
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ActionButton
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(i);
                    }}
                    selected={isSelected}
                    title="Delete keygroup"
                    danger
                  >
                    <DeleteIcon />
                  </ActionButton>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
