import { describe, it, expect } from 'vitest';
import { formatAssTimestamp, generateAssContent } from '@/ffmpeg.js';
import type { Caption } from '@/types.js';

describe('formatAssTimestamp', () => {
  it('formats 0ms as "0:00:00.00"', () => {
    expect(formatAssTimestamp(0)).toBe('0:00:00.00');
  });

  it('formats 6000ms as "0:00:06.00"', () => {
    expect(formatAssTimestamp(6000)).toBe('0:00:06.00');
  });

  it('formats 90500ms as "0:01:30.50"', () => {
    expect(formatAssTimestamp(90500)).toBe('0:01:30.50');
  });

  it('formats 3661230ms as "1:01:01.23"', () => {
    expect(formatAssTimestamp(3661230)).toBe('1:01:01.23');
  });
});

describe('generateAssContent', () => {
  it('includes Script Info header', () => {
    const content = generateAssContent([]);
    expect(content).toContain('[Script Info]');
    expect(content).toContain('ScriptType: v4.00+');
  });

  it('includes V4+ Styles section with Default style', () => {
    const content = generateAssContent([]);
    expect(content).toContain('[V4+ Styles]');
    expect(content).toContain('Style: Default,');
  });

  it('includes Events section header', () => {
    const content = generateAssContent([]);
    expect(content).toContain('[Events]');
    expect(content).toContain('Format: Layer, Start, End,');
  });

  it('generates Dialogue lines with correct timestamps', () => {
    const captions: Caption[] = [
      { text: 'Hello', timestampMs: 5000, durationMs: 3000, type: 'step' },
    ];
    const content = generateAssContent(captions);
    expect(content).toContain('Dialogue: 0,0:00:05.00,0:00:08.00,Default,,0,0,0,,Hello');
  });

  it('includes caption text in Dialogue lines', () => {
    const captions: Caption[] = [
      { text: 'First caption', timestampMs: 0, durationMs: 1000, type: 'title' },
      { text: 'Second caption', timestampMs: 2000, durationMs: 1000, type: 'step' },
    ];
    const content = generateAssContent(captions);
    expect(content).toContain('First caption');
    expect(content).toContain('Second caption');
  });

  it('handles empty captions array', () => {
    const content = generateAssContent([]);
    expect(content).toContain('[Script Info]');
    expect(content).toContain('[Events]');
    expect(content).not.toContain('Dialogue:');
  });
});
