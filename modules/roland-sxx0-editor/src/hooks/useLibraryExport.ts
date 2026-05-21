/**
 * Library Export Hook
 *
 * Manages state and callbacks for exporting tones and patches
 * from the device to the library (device -> library direction).
 */

import { useState, useCallback, type MutableRefObject } from 'react';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { type SamplerClientInterface, type SamplerTone, type SamplerPatch, toneHasWaveData } from '@/core/midi/SamplerClient';
import type { DeviceDragData } from '@/components/library/DeviceMemoryPanel';
import type { OperationProgress } from '@/types/import-operation';
import {
  exportToneToDirectory,
  exportToneAsDownload,
  exportPatchToDirectory,
  getPatchToneDependencies,
  listIndividualTones,
  listIndividualPatches,
  type LibraryToneInfo,
  type LibraryPatchInfo,
  type PatchBundleTone,
  type StorageDirectoryHandle,
} from '@/lib/library-service';

interface ExportToneDialogState {
  tone: SamplerTone;
  toneIndex: number;
  /** Library subfolder path the export should land in (e.g. ['DRUMS']).
   *  Defaults to [] (the patches/tones root). Populated when the user
   *  drops a device item on a specific folder row rather than on the
   *  category root — without this the export silently lands at the
   *  top level no matter where the operator dropped. */
  targetPath?: string[];
}

interface ExportPatchDialogState {
  patch: SamplerPatch;
  patchIndex: number;
  /** Subfolder for the exported patch bundle — see tone dialog above. */
  targetPath?: string[];
}

/** Item descriptor for batch export — one row per device slot the operator
 *  multi-selected before dropping. The `name` is taken from the device at
 *  capture time and threads through to the library filename slug. */
export interface BatchExportItem {
  index: number;
  name: string;
  slotLabel: string;
}

interface BatchExportDialogState {
  kind: 'tone' | 'patch';
  items: BatchExportItem[];
  /** Library subfolder the batch should land in — same shape as the
   *  single-item dialog's targetPath. */
  targetPath: string[];
}

interface UseLibraryExportOptions {
  clientRef: MutableRefObject<SamplerClientInterface | null>;
  libraryHandle: StorageDirectoryHandle | null;
  tones: (SamplerTone | undefined)[];
  patches: (SamplerPatch | undefined)[];
  setIndividualTones: (tones: LibraryToneInfo[]) => void;
  setIndividualPatches: (patches: LibraryPatchInfo[]) => void;
  /**
   * Full library re-scan that the LibraryPage exposes (sets +
   * individual tones + individual patches + samples). Called after
   * every successful export so the tree picks up the newly written
   * objects without the operator having to hit the refresh icon —
   * the partial `setIndividualPatches(updatedPatches)` we used to do
   * here updated only one slice and missed any sibling state the
   * tree pane derives from a full refresh (set membership,
   * cross-category presence checks, etc.).
   */
  handleRefreshLibrary: () => Promise<void>;
  /**
   * When true and `libraryHandle` is null, `handleExportTone` falls back to
   * downloading the tone YAML + WAV via `exportToneAsDownload`. When false
   * (default) and `libraryHandle` is null, `handleExportTone` throws.
   *
   * This preserves the legacy TonesPage behavior, where the export dialog
   * is allowed to open even when no library is connected (the user gets a
   * file download instead). PatchesPage does NOT need this — it gates the
   * dialog on a connected library — and there is no patch-download fallback
   * in `library-service` to call.
   */
  allowDownloadFallback?: boolean;
}

interface UseLibraryExportResult {
  // Export tone dialog
  exportToneDialog: ExportToneDialogState | null;
  exportProgress: OperationProgress | undefined;
  exportError: string | null;

  // Export patch dialog
  exportPatchDialog: ExportPatchDialogState | null;
  exportPatchProgress: OperationProgress | undefined;
  exportPatchError: string | null;

  // Batch export drawer (tones OR patches). Mutually exclusive with the
  // single-item dialogs above — a drop with `data.indices.length > 1`
  // opens this drawer instead of the single dialog.
  batchExportDialog: BatchExportDialogState | null;
  batchExportProgress: OperationProgress | undefined;
  batchExportError: string | null;

  // Shared
  isExporting: boolean;

