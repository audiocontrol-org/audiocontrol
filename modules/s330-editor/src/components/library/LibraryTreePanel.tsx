/**
 * Library Tree Panel
 *
 * Center panel showing library contents in a tree structure:
 * - Sets (expandable folders showing their tones/patches)
 * - Global Tones
 * - Global Patches
 */

import { useState, useCallback } from 'react';
import type { SetInfo } from '@audiocontrol/sampler-library/browser';
import { cn } from '@/lib/utils';

interface LibraryTreePanelProps {
  libraryHandle: FileSystemDirectoryHandle | null;
  sets: SetInfo[];
  selectedName?: string;
  selectedType?: 'tone' | 'patch' | 'set';
  onSelectSet: (name: string) => void;
  onSelectTone: (name: string, setName?: string) => void;
  onSelectPatch: (name: string, setName?: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

/**
 * Folder icon component
 */
function FolderIcon({ isOpen }: { isOpen: boolean }): JSX.Element {
  return (
    <svg
      className={cn('w-4 h-4', isOpen ? 'text-s330-highlight' : 'text-s330-muted')}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      {isOpen ? (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      )}
    </svg>
  );
}

/**
 * Chevron icon for expandable items
 */
function ChevronIcon({ isExpanded }: { isExpanded: boolean }): JSX.Element {
  return (
    <svg
      className={cn(
        'w-3 h-3 text-s330-muted transition-transform',
        isExpanded && 'rotate-90'
      )}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

/**
 * Set item with expandable contents
 */
function SetItem({
  setInfo,
  isSelected,
  isExpanded,
  onToggle,
  onSelect,
}: {
  setInfo: SetInfo;
  isSelected: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
}): JSX.Element {
  return (
    <div>
      <button
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('.expand-toggle')) {
            onToggle();
          } else {
            onSelect();
          }
        }}
        className={cn(
          'w-full text-left px-2 py-1.5 rounded text-sm transition-colors',
          'flex items-center gap-2',
          isSelected
            ? 'bg-s330-highlight/20 text-s330-highlight'
            : 'text-s330-text hover:bg-s330-accent/30'
        )}
      >
        <span className="expand-toggle cursor-pointer p-0.5 -ml-0.5">
          <ChevronIcon isExpanded={isExpanded} />
        </span>
        <FolderIcon isOpen={isExpanded} />
        <span className="flex-1 truncate font-medium">{setInfo.name}</span>
        <span className="text-xs text-s330-muted">
          {setInfo.toneCount}T / {setInfo.patchCount}P
        </span>
      </button>

      {/* Expanded contents */}
      {isExpanded && (
        <div className="ml-6 mt-0.5 space-y-0.5 border-l border-s330-accent/30 pl-2">
          {setInfo.toneCount > 0 && (
            <div className="text-xs text-s330-muted py-1">
              {setInfo.toneCount} tone{setInfo.toneCount !== 1 ? 's' : ''}
            </div>
          )}
          {setInfo.patchCount > 0 && (
            <div className="text-xs text-s330-muted py-1">
              {setInfo.patchCount} patch{setInfo.patchCount !== 1 ? 'es' : ''}
            </div>
          )}
          {setInfo.description && (
            <div className="text-xs text-s330-muted/70 py-1 italic">
              {setInfo.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LibraryTreePanel({
  libraryHandle,
  sets,
  selectedName,
  selectedType,
  onSelectSet,
  onRefresh,
  isLoading,
}: LibraryTreePanelProps): JSX.Element {
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());

  const toggleSet = useCallback((name: string) => {
    setExpandedSets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  if (!libraryHandle) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Library</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-s330-muted text-sm">
            <p className="mb-2">No library folder selected</p>
            <p className="text-xs">
              Click "Select Library Folder" above to connect your library.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b border-s330-accent">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-s330-text">Library</h3>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={cn(
              'text-s330-muted hover:text-s330-text transition-colors p-1',
              isLoading && 'animate-spin'
            )}
            title="Refresh library"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
        <p className="text-xs text-s330-muted mt-1">
          {sets.length} set{sets.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Sets Section */}
        <div className="p-2">
          <div className="text-xs font-medium text-s330-muted uppercase tracking-wide px-2 py-1">
            Sets
          </div>

          {sets.length === 0 ? (
            <div className="text-sm text-s330-muted/70 px-2 py-4 text-center italic">
              No sets in library
            </div>
          ) : (
            <div className="space-y-0.5">
              {sets.map((setInfo) => (
                <SetItem
                  key={setInfo.name}
                  setInfo={setInfo}
                  isSelected={selectedType === 'set' && selectedName === setInfo.name}
                  isExpanded={expandedSets.has(setInfo.name)}
                  onToggle={() => toggleSet(setInfo.name)}
                  onSelect={() => onSelectSet(setInfo.name)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
