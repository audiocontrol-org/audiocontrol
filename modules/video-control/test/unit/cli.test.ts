import { describe, it, expect } from 'vitest';
import { validateScenarioModule, parseTierArg, parseOverlayArg } from '@/cli-utils.js';

describe('validateScenarioModule', () => {
  const validMetadata = {
    name: 'test-scenario',
    description: 'A test scenario',
    mode: 'harness',
    outputTier: 'silent',
  };

  const validRun = async () => {
    /* noop */
  };

  it('returns ScenarioModule for valid module with metadata and run', () => {
    const mod = { metadata: validMetadata, run: validRun };
    const result = validateScenarioModule(mod, '/test/path');
    expect(result.metadata.name).toBe('test-scenario');
    expect(result.run).toBe(validRun);
  });

  it('throws for module missing metadata', () => {
    const mod = { run: validRun };
    expect(() => validateScenarioModule(mod, '/test/path')).toThrow(
      'must export metadata and run',
    );
  });

  it('throws for module missing run function', () => {
    const mod = { metadata: validMetadata };
    expect(() => validateScenarioModule(mod, '/test/path')).toThrow(
      'must export metadata and run',
    );
  });

  it('throws for metadata missing required fields', () => {
    const mod = {
      metadata: { name: 'test' },
      run: validRun,
    };
    expect(() => validateScenarioModule(mod, '/test/path')).toThrow(
      'metadata must have name, description, mode, and outputTier',
    );
  });

  it('includes captions when present as array', () => {
    const captions = [
      { text: 'Hello', timestampMs: 0, durationMs: 1000, type: 'step' },
    ];
    const mod = { metadata: validMetadata, run: validRun, captions };
    const result = validateScenarioModule(mod, '/test/path');
    expect(result.captions).toEqual(captions);
  });

  it('omits captions when not an array', () => {
    const mod = { metadata: validMetadata, run: validRun, captions: 'not-an-array' };
    const result = validateScenarioModule(mod, '/test/path');
    expect(result.captions).toBeUndefined();
  });
});

describe('parseTierArg', () => {
  it('returns undefined when no --tier flag', () => {
    expect(parseTierArg(['--overlay', 'none'])).toBeUndefined();
  });

  it('returns the tier value for valid --tier', () => {
    expect(parseTierArg(['--tier', 'captioned'])).toBe('captioned');
    expect(parseTierArg(['--tier', 'silent'])).toBe('silent');
    expect(parseTierArg(['--tier', 'scripted'])).toBe('scripted');
  });

  it('throws for invalid --tier value', () => {
    expect(() => parseTierArg(['--tier', 'invalid'])).toThrow('Invalid --tier value');
  });

  it('throws when --tier has no value', () => {
    expect(() => parseTierArg(['--tier'])).toThrow('Invalid --tier value');
  });
});

describe('parseOverlayArg', () => {
  it('returns undefined when no --overlay flag', () => {
    expect(parseOverlayArg(['--tier', 'silent'])).toBeUndefined();
  });

  it('returns the overlay value for valid --overlay', () => {
    expect(parseOverlayArg(['--overlay', 'none'])).toBe('none');
    expect(parseOverlayArg(['--overlay', 'burned'])).toBe('burned');
    expect(parseOverlayArg(['--overlay', 'both'])).toBe('both');
  });

  it('throws for invalid --overlay value', () => {
    expect(() => parseOverlayArg(['--overlay', 'invalid'])).toThrow(
      'Invalid --overlay value',
    );
  });

  it('throws when --overlay has no value', () => {
    expect(() => parseOverlayArg(['--overlay'])).toThrow('Invalid --overlay value');
  });
});
