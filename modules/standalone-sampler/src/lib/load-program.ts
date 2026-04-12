import type { Zone, StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import { loadProgramFromProgramsDir, getProgramDirFromProgramsDir, parseWav } from '@audiocontrol/sampler-library/browser';
import type { ProgramPlayback, ZonePlayback } from '@audiocontrol/synth-core';
import { DEFAULT_AMP_ENVELOPE, DEFAULT_PITCH_PARAMS } from '@audiocontrol/synth-core';

/**
 * Load a program from the common-area library and convert it
 * to a ProgramPlayback ready for the synth-core engine.
 *
 * Steps:
 * 1. Load program.yaml from library/common/programs/{name}/
 * 2. For each zone, load the referenced WAV file from the program bundle
 * 3. Parse WAV to get Int16Array samples + sampleRate
 * 4. Build ZonePlayback with pitch/envelope/filter params
 */
export async function loadProgramFromLibrary(
  root: StorageDirectoryHandle,
  programName: string,
): Promise<ProgramPlayback> {
  const programYaml = await loadProgramFromProgramsDir(root, programName);
  const programDir = await getProgramDirFromProgramsDir(root, programName);

  const zones = await Promise.all(
    programYaml.zones.map((zone) => loadZone(programDir, zone)),
  );

  return {
    name: programYaml.name,
    zones,
    polyphony: programYaml.polyphony ?? 'poly',
    playbackMode: programYaml.playbackMode ?? 'gate',
    maxVoices: 16,
  };
}

async function loadZone(
  programDir: StorageDirectoryHandle,
  zone: Zone,
): Promise<ZonePlayback> {
  const wavHandle = await programDir.getFileHandle(zone.sample);
  const wavFile = await wavHandle.getFile();
  const wavBuffer = await wavFile.arrayBuffer();
  const wavData = parseWav(wavBuffer);

  const rootKey = resolveRootKey(zone);

  return {
    samples: wavData.samples,
    sampleRate: wavData.sampleRate,
    keyRange: zone.keyRange ?? [0, 127],
    velocityRange: zone.velocityRange ?? [1, 127],
    pitch: {
      rootKey,
      transpose: zone.transpose ?? DEFAULT_PITCH_PARAMS.transpose,
      fineTune: zone.fineTune ?? DEFAULT_PITCH_PARAMS.fineTune,
    },
    ampEnvelope: { ...DEFAULT_AMP_ENVELOPE },
    muteGroup: zone.muteGroup ?? 0,
    label: zone.label,
  };
}

/**
 * Resolve root key: zone.rootKey takes precedence,
 * otherwise default to middle C (60).
 */
function resolveRootKey(zone: Zone): number {
  if (zone.rootKey !== undefined) {
    // rootKey can be a number or a note name string — the schema resolves it to a number
    return typeof zone.rootKey === 'number' ? zone.rootKey : 60;
  }
  return DEFAULT_PITCH_PARAMS.rootKey;
}
