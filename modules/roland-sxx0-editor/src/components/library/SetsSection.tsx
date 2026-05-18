/**
 * SetsSection -- Collapsible sets section for the library browser.
 *
 * Renders a list of SetItem components with lazy manifest loading.
 * Manages its own state for expanded sets, loaded manifests, and
 * loading indicators. Designed to be passed as `headerSections`
 * to PluginLibraryBrowser.
 */

import { useState, useCallback, useEffect } from 'react';
import type { SetInfo, SetYaml, StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import type { ItemSelection } from '@audiocontrol/editor-core';
import { loadSetManifest } from '@/lib/library-sets';
import { SetItem } from '@/components/library/SetItem';

// =========================================================================
// Types
// =========================================================================

export interface SetsSectionProps {
  /** Sets in the library */
  sets: SetInfo[];
  /** File system handle for the library (needed for manifest loading) */
  libraryHandle: StorageDirectoryHandle | null;
  /** Current selection state (used for highlighting) */
  selection: ItemSelection | null;
  /** Called when a set row is selected */
  onSelectSet: (name: string) => void;
  /** Called when a tone within a set is selected */
  onSelectTone: (name: string, setName: string) => void;
  /** Called when a patch within a set is selected */
  onSelectPatch: (name: string, setName: string) => void;
  /** Called when a set is deleted */
  onDeleteSet?: (name: string) => void;
  /** Called when a set is renamed */
  onRenameSet?: (oldName: string, newName: string) => Promise<void>;
}

// =========================================================================
// Component
// =========================================================================

export function SetsSection({
  sets,
  libraryHandle,
  selection,
  onSelectSet,
  onSelectTone,
  onSelectPatch,
  onDeleteSet,
  onRenameSet,
}: SetsSectionProps): JSX.Element {
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());
  const [manifests, setManifests] = useState<Map<string, SetYaml>>(new Map());
  const [loadingManifests, setLoadingManifests] = useState<Set<string>>(new Set());

  // Toggle set expansion
  const toggleSet = useCallback((name: string) => {
    setExpandedSets((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  // Load manifest when a set is expanded
  useEffect(() => {
    if (!libraryHandle) return;
    for (const setName of expandedSets) {
      if (manifests.has(setName) || loadingManifests.has(setName)) continue;
      setLoadingManifests((prev) => new Set(prev).add(setName));
      loadSetManifest(libraryHandle, setName)
        .then((manifest) => setManifests((prev) => new Map(prev).set(setName, manifest)))
        .catch((err) => console.error(`[SetsSection] Failed to load manifest for ${setName}:`, err))
        .finally(() =>
          setLoadingManifests((prev) => {
            const next = new Set(prev);
            next.delete(setName);
            return next;
          }),
        );
    }
  }, [expandedSets, libraryHandle, manifests, loadingManifests]);

  return (
    <div className="ac-tree-section">
      <div className="ac-tree-section-header">
        <span className="ac-tree-section-title">Sets</span>
      </div>
      {sets.length === 0 ? (
        <div className="ac-tree-section-empty">No sets in library</div>
      ) : (
        <div>
          {sets.map((setInfo) => (
            <SetItem
              key={setInfo.name}
              setInfo={setInfo}
              manifest={manifests.get(setInfo.name) ?? null}
              isSelected={selection?.categoryId === 'sets' && selection?.node.name === setInfo.name}
              isExpanded={expandedSets.has(setInfo.name)}
              selectedItemName={undefined}
              selectedItemType={undefined}
              onToggle={() => toggleSet(setInfo.name)}
              onSelect={() => onSelectSet(setInfo.name)}
              onSelectTone={(toneFile) => onSelectTone(toneFile, setInfo.name)}
              onSelectPatch={(patchFile) => onSelectPatch(patchFile, setInfo.name)}
              onToneDragStart={() => {}}
              onPatchDragStart={() => {}}
              isLoadingManifest={loadingManifests.has(setInfo.name)}
              onDelete={onDeleteSet ? () => onDeleteSet(setInfo.name) : undefined}
              onRename={onRenameSet ? (newName) => onRenameSet(setInfo.name, newName) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
