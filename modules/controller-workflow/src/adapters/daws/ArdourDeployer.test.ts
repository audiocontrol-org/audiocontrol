/**
 * Tests for ArdourDeployer
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ArdourDeployer, type PlatformProvider } from './ArdourDeployer.js';
import type { CanonicalMidiMap } from '@audiocontrol/canonical-midi-maps';

describe('ArdourDeployer', () => {
  let deployer: ArdourDeployer;
  let mockCanonicalMap: CanonicalMidiMap;

  beforeEach(() => {
    deployer = ArdourDeployer.create();

    // Create a mock canonical map for testing
    mockCanonicalMap = {
      version: '1.0.0',
      device: {
        manufacturer: 'Novation',
        model: 'Launch Control XL 3',
      },
      metadata: {
        name: 'Test Configuration',
        description: 'Test mapping',
        tags: [],
      },
      controls: [
        {
          id: 'encoder_1',
          name: 'Encoder 1',
          type: 'encoder',
          cc: 13,
          channel: 0,
          range: [0, 127],
        },
        {
          id: 'slider_1',
          name: 'Slider 1',
          type: 'slider',
          cc: 77,
          channel: 1,
          range: [0, 127],
        },
        {
          id: 'button_1',
          name: 'Button 1',
          type: 'button',
          cc: 41,
          channel: 2,
          range: [0, 127],
        },
      ],
    };
  });

  describe('Platform detection', () => {
    it('should return correct path for macOS', async () => {
      const mockPlatformProvider: PlatformProvider = {
        platform: () => 'darwin',
        homedir: () => '/Users/test',
      };
      const deployer = ArdourDeployer.create(mockPlatformProvider);

      const path = await deployer.getConfigDirectory();
      expect(path).toContain('Library/Application Support/Ardour8/midi_maps');
    });

    it('should return correct path for Linux', async () => {
      const mockPlatformProvider: PlatformProvider = {
        platform: () => 'linux',
        homedir: () => '/home/test',
      };
      const deployer = ArdourDeployer.create(mockPlatformProvider);

      const path = await deployer.getConfigDirectory();
      expect(path).toContain('.config/ardour8/midi_maps');
    });

    it('should return correct path for Windows', async () => {
      const mockPlatformProvider: PlatformProvider = {
        platform: () => 'win32',
        homedir: () => 'C:\\Users\\test',
      };
      const deployer = ArdourDeployer.create(mockPlatformProvider);
      process.env['APPDATA'] = 'C:\\Users\\Test\\AppData\\Roaming';

      const path = await deployer.getConfigDirectory();
      expect(path).toContain('Ardour8');
      expect(path).toContain('midi_maps');
    });

    it('should throw error for unsupported platform', async () => {
      const mockPlatformProvider: PlatformProvider = {
        platform: () => 'freebsd' as NodeJS.Platform,
        homedir: () => '/home/test',
      };
      const deployer = ArdourDeployer.create(mockPlatformProvider);

      await expect(deployer.getConfigDirectory()).rejects.toThrow('Unsupported platform');
    });

    it('should throw error for unknown platform', async () => {
      const mockPlatformProvider: PlatformProvider = {
        platform: () => 'unknown' as NodeJS.Platform,
        homedir: () => '/home/test',
      };
      const deployer = ArdourDeployer.create(mockPlatformProvider);

      await expect(deployer.getConfigDirectory()).rejects.toThrow('Unsupported platform');
    });
  });

  describe('MIDI channel handling', () => {
    it('should include channel 0 in XML output', async () => {
      const mapWithChannel0 = {
        ...mockCanonicalMap,
        midi_channel: 0,
        controls: [
          {
            id: 'encoder_1',
            name: 'Encoder 1',
            type: 'encoder' as const,
            cc: 13,
            channel: 0,
            range: [0, 127] as [number, number],
          },
        ],
      };

      const result = await deployer.deploy(mapWithChannel0, { dryRun: true });
      expect(result.success).toBe(true);
    });

    it('should include channel 1 in XML output', async () => {
      const mapWithChannel1 = {
        ...mockCanonicalMap,
        midi_channel: 1,
        controls: [
          {
            id: 'slider_1',
            name: 'Slider 1',
            type: 'slider' as const,
            cc: 77,
            channel: 1,
            range: [0, 127] as [number, number],
          },
        ],
      };

      const result = await deployer.deploy(mapWithChannel1, { dryRun: true });
      expect(result.success).toBe(true);
    });

    it('should include channel 15 in XML output', async () => {
      const mapWithChannel15 = {
        ...mockCanonicalMap,
        midi_channel: 15,
        controls: [
          {
            id: 'button_1',
            name: 'Button 1',
            type: 'button' as const,
            cc: 41,
            channel: 15,
            range: [0, 127] as [number, number],
          },
        ],
      };

      const result = await deployer.deploy(mapWithChannel15, { dryRun: true });
      expect(result.success).toBe(true);
    });
  });

  describe('Deployment', () => {
    it('should deploy successfully in dry-run mode', async () => {
      const result = await deployer.deploy(mockCanonicalMap, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.dawName).toBe('Ardour');
      expect(result.installed).toBe(false);
      expect(result.outputPath).toBeDefined();
    });

    it('should not write files in dry-run mode', async () => {
      const result = await deployer.deploy(mockCanonicalMap, { dryRun: true, outputPath: '/tmp/test.map' });

      expect(result.success).toBe(true);
      expect(result.outputPath).toBe('/tmp/test.map');
    });

    it('should generate correct output path', async () => {
      const result = await deployer.deploy(mockCanonicalMap, { dryRun: true });

      expect(result.outputPath).toMatch(/\.map$/);
      expect(result.outputPath).toContain('novation');
      expect(result.outputPath).toContain('launch_control_xl_3');
    });

    it('should handle plugin name in output path', async () => {
      const mapWithPlugin = {
        ...mockCanonicalMap,
        plugin: {
          name: 'TAL-Filter',
          type: 'vst3' as const,
        },
      };

      const result = await deployer.deploy(mapWithPlugin, { dryRun: true });

      expect(result.outputPath).toContain('tal-filter');
    });

    it('should handle custom output path', async () => {
      const customPath = '/custom/path/test.map';
      const result = await deployer.deploy(mockCanonicalMap, {
        dryRun: true,
        outputPath: customPath
      });

      expect(result.outputPath).toBe(customPath);
    });

    it('should handle deployment errors gracefully', async () => {
      const invalidMap = {
        ...mockCanonicalMap,
        controls: [
          {
            id: 'invalid',
            name: 'Invalid Control',
            type: 'unknown' as any,
            range: [0, 127] as [number, number],
          },
        ],
      };

      const result = await deployer.deploy(invalidMap, { dryRun: false, outputPath: '/tmp/test.map' });

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('Installation check', () => {
    it('should check if Ardour is installed', async () => {
      const isInstalled = await deployer.isInstalled();
      expect(typeof isInstalled).toBe('boolean');
    });
  });

  describe('Factory method', () => {
    it('should create deployer via factory function', () => {
      const newDeployer = ArdourDeployer.create();
      expect(newDeployer).toBeInstanceOf(ArdourDeployer);
      expect(newDeployer.dawName).toBe('Ardour');
      expect(newDeployer.version).toBe('8.x');
    });
  });
});
