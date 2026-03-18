import type { ToneConverter, PatchConverter } from '@/converters/converter-registry.js';
import type {
  SetYaml,
  SetToneEntry,
  SetPatchEntry,
  WaveSegmentAllocation,
  ToneYaml,
  PatchYaml,
} from '@/schemas/index.js';
import { getToneFilename, getPatchFilename } from '@/storage/set-paths.js';

interface ToneWithWave {
  wave: { bank: number; segmentTop: number; segmentLength: number };
}

export interface SeriesDeviceStateInput<TTone, TPatch> {
  tones: (TTone | null)[];
  patches: (TPatch | null)[];
  waveData: Map<number, { data: Uint8Array; sampleRate: number }>;
}

export interface SeriesDeviceStateToSetResult {
  manifest: SetYaml;
  tones: Map<number, { yaml: ToneYaml; wavData: Uint8Array; sampleRate: number }>;
  patches: Map<number, PatchYaml>;
}

export interface SeriesSetToDeviceInput {
  manifest: SetYaml;
  tones: Map<number, { yaml: ToneYaml; wavData: Uint8Array }>;
  patches: Map<number, PatchYaml>;
}

export interface SeriesSetToDeviceResult<TTone, TPatch> {
  tones: Map<number, { tone: TTone; wavData: Uint8Array }>;
  patches: Map<number, TPatch>;
  allocations: Map<number, WaveSegmentAllocation>;
}

export interface SSeriesSetConverterConfig<TTone, TPatch> {
  deviceType: 's330' | 's550';
  toneConverter: ToneConverter<TTone, ToneYaml>;
  patchConverter: PatchConverter<TPatch, PatchYaml>;
  bankCount: number;
}

export interface SSeriesSetConverter<TTone, TPatch> {
  deviceStateToSet(
    setName: string,
    description: string | undefined,
    input: SeriesDeviceStateInput<TTone, TPatch>,
  ): SeriesDeviceStateToSetResult;

  setToDeviceState(
    input: SeriesSetToDeviceInput,
  ): SeriesSetToDeviceResult<TTone, TPatch>;

  validateSetAllocations(manifest: SetYaml): string[];

  calculateSetSegmentUsage(manifest: SetYaml): Record<string, number>;
}

export function createSeriesSetConverter<TTone extends ToneWithWave, TPatch>(
  config: SSeriesSetConverterConfig<TTone, TPatch>,
): SSeriesSetConverter<TTone, TPatch> {
  const { deviceType, toneConverter, patchConverter, bankCount } = config;

  function deviceStateToSet(
    setName: string,
    description: string | undefined,
    input: SeriesDeviceStateInput<TTone, TPatch>,
  ): SeriesDeviceStateToSetResult {
    const now = new Date().toISOString();
    const toneEntries: SetToneEntry[] = [];
    const patchEntries: SetPatchEntry[] = [];
    const convertedTones = new Map<number, { yaml: ToneYaml; wavData: Uint8Array; sampleRate: number }>();
    const convertedPatches = new Map<number, PatchYaml>();

    for (let slot = 0; slot < input.tones.length; slot++) {
      const tone = input.tones[slot];
      if (tone === null) continue;

      const waveInfo = input.waveData.get(slot);
      if (!waveInfo) continue;

      const toneFile = getToneFilename(slot);
      const wavFilename = `${toneFile}.wav`;

      const yaml = toneConverter.toYaml(tone, wavFilename);
      const sampleRateHz = waveInfo.sampleRate;

      const allocation: WaveSegmentAllocation = {
        bank: tone.wave.bank as WaveSegmentAllocation['bank'],
        segmentTop: tone.wave.segmentTop,
        segmentLength: tone.wave.segmentLength,
      };

      toneEntries.push({
        slot,
        file: toneFile,
        waveAllocation: allocation,
      });

      convertedTones.set(slot, {
        yaml,
        wavData: waveInfo.data,
        sampleRate: sampleRateHz,
      });
    }

    for (let slot = 0; slot < input.patches.length; slot++) {
      const patch = input.patches[slot];
      if (patch === null) continue;

      const patchFile = getPatchFilename(slot);
      const yaml = patchConverter.toYaml(patch);

      patchEntries.push({
        slot,
        file: patchFile,
      });

      convertedPatches.set(slot, yaml);
    }

    const manifest: SetYaml = {
      format: 'sampler-set',
      device: deviceType,
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

  function setToDeviceState(
    input: SeriesSetToDeviceInput,
  ): SeriesSetToDeviceResult<TTone, TPatch> {
    const resultTones = new Map<number, { tone: TTone; wavData: Uint8Array }>();
    const resultPatches = new Map<number, TPatch>();
    const allocations = new Map<number, WaveSegmentAllocation>();

    for (const entry of input.manifest.tones) {
      allocations.set(entry.slot, entry.waveAllocation);
    }

    for (const [slot, data] of input.tones) {
      const tone = toneConverter.fromYaml(data.yaml);
      const allocation = allocations.get(slot);

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

    for (const [slot, yaml] of input.patches) {
      const patch = patchConverter.fromYaml(yaml);
      resultPatches.set(slot, patch);
    }

    return {
      tones: resultTones,
      patches: resultPatches,
      allocations,
    };
  }

  function validateSetAllocations(manifest: SetYaml): string[] {
    const errors: string[] = [];
    const bankUsage: Set<number>[] = [];
    for (let i = 0; i < bankCount; i++) {
      bankUsage.push(new Set<number>());
    }

    for (const entry of manifest.tones) {
      const { bank, segmentTop, segmentLength } = entry.waveAllocation;

      if (bank >= bankCount) {
        errors.push(`Tone ${entry.file} has invalid bank ${bank} (must be 0-${bankCount - 1})`);
        continue;
      }

      for (let seg = segmentTop; seg < segmentTop + segmentLength; seg++) {
        if (seg > 17) {
          errors.push(
            `Tone ${entry.file} allocation exceeds bank capacity (segment ${seg} > 17)`,
          );
          continue;
        }

        if (bankUsage[bank]?.has(seg)) {
          errors.push(
            `Tone ${entry.file} allocation overlaps with another tone at bank ${bank} segment ${seg}`,
          );
        } else {
          bankUsage[bank]?.add(seg);
        }
      }
    }

    return errors;
  }

  function calculateSetSegmentUsage(manifest: SetYaml): Record<string, number> {
    const usage: Record<string, number> = {};
    for (let i = 0; i < bankCount; i++) {
      usage[`bank${i}`] = 0;
    }

    for (const entry of manifest.tones) {
      const bank = entry.waveAllocation.bank;
      const key = `bank${bank}`;
      const maxSegment = entry.waveAllocation.segmentTop + entry.waveAllocation.segmentLength;
      if (key in usage) {
        usage[key] = Math.max(usage[key], maxSegment);
      }
    }

    return usage;
  }

  return {
    deviceStateToSet,
    setToDeviceState,
    validateSetAllocations,
    calculateSetSegmentUsage,
  };
}
