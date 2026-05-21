/**
 * Item Preview Panel
 *
 * Right column of the Library page — shows details of the selected
 * device or library item with import / edit actions.
 *
 * Uses the lean .ac-preview-pane chrome (head + body, no card boxes)
 * with .ac-preview-fields parameter grids and .ac-pane-action buttons,
 * matching the design language adopted across the editor pages.
 */

import { useState, useEffect, type ReactNode } from 'react';
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
import {
  PreviewPane,
  PreviewIdentity,
  FieldGrid,
  PaneAction,
  LoadingState,
  ErrorState,
  EmptySlotMessage,
  type FieldDef,
} from '@/components/library/preview-chrome';

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
  /** Open the v3 export drawer for a device-resident tone. */
  onExportDeviceTone?: (toneIndex: number) => void;
  /** Open the v3 export drawer for a device-resident patch. */
  onExportDevicePatch?: (patchIndex: number) => void;
  /** Pre-select the slot in the editor store and route to /tones. */
  onEditDeviceTone?: (toneIndex: number) => void;
  /** Pre-select the slot in the editor store and route to /patches. */
  onEditDevicePatch?: (patchIndex: number) => void;
}

// ---------------------------------------------------------------
// Tone / Patch / Set field-grid builders
// ---------------------------------------------------------------

function toneFields(tone: SamplerTone): FieldDef[][] {
  return [
    [
      { label: 'Sample Rate', value: tone.sampleRate },
      { label: 'Loop Mode', value: tone.loopMode },
      { label: 'Original Key', value: tone.originalKey },
      {
        label: 'Output',
        value: tone.outputAssign === 0 ? 'Mix' : `Out ${tone.outputAssign}`,
      },
    ],
    [
      { label: 'Wave Bank', value: tone.wave.bank === 0 ? 'A' : 'B' },
      {
        label: 'Segments',
        value: `${tone.wave.segmentTop}–${tone.wave.segmentTop + tone.wave.segmentLength - 1} (${tone.wave.segmentLength})`,
      },
      { label: 'TVA Level', value: tone.tva?.level ?? '—' },
      { label: 'TVF', value: tone.tvf?.enabled ? 'On' : 'Off' },
    ],
  ];
}

function patchFields(patch: SamplerPatch): FieldDef[][] {
  return [
    [
      { label: 'Key Mode', value: patch.common.keyMode },
      { label: 'Level', value: patch.common.level },
      { label: 'Bender Range', value: patch.common.benderRange },
      { label: 'Key Assign', value: patch.common.keyAssign },
    ],
    [
      { label: 'Aftertouch', value: patch.common.aftertouchAssign },
      {
        label: 'Output',
        value: patch.common.outputAssign === 8 ? 'Mix' : `Out ${patch.common.outputAssign}`,
      },
    ],
  ];
}

// ---------------------------------------------------------------
// Inner body components
// ---------------------------------------------------------------

function TonePreviewBody({
  tone,
  kind,
  slot,
  actions,
}: {
  tone: SamplerTone;
  kind: string;
  slot: string;
  actions?: ReactNode;
}): JSX.Element {
  const [primary, secondary] = toneFields(tone);
  return (
    <>
      <PreviewIdentity kind={kind} slot={slot} name={tone.name} />
      <FieldGrid fields={primary} />
      <FieldGrid fields={secondary} />
      {actions}
    </>
  );
}

function PatchPreviewBody({
  patch,
  kind,
  slot,
  toneList,
  actions,
}: {
  patch: SamplerPatch;
  kind: string;
  slot: string;
  toneList?: { slot: number; file: string }[];
  actions?: ReactNode;
}): JSX.Element {
  const config = useDeviceConfig();
  const [primary, secondary] = patchFields(patch);
  return (
    <>
      <PreviewIdentity kind={kind} slot={slot} name={patch.common.name} />
      <FieldGrid fields={primary} />
      <FieldGrid fields={secondary} />
      {toneList && toneList.length > 0 && (
        <div className="ac-preview-tone-list">
          <div className="ac-preview-tone-list-eyebrow">
            Required Tones ({toneList.length})
          </div>
          {toneList.map(({ slot: s, file }) => (
            <div key={s} className="ac-preview-tone-list-row">
              <span className="ac-preview-tone-list-slot">
                {config.memoryLayout.formatToneSlot(s)}
              </span>
              <span className="ac-preview-tone-list-name">{file}</span>
            </div>
          ))}
        </div>
      )}
      {actions}
    </>
  );
}

