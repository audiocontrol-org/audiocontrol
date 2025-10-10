/**
 * lib-device-uuid - Cross-platform device UUID detection
 *
 * This library provides a unified interface for detecting device UUIDs
 * and metadata across different platforms (macOS, Linux).
 *
 * @packageDocumentation
 */

// Export all types
export * from '@/types.js';

// Export platform detection utilities
export * from '@/platform.js';

// Export main device detector factory
export * from '@/device-detector.js';

// Export platform-specific detectors for advanced usage
export { MacOSDetector } from '@/detectors/macos.js';
export { LinuxDetector } from '@/detectors/linux.js';
