/**
 * S-550 set converter for bidirectional device state <-> set conversion.
 *
 * Provides functions to convert between:
 * - Device state (S550Tone[], S550Patch[], wave data)
 * - Set format (SetYaml manifest, ToneYaml files, PatchYaml files)
 *
 * @packageDocumentation
 */

import type {
    S550Tone,
    S550Patch,
    SSeriesSampleRate,
} from '@audiocontrol/sampler-devices/s550';
import type {
    SetYaml,
    SetToneEntry,
    SetPatchEntry,
    WaveSegmentAllocation,
    ToneYaml,
    PatchYaml,
} from '@/schemas/index.js';
import { s550ToneConverter } from './tone-converter.js';
import { s550PatchConverter } from './patch-converter.js';
import { getToneFilename, getPatchFilename } from '@/storage/set-paths.js';

/**
 * Input data for converting device state to a set.
 */
export interface DeviceStateInput {
    /** Array of tones (null for empty slots) */
    tones: (S550Tone | null)[];
    /** Array of patches (null for empty slots) */
    patches: (S550Patch | null)[];
    /** Wave data by slot index, sampleRate is Hz (15000 or 30000) */
    waveData: Map<number, { data: Uint8Array; sampleRate: number }>;
}

/**
 * Output data from converting device state to a set.
 */
export interface DeviceStateToSetResult {
    /** Set manifest (to be written as set.yaml) */
    manifest: SetYaml;
    /** Tone YAML data by slot index */
    tones: Map<number, { yaml: ToneYaml; wavData: Uint8Array; sampleRate: number }>;
    /** Patch YAML data by slot index */
    patches: Map<number, PatchYaml>;
}

/**
 * Input data for converting a set to device state.
 */
export interface SetToDeviceInput {
    /** Set manifest */
    manifest: SetYaml;
    /** Tone YAML data by slot index */
    tones: Map<number, { yaml: ToneYaml; wavData: Uint8Array }>;
    /** Patch YAML data by slot index */
    patches: Map<number, PatchYaml>;
}

/**
 * Output data from converting a set to device state.
 */
export interface SetToDeviceResult {
    /** Tones ready for upload, keyed by target slot */
    tones: Map<number, { tone: S550Tone; wavData: Uint8Array }>;
    /** Patches ready for upload, keyed by target slot */
    patches: Map<number, S550Patch>;
    /** Wave segment allocations by slot (from manifest) */
    allocations: Map<number, WaveSegmentAllocation>;
}

/**
 * Convert device state to a set.
 *
 * Takes the current device state (all tones, patches, and wave data) and
 * converts it to the set format used for library storage.
 *
 * @param setName - Name for the new set
 * @param description - Optional description
 * @param input - Device state containing tones, patches, and wave data
 * @returns Set manifest and converted tone/patch data
 */
export function deviceStateToSet(
    setName: string,
    description: string | undefined,
    input: DeviceStateInput
): DeviceStateToSetResult {
    const now = new Date().toISOString();
    const toneEntries: SetToneEntry[] = [];
    const patchEntries: SetPatchEntry[] = [];
    const convertedTones = new Map<number, { yaml: ToneYaml; wavData: Uint8Array; sampleRate: number }>();
    const convertedPatches = new Map<number, PatchYaml>();

    // Convert tones
    for (let slot = 0; slot < input.tones.length; slot++) {
        const tone = input.tones[slot];
        if (tone === null) continue;

        const waveInfo = input.waveData.get(slot);
        if (!waveInfo) {
            // Skip tones without wave data - they can't be saved
            continue;
        }

        const toneFile = getToneFilename(slot);
        const wavFilename = `${toneFile}.wav`;

        // Convert tone to YAML format
        const yaml = s550ToneConverter.toYaml(tone, wavFilename);
        const sampleRateHz = waveInfo.sampleRate;

        // Extract wave allocation from tone
        // S-550 supports wave banks 0-3 (A, B, C, D)
        const allocation: WaveSegmentAllocation = {
            bank: tone.wave.bank as 0 | 1 | 2 | 3,
            segmentTop: tone.wave.segmentTop,
            segmentLength: tone.wave.segmentLength,
        };

        // Add to manifest entries
        toneEntries.push({
            slot,
            file: toneFile,
            waveAllocation: allocation,
        });

        // Store converted data
        convertedTones.set(slot, {
            yaml,
            wavData: waveInfo.data,
            sampleRate: sampleRateHz,
        });
    }

    // Convert patches
    for (let slot = 0; slot < input.patches.length; slot++) {
        const patch = input.patches[slot];
        if (patch === null) continue;

        const patchFile = getPatchFilename(slot);

        // Convert patch to YAML format
        const yaml = s550PatchConverter.toYaml(patch);

        // Add to manifest entries
        patchEntries.push({
            slot,
            file: patchFile,
        });

        // Store converted data
        convertedPatches.set(slot, yaml);
    }

    // Create manifest
    const manifest: SetYaml = {
        format: 'sampler-set',
        device: 's550',
        version: 1,
        name: setName,
        description,
        createdAt: now,
        modifiedAt: now,
        tones: toneEntries.sort((a, b) => a.slot - b.slot),
        patches: patchEntries.sort((a, b) => a.slot - b.slot),
    };

    return {
        manifest,
        tones: convertedTones,
        patches: convertedPatches,
    };
}