// ---------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------

export function ItemPreviewPanel({
  selection,
  deviceTones,
  devicePatches,
  libraryHandle,
  onImportTone,
  onImportPatch,
  onImportIndividualTone,
  onImportIndividualPatch,
  onExportDeviceTone,
  onExportDevicePatch,
  onEditDeviceTone,
  onEditDevicePatch,
  onLoadSet,
  onOpenInLoopEditor,
  onOpenInSampleEditor,
}: ItemPreviewPanelProps): JSX.Element {
  const { memoryLayout } = useDeviceConfig();

  const [loadingLibraryItem, setLoadingLibraryItem] = useState(false);
  const [libraryTone, setLibraryTone] = useState<SamplerTone | null>(null);
  const [libraryPatch, setLibraryPatch] = useState<SamplerPatch | null>(null);
  const [libraryManifest, setLibraryManifest] = useState<SetYaml | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLibraryTone(null);
    setLibraryPatch(null);
    setLibraryManifest(null);
    setLoadError(null);

    if (!selection || selection.source !== 'library' || !libraryHandle) return;
    if (selection.type === 'set') return;

    if (selection.type === 'individualTone' && selection.name) {
      const name = selection.name;
      const path = selection.path ?? [];
      (async () => {
        setLoadingLibraryItem(true);
        try {
          const { yaml } = await loadIndividualTone(libraryHandle, name, path);
          setLibraryTone(convertYamlToS330Tone(yaml));
        } catch (err) {
          console.error('[ItemPreviewPanel] Failed to load individual tone:', err);
          setLoadError(err instanceof Error ? err.message : 'Failed to load tone');
        } finally {
          setLoadingLibraryItem(false);
        }
      })();
      return;
    }

    if (selection.type === 'individualPatch' && selection.name) {
      const name = selection.name;
      const path = selection.path ?? [];
      (async () => {
        setLoadingLibraryItem(true);
        try {
          const bundle = await loadIndividualPatch(libraryHandle, name, path);
          setLibraryPatch(convertYamlToS330Patch(bundle.patch));
        } catch (err) {
          console.error('[ItemPreviewPanel] Failed to load individual patch:', err);
          setLoadError(err instanceof Error ? err.message : 'Failed to load patch');
        } finally {
          setLoadingLibraryItem(false);
        }
      })();
      return;
    }

    if (!selection.setName || !selection.name) return;

    const setName = selection.setName;
    const itemName = selection.name;
    const itemType = selection.type;
    (async () => {
      setLoadingLibraryItem(true);
      try {
        const manifest = await loadSetManifest(libraryHandle, setName);
        setLibraryManifest(manifest);
        if (itemType === 'tone') {
          const { yaml } = await loadToneFromSet(libraryHandle, setName, itemName);
          setLibraryTone(convertYamlToS330Tone(yaml));
        } else if (itemType === 'patch') {
          const patchYaml = await loadPatchFromSet(libraryHandle, setName, itemName);
          setLibraryPatch(convertYamlToS330Patch(patchYaml));
        }
      } catch (err) {
        console.error('[ItemPreviewPanel] Failed to load library item:', err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load item');
      } finally {
        setLoadingLibraryItem(false);
      }
    })();
  }, [selection, libraryHandle]);

  // ---- Empty state -------------------------------------------------
  if (!selection) {
    return (
      <PreviewPane title="Preview">
        <EmptySlotMessage message="Select an item to view details" />
      </PreviewPane>
    );
  }

  // ---- Device tone -------------------------------------------------
  if (selection.source === 'device' && selection.type === 'tone' && selection.index !== undefined) {
    const tone = deviceTones[selection.index];
    const toneIndex = selection.index;
    return (
      <PreviewPane title="Device Tone">
        {tone ? (
          <TonePreviewBody
            tone={tone}
            kind="Device Tone"
            slot={memoryLayout.formatToneSlot(toneIndex)}
            actions={
              (onExportDeviceTone || onEditDeviceTone) ? (
                <div className="ac-pane-actions">
                  {onExportDeviceTone && (
                    <PaneAction
                      label="Export to Library"
                      variant="primary"
                      onClick={() => onExportDeviceTone(toneIndex)}
                      testId="export-device-tone-button"
                    />
                  )}
                  {onEditDeviceTone && (
                    <PaneAction
                      label="Edit in Tone Editor"
                      onClick={() => onEditDeviceTone(toneIndex)}
                      testId="edit-device-tone-button"
                    />
                  )}
                </div>
              ) : undefined
            }
          />
        ) : (
          <EmptySlotMessage message="Empty slot" />
        )}
      </PreviewPane>
    );
  }

  // ---- Device patch ------------------------------------------------
  if (selection.source === 'device' && selection.type === 'patch' && selection.index !== undefined) {
    const patch = devicePatches[selection.index];
    const patchIndex = selection.index;
    return (
      <PreviewPane title="Device Patch">
        {patch ? (
          <PatchPreviewBody
            patch={patch}
            kind="Device Patch"
            slot={memoryLayout.formatPatchSlot(patchIndex)}
            actions={
              (onExportDevicePatch || onEditDevicePatch) ? (
                <div className="ac-pane-actions">
                  {onExportDevicePatch && (
                    <PaneAction
                      label="Export to Library"
                      variant="primary"
                      onClick={() => onExportDevicePatch(patchIndex)}
                      testId="export-device-patch-button"
                    />
                  )}
                  {onEditDevicePatch && (
                    <PaneAction
                      label="Edit in Patch Editor"
                      onClick={() => onEditDevicePatch(patchIndex)}
                      testId="edit-device-patch-button"
                    />
                  )}
                </div>
              ) : undefined
            }
          />
        ) : (
          <EmptySlotMessage message="Empty slot" />
        )}
      </PreviewPane>
    );
  }

  // ---- Library set -------------------------------------------------
  if (selection.source === 'library' && selection.type === 'set' && selection.name) {
    return (
      <PreviewPane title="Library Set">
        <PreviewIdentity kind="Library Set" name={selection.name} />
        <p className="ac-preview-pane-head-sub" style={{ fontFamily: 'inherit' }}>
          Load this set to replace all tones and patches on the device.
        </p>
        {onLoadSet && (
          <div className="ac-pane-actions">
            <PaneAction label="Load Set to Device" variant="primary" onClick={onLoadSet} />
          </div>
        )}
      </PreviewPane>
    );
  }

  // ---- Individual library tone ------------------------------------
  if (selection.source === 'library' && selection.type === 'individualTone' && selection.name) {
    const itemName = selection.name;
    const path = selection.path;
    return (
      <PreviewPane title="Library Tone" subtitle="individual export">
        {loadingLibraryItem ? (
          <LoadingState />
        ) : loadError ? (
          <ErrorState message={loadError} />
        ) : libraryTone ? (
          <TonePreviewBody
            tone={libraryTone}
            kind="Library Tone"
            slot={itemName}
            actions={
              <div className="ac-pane-actions">
                {onImportIndividualTone && (
                  <PaneAction
                    label="Import to Device"
                    variant="primary"
                    onClick={() => onImportIndividualTone(itemName)}
                    testId="import-to-device-button"
                  />
                )}
                {onOpenInLoopEditor && (
                  <PaneAction
                    label="Open in Loop Editor"
                    onClick={() => onOpenInLoopEditor(itemName, 'tone', path)}
                  />
                )}
                {onOpenInSampleEditor && (
                  <PaneAction
                    label="Open in Editor"
                    onClick={() => onOpenInSampleEditor(itemName, 'tone', path)}
                  />
                )}
              </div>
            }
          />
        ) : (
          <EmptySlotMessage message="Could not load tone" />
        )}
      </PreviewPane>
    );
  }

  // ---- Individual library patch -----------------------------------
  if (selection.source === 'library' && selection.type === 'individualPatch' && selection.name) {
    const itemName = selection.name;
    const path = selection.path;
    return (
      <PreviewPane title="Library Patch" subtitle="individual export">
        {loadingLibraryItem ? (
          <LoadingState />
        ) : loadError ? (
          <ErrorState message={loadError} />
        ) : libraryPatch ? (
          <PatchPreviewBody
            patch={libraryPatch}
            kind="Library Patch"
            slot={itemName}
            actions={
              <div className="ac-pane-actions">
                {onImportIndividualPatch && (
                  <PaneAction
                    label="Import to Device"
                    variant="primary"
                    onClick={() => onImportIndividualPatch(itemName, path)}
                    testId="import-to-device-button"
                  />
                )}
              </div>
            }
          />
        ) : (
          <EmptySlotMessage message="Could not load patch" />
        )}
      </PreviewPane>
    );
  }

  // ---- Library tone inside a set ----------------------------------
  if (selection.source === 'library' && selection.type === 'tone' && selection.setName && selection.name) {
    const setName = selection.setName;
    const itemName = selection.name;
    const path = selection.path;
    return (
      <PreviewPane title="Library Tone" subtitle={`from ${setName}`}>
        {loadingLibraryItem ? (
          <LoadingState />
        ) : loadError ? (
          <ErrorState message={loadError} />
        ) : libraryTone ? (
          <TonePreviewBody
            tone={libraryTone}
            kind="Library Tone"
            slot={itemName}
            actions={
              <div className="ac-pane-actions">
                {onImportTone && (
                  <PaneAction
                    label="Import to Device"
                    variant="primary"
                    onClick={() => onImportTone(setName, itemName)}
                    testId="import-to-device-button"
                  />
                )}
                {onOpenInLoopEditor && (
                  <PaneAction
                    label="Open in Loop Editor"
                    onClick={() => onOpenInLoopEditor(itemName, 'tone', path)}
                  />
                )}
                {onOpenInSampleEditor && (
                  <PaneAction
                    label="Open in Editor"
                    onClick={() => onOpenInSampleEditor(itemName, 'tone', path)}
                  />
                )}
              </div>
            }
          />
        ) : (
          <EmptySlotMessage message="Could not load tone" />
        )}
      </PreviewPane>
    );
  }

  // ---- Library patch inside a set ---------------------------------
  if (selection.source === 'library' && selection.type === 'patch' && selection.setName && selection.name) {
    const setName = selection.setName;
    const itemName = selection.name;
    return (
      <PreviewPane title="Library Patch" subtitle={`from ${setName}`}>
        {loadingLibraryItem ? (
          <LoadingState />
        ) : loadError ? (
          <ErrorState message={loadError} />
        ) : libraryPatch ? (
          <PatchPreviewBody
            patch={libraryPatch}
            kind="Library Patch"
            slot={itemName}
            toneList={resolveToneList(libraryPatch, libraryManifest, memoryLayout)}
            actions={
              <div className="ac-pane-actions">
                {onImportPatch && (
                  <PaneAction
                    label="Import to Device"
                    variant="primary"
                    onClick={() => onImportPatch(setName, itemName)}
                    testId="import-to-device-button"
                  />
                )}
              </div>
            }
          />
        ) : (
          <EmptySlotMessage message="Could not load patch" />
        )}
      </PreviewPane>
    );
  }

  // ---- Fallback ---------------------------------------------------
  return (
    <PreviewPane title="Preview">
      <EmptySlotMessage message="Select an item to view details" />
    </PreviewPane>
  );
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

interface MemLayoutLike {
  formatToneSlot: (slot: number) => string;
}

function resolveToneList(
  patch: SamplerPatch,
  manifest: SetYaml | null,
  memoryLayout: MemLayoutLike,
): { slot: number; file: string }[] {
  // Canonical dependency analysis lives in `getPatchToneDependencies`
  // — do not inline; toneLayer2 handling is easy to get wrong.
  const slots = getPatchToneDependencies(patch);
  return slots.map((slot) => {
    const entry = manifest?.tones.find((t) => t.slot === slot);
    return { slot, file: entry ? entry.file : memoryLayout.formatToneSlot(slot) };
  });
}
