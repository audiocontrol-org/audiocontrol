import { describe, it, expect } from 'vitest';
import { detectPlatform } from '../src/platform.js';

describe('Platform Detection', () => {
  it('should detect platform', () => {
    const platform = detectPlatform();
    expect(['darwin', 'linux', 'win32', 'unknown']).toContain(platform);
  });

  it('should return a valid platform type', () => {
    const platform = detectPlatform();
    expect(platform).toBeDefined();
    expect(typeof platform).toBe('string');
  });

  it('should match process.platform for known platforms', () => {
    const platform = detectPlatform();
    if (process.platform === 'darwin' || process.platform === 'linux' || process.platform === 'win32') {
      expect(platform).toBe(process.platform);
    } else {
      expect(platform).toBe('unknown');
    }
  });
});
