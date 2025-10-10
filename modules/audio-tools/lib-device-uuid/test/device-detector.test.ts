import { describe, it, expect, vi } from 'vitest';
import { createDeviceDetector } from '../src/device-detector.js';
import { MacOSDetector } from '../src/detectors/macos.js';
import { LinuxDetector } from '../src/detectors/linux.js';

describe('Device Detector Factory', () => {
  it('should create detector for current platform', () => {
    // Skip on Windows since it's not yet supported
    if (process.platform === 'win32') {
      expect(() => createDeviceDetector()).toThrow(/Windows platform not yet supported/);
      return;
    }

    const detector = createDeviceDetector();
    expect(detector).toBeDefined();
    expect(detector.getPlatform()).toBeDefined();
  });

  it('should create MacOSDetector on darwin platform', () => {
    if (process.platform !== 'darwin') {
      // Skip this test on non-macOS platforms
      return;
    }

    const detector = createDeviceDetector();
    expect(detector).toBeInstanceOf(MacOSDetector);
    expect(detector.getPlatform()).toBe('darwin');
  });

  it('should create LinuxDetector on linux platform', () => {
    if (process.platform !== 'linux') {
      // Skip this test on non-Linux platforms
      return;
    }

    const detector = createDeviceDetector();
    expect(detector).toBeInstanceOf(LinuxDetector);
    expect(detector.getPlatform()).toBe('linux');
  });

  it('should throw descriptive error on Windows', () => {
    if (process.platform !== 'win32') {
      // Can't test this on non-Windows platforms without mocking
      return;
    }

    expect(() => createDeviceDetector()).toThrow(/Windows platform not yet supported/);
    expect(() => createDeviceDetector()).toThrow(/WMI or PowerShell/);
  });

  it('should implement DeviceDetectorInterface', () => {
    if (process.platform === 'win32') {
      // Skip on Windows
      return;
    }

    const detector = createDeviceDetector();
    expect(typeof detector.detectDevice).toBe('function');
    expect(typeof detector.isSupported).toBe('function');
    expect(typeof detector.getPlatform).toBe('function');
  });

  it('should report correct support status', () => {
    if (process.platform === 'win32') {
      // Skip on Windows
      return;
    }

    const detector = createDeviceDetector();
    expect(detector.isSupported()).toBe(true);
  });
});
