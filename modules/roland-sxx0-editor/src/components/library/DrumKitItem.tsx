/**
 * Drum Kit Item
 *
 * Renders a single drum kit entry in the library tree with
 * selection, drag-start, and delete support.
 */

import { useCallback } from 'react';
import type { DrumKitInfo } from '@/lib/library-service';
import { cn } from '@/lib/utils';
import { DrumKitIcon } from './LibraryTreeIcons';
import { DeleteButton } from './LibraryTreeIcons';

export interface DrumKitItemProps {
  kitInfo: DrumKitInfo;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}

export function DrumKitItem({
  kitInfo,
  isSelected,
  onSelect,
  onDelete,
  onDragStart,
}: DrumKitItemProps): JSX.Element {
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.();
  }, [onDelete]);

  return (
    <div
      className={cn(
        'group w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
        'flex items-center gap-2 cursor-grab active:cursor-grabbing',
        isSelected
          ? 'bg-s330-highlight/20 text-s330-highlight'
          : 'text-s330-text hover:bg-s330-accent/30'
      )}
      onClick={onSelect}
      draggable
      onDragStart={onDragStart}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      <DrumKitIcon />
      <span className="flex-1 truncate font-medium">{kitInfo.name}</span>
      <span className="text-xs text-s330-muted">
        {kitInfo.kitCount} kit{kitInfo.kitCount !== 1 ? 's' : ''} / {kitInfo.sampleCount} samples
      </span>
      {onDelete && <DeleteButton onClick={handleDelete} title="Delete drum kit" />}
    </div>
  );
}
