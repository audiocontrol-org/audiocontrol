/**
 * Item Preview Panel
 *
 * Right panel showing details of the selected item (tone, patch, or set)
 * with action buttons for import/export.
 */

import { useState, useEffect } from 'react';
import type { SamplerTone, SamplerPatch } from '@/core/midi/SamplerClient';
import type { SetYaml, StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import type { RolandPageSelection } from '@/pages/LibraryPage';
import {
  loadToneFromSet,
  loadPatchFromSet,
  loadSetManifest,
  loadIndividualTone,
  loadIndividualPatch,
  convertYamlToS330Tone,
  convertYamlToS330Patch,
  getPatchToneDependencies,
} from '@/lib/library-service';
import { useDeviceConfig } from '@/context/DeviceConfigContext';

interface ItemPreviewPanelProps {
  selection: RolandPageSelection | null;
  deviceTones: (SamplerTone | undefined)[];
  devicePatches: (SamplerPatch | undefined)[];
  libraryHandle: StorageDirectoryHandle | null;
  onImportTone?: (setName: string, toneFile: string) => void;
  onImportPatch?: (setName: string, patchFile: string) => void;
  onImportIndividualTone?: (toneFile: string) => void;
  onImportIndividualPatch?: (patchDirectoryName: string, path?: string[]) => void;
  onLoadSet?: () => void;
  onOpenInLoopEditor?: (name: string, nodeType: string, path?: string[]) => void;
  onOpenInSampleEditor?: (name: string, nodeType: string, path?: string[]) => void;
}

/**
 * Tone preview component
 */
function TonePreview({ tone, slotLabel }: { tone: SamplerTone; slotLabel: string }): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-s330-muted uppercase tracking-wide mb-1">
          {slotLabel}
        </div>
        <h4 className="text-lg font-bold text-s330-text">{tone.name}</h4>
      </div>

      <div className="bg-s330-bg rounded p-3 text-sm space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-s330-muted text-xs">Sample Rate</span>
            <div className="text-s330-text">{tone.sampleRate}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Loop Mode</span>
            <div className="text-s330-text capitalize">{tone.loopMode}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Original Key</span>
            <div className="text-s330-text">{tone.originalKey}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Output</span>
            <div className="text-s330-text">
              {tone.outputAssign === 0 ? 'Mix' : `Out ${tone.outputAssign}`}
            </div>
          </div>
        </div>

        <hr className="border-s330-accent/30" />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-s330-muted text-xs">Wave Bank</span>
            <div className="text-s330-text">{tone.wave.bank === 0 ? 'A' : 'B'}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Segments</span>
            <div className="text-s330-text">
              {tone.wave.segmentTop}-{tone.wave.segmentTop + tone.wave.segmentLength - 1}
              {' '}({tone.wave.segmentLength})
            </div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">TVA Level</span>
            <div className="text-s330-text">{tone.tva?.level ?? '-'}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">TVF</span>
            <div className="text-s330-text">{tone.tvf?.enabled ? 'ON' : 'OFF'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Library tone preview from YAML (shows original slot from file name)
 */
function LibraryTonePreview({
  tone,
  fileName,
  onImport,
  onChopSample,
  onOpenInLoopEditor,
  onOpenInSampleEditor,
  isLoadingWav,
}: {
  tone: SamplerTone;
  fileName: string;
  onImport?: () => void;
  onChopSample?: () => void;
  onOpenInLoopEditor?: () => void;
  onOpenInSampleEditor?: () => void;
  isLoadingWav?: boolean;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <TonePreview tone={tone} slotLabel={`Library Tone: ${fileName}`} />

      <div className="flex flex-col gap-2">
        {onImport && (
          <button
            onClick={onImport}
            className="w-full ac-btn ac-btn-primary"
            data-testid="import-to-device-button"
          >
            Import to Device
          </button>
        )}
        {onOpenInLoopEditor && (
          <button
            onClick={onOpenInLoopEditor}
            disabled={isLoadingWav}
            className="w-full ac-btn ac-btn-ghost"
          >
            {isLoadingWav ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Loading...
              </>
            ) : (
              'Open in Loop Editor'
            )}
          </button>
        )}
        {onOpenInSampleEditor && (
          <button
            onClick={onOpenInSampleEditor}
            disabled={isLoadingWav}
            className="w-full ac-btn ac-btn-ghost"
          >
            {isLoadingWav ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Loading...
              </>
            ) : (
              'Open in Editor'
            )}
          </button>
        )}
        {onChopSample && (
          <button
            onClick={onChopSample}
            disabled={isLoadingWav}
            className="w-full ac-btn ac-btn-ghost"
          >
            {isLoadingWav ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Loading...
              </>
            ) : (
              'Chop into Drum Kit'
            )}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Patch preview component
 */
function PatchPreview({ patch, slotLabel }: { patch: SamplerPatch; slotLabel: string }): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-s330-muted uppercase tracking-wide mb-1">
          {slotLabel}
        </div>
        <h4 className="text-lg font-bold text-s330-text">{patch.common.name}</h4>
      </div>

      <div className="bg-s330-bg rounded p-3 text-sm space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-s330-muted text-xs">Key Mode</span>
            <div className="text-s330-text capitalize">{patch.common.keyMode}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Level</span>
            <div className="text-s330-text">{patch.common.level}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Bender Range</span>
            <div className="text-s330-text">{patch.common.benderRange}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Key Assign</span>
            <div className="text-s330-text capitalize">{patch.common.keyAssign}</div>
          </div>
        </div>

        <hr className="border-s330-accent/30" />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-s330-muted text-xs">Aftertouch</span>
            <div className="text-s330-text capitalize">{patch.common.aftertouchAssign}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Output</span>
            <div className="text-s330-text">
              {patch.common.outputAssign === 8 ? 'Mix' : `Out ${patch.common.outputAssign}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Library patch preview with tone dependencies
 */
function LibraryPatchPreview({
  patch,
  fileName,
  manifest,
  onImport,
}: {
  patch: SamplerPatch;
  fileName: string;
  manifest: SetYaml | null;
  onImport?: () => void;
}): JSX.Element {
  const { memoryLayout } = useDeviceConfig();

  // Use the canonical function for tone dependency analysis.
  // DO NOT duplicate this logic - see getPatchToneDependencies for important
  // details about toneLayer2 handling that are easy to get wrong.
  const sortedTones = getPatchToneDependencies(patch);

  // Look up tone files in manifest. Slot labels are device-aware
  // (S-330: T11..T48; S-550: T11..T88 across blocks I..IV) — route through
  // the layout formatter, never raw `Math.floor(idx/8) + 1` arithmetic.
  const toneFiles = manifest
    ? sortedTones.map((slot) => {
        const entry = manifest.tones.find((t) => t.slot === slot);
        return entry ? entry.file : memoryLayout.formatToneSlot(slot);
      })
    : sortedTones.map((slot) => memoryLayout.formatToneSlot(slot));

  return (
    <div className="space-y-4">
      <PatchPreview patch={patch} slotLabel={`Library Patch: ${fileName}`} />

      {/* Required Tones */}
      {sortedTones.length > 0 && (
        <div className="bg-s330-bg rounded p-3 text-sm">
          <div className="text-s330-muted text-xs uppercase tracking-wide mb-2">
            Required Tones ({sortedTones.length})
          </div>
          <div className="space-y-1">
            {sortedTones.map((slot, idx) => (
              <div key={slot} className="flex items-center gap-2 text-s330-text">
                <span className="text-s330-muted">{memoryLayout.formatToneSlot(slot)}:</span>
                <span className="truncate">{toneFiles[idx]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {onImport && (
        <button
          onClick={onImport}
          className="w-full ac-btn ac-btn-primary"
          data-testid="import-to-device-button"
        >
          Import to Device
        </button>
      )}
    </div>
  );
}

/**
 * Set preview component (for library sets)
 */
function SetPreview({ name, onLoad }: { name: string; onLoad?: () => void }): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-s330-muted uppercase tracking-wide mb-1">
          Library Set
        </div>
        <h4 className="text-lg font-bold text-s330-text">{name}</h4>
      </div>

      <div className="bg-s330-bg rounded p-3 text-sm">
        <p className="text-s330-muted">
          Load this set to replace all tones and patches on the device.
        </p>
      </div>

      {onLoad && (
        <button
          onClick={onLoad}
          className="w-full ac-btn ac-btn-primary"
        >
          Load Set to Device
        </button>
      )}
    </div>
  );
}

/**
 * Loading state component
 */
function LoadingState(): JSX.Element {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="flex items-center gap-2 text-s330-muted">
        <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span>Loading...</span>
      </div>
    </div>
  );
}

/**
 * Error state component
 */
function ErrorState({ message }: { message: string }): JSX.Element {
  return (
    <div className="text-center text-red-400 text-sm py-8">
      <p>Failed to load: {message}</p>
    </div>
  );
}

export function ItemPreviewPanel({
  selection,
  deviceTones,
  devicePatches,
  libraryHandle,
  onImportTone,
  onImportPatch,
  onImportIndividualTone,
  onImportIndividualPatch,
  onLoadSet,
  onOpenInLoopEditor,
  onOpenInSampleEditor,
}: ItemPreviewPanelProps): JSX.Element {
  const { memoryLayout } = useDeviceConfig();

  // State for loaded library items
  const [loadingLibraryItem, setLoadingLibraryItem] = useState(false);
  const [libraryTone, setLibraryTone] = useState<SamplerTone | null>(null);
  const [libraryPatch, setLibraryPatch] = useState<SamplerPatch | null>(null);
  const [libraryManifest, setLibraryManifest] = useState<SetYaml | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load library item when selection changes
  useEffect(() => {
    // Reset state
    setLibraryTone(null);
    setLibraryPatch(null);
    setLibraryManifest(null);
    setLoadError(null);

    if (!selection || selection.source !== 'library' || !libraryHandle) {
      return;
    }

    // Skip if set (sets have their own simple preview)
    if (selection.type === 'set') {
      return;
    }

    // Handle individual tones (outside of sets)
    if (selection.type === 'individualTone' && selection.name) {
      const loadIndividual = async () => {
        setLoadingLibraryItem(true);
        try {
          const { yaml } = await loadIndividualTone(libraryHandle, selection.name!, selection.path ?? []);
          const tone = convertYamlToS330Tone(yaml);
          setLibraryTone(tone);
        } catch (err) {
          console.error('[ItemPreviewPanel] Failed to load individual tone:', err);
          setLoadError(err instanceof Error ? err.message : 'Failed to load tone');
        } finally {
          setLoadingLibraryItem(false);
        }
      };
      loadIndividual();
      return;
    }

    // Handle individual patches (outside of sets)
    if (selection.type === 'individualPatch' && selection.name) {
      const loadIndividual = async () => {
        setLoadingLibraryItem(true);
        try {
          const bundle = await loadIndividualPatch(libraryHandle, selection.name!, selection.path ?? []);
          const patch = convertYamlToS330Patch(bundle.patch);
          setLibraryPatch(patch);
        } catch (err) {
          console.error('[ItemPreviewPanel] Failed to load individual patch:', err);
          setLoadError(err instanceof Error ? err.message : 'Failed to load patch');
        } finally {
          setLoadingLibraryItem(false);
        }
      };
      loadIndividual();
      return;
    }

    // Need setName for library tones/patches within sets
    if (!selection.setName || !selection.name) {
      return;
    }

    const loadItem = async () => {
      setLoadingLibraryItem(true);
      try {
        // Load manifest for context (needed for patch dependencies)
        const manifest = await loadSetManifest(libraryHandle, selection.setName!);
        setLibraryManifest(manifest);

        if (selection.type === 'tone') {
          const { yaml } = await loadToneFromSet(libraryHandle, selection.setName!, selection.name!);
          const tone = convertYamlToS330Tone(yaml);
          setLibraryTone(tone);
        } else if (selection.type === 'patch') {
          const patchYaml = await loadPatchFromSet(libraryHandle, selection.setName!, selection.name!);
          const patch = convertYamlToS330Patch(patchYaml);
          setLibraryPatch(patch);
        }
      } catch (err) {
        console.error('[ItemPreviewPanel] Failed to load library item:', err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load item');
      } finally {
        setLoadingLibraryItem(false);
      }
    };

    loadItem();
  }, [selection, libraryHandle]);

  // Empty state
  if (!selection) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Preview</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-s330-muted text-sm">
            <p>Select an item to preview</p>
          </div>
        </div>
      </div>
    );
  }

  // Device tone selected
  if (selection.source === 'device' && selection.type === 'tone' && selection.index !== undefined) {
    const tone = deviceTones[selection.index];
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Device Tone</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {tone ? (
            <TonePreview tone={tone} slotLabel={memoryLayout.formatToneSlot(selection.index)} />
          ) : (
            <div className="text-center text-s330-muted text-sm py-8">
              <p>Empty slot</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Device patch selected
  if (selection.source === 'device' && selection.type === 'patch' && selection.index !== undefined) {
    const patch = devicePatches[selection.index];
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Device Patch</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {patch ? (
            <PatchPreview patch={patch} slotLabel={memoryLayout.formatPatchSlot(selection.index)} />
          ) : (
            <div className="text-center text-s330-muted text-sm py-8">
              <p>Empty slot</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Library set selected
  if (selection.source === 'library' && selection.type === 'set' && selection.name) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Library Set</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <SetPreview name={selection.name} onLoad={onLoadSet} />
        </div>
      </div>
    );
  }

  // Individual library tone selected (outside of sets)
  if (selection.source === 'library' && selection.type === 'individualTone' && selection.name) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Library Tone</h3>
          <p className="text-xs text-s330-muted mt-0.5">individual export</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loadingLibraryItem ? (
            <LoadingState />
          ) : loadError ? (
            <ErrorState message={loadError} />
          ) : libraryTone ? (
            <>
              <LibraryTonePreview
                tone={libraryTone}
                fileName={selection.name}
                onImport={onImportIndividualTone ? () => onImportIndividualTone(selection.name!) : undefined}
                onOpenInLoopEditor={onOpenInLoopEditor ? () => onOpenInLoopEditor(selection.name!, 'tone', selection.path) : undefined}
                onOpenInSampleEditor={onOpenInSampleEditor ? () => onOpenInSampleEditor(selection.name!, 'tone', selection.path) : undefined}
              />
            </>
          ) : (
            <div className="text-center text-s330-muted text-sm py-8">
              <p>Could not load tone</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Individual library patch selected (outside of sets)
  if (selection.source === 'library' && selection.type === 'individualPatch' && selection.name) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Library Patch</h3>
          <p className="text-xs text-s330-muted mt-0.5">individual export</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loadingLibraryItem ? (
            <LoadingState />
          ) : loadError ? (
            <ErrorState message={loadError} />
          ) : libraryPatch ? (
            <LibraryPatchPreview
              patch={libraryPatch}
              fileName={selection.name}
              manifest={null}
              onImport={onImportIndividualPatch ? () => onImportIndividualPatch(selection.name!, selection.path) : undefined}
            />
          ) : (
            <div className="text-center text-s330-muted text-sm py-8">
              <p>Could not load patch</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Library tone selected (within a set)
  if (selection.source === 'library' && selection.type === 'tone' && selection.setName && selection.name) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Library Tone</h3>
          <p className="text-xs text-s330-muted mt-0.5">from {selection.setName}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loadingLibraryItem ? (
            <LoadingState />
          ) : loadError ? (
            <ErrorState message={loadError} />
          ) : libraryTone ? (
            <>
              <LibraryTonePreview
                tone={libraryTone}
                fileName={selection.name}
                onImport={onImportTone ? () => onImportTone(selection.setName!, selection.name!) : undefined}
                onOpenInLoopEditor={onOpenInLoopEditor ? () => onOpenInLoopEditor(selection.name!, 'tone', selection.path) : undefined}
                onOpenInSampleEditor={onOpenInSampleEditor ? () => onOpenInSampleEditor(selection.name!, 'tone', selection.path) : undefined}
              />
            </>
          ) : (
            <div className="text-center text-s330-muted text-sm py-8">
              <p>Could not load tone</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Library patch selected
  if (selection.source === 'library' && selection.type === 'patch' && selection.setName && selection.name) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Library Patch</h3>
          <p className="text-xs text-s330-muted mt-0.5">from {selection.setName}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loadingLibraryItem ? (
            <LoadingState />
          ) : loadError ? (
            <ErrorState message={loadError} />
          ) : libraryPatch ? (
            <LibraryPatchPreview
              patch={libraryPatch}
              fileName={selection.name}
              manifest={libraryManifest}
              onImport={onImportPatch ? () => onImportPatch(selection.setName!, selection.name!) : undefined}
            />
          ) : (
            <div className="text-center text-s330-muted text-sm py-8">
              <p>Could not load patch</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-s330-accent">
        <h3 className="font-bold text-s330-text">Preview</h3>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-s330-muted text-sm">
          <p>Select an item to preview</p>
        </div>
      </div>
    </div>
  );
}
