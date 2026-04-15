import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, statSync, readFileSync } from 'node:fs';
import { rm, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { runScenario } from '@/runner.js';
import { validateScenarioModule } from '@/cli-utils.js';
import type { ScenarioResult } from '@/types.js';

const MODULE_ROOT = resolve(__dirname, '../..');
const OUTPUT_BASE = join(MODULE_ROOT, 'test-output', 'e2e');

async function loadScenario(relativePath: string) {
  const absolutePath = resolve(MODULE_ROOT, relativePath);
  const mod: Record<string, unknown> = await import(absolutePath);
  return validateScenarioModule(mod, absolutePath);
}

describe('scenario pipeline', () => {
  describe('hello-world (silent tier)', () => {
    let result: ScenarioResult;
    const outputBase = join(OUTPUT_BASE, 'hello-world-run');

    beforeAll(async () => {
      await rm(outputBase, { recursive: true, force: true });
      await mkdir(outputBase, { recursive: true });

      const scenario = await loadScenario('scenarios/hello-world.ts');
      result = await runScenario(scenario, {
        url: 'about:blank',
        outputBase,
        tier: 'silent',
      });
    });

    afterAll(async () => {
      await rm(outputBase, { recursive: true, force: true });
    });

    it('produces an MP4 file', () => {
      expect(existsSync(result.mp4Path)).toBe(true);
      const stat = statSync(result.mp4Path);
      expect(stat.size).toBeGreaterThan(0);
    });

    it('produces a GIF file', () => {
      expect(existsSync(result.gifPath)).toBe(true);
      const stat = statSync(result.gifPath);
      expect(stat.size).toBeGreaterThan(0);
    });

    it('places output in the correct directory', () => {
      expect(result.outputDir).toContain('hello-world');
      expect(existsSync(result.outputDir)).toBe(true);
      const stat = statSync(result.outputDir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('returns correct scenario name', () => {
      expect(result.scenarioName).toBe('hello-world');
    });

    it('returns correct metadata', () => {
      expect(result.metadata.mode).toBe('harness');
    });
  });

  describe('s3k-zone-editor (scripted tier with overlay)', () => {
    let result: ScenarioResult;
    const outputBase = join(OUTPUT_BASE, 's3k-zone-editor-run');

    beforeAll(async () => {
      await rm(outputBase, { recursive: true, force: true });
      await mkdir(outputBase, { recursive: true });

      const scenario = await loadScenario('scenarios/s3k-zone-editor.ts');
      result = await runScenario(scenario, {
        url: 'about:blank',
        outputBase,
        tier: 'scripted',
        overlay: 'burned',
      });
    });

    afterAll(async () => {
      await rm(outputBase, { recursive: true, force: true });
    });

    it('produces an MP4 file', () => {
      expect(existsSync(result.mp4Path)).toBe(true);
      const stat = statSync(result.mp4Path);
      expect(stat.size).toBeGreaterThan(0);
    });

    it('produces a GIF file', () => {
      expect(existsSync(result.gifPath)).toBe(true);
      const stat = statSync(result.gifPath);
      expect(stat.size).toBeGreaterThan(0);
    });

    it('produces captions YAML', () => {
      expect(result.captionsYamlPath).toBeDefined();
      expect(existsSync(result.captionsYamlPath!)).toBe(true);
      const content = readFileSync(result.captionsYamlPath!, 'utf-8');
      expect(content).toContain('project:');
      expect(content).toContain('overlays:');
      expect(content).toContain('s3k-zone-editor');
    });

    it('produces a VO script', () => {
      expect(result.voScriptPath).toBeDefined();
      expect(existsSync(result.voScriptPath!)).toBe(true);
      const content = readFileSync(result.voScriptPath!, 'utf-8');
      expect(content).toContain('Voiceover Script:');
      expect(content).toContain('Total duration:');
    });

    it('produces a captioned MP4 when overlay is burned', () => {
      expect(result.captionedMp4Path).toBeDefined();
      expect(existsSync(result.captionedMp4Path!)).toBe(true);
      const captionedStat = statSync(result.captionedMp4Path!);
      expect(captionedStat.size).toBeGreaterThan(0);
      const cleanStat = statSync(result.mp4Path);
      expect(captionedStat.size).toBeGreaterThan(cleanStat.size);
    });

    it('captions YAML conforms to text-overlay schema', () => {
      expect(result.captionsYamlPath).toBeDefined();
      const content = readFileSync(result.captionsYamlPath!, 'utf-8');

      // Required top-level sections
      expect(content).toContain('project:');
      expect(content).toContain('defaults:');
      expect(content).toContain('theme:');
      expect(content).toContain('overlays:');

      // Overlay timecodes match M:SS.mmm pattern (filter for quoted timecode
      // values to exclude the defaults transition "in: fade" / "out: fade")
      const timecodePattern = /\d+:\d{2}\.\d{3}/;
      const lines = content.split('\n');
      const inLines = lines.filter((line) => {
        const trimmed = line.trim();
        return trimmed.startsWith('in: "') && timecodePattern.test(trimmed);
      });
      const outLines = lines.filter((line) => {
        const trimmed = line.trim();
        return trimmed.startsWith('out: "') && timecodePattern.test(trimmed);
      });
      expect(inLines.length).toBeGreaterThan(0);
      expect(outLines.length).toBeGreaterThan(0);
      for (const line of [...inLines, ...outLines]) {
        expect(line).toMatch(timecodePattern);
      }

      // Overlay types are valid
      const typeLines = lines.filter((line) => line.trim().startsWith('type:'));
      const validTypes = new Set(['title', 'lower-third', 'callout']);
      for (const line of typeLines) {
        const typeValue = line.trim().replace('type:', '').trim();
        expect(validTypes.has(typeValue)).toBe(true);
      }
    });
  });
});
