/**
 * Incremental save: fresh device fetch + structured byte-accurate progress.
 *
 * Split out of `library-sets.ts` to keep that file under the 300-500 line
 * cap. `saveDeviceToSetIncremental` is substantial because it emits real
 * {@link OperationProgress} values across three logical steps (scanning,
 * tone writes with real wave-data bytes, patch writes with estimated
 * patch-file bytes) and needs a local emitter helper to keep each emit
 * site compact.
 */

import type { S330Tone, S330Patch } from '@/core/midi/S330Client';
import {
  type StorageDirectoryHandle,
  type SetYaml,
  type OperationProgress,
  getNestedDirectory,
} from '@audiocontrol/sampler-library/browser';
import {
  stringifyYaml,
  writeToneFilesToDirectory,
  writePatchFileToDirectory,
  getToneFilename,
  getPatchFilename,
} from '@/lib/library-io';
import type {
  FetchToneDataCallback,
  FetchPatchDataCallback,
  FetchWaveDataCallback,
} from '@/lib/library-sets-types';

// S-330 constants — duplicated locally from library-sets.ts. Kept inline
// because saveDeviceToSet (non-incremental) in library-sets.ts is the
// only other consumer and pulling them into a shared "constants" file
// would create a one-line module with no semantic value.
const MAX_TONES = 48;
const MAX_PATCHES = 16;

/**
 * Approximate size of a serialized S-330 patch YAML file in bytes.
 *
 * Used as the per-patch byte estimate during phase 3 of
 * {@link saveDeviceToSetIncremental} so that the progress bar can show
 * sensible cumulative bytes during the patch-write phase. Patch YAMLs are
 * small (S-330 patches have a fixed set of common parameters serialized
 * to ~200-500 bytes), so 512 is a conservative round-up that keeps the
 * per-step display honest while remaining deterministic.
 */
const APPROX_PATCH_BYTES = 512;

/**
 * Save device state to a set incrementally.
 *
 * IMPORTANT: This function fetches ALL data fresh from the device.
 * It does NOT use any cached UI state to ensure accuracy even when
 * the device state has changed (e.g., after loading a diskette).
 *
 * Progress reporting emits real {@link OperationProgress} values across
 * 3 logical steps:
 *   1. Scanning — iterate device slots to discover valid tones/patches.
 *      `bytesTotal === 0` during this step so the progress bar suppresses
 *      byte/ETA display (totals are not yet known).
 *   2. Saving tones — real wave-data bytes streamed from each
 *      `fetchWaveData` callback (2 MIDI bytes per 12-bit sample).
 *   3. Saving patches — patch YAML byte estimates ({@link APPROX_PATCH_BYTES}
 *      per patch).
 *
 * `bytesTotalAllSteps` is computed once after the scan completes (sum of
 * tone wave bytes + estimated patch bytes), so phase 2 and phase 3 can
 * report a meaningful overall percent.
 */