  // Handlers
  handleDropDeviceTone: (data: DeviceDragData, targetPath?: string[]) => void;
  handleDropDevicePatch: (data: DeviceDragData, targetPath?: string[]) => void;
  handleExportTone: (toneName: string, toneIndex: number) => Promise<void>;
  handleExportPatch: (patchName: string, patchIndex: number) => Promise<void>;
  /** Runs the batch identified by the current `batchExportDialog`. The
   *  dispatch happens serially (next item starts after the prior write
   *  resolves) so the SteppedProgressDrawer's "Exporting X of N" step
   *  log advances one row at a time and the operator sees the device
   *  cycle through items. The library tree is refreshed once at the
   *  end (not per-item — that would re-scan O(N²) tree state). */
  handleBatchExport: () => Promise<void>;

  // Imperative dialog openers (for non-DnD entry points: list-row buttons,
  // editor toolbar buttons, etc.). Open the same dialog the drag-and-drop
  // handlers use, but addressable by index.
  openExportToneDialog: (toneIndex: number) => void;
  openExportPatchDialog: (patchIndex: number) => void;

  // Dialog closers (for onOpenChange)
  closeExportToneDialog: () => void;
  closeExportPatchDialog: () => void;
  closeBatchExportDialog: () => void;
}

export function useLibraryExport({
  clientRef,
  libraryHandle,
  tones,
  patches,
  setIndividualTones,
  setIndividualPatches,
  handleRefreshLibrary,
  allowDownloadFallback = false,
}: UseLibraryExportOptions): UseLibraryExportResult {
  // Device-aware slot label formatter — used in user-facing progress / error text.
  // Routing through MemoryLayout means S-550 patches >= block 2 render with the
  // Roman-numeral block prefix (II11..II28 etc.) instead of P31..P48 arithmetic.
  const { memoryLayout } = useDeviceConfig();

  // Export tone dialog state
  const [exportToneDialog, setExportToneDialog] = useState<ExportToneDialogState | null>(null);
  const [exportProgress, setExportProgress] = useState<OperationProgress | undefined>(undefined);
  const [exportError, setExportError] = useState<string | null>(null);

  // Export patch dialog state
  const [exportPatchDialog, setExportPatchDialog] = useState<ExportPatchDialogState | null>(null);
  const [exportPatchProgress, setExportPatchProgress] = useState<OperationProgress | undefined>(undefined);
  const [exportPatchError, setExportPatchError] = useState<string | null>(null);

  // Batch export drawer state — opened when a drop carries a multi-
  // index payload (DeviceDragData.indices.length > 1). The drawer
  // owns its own progress stream so cross-item progress doesn't
  // collide with the single-item dialog's stream.
  const [batchExportDialog, setBatchExportDialog] = useState<BatchExportDialogState | null>(null);
  const [batchExportProgress, setBatchExportProgress] = useState<OperationProgress | undefined>(undefined);
  const [batchExportError, setBatchExportError] = useState<string | null>(null);

  // Shared
  const [isExporting, setIsExporting] = useState(false);

  // Close export tone dialog (only when not exporting)
  const closeExportToneDialog = useCallback(() => {
    if (!isExporting) {
      setExportToneDialog(null);
      setExportProgress(undefined);
      setExportError(null);
    }
  }, [isExporting]);

  // Close export patch dialog (only when not exporting)
  const closeExportPatchDialog = useCallback(() => {
    if (!isExporting) {
      setExportPatchDialog(null);
      setExportPatchProgress(undefined);
      setExportPatchError(null);
    }
  }, [isExporting]);

  const closeBatchExportDialog = useCallback(() => {
    if (!isExporting) {
      setBatchExportDialog(null);
      setBatchExportProgress(undefined);
      setBatchExportError(null);
    }
  }, [isExporting]);

  // Imperatively open the export-tone dialog by tone index.
  // Mirrors `handleDropDeviceTone` for callers that don't go through DnD
  // (e.g. a list-row "Export" button, a toolbar action). Same effects:
  // sets the dialog state, clears progress and error. Throws if the tone
  // isn't loaded — the caller is responsible for ensuring the tone is
  // present in the device-data store before invoking export.
  const openExportToneDialog = useCallback((toneIndex: number) => {
    if (!libraryHandle && !allowDownloadFallback) {
      throw new Error('Library not connected. Connect a library before exporting.');
    }
    const tone = tones[toneIndex];
    if (!tone) {
      throw new Error('Tone not loaded from device. Try refreshing device data first.');
    }
    setExportProgress(undefined);
    setExportError(null);
    setExportToneDialog({ tone, toneIndex });
  }, [tones, libraryHandle, allowDownloadFallback]);

  // Imperatively open the export-patch dialog by patch index.
  const openExportPatchDialog = useCallback((patchIndex: number) => {
    if (!libraryHandle) {
      throw new Error('Library not connected. Connect a library before exporting.');
    }
    const patch = patches[patchIndex];
    if (!patch) {
      throw new Error('Patch not loaded from device. Try refreshing device data first.');
    }
    setExportPatchProgress(undefined);
    setExportPatchError(null);
    setExportPatchDialog({ patch, patchIndex });
  }, [patches, libraryHandle]);

  // Handle drop from device memory to library (export tone). When the
  // payload's `indices` array has >1 entries, opens the batch drawer;
  // otherwise opens the single-item dialog. Single is the common case;
  // batch fires only after the operator multi-selected in the device
  // memory panel before dragging.
  const handleDropDeviceTone = useCallback((data: DeviceDragData, targetPath: string[] = []) => {
    if (data.type !== 'tone') {
      return;
    }
    // Batch path: multi-select drag.
    if (data.indices && data.indices.length > 1) {
      const items: BatchExportItem[] = [];
      for (const i of data.indices) {
        const tone = tones[i];
        if (!tone) {
          // Loud failure — the operator just dragged this set; if one
          // slot isn't loaded, the batch is incoherent and the silent
          // "skip the missing item" pattern would land an incomplete
          // export at the destination without telling them.
          throw new Error(
            `Tone at ${memoryLayout.formatToneSlot(i)} is not loaded. Reload the bank and try again.`,
          );
        }
        items.push({ index: i, name: tone.name || `Tone_${memoryLayout.formatToneSlot(i)}`, slotLabel: memoryLayout.formatToneSlot(i) });
      }
      setBatchExportDialog({ kind: 'tone', items, targetPath });
      setBatchExportProgress(undefined);
      setBatchExportError(null);
      return;
    }
    // Single path (existing).
    const tone = tones[data.index];
    if (!tone) {
      throw new Error('Tone not loaded from device. Try refreshing device data first.');
    }
    setExportToneDialog({ tone, toneIndex: data.index, targetPath });
    setExportProgress(undefined);
    setExportError(null);
  }, [tones, memoryLayout]);

  // Handle drop from device memory to library (export patch) — same
  // batch detection as the tone sibling above.
  const handleDropDevicePatch = useCallback((data: DeviceDragData, targetPath: string[] = []) => {
    if (data.type !== 'patch') {
      return;
    }
    if (data.indices && data.indices.length > 1) {
      const items: BatchExportItem[] = [];
      for (const i of data.indices) {
        const patch = patches[i];
        if (!patch) {
          throw new Error(
            `Patch at ${memoryLayout.formatPatchSlot(i)} is not loaded. Reload the bank and try again.`,
          );
        }
        items.push({
          index: i,
          name: patch.common.name || `Patch_${memoryLayout.formatPatchSlot(i)}`,
          slotLabel: memoryLayout.formatPatchSlot(i),
        });
      }
      setBatchExportDialog({ kind: 'patch', items, targetPath });
      setBatchExportProgress(undefined);
      setBatchExportError(null);
      return;
    }
    const patch = patches[data.index];
    if (!patch) {
      throw new Error('Patch not loaded from device. Try refreshing device data first.');
    }
    setExportPatchDialog({ patch, patchIndex: data.index, targetPath });
    setExportPatchProgress(undefined);
    setExportPatchError(null);
  }, [patches, memoryLayout]);

  // Handle export tone from dialog
  const handleExportTone = useCallback(async (toneName: string, toneIndex: number) => {
    if (!clientRef.current || !exportToneDialog) {
      throw new Error('Device not connected');
    }
    if (!libraryHandle && !allowDownloadFallback) {
      throw new Error('Library not connected');
    }

    const tone = exportToneDialog.tone;

    setIsExporting(true);
    setExportError(null);
    setExportProgress({
      currentStep: 1, totalSteps: 2,
      stepLabel: 'Fetching wave data',
      bytesSent: 0, bytesTotal: 0,
      bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
    });

    try {
      // Step 1: Fetch wave data from device
      const waveData = await clientRef.current.requestWaveData(
        toneIndex,
        (received, total) => {
          setExportProgress({
            currentStep: 1,
            totalSteps: 2,
            stepLabel: 'Fetching wave data',
            bytesSent: received,
            bytesTotal: total,
            bytesSentAllSteps: 0,
            bytesTotalAllSteps: total,
          });
        }
      );

      const waveBytes = waveData.data.length;

      // Step 2: Write to library (or download as files if no library connected
      // and fallback is enabled — preserves the legacy TonesPage behavior).
      const writingToLibrary = libraryHandle !== null;
      setExportProgress({
        currentStep: 2,
        totalSteps: 2,
        stepLabel: writingToLibrary ? 'Writing to library' : 'Downloading files',
        bytesSent: 0,
        bytesTotal: 0,
        bytesSentAllSteps: waveBytes,
        bytesTotalAllSteps: waveBytes,
      });

      if (libraryHandle) {
        await exportToneToDirectory(
          libraryHandle,
          { ...tone, name: toneName },
          waveData,
          toneName,
          () => {
            // Writing is fast — just keep the progress at step 2
          },
          // targetPath threads through from the drop site so a drop
          // on a folder row writes into that folder instead of the
          // tones root (bug pre-2026-05-21: targetPath was discarded
          // and every drop landed at the top level).
          exportToneDialog.targetPath ?? [],
        );
      } else {
        // allowDownloadFallback path: download YAML + WAV instead of writing
        // to a library directory.
        await exportToneAsDownload({ ...tone, name: toneName }, waveData, toneName, () => {});
      }

      // Final state: complete
      setExportProgress({
        currentStep: 2,
        totalSteps: 2,
        stepLabel: 'Export complete',
        bytesSent: 0,
        bytesTotal: 0,
        bytesSentAllSteps: waveBytes,
        bytesTotalAllSteps: waveBytes,
      });

      // Refresh the library tree end-to-end so the newly exported
      // tone surfaces without the operator hitting the refresh icon.
      // The partial `listIndividualTones` call below is preserved
      // for the legacy callers that consume `setIndividualTones`
      // directly; the canonical refresh is the full re-scan.
      if (libraryHandle) {
        await handleRefreshLibrary();
        const updatedTones = await listIndividualTones(libraryHandle);
        setIndividualTones(updatedTones);
      }
    } catch (err) {
      console.error('[useLibraryExport] Failed to export tone:', err);
      const message = err instanceof Error ? err.message : 'Failed to export tone';
      setExportError(message);
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, [libraryHandle, clientRef, exportToneDialog, setIndividualTones, handleRefreshLibrary, allowDownloadFallback]);

  // Handle export patch from dialog
  const handleExportPatch = useCallback(async (patchName: string, _patchIndex: number) => {
    if (!libraryHandle || !exportPatchDialog || !clientRef.current) {
      throw new Error('Library or device not connected');
    }

    const patch = exportPatchDialog.patch;
    const client = clientRef.current;

    setIsExporting(true);
    setExportPatchError(null);

    try {
      // Get all tone slots referenced by this patch
      const referencedSlots = getPatchToneDependencies(patch);

      // Auto-fetch any referenced tones that aren't already in the
      // device-data store. The prior behavior threw "Tone not loaded
      // from device — refresh first" which forced the operator to go
      // load every bank that the patch happens to touch. The patch
      // export already needs MIDI for the wave data; the parameter
      // dump is a fast SysEx round-trip, so we fetch what's missing
      // inline. Each fetch becomes a "Resolving tone TXX" row in the
      // v3 step log so the operator sees the work happening rather
      // than wondering why the export paused.
      const fetchedTones = new Map<number, SamplerTone>();
      let stepCounter = 0;

      const resolveTone = async (slot: number): Promise<SamplerTone> => {
        const cached = fetchedTones.get(slot);
        if (cached) return cached;
        const existing = tones[slot];
        if (existing) {
          fetchedTones.set(slot, existing);
          return existing;
        }
        stepCounter += 1;
        const myStep = stepCounter;
        setExportPatchProgress({
          currentStep: myStep,
          // Total is unknown until classification finishes — the
          // step-log view ignores `totalSteps` and the v3 dialog
          // no longer renders the legacy OperationProgressBar, so
          // equating the two keeps each step's bar at 100% (matches
          // the discrete-step model of the new chrome).
          totalSteps: myStep,
          stepLabel: `Resolving tone ${memoryLayout.formatToneSlot(slot)}`,
          bytesSent: 0, bytesTotal: 0,
          bytesSentAllSteps: 0, bytesTotalAllSteps: 0,
        });
        const fetched = await client.requestToneData(slot);
        if (!fetched) {
          // `requestToneData` resolves null on transport failure / empty
          // slot. Surface as a real error so the v3 step log's failed
          // row tells the operator which tone the device wouldn't return.
          throw new Error(
            `Device returned no data for tone ${memoryLayout.formatToneSlot(slot)}. ` +
              `The slot may be empty or the MIDI transport may have failed.`,
          );
        }
        fetchedTones.set(slot, fetched);
        return fetched;
      };

      // Phase 1: classify every referenced slot, auto-fetching the
      // parameter data for any that aren't already in `tones`.
      const originalSlotSet = new Set<number>();
      const subToneSlots: number[] = [];
      for (const slot of referencedSlots) {
        const tone = await resolveTone(slot);
        if (toneHasWaveData(tone)) {
          originalSlotSet.add(slot);
        } else {
          subToneSlots.push(slot);
        }
      }

      // Phase 2: each sub-tone references a source tone whose wave
      // is the actual sample. Resolve those too if the patch didn't
      // reference them directly.
      for (const slot of subToneSlots) {
        const tone = fetchedTones.get(slot)!;
        const sourceSlot = tone.sourceTone;
        if (!originalSlotSet.has(sourceSlot)) {
          await resolveTone(sourceSlot);
          originalSlotSet.add(sourceSlot);
        }
      }

      const originalSlots = Array.from(originalSlotSet).sort((a, b) => a - b);

      // Phase 3: fetch wave data for every original tone. Each fetch
      // is its own step in the log; byte progress fills the active
      // row's bar in real time.
      const bundleTones: PatchBundleTone[] = [];
      let completedWaveBytes = 0;
      let estimatedTotalBytes = 0;

      for (let i = 0; i < originalSlots.length; i++) {
        const slot = originalSlots[i];
        const tone = fetchedTones.get(slot)!;
        stepCounter += 1;
        const myStep = stepCounter;

        const waveData = await client.requestWaveData(
          slot,
          (received, total) => {
            if (estimatedTotalBytes === 0 || received === 0) {
              estimatedTotalBytes = completedWaveBytes + total + (total * (originalSlots.length - i - 1));
            }
            setExportPatchProgress({
              currentStep: myStep,
              totalSteps: myStep + (originalSlots.length - i - 1) + 1,
              stepLabel: `Fetching tone ${memoryLayout.formatToneSlot(slot)}`,
              bytesSent: received,
              bytesTotal: total,
              bytesSentAllSteps: completedWaveBytes,
              bytesTotalAllSteps: estimatedTotalBytes,
            });
          }
        );

        completedWaveBytes += waveData.data.length;
        bundleTones.push({ slot, tone, waveData });
      }

      // Add sub-tones without wave data — they reference the
      // original tone's WAV in the exported bundle.
      for (const slot of subToneSlots) {
        const tone = fetchedTones.get(slot)!;
        bundleTones.push({ slot, tone });
      }

      // Phase 4 step counter bump for the write phase.
      stepCounter += 1;

      // Final step: write to library
      setExportPatchProgress({
        currentStep: stepCounter,
        totalSteps: stepCounter,
        stepLabel: 'Writing files to library',
        bytesSent: 0,
        bytesTotal: 0,
        bytesSentAllSteps: completedWaveBytes,
        bytesTotalAllSteps: completedWaveBytes,
      });

      await exportPatchToDirectory(
        libraryHandle,
        { ...patch, common: { ...patch.common, name: patchName } },
        bundleTones,
        patchName,
        () => {
          // Writing is fast — keep progress at final step
        },
        // See tone-export sibling — targetPath threads through from the
        // drop site so the bundle lands in the operator-targeted folder.
        exportPatchDialog.targetPath ?? [],
      );

      // Final state: complete
      setExportPatchProgress({
        currentStep: stepCounter,
        totalSteps: stepCounter,
        stepLabel: 'Export complete',
        bytesSent: 0,
        bytesTotal: 0,
        bytesSentAllSteps: completedWaveBytes,
        bytesTotalAllSteps: completedWaveBytes,
      });

      // Refresh the library tree end-to-end so the newly exported
      // patch surfaces without the operator hitting the refresh icon.
      // See the tone-export sibling above for the rationale.
      await handleRefreshLibrary();
      const updatedPatches = await listIndividualPatches(libraryHandle);
      setIndividualPatches(updatedPatches);
    } catch (err) {
      console.error('[useLibraryExport] Failed to export patch:', err);
      const message = err instanceof Error ? err.message : 'Failed to export patch';
      setExportPatchError(message);
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, [libraryHandle, clientRef, exportPatchDialog, tones, setIndividualPatches, handleRefreshLibrary, memoryLayout]);

  // Batch export — single entry point for both tone and patch batches.
  // Loops the items declared in the current `batchExportDialog` serially,
  // calling the same library helpers (`exportToneToDirectory` /
  // `exportPatchToDirectory`) as the single-item flows. Progress is
  // surfaced via `batchExportProgress` as a single step-per-item stream
  // (each item is one row in the SteppedProgressDrawer's log) — the
  // per-patch sub-steps (resolve / fetch / write) collapse to a single
  // "Exporting patch X" row so the drawer doesn't grow unbounded.
  const handleBatchExport = useCallback(async () => {
    if (!batchExportDialog) {
      throw new Error('No batch is queued for export');
    }
    if (!clientRef.current || !libraryHandle) {
      throw new Error('Device or library not connected');
    }
    const { kind, items, targetPath } = batchExportDialog;
    const client = clientRef.current;

    setIsExporting(true);
    setBatchExportError(null);

    try {
      let completedBytes = 0;
      let estimatedTotalBytes = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const stepHeader: OperationProgress = {
          currentStep: i + 1,
          totalSteps: items.length,
          stepLabel: kind === 'tone'
            ? `Exporting tone ${item.slotLabel}: ${item.name}`
            : `Exporting patch ${item.slotLabel}: ${item.name}`,
          bytesSent: 0,
          bytesTotal: 0,
          bytesSentAllSteps: completedBytes,
          bytesTotalAllSteps: estimatedTotalBytes,
        };
        setBatchExportProgress(stepHeader);

        if (kind === 'tone') {
          const tone = tones[item.index];
          if (!tone) {
            throw new Error(`Tone at ${item.slotLabel} is no longer loaded`);
          }
          const waveData = await client.requestWaveData(
            item.index,
            (received, total) => {
              if (estimatedTotalBytes === 0 || received === 0) {
                estimatedTotalBytes = completedBytes + total + (total * (items.length - i - 1));
              }
              setBatchExportProgress({
                ...stepHeader,
                bytesSent: received,
                bytesTotal: total,
                bytesSentAllSteps: completedBytes + received,
                bytesTotalAllSteps: estimatedTotalBytes,
              });
            },
          );
          await exportToneToDirectory(
            libraryHandle,
            { ...tone, name: item.name },
            waveData,
            item.name,
            () => {},
            targetPath,
          );
          completedBytes += waveData.data.length;
        } else {
          // Patch batch — resolve dependencies, fetch waves, then write.
          // The per-patch sub-steps collapse into the single step header
          // above; only the final "All N patches exported" surfaces in
          // the step log. Mirrors handleExportPatch's structure with the
          // dialog-state plumbing stripped out.
          const patch = patches[item.index];
          if (!patch) {
            throw new Error(`Patch at ${item.slotLabel} is no longer loaded`);
          }
          const referencedSlots = getPatchToneDependencies(patch);
          const fetchedTones = new Map<number, SamplerTone>();

          const resolveTone = async (slot: number): Promise<SamplerTone> => {
            const cached = fetchedTones.get(slot);
            if (cached) return cached;
            const existing = tones[slot];
            if (existing) {
              fetchedTones.set(slot, existing);
              return existing;
            }
            const fetched = await client.requestToneData(slot);
            if (!fetched) {
              throw new Error(
                `Device returned no data for tone ${memoryLayout.formatToneSlot(slot)} ` +
                  `referenced by patch ${item.slotLabel}.`,
              );
            }
            fetchedTones.set(slot, fetched);
            return fetched;
          };

          const originalSlotSet = new Set<number>();
          const subToneSlots: number[] = [];
          for (const slot of referencedSlots) {
            const t = await resolveTone(slot);
            if (toneHasWaveData(t)) {
              originalSlotSet.add(slot);
            } else {
              subToneSlots.push(slot);
            }
          }
          for (const slot of subToneSlots) {
            const t = fetchedTones.get(slot)!;
            if (!originalSlotSet.has(t.sourceTone)) {
              await resolveTone(t.sourceTone);
              originalSlotSet.add(t.sourceTone);
            }
          }
          const originalSlots = Array.from(originalSlotSet).sort((a, b) => a - b);

          const bundleTones: PatchBundleTone[] = [];
          let patchWaveBytes = 0;
          for (const slot of originalSlots) {
            const t = fetchedTones.get(slot)!;
            const waveData = await client.requestWaveData(slot, (received, total) => {
              if (estimatedTotalBytes === 0 || received === 0) {
                // Rough estimate: assume each remaining patch's wave footprint
                // is similar to what we've measured so far. The estimate
                // self-corrects on every received-bytes callback.
                estimatedTotalBytes = completedBytes + patchWaveBytes + total
                  + (total * (items.length - i - 1) * Math.max(1, originalSlots.length));
              }
              setBatchExportProgress({
                ...stepHeader,
                bytesSent: received,
                bytesTotal: total,
                bytesSentAllSteps: completedBytes + patchWaveBytes + received,
                bytesTotalAllSteps: estimatedTotalBytes,
              });
            });
            patchWaveBytes += waveData.data.length;
            bundleTones.push({ slot, tone: t, waveData });
          }
          for (const slot of subToneSlots) {
            const t = fetchedTones.get(slot)!;
            bundleTones.push({ slot, tone: t });
          }
          await exportPatchToDirectory(
            libraryHandle,
            { ...patch, common: { ...patch.common, name: item.name } },
            bundleTones,
            item.name,
            () => {},
            targetPath,
          );
          completedBytes += patchWaveBytes;
        }
      }

      // Final completion step — emits a clean "Export complete" row
      // in the step log so the drawer transitions to Done state.
      setBatchExportProgress({
        currentStep: items.length,
        totalSteps: items.length,
        stepLabel: 'Export complete',
        bytesSent: 0,
        bytesTotal: 0,
        bytesSentAllSteps: completedBytes,
        bytesTotalAllSteps: completedBytes,
      });

      // Single refresh after the loop — see UseLibraryExportOptions.handleRefreshLibrary
      // docstring for why per-item refresh is wrong (O(N²) tree work + cross-category
      // state churn the operator sees as flicker).
      await handleRefreshLibrary();
      if (kind === 'tone') {
        const updatedTones = await listIndividualTones(libraryHandle);
        setIndividualTones(updatedTones);
      } else {
        const updatedPatches = await listIndividualPatches(libraryHandle);
        setIndividualPatches(updatedPatches);
      }
    } catch (err) {
      console.error('[useLibraryExport] Batch export failed:', err);
      const message = err instanceof Error ? err.message : 'Batch export failed';
      setBatchExportError(message);
      throw err;
    } finally {
      setIsExporting(false);
    }
  }, [
    batchExportDialog,
    clientRef,
    libraryHandle,
    tones,
    patches,
    setIndividualTones,
    setIndividualPatches,
    handleRefreshLibrary,
    memoryLayout,
  ]);

  return {
    exportToneDialog,
    exportProgress,
    exportError,
    exportPatchDialog,
    exportPatchProgress,
    exportPatchError,
    batchExportDialog,
    batchExportProgress,
    batchExportError,
    isExporting,
    handleDropDeviceTone,
    handleDropDevicePatch,
    handleExportTone,
    handleExportPatch,
    handleBatchExport,
    openExportToneDialog,
    openExportPatchDialog,
    closeExportToneDialog,
    closeExportPatchDialog,
    closeBatchExportDialog,
  };
}
