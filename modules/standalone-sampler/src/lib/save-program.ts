import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { saveProgram, createWav } from '@audiocontrol/sampler-library/browser';
import type { ProgramPlayback } from '@audiocontrol/synth-core';
import type { ProgramYaml, Zone } from '@audiocontrol/sampler-library/browser';

function toInt16(samples: Int16Array | Float32Array): Int16Array {
  if (samples instanceof Int16Array) return samples;
  const result = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    result[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i]! * 32768)));
  }
  return result;
}

/**
 * Save a ProgramPlayback to the common-area library.
 *
 * Converts the engine-format program back to ProgramYaml + WAV files
 * and saves to library/common/programs/{name}/.
 */
export async function saveProgramToLibrary(
  root: StorageDirectoryHandle,
  program: ProgramPlayback,
): Promise<void> {
  const wavFiles = program.zones.map((zone, index) => {
    const filename = `zone-${index}.wav`;
    const int16Samples = toInt16(zone.samples);
    const data = createWav(int16Samples, zone.sampleRate);
    return { filename, data };
  });

  const zones: Zone[] = program.zones.map((zone, index) => ({
    sample: `zone-${index}.wav`,
    keyRange: zone.keyRange,
    velocityRange: zone.velocityRange,
    rootKey: zone.pitch.rootKey,
    transpose: zone.pitch.transpose,
    fineTune: zone.pitch.fineTune,
    muteGroup: zone.muteGroup,
    label: zone.label,
  }));

  const yaml: ProgramYaml = {
    format: 'program',
    version: 1,
    name: program.name,
    zones,
    polyphony: program.polyphony,
    playbackMode: program.playbackMode,
    modifiedAt: new Date().toISOString(),
  };

  await saveProgram(root, {
    name: program.name,
    yaml,
    wavFiles,
  });
}
