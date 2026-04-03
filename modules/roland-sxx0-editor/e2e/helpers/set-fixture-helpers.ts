/**
 * Helpers for writing set fixtures to OPFS during e2e tests.
 *
 * Provides fixture data (YAML, WAV) and a function to populate
 * a complete set directory structure in OPFS.
 */

import type { Page } from '@playwright/test';
import { createMinimalWavBase64 } from './roundtrip-helpers';

// ---------------------------------------------------------------------------
// Fixture Data
// ---------------------------------------------------------------------------

export const SET_NAME = 'E2E_Individual';

export const TONE_WAV_BASE64 = createMinimalWavBase64(30000, 1);

export const SET_MANIFEST_YAML = `format: sampler-set
device: s330
version: 1
name: ${SET_NAME}
description: E2E fixture for individual tone/patch load
createdAt: "2024-01-01T00:00:00.000Z"
tones:
  - slot: 0
    file: T01
    waveAllocation:
      bank: 0
      segmentTop: 0
      segmentLength: 1
patches:
  - slot: 0
    file: P01`;

export const TONE_YAML = `format: sampler-tone
device: s330
version: 1
name: "SetTone01"
wave:
  file: T01.wav
  sampleRate: 30000
  loopMode: forward
  startPoint: 0
  endPoint: 30000
  loopPoint: 0
s330:
  originalKey: 60
  outputAssign: 0
  transpose: 0
  fineTune: 0
  lfo:
    rate: 0
    sync: false
    delay: 0
    mode: normal
    polarity: false
    offset: 64
  tvf:
    cutoff: 127
    resonance: 0
    keyFollow: 64
    lfoDepth: 0
    egDepth: 0
    egPolarity: normal
    levelCurve: 0
    keyRateFollow: 64
    velRateFollow: 64
    enabled: false
    envelope:
      levels: [127, 127, 127, 127, 127, 127, 127, 0]
      rates: [127, 127, 127, 127, 127, 127, 127, 127]
      sustainPoint: 3
      endPoint: 8
  tva:
    level: 100
    lfoDepth: 0
    keyRate: 64
    velRate: 64
    levelCurve: 0
    envelope:
      levels: [127, 127, 127, 127, 127, 127, 127, 0]
      rates: [127, 127, 127, 127, 127, 127, 127, 127]
      sustainPoint: 3
      endPoint: 8
  benderEnabled: true
  aftertouchEnabled: true
  pitchFollow: true`;

// Patch that references T01 via keyGroups. The patch import dialog
// will also import the required dependent tones.
export const PATCH_YAML = `format: sampler-patch
device: s330
version: 1
name: "SetPatch01"
level: 100
keyGroups:
  - name: SetTone01
    tone: T01
    keyRange: [0, 127]
    velocityRange: [1, 127]
    level: 100
    pan: center
s330:
  benderRange: 2
  aftertouchSens: 64
  keyMode: normal
  velocityThreshold: 64
  octaveShift: 0
  detune: 0
  velocityMixRatio: 64
  aftertouchAssign: modulation
  keyAssign: rotary
  outputAssign: 0`;

// ---------------------------------------------------------------------------
// OPFS Set Fixture Writer
// ---------------------------------------------------------------------------

/**
 * Write a complete set fixture to OPFS.
 *
 * Creates the directory structure:
 *   library/{device}/sets/{setName}/set.yaml
 *   library/{device}/sets/{setName}/tones/T01.yaml
 *   library/{device}/sets/{setName}/tones/T01.wav
 *   library/{device}/sets/{setName}/patches/P01.yaml
 */
export async function writeSetFixtureToOPFS(
  page: Page,
  device: string,
  setName: string,
  manifestYaml: string,
  toneYaml: string,
  wavBase64: string,
  patchYaml: string
): Promise<void> {
  await page.evaluate(
    async (args: {
      device: string;
      setName: string;
      manifestYaml: string;
      toneYaml: string;
      wavBase64: string;
      patchYaml: string;
    }) => {
      const root = await navigator.storage.getDirectory();
      const lib = await root.getDirectoryHandle('library', { create: true });
      const deviceDir = await lib.getDirectoryHandle(args.device, {
        create: true,
      });
      const setsDir = await deviceDir.getDirectoryHandle('sets', {
        create: true,
      });
      const setDir = await setsDir.getDirectoryHandle(args.setName, {
        create: true,
      });

      // Write set.yaml manifest
      const manifestHandle = await setDir.getFileHandle('set.yaml', {
        create: true,
      });
      const manifestWriter = await manifestHandle.createWritable();
      await manifestWriter.write(args.manifestYaml);
      await manifestWriter.close();

      // Write tones/T01.yaml
      const tonesDir = await setDir.getDirectoryHandle('tones', {
        create: true,
      });
      const toneYamlHandle = await tonesDir.getFileHandle('T01.yaml', {
        create: true,
      });
      const toneYamlWriter = await toneYamlHandle.createWritable();
      await toneYamlWriter.write(args.toneYaml);
      await toneYamlWriter.close();

      // Write tones/T01.wav from base64
      const binaryString = atob(args.wavBase64);
      const wavBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        wavBytes[i] = binaryString.charCodeAt(i);
      }
      const wavHandle = await tonesDir.getFileHandle('T01.wav', {
        create: true,
      });
      const wavWriter = await wavHandle.createWritable();
      await wavWriter.write(wavBytes);
      await wavWriter.close();

      // Write patches/P01.yaml
      const patchesDir = await setDir.getDirectoryHandle('patches', {
        create: true,
      });
      const patchYamlHandle = await patchesDir.getFileHandle('P01.yaml', {
        create: true,
      });
      const patchYamlWriter = await patchYamlHandle.createWritable();
      await patchYamlWriter.write(args.patchYaml);
      await patchYamlWriter.close();
    },
    {
      device,
      setName,
      manifestYaml,
      toneYaml,
      wavBase64,
      patchYaml,
    }
  );
}
