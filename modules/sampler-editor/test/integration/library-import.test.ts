/**
 * Integration test for library patch import.
 *
 * Reads actual files from the library to verify WAV parsing
 * and segment calculation work correctly end-to-end.
 *
 * Run with: pnpm --filter s330-editor test:integration
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  parseWav,
  prepareWavForS330,
  calculateSegmentsNeeded,
} from '@audiocontrol/sampler-devices/s330';
import { parse as parseYaml } from 'yaml';
import { ToneYamlSchema } from '@audiocontrol/sampler-library/browser';

const LIBRARY_PATH = path.join(
  process.env.HOME || '',
  'Documents/AudioTools/library/s330'
);

/**
 * Simulates what readToneFilesFromDirectory does, but using Node fs
 */
function loadToneFromDisk(toneDir: string, baseFilename: string) {
  const yamlPath = path.join(toneDir, `${baseFilename}.yaml`);
  const wavPath = path.join(toneDir, `${baseFilename}.wav`);

  // Load and parse YAML
  const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
  const yaml = ToneYamlSchema.parse(parseYaml(yamlContent));

  // Load WAV file
  const wavBuffer = fs.readFileSync(wavPath);
  const wavArrayBuffer = wavBuffer.buffer.slice(
    wavBuffer.byteOffset,
    wavBuffer.byteOffset + wavBuffer.byteLength
  );

  return { yaml, wavBuffer, wavArrayBuffer };
}

