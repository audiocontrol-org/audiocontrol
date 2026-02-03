/**
 * Unit tests for ArdourDeployer
 *
 * Tests conversion from canonical MIDI maps to Ardour XML format and deployment.
 * Mocks file system operations using dependency injection.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ArdourDeployer, type PlatformProvider } from '@/adapters/daws/ArdourDeployer.js';
import type { CanonicalMidiMap, ControlDefinition } from '@audiocontrol/canonical-midi-maps';
import type { DeploymentOptions } from '@/types/daw-deployer.js';
import * as fs from 'node:fs/promises';

// Mock file system operations
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
}));

describe('ArdourDeployer', () => {
  let deployer: ArdourDeployer;
  let mockCanonicalMap: CanonicalMidiMap;

  beforeEach(() => {
    deployer = ArdourDeployer.create();

    // Create a basic canonical map for testing
    mockCanonicalMap = {
      version: '1.0.0',
      device: {
        manufacturer: 'Novation',
        model: 'Launch Control XL 3',
      },
      metadata: {
        name: 'Test Map',
        description: 'Test MIDI map',
        date: '2025-10-05',
      },
      controls: [
        {
          id: 'encoder_1',
          name: 'Encoder 1',
          type: 'encoder',
          cc: 13,
          channel: 0,
        },
        {
          id: 'slider_1',
          name: 'Slider 1',
          type: 'slider',
          cc: 77,
          channel: 0,
        },
        {
          id: 'button_1',
          name: 'Button 1',
          type: 'button',
          cc: 41,
          channel: 0,
        },
      ],
    };

    // Reset mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('static properties', () => {
    it('should have correct DAW name', () => {
      expect(deployer.dawName).toBe('Ardour');
    });

    it('should have correct version', () => {
      expect(deployer.version).toBe('8.x');
    });
  });

  describe('deploy', () => {
    it('should deploy to specified output path', async () => {
      const options: DeploymentOptions = {
        outputPath: '/custom/path/test.map',
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await deployer.deploy(mockCanonicalMap, options);

      expect(result.success).toBe(true);
      expect(result.dawName).toBe('Ardour');
      expect(result.outputPath).toBe('/custom/path/test.map');
      expect(result.installed).toBe(false);
      expect(fs.mkdir).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should use default output path when not specified', async () => {
      const options: DeploymentOptions = {};

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await deployer.deploy(mockCanonicalMap, options);

      expect(result.success).toBe(true);
      expect(result.outputPath).toContain('novation_launch_control_xl_3.map');
    });

    it('should auto-install to Ardour config directory', async () => {
      const options: DeploymentOptions = {
        autoInstall: true,
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await deployer.deploy(mockCanonicalMap, options);

      expect(result.success).toBe(true);
      expect(result.installed).toBe(true);
      expect(result.outputPath).toContain('midi_maps');
    });

    it('should handle dry run mode without writing files', async () => {
      const options: DeploymentOptions = {
        outputPath: '/test/path.map',
        dryRun: true,
      };

      const result = await deployer.deploy(mockCanonicalMap, options);

      expect(result.success).toBe(true);
      expect(result.outputPath).toBe('/test/path.map');
      expect(result.installed).toBe(false);
      expect(fs.writeFile).not.toHaveBeenCalled();
      expect(fs.mkdir).not.toHaveBeenCalled();
    });

    it('should create output directory recursively', async () => {
      const options: DeploymentOptions = {
        outputPath: '/deep/nested/path/test.map',
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mockCanonicalMap, options);

      expect(fs.mkdir).toHaveBeenCalledWith('/deep/nested/path', { recursive: true });
    });

    it('should write valid XML content', async () => {
      const options: DeploymentOptions = {
        outputPath: '/test/path.map',
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mockCanonicalMap, options);

      expect(fs.writeFile).toHaveBeenCalled();
      const [, content, encoding] = vi.mocked(fs.writeFile).mock.calls[0];
      expect(encoding).toBe('utf-8');
      expect(typeof content).toBe('string');
      expect(content).toContain('<?xml');
      expect(content).toContain('ArdourMIDIBindings');
    });

    it('should handle deployment errors gracefully', async () => {
      const options: DeploymentOptions = {
        outputPath: '/test/path.map',
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

      const result = await deployer.deploy(mockCanonicalMap, options);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('Permission denied');
    });

    it('should include plugin info in map name', async () => {
      const mapWithPlugin: CanonicalMidiMap = {
        ...mockCanonicalMap,
        plugin: {
          name: 'Test Plugin',
          manufacturer: 'Test Vendor',
        },
      };

      const options: DeploymentOptions = {};

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await deployer.deploy(mapWithPlugin, options);

      expect(result.outputPath).toContain('test_plugin');
    });
  });

  describe('isInstalled', () => {
    it('should return true when Ardour config directory exists', async () => {
      vi.mocked(fs.access).mockResolvedValue(undefined);

      const installed = await deployer.isInstalled();

      expect(installed).toBe(true);
    });

    it('should return false when Ardour config directory does not exist', async () => {
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const installed = await deployer.isInstalled();

      expect(installed).toBe(false);
    });
  });

  describe('getConfigDirectory', () => {
    it('should return macOS path on darwin platform', async () => {
      const mockPlatformProvider: PlatformProvider = {
        platform: () => 'darwin',
        homedir: () => '/Users/test',
      };
      const deployer = ArdourDeployer.create(mockPlatformProvider);

      const configDir = await deployer.getConfigDirectory();

      expect(configDir).toBe('/Users/test/Library/Application Support/Ardour8/midi_maps');
    });

    it('should return Linux path on linux platform', async () => {
      const mockPlatformProvider: PlatformProvider = {
        platform: () => 'linux',
        homedir: () => '/home/test',
      };
      const deployer = ArdourDeployer.create(mockPlatformProvider);

      const configDir = await deployer.getConfigDirectory();

      expect(configDir).toBe('/home/test/.config/ardour8/midi_maps');
    });

    it('should return Windows path on win32 platform', async () => {
      const mockPlatformProvider: PlatformProvider = {
        platform: () => 'win32',
        homedir: () => 'C:\\Users\\test',
      };
      const deployer = ArdourDeployer.create(mockPlatformProvider);
      process.env['APPDATA'] = 'C:\\Users\\test\\AppData\\Roaming';

      const configDir = await deployer.getConfigDirectory();

      // On non-Windows hosts, path.join uses forward slashes, so we normalize for comparison
      expect(configDir.replace(/\//g, '\\')).toBe('C:\\Users\\test\\AppData\\Roaming\\Ardour8\\midi_maps');
    });

    it('should use fallback path when APPDATA not set on Windows', async () => {
      const mockPlatformProvider: PlatformProvider = {
        platform: () => 'win32',
        homedir: () => 'C:\\Users\\test',
      };
      const deployer = ArdourDeployer.create(mockPlatformProvider);
      delete process.env['APPDATA'];

      const configDir = await deployer.getConfigDirectory();

      // Normalize path separators for cross-platform testing
      const normalizedPath = configDir.replace(/\//g, '\\');
      expect(normalizedPath).toContain('AppData\\Roaming\\Ardour8\\midi_maps');
    });

    it('should throw error for unsupported platform', async () => {
      const mockPlatformProvider: PlatformProvider = {
        platform: () => 'aix' as NodeJS.Platform,
        homedir: () => '/home/test',
      };
      const deployer = ArdourDeployer.create(mockPlatformProvider);

      await expect(deployer.getConfigDirectory()).rejects.toThrow('Unsupported platform');
    });
  });

  describe('control type conversion', () => {
    it('should convert encoder controls correctly', async () => {
      const mapWithEncoder: CanonicalMidiMap = {
        ...mockCanonicalMap,
        controls: [
          {
            id: 'encoder_1',
            name: 'Encoder 1',
            type: 'encoder',
            cc: 13,
            channel: 0,
          },
        ],
      };

      const options: DeploymentOptions = {
        outputPath: '/test/encoder.map',
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mapWithEncoder, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      expect(content).toContain('encoder="yes"');
    });

    it('should convert slider controls correctly', async () => {
      const mapWithSlider: CanonicalMidiMap = {
        ...mockCanonicalMap,
        controls: [
          {
            id: 'slider_1',
            name: 'Slider 1',
            type: 'slider',
            cc: 77,
            channel: 0,
          },
        ],
      };

      const options: DeploymentOptions = {
        outputPath: '/test/slider.map',
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mapWithSlider, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      // Sliders use CC binding without encoder flag
      expect(content).toContain('ctl="77"');
      expect(content).not.toContain('encoder="yes"');
    });

    it('should convert button controls correctly', async () => {
      const mapWithButton: CanonicalMidiMap = {
        ...mockCanonicalMap,
        controls: [
          {
            id: 'button_1',
            name: 'Button 1',
            type: 'button',
            cc: 41,
            channel: 0,
          },
        ],
      };

      const options: DeploymentOptions = {
        outputPath: '/test/button.map',
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mapWithButton, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      // Buttons use note binding
      expect(content).toContain('note="41"');
    });

    it('should handle button groups', async () => {
      const mapWithButtonGroup: CanonicalMidiMap = {
        ...mockCanonicalMap,
        controls: [
          {
            id: 'button_group_1',
            name: 'Button Group',
            type: 'button_group',
            buttons: [
              { cc: 41, mode: 'momentary', channel: 0 },
              { cc: 42, mode: 'toggle', channel: 0 },
            ],
          } as ControlDefinition,
        ],
      };

      const options: DeploymentOptions = {
        outputPath: '/test/group.map',
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mapWithButtonGroup, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      expect(content).toContain('note="41"');
      expect(content).toContain('note="42"');
      expect(content).toContain('momentary="yes"');
    });

    it('should throw error for unsupported control type', async () => {
      const mapWithInvalidType: CanonicalMidiMap = {
        ...mockCanonicalMap,
        controls: [
          {
            id: 'invalid_1',
            name: 'Invalid',
            type: 'unknown_type' as any,
            cc: 99,
            channel: 0,
          },
        ],
      };

      const options: DeploymentOptions = {
        outputPath: '/test/invalid.map',
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await deployer.deploy(mapWithInvalidType, options);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Unsupported control type');
    });
  });

  describe('MIDI channel handling', () => {
    it('should use control-specific channel', async () => {
      const mapWithChannels: CanonicalMidiMap = {
        ...mockCanonicalMap,
        controls: [
          {
            id: 'encoder_1',
            name: 'Encoder 1',
            type: 'encoder',
            cc: 13,
            channel: 5,
          },
        ],
      };

      const options: DeploymentOptions = {
        outputPath: '/test/channels.map',
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mapWithChannels, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      expect(content).toContain('channel="5"');
    });

    it('should use map-level channel when control channel not specified', async () => {
      const mapWithDefaultChannel: CanonicalMidiMap = {
        ...mockCanonicalMap,
        midi_channel: 7,
        controls: [
          {
            id: 'encoder_1',
            name: 'Encoder 1',
            type: 'encoder',
            cc: 13,
          } as ControlDefinition,
        ],
      };

      const options: DeploymentOptions = {
        outputPath: '/test/default-channel.map',
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mapWithDefaultChannel, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      expect(content).toContain('channel="7"');
    });

    it('should group controls by channel', async () => {
      const mapWithMultipleChannels: CanonicalMidiMap = {
        ...mockCanonicalMap,
        controls: [
          { id: 'encoder_1', name: 'E1', type: 'encoder', cc: 13, channel: 0 },
          { id: 'encoder_2', name: 'E2', type: 'encoder', cc: 14, channel: 1 },
          { id: 'encoder_3', name: 'E3', type: 'encoder', cc: 15, channel: 0 },
        ],
      };

      const options: DeploymentOptions = {
        outputPath: '/test/grouped.map',
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mapWithMultipleChannels, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];

      // Should have channel comments for organization
      expect(content).toContain('Novation Launch Control XL 3');

      // All channels should be present
      expect(content).toContain('channel="0"');
      expect(content).toContain('channel="1"');
    });
  });

  describe('plugin parameter handling', () => {
    it('should use plugin_parameter when specified', async () => {
      const mapWithPluginParams: CanonicalMidiMap = {
        ...mockCanonicalMap,
        plugin: {
          name: 'Test Plugin',
          manufacturer: 'Test Vendor',
        },
        controls: [
          {
            id: 'encoder_1',
            name: 'Cutoff',
            type: 'encoder',
            cc: 13,
            channel: 0,
            plugin_parameter: 5,
          } as ControlDefinition,
        ],
      };

      const options: DeploymentOptions = {
        outputPath: '/test/plugin-params.map',
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mapWithPluginParams, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      expect(content).toContain('uri="/plugins/parameter/5"');
    });

    it('should generate parameter URI from control ID when plugin_parameter not specified', async () => {
      const options: DeploymentOptions = {
        outputPath: '/test/generated-uri.map',
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mockCanonicalMap, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      expect(content).toContain('uri="/plugins/parameter/encoder_1"');
      expect(content).toContain('uri="/plugins/parameter/slider_1"');
      expect(content).toContain('uri="/plugins/parameter/button_1"');
    });
  });

  describe('filename generation', () => {
    it('should sanitize device name for filename', async () => {
      const mapWithSpecialChars: CanonicalMidiMap = {
        ...mockCanonicalMap,
        device: {
          manufacturer: 'Test/Vendor',
          model: 'Device #1 (v2.0)',
        },
      };

      const options: DeploymentOptions = {};

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await deployer.deploy(mapWithSpecialChars, options);

      expect(result.outputPath).toMatch(/^[a-z0-9_-]+\.map$/);
      expect(result.outputPath).not.toContain('/');
      expect(result.outputPath).not.toContain('(');
      expect(result.outputPath).not.toContain(')');
      expect(result.outputPath).not.toContain('#');
    });

    it('should convert spaces to underscores in filename', async () => {
      const options: DeploymentOptions = {};

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await deployer.deploy(mockCanonicalMap, options);

      expect(result.outputPath).toContain('_');
      expect(result.outputPath).not.toContain(' ');
    });

    it('should lowercase filename', async () => {
      const options: DeploymentOptions = {};

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await deployer.deploy(mockCanonicalMap, options);

      expect(result.outputPath).toBe(result.outputPath?.toLowerCase());
    });
  });

  describe('error handling', () => {
    it('should handle missing CC numbers', async () => {
      const mapWithMissingCC: CanonicalMidiMap = {
        ...mockCanonicalMap,
        controls: [
          {
            id: 'encoder_1',
            name: 'Encoder 1',
            type: 'encoder',
          } as ControlDefinition,
        ],
      };

      const options: DeploymentOptions = {
        outputPath: '/test/missing-cc.map',
      };

      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await deployer.deploy(mapWithMissingCC, options);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('missing CC number');
    });

    it('should handle file system errors with descriptive messages', async () => {
      const options: DeploymentOptions = {
        outputPath: '/test/error.map',
      };

      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Disk full'));

      const result = await deployer.deploy(mockCanonicalMap, options);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Disk full');
    });
  });
});