export async function saveDeviceToSetIncremental(
  directoryHandle: StorageDirectoryHandle,
  setName: string,
  description: string | undefined,
  fetchToneData: FetchToneDataCallback,
  fetchPatchData: FetchPatchDataCallback,
  fetchWaveData: FetchWaveDataCallback,
  onProgress?: (progress: OperationProgress) => void
): Promise<void> {
  const sanitizedSetName = setName.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, '_');

  // Local helper: build an OperationProgress with totalSteps=3 baked in.
  // Each callsite passes only the fields that change, keeping the emit
  // sites compact while preserving the shared structure.
  function emit(opts: {
    step: 1 | 2 | 3;
    label: string;
    bytesSent: number;
    bytesTotal: number;
    bytesSentAllSteps: number;
    bytesTotalAllSteps: number;
  }): void {
    onProgress?.({
      currentStep: opts.step,
      totalSteps: 3,
      stepLabel: opts.label,
      bytesSent: opts.bytesSent,
      bytesTotal: opts.bytesTotal,
      bytesSentAllSteps: opts.bytesSentAllSteps,
      bytesTotalAllSteps: opts.bytesTotalAllSteps,
    });
  }

  emit({
    step: 1,
    label: 'Creating set directory...',
    bytesSent: 0,
    bytesTotal: 0,
    bytesSentAllSteps: 0,
    bytesTotalAllSteps: 0,
  });

  const setsDir = await getNestedDirectory(directoryHandle, ['library', 's330', 'sets']);
  const setDir = await setsDir.getDirectoryHandle(sanitizedSetName, { create: true });
  const tonesDir = await setDir.getDirectoryHandle('tones', { create: true });
  const patchesDir = await setDir.getDirectoryHandle('patches', { create: true });

  const toneEntries: { slot: number; file: string; waveAllocation: { bank: 0 | 1; segmentTop: number; segmentLength: number } }[] = [];
  const patchEntries: { slot: number; file: string }[] = [];

  // Phase 1: Scan device for valid tones and patches.
  // bytesTotal/bytesTotalAllSteps are 0 here because totals are not yet
  // known. OperationProgressBar suppresses byte/ETA display when
  // bytesTotal === 0, so the user sees the step label and step counter
  // without fabricated byte counts.
  const validTones: { index: number; tone: S330Tone }[] = [];
  const validPatches: { index: number; patch: S330Patch }[] = [];

  for (let i = 0; i < MAX_TONES; i++) {
    try {
      const tone = await fetchToneData(i);
      if (tone && tone.wave.segmentLength > 0) {
        validTones.push({ index: i, tone });
      }
    } catch (err) {
      console.warn(`[saveDeviceToSetIncremental] Failed to fetch tone ${i}:`, err);
    }
    emit({
      step: 1,
      label: `Scanning tones (${i + 1} of ${MAX_TONES})...`,
      bytesSent: 0,
      bytesTotal: 0,
      bytesSentAllSteps: 0,
      bytesTotalAllSteps: 0,
    });
  }

  for (let i = 0; i < MAX_PATCHES; i++) {
    try {
      const patch = await fetchPatchData(i);
      if (patch) {
        validPatches.push({ index: i, patch });
      }
    } catch (err) {
      console.warn(`[saveDeviceToSetIncremental] Failed to fetch patch ${i}:`, err);
    }
    emit({
      step: 1,
      label: `Scanning patches (${i + 1} of ${MAX_PATCHES})...`,
      bytesSent: 0,
      bytesTotal: 0,
      bytesSentAllSteps: 0,
      bytesTotalAllSteps: 0,
    });
  }

  // Compute totals now that the scan is complete. 2 MIDI bytes per
  // 12-bit sample (see wave-export.ts for the encoding). validTones
  // already filters to tones with segmentLength > 0.
  const totalToneBytes = validTones.reduce(
    (sum, { tone }) => sum + tone.wave.segmentLength * 2,
    0,
  );
  const totalPatchBytes = validPatches.length * APPROX_PATCH_BYTES;
  const totalAllStepsBytes = totalToneBytes + totalPatchBytes;

  emit({
    step: 1,
    label: `Found ${validTones.length} tones and ${validPatches.length} patches`,
    bytesSent: 0,
    bytesTotal: 0,
    bytesSentAllSteps: 0,
    bytesTotalAllSteps: totalAllStepsBytes,
  });

  // Phase 2: Process each tone — real bytes from fetchWaveData.
  // `bytesSentBeforeThisTone` snapshots cumulative tone-bytes-completed
  // at the START of each tone. The fetchWaveData callback's `received`
  // is per-tone (resets to 0 for each new tone), so we expose
  // bytesSentAllSteps = bytesSentBeforeThisTone (constant within a tone)
  // and bytesSent = received (per-tone progress). After the tone
  // completes, bytesSentBeforeThisTone advances by the tone's full
  // bytes-total so the next tone starts at the correct cumulative point.
  let bytesSentBeforeThisTone = 0;

  for (const { index, tone } of validTones) {
    const toneFile = getToneFilename(index, tone.name);
    const toneLabel = tone.name || toneFile;
    const toneBytesTotal = tone.wave.segmentLength * 2;

    emit({
      step: 2,
      label: `Fetching wave data for ${toneLabel}...`,
      bytesSent: 0,
      bytesTotal: toneBytesTotal,
      bytesSentAllSteps: bytesSentBeforeThisTone,
      bytesTotalAllSteps: totalAllStepsBytes,
    });

    try {
      const waveResponse = await fetchWaveData(index, (received, total) => {
        // The callback `total` is the per-tone byte count; it matches
        // toneBytesTotal in steady state, but we prefer the callback's
        // own `total` to stay robust against device-reported counts.
        emit({
          step: 2,
          label: `Fetching wave data for ${toneLabel}...`,
          bytesSent: received,
          bytesTotal: total,
          bytesSentAllSteps: bytesSentBeforeThisTone,
          bytesTotalAllSteps: totalAllStepsBytes,
        });
      });

      emit({
        step: 2,
        label: `Writing ${toneLabel} to disk...`,
        bytesSent: toneBytesTotal,
        bytesTotal: toneBytesTotal,
        bytesSentAllSteps: bytesSentBeforeThisTone,
        bytesTotalAllSteps: totalAllStepsBytes,
      });

      const result = await writeToneFilesToDirectory(tonesDir, tone, waveResponse, toneFile);

      toneEntries.push({
        slot: index,
        file: toneFile,
        waveAllocation: {
          // `tone.wave.bank` is `number` at the device-client boundary
          // (S-330: 0/1, S-550: 0..3). The set-manifest schema for the
          // S-330 device pins it to 0 | 1; this narrowing is enforced by
          // the device-client when writing back. Pre-existing assertion.
          bank: tone.wave.bank as 0 | 1,
          segmentTop: tone.wave.segmentTop,
          segmentLength: result.segmentLength,
        },
      });
    } catch (err) {
      console.warn(`[saveDeviceToSetIncremental] Failed to save tone ${index}:`, err);
    }

    // Advance the cumulative snapshot by the tone's full byte count,
    // even on failure, so the overall progress remains monotonic and
    // the bar doesn't stall at the failed tone's pre-fetch position.
    bytesSentBeforeThisTone += toneBytesTotal;
  }

  // Phase 3: Process each patch — APPROX_PATCH_BYTES per patch.
  // bytesSentAllSteps starts at totalToneBytes (all of step 2's bytes
  // are now complete). Within step 3, bytesSent ticks up by
  // APPROX_PATCH_BYTES per patch processed; bytesTotal is the full
  // step-3 byte count.
  let patchBytesWritten = 0;

  for (const { index, patch } of validPatches) {
    const patchFile = getPatchFilename(index, patch.common.name);
    const patchLabel = patch.common.name || patchFile;

    emit({
      step: 3,
      label: `Writing patch ${patchLabel}...`,
      bytesSent: patchBytesWritten,
      bytesTotal: totalPatchBytes,
      bytesSentAllSteps: totalToneBytes + patchBytesWritten,
      bytesTotalAllSteps: totalAllStepsBytes,
    });

    try {
      await writePatchFileToDirectory(patchesDir, patch, patchFile);

      patchEntries.push({
        slot: index,
        file: patchFile,
      });
    } catch (err) {
      console.warn(`[saveDeviceToSetIncremental] Failed to save patch ${index}:`, err);
    }

    patchBytesWritten += APPROX_PATCH_BYTES;

    emit({
      step: 3,
      label: `Writing patch ${patchLabel}...`,
      bytesSent: patchBytesWritten,
      bytesTotal: totalPatchBytes,
      bytesSentAllSteps: totalToneBytes + patchBytesWritten,
      bytesTotalAllSteps: totalAllStepsBytes,
    });
  }

  // Write manifest last — small in-place write; the cumulative byte
  // counters are already at totalAllStepsBytes so the bar is at 100%.
  emit({
    step: 3,
    label: 'Writing set manifest...',
    bytesSent: totalPatchBytes,
    bytesTotal: totalPatchBytes,
    bytesSentAllSteps: totalAllStepsBytes,
    bytesTotalAllSteps: totalAllStepsBytes,
  });

  const now = new Date().toISOString();
  const manifest: SetYaml = {
    format: 'sampler-set',
    device: 's330',
    version: 1,
    name: setName,
    description,
    createdAt: now,
    modifiedAt: now,
    tones: toneEntries.sort((a, b) => a.slot - b.slot),
    patches: patchEntries.sort((a, b) => a.slot - b.slot),
  };

  const manifestContent = stringifyYaml(manifest, { indent: 2, lineWidth: 120 });
  const manifestHandle = await setDir.getFileHandle('set.yaml', { create: true });
  const manifestWritable = await manifestHandle.createWritable();
  await manifestWritable.write(manifestContent);
  await manifestWritable.close();

  emit({
    step: 3,
    label: `Saved ${toneEntries.length} tones and ${patchEntries.length} patches`,
    bytesSent: totalPatchBytes,
    bytesTotal: totalPatchBytes,
    bytesSentAllSteps: totalAllStepsBytes,
    bytesTotalAllSteps: totalAllStepsBytes,
  });
}