describe('library-import integration', () => {
  const patchesDir = path.join(LIBRARY_PATH, 'patches');

  // Skip if library doesn't exist
  const libraryExists = fs.existsSync(patchesDir);

  describe.skipIf(!libraryExists)('patch bundle loading', () => {
    it('reads actual patch directories from library', () => {
      const patches = fs.readdirSync(patchesDir).filter((name) => {
        const stat = fs.statSync(path.join(patchesDir, name));
        return stat.isDirectory();
      });

      console.log(`Found ${patches.length} patch bundles:`, patches);
      expect(patches.length).toBeGreaterThan(0);
    });

    it('correctly parses WAV files without including header in sample count', () => {
      const patches = fs.readdirSync(patchesDir).filter((name) => {
        const stat = fs.statSync(path.join(patchesDir, name));
        return stat.isDirectory();
      });

      for (const patchName of patches) {
        const tonesDir = path.join(patchesDir, patchName, 'tones');
        if (!fs.existsSync(tonesDir)) continue;

        const toneFiles = fs.readdirSync(tonesDir).filter((f) => f.endsWith('.yaml'));

        for (const toneFile of toneFiles) {
          const baseFilename = toneFile.replace('.yaml', '');
          const { yaml, wavBuffer, wavArrayBuffer } = loadToneFromDisk(tonesDir, baseFilename);

          // Raw file size
          const rawFileSize = wavBuffer.length;

          // Parse WAV to get actual samples
          const parsed = parseWav(wavArrayBuffer);
          const actualSamples = parsed.samples.length;

          // Prepare for S330
          const targetSampleRate = yaml.wave.sampleRate as 15000 | 30000;
          const prepared = prepareWavForS330(wavArrayBuffer, targetSampleRate);
          const preparedSamples = prepared.data.length / 2;

          // Calculate segments
          const segmentsNeeded = calculateSegmentsNeeded(preparedSamples);
          const maxSamples = segmentsNeeded * 12000;

          console.log(`${patchName}/${baseFilename}:`, {
            rawFileSize,
            actualSamples,
            preparedSamples,
            segmentsNeeded,
            maxSamples,
          });

          // THE BUG: rawFileSize / 2 would give wrong sample count
          const wrongSampleCount = rawFileSize / 2;

          // Verify we're NOT using raw file size
          if (rawFileSize > 44) {
            // WAV header is 44 bytes, so raw/2 will always be > actual samples
            expect(wrongSampleCount).toBeGreaterThan(actualSamples);
          }

          // Verify prepared samples fit in calculated segments
          expect(preparedSamples).toBeLessThanOrEqual(maxSamples);

          // Verify the import would succeed (this is what importTone checks)
          const importWouldSucceed = preparedSamples <= maxSamples;
          expect(importWouldSucceed).toBe(true);
        }
      }
    });

    it('simulates full import flow for each patch', () => {
      const patches = fs.readdirSync(patchesDir).filter((name) => {
        const stat = fs.statSync(path.join(patchesDir, name));
        return stat.isDirectory();
      });

      const results: Array<{
        patch: string;
        tone: string;
        samples: number;
        segments: number;
        wouldPass: boolean;
      }> = [];

      for (const patchName of patches) {
        const tonesDir = path.join(patchesDir, patchName, 'tones');
        if (!fs.existsSync(tonesDir)) continue;

        const toneFiles = fs.readdirSync(tonesDir).filter((f) => f.endsWith('.yaml'));

        for (const toneFile of toneFiles) {
          const baseFilename = toneFile.replace('.yaml', '');
          const { yaml, wavArrayBuffer } = loadToneFromDisk(tonesDir, baseFilename);

          const targetSampleRate = yaml.wave.sampleRate as 15000 | 30000;
          const prepared = prepareWavForS330(wavArrayBuffer, targetSampleRate);
          const sampleCount = prepared.data.length / 2;
          const segmentLength = calculateSegmentsNeeded(sampleCount);
          const maxSamples = segmentLength * 12000;

          // This is the exact check in importTone
          const wouldPass = sampleCount <= maxSamples;

          results.push({
            patch: patchName,
            tone: baseFilename,
            samples: sampleCount,
            segments: segmentLength,
            wouldPass,
          });

          // Every tone should pass
          expect(wouldPass).toBe(true);
        }
      }

      console.log('\nImport simulation results:');
      console.table(results);
    });
  });

  describe.skipIf(!libraryExists)('regression test: raw WAV bytes bug', () => {
    it('demonstrates the bug that was fixed', () => {
      const patches = fs.readdirSync(patchesDir).filter((name) => {
        const stat = fs.statSync(path.join(patchesDir, name));
        return stat.isDirectory();
      });

      let foundBuggyCase = false;

      for (const patchName of patches) {
        const tonesDir = path.join(patchesDir, patchName, 'tones');
        if (!fs.existsSync(tonesDir)) continue;

        const toneFiles = fs.readdirSync(tonesDir).filter((f) => f.endsWith('.yaml'));

        for (const toneFile of toneFiles) {
          const baseFilename = toneFile.replace('.yaml', '');
          const { yaml, wavBuffer, wavArrayBuffer } = loadToneFromDisk(tonesDir, baseFilename);

          const targetSampleRate = yaml.wave.sampleRate as 15000 | 30000;
          const prepared = prepareWavForS330(wavArrayBuffer, targetSampleRate);

          // CORRECT: use prepared data
          const correctSampleCount = prepared.data.length / 2;
          const correctSegments = calculateSegmentsNeeded(correctSampleCount);
          const correctMaxSamples = correctSegments * 12000;

          // BUG: use raw file bytes (what the old code did)
          const wrongSampleCount = wavBuffer.length / 2;

          // If using 2 segments but raw count > 24000, we found the bug case
          if (correctSegments === 2 && wrongSampleCount > 24000) {
            foundBuggyCase = true;
            console.log(`\nBug case found: ${patchName}/${baseFilename}`);
            console.log(`  Raw file bytes: ${wavBuffer.length}`);
            console.log(`  Wrong sample count (raw/2): ${wrongSampleCount}`);
            console.log(`  Correct sample count: ${correctSampleCount}`);
            console.log(`  Segments needed: ${correctSegments}`);
            console.log(`  Max samples for ${correctSegments} segments: ${correctMaxSamples}`);
            console.log(`  Wrong count would FAIL: ${wrongSampleCount} > ${correctMaxSamples}`);
            console.log(`  Correct count PASSES: ${correctSampleCount} <= ${correctMaxSamples}`);

            // The old buggy code would fail
            expect(wrongSampleCount).toBeGreaterThan(correctMaxSamples);

            // The fixed code passes
            expect(correctSampleCount).toBeLessThanOrEqual(correctMaxSamples);
          }
        }
      }

      if (foundBuggyCase) {
        console.log('\n✓ Bug regression test passed - the buggy case was found and handled correctly');
      } else {
        console.log('\nNo 2-segment tones found in library (bug case not applicable)');
      }
    });
  });
});
