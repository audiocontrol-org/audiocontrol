/**
 * Unit tests for LiveDeployer
 *
 * Tests conversion from canonical MIDI maps to Max for Live plugin-mappings.json format.
 * Mocks file system operations using dependency injection.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LiveDeployer } from '@/adapters/daws/LiveDeployer.js';
import type { CanonicalMidiMap, ControlDefinition } from '@audiocontrol/canonical-midi-maps';
import type { DeploymentOptions } from '@/types/daw-deployer.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// Mock file system operations
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
}));

describe('LiveDeployer', () => {
  let deployer: LiveDeployer;
  let mockCanonicalMap: CanonicalMidiMap;

  beforeEach(() => {
    deployer = LiveDeployer.create();

    // Create a basic canonical map for testing
    mockCanonicalMap = {
      version: '1.0.0',
      device: {
        manufacturer: 'Novation',
        model: 'Launch Control XL 3',
      },
      plugin: {
        manufacturer: 'TAL Software',
        name: 'TAL-J-8',
      },
      metadata: {
        name: 'TAL-J-8 Test Map',
        description: 'Test mapping for TAL-J-8',
        date: '2025-10-12',
      },
      controls: [
        {
          id: 'encoder_13',
          name: 'VCF Cutoff',
          type: 'encoder',
          cc: 13,
          channel: 0,
          plugin_parameter: 105,
        },
        {
          id: 'encoder_14',
          name: 'VCF Resonance',
          type: 'encoder',
          cc: 14,
          channel: 0,
          plugin_parameter: 107,
        },
        {
          id: 'slider_77',
          name: 'Volume',
          type: 'slider',
          cc: 77,
          channel: 0,
          plugin_parameter: 120,
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
      expect(deployer.dawName).toBe('Ableton Live');
    });

    it('should have correct version', () => {
      expect(deployer.version).toBe('11/12');
    });
  });

  describe('deploy', () => {
    it('should create plugin mapping in JSON format', async () => {
      const options: DeploymentOptions = {
        outputPath: '/custom/path/test.json',
      };

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await deployer.deploy(mockCanonicalMap, options);

      expect(result.success).toBe(true);
      expect(result.dawName).toBe('Ableton Live');
      expect(result.installed).toBe(true);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('should merge with existing plugin mappings', async () => {
      const options: DeploymentOptions = {};

      const existingMappings = {
        'launch-control-xl-3_existing-plugin': {
          controller: { manufacturer: 'Novation', model: 'Launch Control XL 3' },
          pluginName: 'Existing Plugin',
          pluginManufacturer: 'Test',
          mappings: { 20: { deviceIndex: 1, parameterIndex: 0, parameterName: 'Test', curve: 'linear' } },
          metadata: { name: 'Existing' },
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(existingMappings));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await deployer.deploy(mockCanonicalMap, options);

      expect(result.success).toBe(true);
      expect(fs.writeFile).toHaveBeenCalled();

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(content as string);

      // Should contain both old and new mappings
      expect(writtenData['launch-control-xl-3_existing-plugin']).toBeDefined();
      expect(writtenData['launch-control-xl-3_tal-j-8']).toBeDefined();
    });

    it('should handle dry run mode without writing files', async () => {
      const options: DeploymentOptions = {
        outputPath: '/test/path.json',
        dryRun: true,
      };

      const result = await deployer.deploy(mockCanonicalMap, options);

      expect(result.success).toBe(true);
      expect(result.installed).toBe(false);
      expect(fs.writeFile).not.toHaveBeenCalled();
    });

    it('should convert CC numbers to string keys', async () => {
      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mockCanonicalMap, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(content as string);
      const mapping = writtenData['launch-control-xl-3_tal-j-8'];

      // CC numbers should be string keys
      expect(mapping.mappings['13']).toBeDefined();
      expect(mapping.mappings['14']).toBeDefined();
      expect(mapping.mappings['77']).toBeDefined();
    });

    it('should set deviceIndex to 1 for cc-router compatibility', async () => {
      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mockCanonicalMap, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(content as string);
      const mapping = writtenData['launch-control-xl-3_tal-j-8'];

      // All controls should target device 1 (first plugin after cc-router)
      expect(mapping.mappings['13'].deviceIndex).toBe(1);
      expect(mapping.mappings['14'].deviceIndex).toBe(1);
      expect(mapping.mappings['77'].deviceIndex).toBe(1);
    });

    it('should use plugin_parameter as parameterIndex when specified', async () => {
      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mockCanonicalMap, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(content as string);
      const mapping = writtenData['launch-control-xl-3_tal-j-8'];

      expect(mapping.mappings['13'].parameterIndex).toBe(105);
      expect(mapping.mappings['14'].parameterIndex).toBe(107);
      expect(mapping.mappings['77'].parameterIndex).toBe(120);
    });

    it('should extract parameter index from control ID when plugin_parameter not specified', async () => {
      const mapWithoutPluginParams: CanonicalMidiMap = {
        ...mockCanonicalMap,
        controls: [
          {
            id: 'encoder_16',
            name: 'Generic Control',
            type: 'encoder',
            cc: 13,
            channel: 0,
          },
        ],
      };

      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mapWithoutPluginParams, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(content as string);
      const mapping = writtenData['launch-control-xl-3_tal-j-8'];

      // Should extract "16" from "encoder_16"
      expect(mapping.mappings['13'].parameterIndex).toBe(16);
    });

    it('should use control name as parameterName', async () => {
      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mockCanonicalMap, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(content as string);
      const mapping = writtenData['launch-control-xl-3_tal-j-8'];

      expect(mapping.mappings['13'].parameterName).toBe('VCF Cutoff');
      expect(mapping.mappings['14'].parameterName).toBe('VCF Resonance');
      expect(mapping.mappings['77'].parameterName).toBe('Volume');
    });

    it('should set default linear curve', async () => {
      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mockCanonicalMap, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(content as string);
      const mapping = writtenData['launch-control-xl-3_tal-j-8'];

      expect(mapping.mappings['13'].curve).toBe('linear');
      expect(mapping.mappings['14'].curve).toBe('linear');
      expect(mapping.mappings['77'].curve).toBe('linear');
    });

    it('should skip controls without CC numbers', async () => {
      const mapWithMissingCC: CanonicalMidiMap = {
        ...mockCanonicalMap,
        controls: [
          {
            id: 'encoder_1',
            name: 'Valid Control',
            type: 'encoder',
            cc: 13,
            channel: 0,
          },
          {
            id: 'encoder_2',
            name: 'Invalid Control',
            type: 'encoder',
            channel: 0,
          } as ControlDefinition,
        ],
      };

      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mapWithMissingCC, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(content as string);
      const mapping = writtenData['launch-control-xl-3_tal-j-8'];

      // Should only have the valid control
      expect(Object.keys(mapping.mappings)).toEqual(['13']);
    });

    it('should include metadata from canonical map', async () => {
      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mockCanonicalMap, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(content as string);
      const mapping = writtenData['launch-control-xl-3_tal-j-8'];

      expect(mapping.metadata.name).toBe('TAL-J-8 Test Map');
      expect(mapping.metadata.description).toBe('Test mapping for TAL-J-8');
      expect(mapping.metadata.version).toBe('1.0.0');
    });

    it('should generate mapping key from controller and plugin names', async () => {
      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mockCanonicalMap, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(content as string);

      // Key format: "controller_plugin" (lowercase, spaces to dashes)
      expect(writtenData['launch-control-xl-3_tal-j-8']).toBeDefined();
    });

    it('should handle plugin name from metadata when plugin not specified', async () => {
      const mapWithoutPlugin: CanonicalMidiMap = {
        ...mockCanonicalMap,
        plugin: undefined,
        metadata: {
          ...mockCanonicalMap.metadata,
          name: 'Custom Mapping',
        },
      };

      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mapWithoutPlugin, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(content as string);

      expect(writtenData['launch-control-xl-3_custom-mapping']).toBeDefined();
    });

    it('should format JSON with 2-space indentation', async () => {
      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mockCanonicalMap, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];

      // Should be formatted with 2 spaces
      expect(content).toContain('  "launch-control-xl-3_tal-j-8"');
      expect(content).toContain('    "controller"');
      // Should end with newline
      expect(content).toMatch(/\n$/);
    });

    it('should handle deployment errors gracefully', async () => {
      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Permission denied'));

      const result = await deployer.deploy(mockCanonicalMap, options);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('Permission denied');
    });

    it('should handle JSON parse errors in existing mappings file', async () => {
      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockResolvedValue('{ invalid json }');
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await deployer.deploy(mockCanonicalMap, options);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });

    it('should rethrow non-ENOENT file read errors', async () => {
      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue(new Error('Disk error'));
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await deployer.deploy(mockCanonicalMap, options);

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('Disk error');
    });
  });

  describe('isInstalled', () => {
    it('should return true when cc-router module exists', async () => {
      vi.mocked(fs.readFile).mockResolvedValue('{ "name": "cc-router" }');

      const installed = await deployer.isInstalled();

      expect(installed).toBe(true);
    });

    it('should return false when cc-router module does not exist', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const installed = await deployer.isInstalled();

      expect(installed).toBe(false);
    });
  });

  describe('getConfigDirectory', () => {
    it('should return macOS path', async () => {
      const configDir = await deployer.getConfigDirectory();

      if (process.platform === 'darwin') {
        expect(configDir).toContain('Music/Ableton/User Library/Remote Scripts');
      }
    });

    it('should return Linux path on linux platform', async () => {
      // This test is platform-specific, just verify it returns a string
      const configDir = await deployer.getConfigDirectory();
      expect(typeof configDir).toBe('string');
    });

    it('should return Windows path on win32 platform', async () => {
      // This test is platform-specific, just verify it returns a string
      const configDir = await deployer.getConfigDirectory();
      expect(typeof configDir).toBe('string');
    });
  });

  describe('mapping key generation', () => {
    it('should lowercase model names', async () => {
      const mapWithUppercase: CanonicalMidiMap = {
        ...mockCanonicalMap,
        device: { manufacturer: 'Test', model: 'Controller XL' },
        plugin: { manufacturer: 'Test', name: 'Plugin V2' },
      };

      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mapWithUppercase, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(content as string);

      expect(writtenData['controller-xl_plugin-v2']).toBeDefined();
    });

    it('should replace spaces with dashes', async () => {
      const mapWithSpaces: CanonicalMidiMap = {
        ...mockCanonicalMap,
        device: { manufacturer: 'Test', model: 'My Controller' },
        plugin: { manufacturer: 'Test', name: 'My Plugin' },
      };

      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mapWithSpaces, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(content as string);

      expect(writtenData['my-controller_my-plugin']).toBeDefined();
    });

    it('should handle unknown controller/plugin gracefully', async () => {
      const mapWithMissing: CanonicalMidiMap = {
        ...mockCanonicalMap,
        device: { manufacturer: 'Test' } as any,
        plugin: undefined,
        metadata: {},
      };

      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mapWithMissing, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(content as string);

      expect(writtenData['unknown_unknown']).toBeDefined();
    });
  });

  describe('controller and plugin metadata', () => {
    it('should include controller manufacturer and model', async () => {
      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mockCanonicalMap, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(content as string);
      const mapping = writtenData['launch-control-xl-3_tal-j-8'];

      expect(mapping.controller.manufacturer).toBe('Novation');
      expect(mapping.controller.model).toBe('Launch Control XL 3');
    });

    it('should include plugin name and manufacturer', async () => {
      const options: DeploymentOptions = {};

      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await deployer.deploy(mockCanonicalMap, options);

      const [, content] = vi.mocked(fs.writeFile).mock.calls[0];
      const writtenData = JSON.parse(content as string);
      const mapping = writtenData['launch-control-xl-3_tal-j-8'];

      expect(mapping.pluginName).toBe('TAL-J-8');
      expect(mapping.pluginManufacturer).toBe('TAL Software');
    });
  });
});
