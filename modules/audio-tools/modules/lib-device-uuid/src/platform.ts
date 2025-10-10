import type { Platform } from '@/types.js';

/**
 * Detect the current platform
 * @returns Platform identifier based on process.platform
 */
export function detectPlatform(): Platform {
  const platform = process.platform;
  if (platform === 'darwin' || platform === 'linux' || platform === 'win32') {
    return platform;
  }
  return 'unknown';
}