/**
 * Convert a set to device state.
 *
 * Takes set data (manifest, tone YAMLs, patch YAMLs) and converts it
 * to the format needed for uploading to the device.
 *
 * @param input - Set data with manifest, tones, and patches
 * @returns Device-ready tones and patches with wave data
 */
export function setToDeviceState(input: SetToDeviceInput): SetToDeviceResult {
    const resultTones = new Map<number, { tone: S550Tone; wavData: Uint8Array }>();
    const resultPatches = new Map<number, S550Patch>();
    const allocations = new Map<number, WaveSegmentAllocation>();

    // Build allocation map from manifest
    for (const entry of input.manifest.tones) {
        allocations.set(entry.slot, entry.waveAllocation);
    }

    // Convert tones
    for (const [slot, data] of input.tones) {
        const tone = s550ToneConverter.fromYaml(data.yaml);
        const allocation = allocations.get(slot);

        // Apply wave allocation from manifest
        if (allocation) {
            tone.wave.bank = allocation.bank;
            tone.wave.segmentTop = allocation.segmentTop;
            tone.wave.segmentLength = allocation.segmentLength;
        }

        resultTones.set(slot, {
            tone,
            wavData: data.wavData,
        });
    }

    // Convert patches
    for (const [slot, yaml] of input.patches) {
        const patch = s550PatchConverter.fromYaml(yaml);
        resultPatches.set(slot, patch);
    }

    return {
        tones: resultTones,
        patches: resultPatches,
        allocations,
    };
}

/**
 * Validate that a set's wave allocations don't overlap.
 *
 * S-550 has limited wave memory in four banks (A, B, C, D).
 * This function checks that the allocations in a set manifest don't conflict.
 *
 * @param manifest - Set manifest to validate
 * @returns Array of error messages (empty if valid)
 */
export function validateSetAllocations(manifest: SetYaml): string[] {
    const errors: string[] = [];

    // Track segments used per bank (S-550 has 4 banks)
    const bankUsage = [
        new Set<number>(),
        new Set<number>(),
        new Set<number>(),
        new Set<number>(),
    ];

    for (const entry of manifest.tones) {
        const { bank, segmentTop, segmentLength } = entry.waveAllocation;

        // Validate bank is in range for S-550
        if (bank > 3) {
            errors.push(`Tone ${entry.file} has invalid bank ${bank} (must be 0-3)`);
            continue;
        }

        // Check each segment in the allocation
        for (let seg = segmentTop; seg < segmentTop + segmentLength; seg++) {
            if (seg > 17) {
                errors.push(
                    `Tone ${entry.file} allocation exceeds bank capacity (segment ${seg} > 17)`
                );
                continue;
            }

            if (bankUsage[bank]?.has(seg)) {
                errors.push(
                    `Tone ${entry.file} allocation overlaps with another tone at bank ${bank} segment ${seg}`
                );
            } else {
                bankUsage[bank]?.add(seg);
            }
        }
    }

    return errors;
}

/**
 * Calculate wave segment requirements for a set.
 *
 * @param manifest - Set manifest
 * @returns Total segments needed per bank (S-550 has 4 banks)
 */
export function calculateSetSegmentUsage(manifest: SetYaml): {
    bank0: number;
    bank1: number;
    bank2: number;
    bank3: number;
} {
    let bank0 = 0;
    let bank1 = 0;
    let bank2 = 0;
    let bank3 = 0;

    for (const entry of manifest.tones) {
        const maxSegment = entry.waveAllocation.segmentTop + entry.waveAllocation.segmentLength;
        switch (entry.waveAllocation.bank) {
            case 0:
                bank0 = Math.max(bank0, maxSegment);
                break;
            case 1:
                bank1 = Math.max(bank1, maxSegment);
                break;
            case 2:
                bank2 = Math.max(bank2, maxSegment);
                break;
            case 3:
                bank3 = Math.max(bank3, maxSegment);
                break;
        }
    }

    return { bank0, bank1, bank2, bank3 };
}
