import { describe, it, expect } from 'vitest';
import {
  formatTimestamp,
  formatTimecode,
  yamlEscapeString,
  formatTitle,
  wrapText,
  generateCaptionsYaml,
  generateVoScript,
} from '@/captions.js';
import type { Caption } from '@/types.js';

describe('formatTimestamp', () => {
  it('formats 0ms as "00:00"', () => {
    expect(formatTimestamp(0)).toBe('00:00');
  });

  it('formats 90000ms as "01:30"', () => {
    expect(formatTimestamp(90000)).toBe('01:30');
  });

  it('formats 5000ms as "00:05"', () => {
    expect(formatTimestamp(5000)).toBe('00:05');
  });
});

describe('formatTimecode', () => {
  it('formats 0ms as "0:00.000"', () => {
    expect(formatTimecode(0)).toBe('0:00.000');
  });

  it('formats 6000ms as "0:06.000"', () => {
    expect(formatTimecode(6000)).toBe('0:06.000');
  });

  it('formats 90500ms as "1:30.500"', () => {
    expect(formatTimecode(90500)).toBe('1:30.500');
  });

  it('formats 500ms as "0:00.500"', () => {
    expect(formatTimecode(500)).toBe('0:00.500');
  });
});

describe('yamlEscapeString', () => {
  it('wraps plain text in double quotes', () => {
    expect(yamlEscapeString('hello world')).toBe('"hello world"');
  });

  it('escapes double quotes within text', () => {
    expect(yamlEscapeString('say "hello"')).toBe('"say \\"hello\\""');
  });

  it('escapes backslashes', () => {
    expect(yamlEscapeString('path\\to\\file')).toBe('"path\\\\to\\\\file"');
  });
});

describe('formatTitle', () => {
  it('capitalizes each word from kebab-case', () => {
    expect(formatTitle('s3k-zone-editor')).toBe('S3k Zone Editor');
  });

  it('handles single word', () => {
    expect(formatTitle('demo')).toBe('Demo');
  });
});

describe('wrapText', () => {
  it('returns single line when text fits within width', () => {
    expect(wrapText('short text', 40)).toEqual(['short text']);
  });

  it('wraps at word boundary when text exceeds width', () => {
    const result = wrapText('the quick brown fox jumps over', 15);
    expect(result.length).toBeGreaterThan(1);
    for (const line of result) {
      expect(line.length).toBeLessThanOrEqual(15);
    }
  });

  it('handles single long word that exceeds width', () => {
    const result = wrapText('superlongword', 5);
    expect(result).toEqual(['superlongword']);
  });
});

const makeCaptions = (): Caption[] => [
  { text: 'Welcome to the demo', timestampMs: 0, durationMs: 3000, type: 'title' },
  { text: 'Click the button', timestampMs: 5000, durationMs: 2000, type: 'step' },
  { text: 'Notice the highlight', timestampMs: 8000, durationMs: 2000, type: 'callout' },
];

describe('generateCaptionsYaml', () => {
  it('includes project config with scenario name', () => {
    const yaml = generateCaptionsYaml('my-demo', [], 10000);
    expect(yaml).toContain('project:');
    expect(yaml).toContain('name: "my-demo"');
  });

  it('includes resolution and framerate', () => {
    const yaml = generateCaptionsYaml('demo', [], 10000);
    expect(yaml).toContain('resolution: [1280, 720]');
    expect(yaml).toContain('framerate: 30');
  });

  it('formats video duration as timecode', () => {
    const yaml = generateCaptionsYaml('demo', [], 90500);
    expect(yaml).toContain('duration: "1:30.500"');
  });

  it('maps title caption type to title overlay type', () => {
    const captions: Caption[] = [
      { text: 'Title', timestampMs: 0, durationMs: 1000, type: 'title' },
    ];
    const yaml = generateCaptionsYaml('demo', captions, 5000);
    expect(yaml).toContain('type: title');
  });

  it('maps step caption type to lower-third overlay type', () => {
    const captions: Caption[] = [
      { text: 'Step', timestampMs: 0, durationMs: 1000, type: 'step' },
    ];
    const yaml = generateCaptionsYaml('demo', captions, 5000);
    expect(yaml).toContain('type: lower-third');
  });

  it('maps callout caption type to callout overlay type', () => {
    const captions: Caption[] = [
      { text: 'Callout', timestampMs: 0, durationMs: 1000, type: 'callout' },
    ];
    const yaml = generateCaptionsYaml('demo', captions, 5000);
    expect(yaml).toContain('type: callout');
  });

  it('generates correct in/out timecodes for each overlay', () => {
    const captions: Caption[] = [
      { text: 'Hello', timestampMs: 5000, durationMs: 3000, type: 'step' },
    ];
    const yaml = generateCaptionsYaml('demo', captions, 10000);
    expect(yaml).toContain('in: "0:05.000"');
    expect(yaml).toContain('out: "0:08.000"');
  });

  it('assigns sequential caption IDs', () => {
    const yaml = generateCaptionsYaml('demo', makeCaptions(), 15000);
    expect(yaml).toContain('id: "caption-0"');
    expect(yaml).toContain('id: "caption-1"');
    expect(yaml).toContain('id: "caption-2"');
  });

  it('produces valid YAML structure', () => {
    const yaml = generateCaptionsYaml('demo', makeCaptions(), 15000);
    expect(yaml).toContain('project:');
    expect(yaml).toContain('overlays:');
    expect(yaml).toContain('defaults:');
    expect(yaml).toContain('theme:');
  });
});

describe('generateVoScript', () => {
  it('includes scenario title in header', () => {
    const script = generateVoScript('s3k-zone-editor', [], 10000);
    expect(script).toContain('Voiceover Script: S3k Zone Editor');
  });

  it('includes separator line matching title length', () => {
    const script = generateVoScript('demo', [], 10000);
    const lines = script.split('\n');
    const titleLine = lines[0];
    const separatorLine = lines[1];
    expect(separatorLine).toBe('='.repeat(titleLine.length));
  });

  it('formats caption timestamps as [MM:SS]', () => {
    const captions: Caption[] = [
      { text: 'Hello', timestampMs: 65000, durationMs: 2000, type: 'step' },
    ];
    const script = generateVoScript('demo', captions, 70000);
    expect(script).toContain('[01:05]');
  });

  it('wraps long caption text with indentation', () => {
    const longText = 'This is a very long caption that should be wrapped across multiple lines to stay within the configured line width limit';
    const captions: Caption[] = [
      { text: longText, timestampMs: 0, durationMs: 5000, type: 'step' },
    ];
    const script = generateVoScript('demo', captions, 10000);
    const lines = script.split('\n');
    const indentedLines = lines.filter((l) => l.startsWith('        '));
    expect(indentedLines.length).toBeGreaterThan(0);
  });

  it('includes total duration at the end', () => {
    const script = generateVoScript('demo', [], 15500);
    expect(script).toContain('Total duration: 15.5s');
  });
});
