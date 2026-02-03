/**
 * Integration tests for controller-workflow module
 *
 * Tests the complete workflow from controller reading through DAW deployment
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeploymentWorkflow } from './orchestrator/DeploymentWorkflow.js';
import { LaunchControlXL3Adapter } from './adapters/controllers/LaunchControlXL3Adapter.js';
import { LaunchControlXL3Converter } from './converters/LaunchControlXL3Converter.js';
import { ArdourDeployer } from './adapters/daws/ArdourDeployer.js';
import type { LaunchControlXL3, CustomMode } from '@audiocontrol/launch-control-xl3';
import type { ControllerAdapterInterface } from './types/index.js';

// Mock the LaunchControlXL3 device
const createMockLCXL3Device = (): LaunchControlXL3 => {
  const mockMode: CustomMode = {
    name: 'Test',
    slot: 0,
    controls: {
      SEND_A1: {
        type: 'knob',
        cc: 13,
        channel: 0,
        minValue: 0,
        maxValue: 127,
        behavior: 'absolute',
      },
      FADER1: {
        type: 'fader',
        cc: 77,
        channel: 0,
        minValue: 0,
        maxValue: 127,
        behavior: 'absolute',
      },
    },
  };

  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    verifyDevice: vi.fn().mockResolvedValue({
      firmwareVersion: '1.0.0',
      deviceId: 'LCXL3-TEST',
    }),
    readCustomMode: vi.fn().mockResolvedValue(mockMode),
    writeCustomMode: vi.fn().mockResolvedValue(undefined),
  } as unknown as LaunchControlXL3;
};

describe('Integration Tests', () => {
  let mockDevice: LaunchControlXL3;
  let adapter: ControllerAdapterInterface;
  let converter: LaunchControlXL3Converter;
  let deployer: ArdourDeployer;

  beforeEach(() => {
    mockDevice = createMockLCXL3Device();
    adapter = new LaunchControlXL3Adapter(mockDevice);
    converter = new LaunchControlXL3Converter();
    deployer = ArdourDeployer.create();
  });

  describe('End-to-end workflow', () => {
    it('should complete full workflow in dry-run mode', async () => {
      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers: new Map([['ardour', deployer]]),
      });

      const result = await workflow.execute({
        configSlot: 0,
        targets: ['ardour'],
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.controllerConfig).toBeDefined();
      expect(result.canonicalMap).toBeDefined();
      expect(result.deployments).toHaveLength(1);
      expect(result.deployments[0].success).toBe(true);
      expect(result.deployments[0].dawName).toBe('Ardour');
    });

    it('should not write files in dry-run mode', async () => {
      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers: new Map([['ardour', deployer]]),
      });

      // Execute in dry-run mode
      const result = await workflow.execute({
        configSlot: 0,
        targets: ['ardour'],
        outputDir: '/tmp/integration-test',
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.deployments[0].installed).toBe(false);
      // In dry-run mode, canonical YAML should not be saved
      expect(result.canonicalPath).toBeUndefined();
    });

    it('should preserve controller metadata through conversion', async () => {
      const customMode: CustomMode = {
        name: 'MyPlugin',
        slot: 3,
        controls: {
          SEND_A1: {
            type: 'knob',
            cc: 13,
            channel: 0,
            name: 'Cutoff',
            minValue: 0,
            maxValue: 127,
            behavior: 'absolute',
          },
        },
        metadata: {
          version: '1.0',
          author: 'Test User',
        },
      };

      vi.mocked(mockDevice.readCustomMode).mockResolvedValue(customMode);

      const config = await adapter.readConfiguration(3);
      expect(config.metadata?.slot).toBe(3);

      const canonical = converter.convert(config, { preserveLabels: false });
      expect(canonical.metadata.name).toBe('MyPlugin');
    });

    it('should handle plugin information correctly', async () => {
      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers: new Map([['ardour', deployer]]),
      });

      const result = await workflow.execute({
        configSlot: 0,
        targets: ['ardour'],
        pluginInfo: {
          name: 'TAL-Filter',
          type: 'vst3',
        },
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.canonicalMap?.plugin).toBeDefined();
      expect(result.canonicalMap?.plugin?.name).toBe('TAL-Filter');
    });
  });

  describe('Adapter → Converter integration', () => {
    it('should convert LCXL3 configuration to canonical format', async () => {
      const config = await adapter.readConfiguration(0);
      expect(config.controls).toHaveLength(2);

      const canonical = converter.convert(config, { preserveLabels: false });

      expect(canonical.version).toBe('1.0.0');
      expect(canonical.device.manufacturer).toBe('Novation');
      expect(canonical.device.model).toBe('Launch Control XL 3');
      expect(canonical.controls).toHaveLength(2);
      expect(canonical.controls[0].id).toBe('encoder_1');
      expect(canonical.controls[1].id).toBe('slider_1');
    });

    it('should preserve labels when requested', async () => {
      const modeWithLabels: CustomMode = {
        name: 'Labeled',
        controls: {
          SEND_A1: {
            type: 'knob',
            cc: 13,
            channel: 0,
            name: 'Resonance',
            minValue: 0,
            maxValue: 127,
            behavior: 'absolute',
          },
        },
      };

      vi.mocked(mockDevice.readCustomMode).mockResolvedValue(modeWithLabels);

      const config = await adapter.readConfiguration(0);
      const canonical = converter.convert(config, { preserveLabels: true });

      expect(canonical.controls[0].name).toBe('Resonance');
    });

    it('should use default names when not preserving labels', async () => {
      const config = await adapter.readConfiguration(0);
      const canonical = converter.convert(config, { preserveLabels: false });

      expect(canonical.controls[0].name).toBe('Encoder 1');
      expect(canonical.controls[1].name).toBe('Slider 1');
    });
  });

  describe('Converter → Deployer integration', () => {
    it('should deploy canonical map to Ardour format', async () => {
      const config = await adapter.readConfiguration(0);
      const canonical = converter.convert(config, { preserveLabels: false });

      const result = await deployer.deploy(canonical, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.dawName).toBe('Ardour');
      expect(result.outputPath).toBeDefined();
      expect(result.outputPath).toMatch(/\.map$/);
    });

    it('should handle multi-channel mappings', async () => {
      const multiChannelMode: CustomMode = {
        name: 'Multi',
        controls: {
          SEND_A1: {
            type: 'knob',
            cc: 13,
            channel: 0,
            minValue: 0,
            maxValue: 127,
            behavior: 'absolute',
          },
          SEND_A2: {
            type: 'knob',
            cc: 14,
            channel: 1,
            minValue: 0,
            maxValue: 127,
            behavior: 'absolute',
          },
          SEND_A3: {
            type: 'knob',
            cc: 15,
            channel: 2,
            minValue: 0,
            maxValue: 127,
            behavior: 'absolute',
          },
        },
      };

      vi.mocked(mockDevice.readCustomMode).mockResolvedValue(multiChannelMode);

      const config = await adapter.readConfiguration(0);
      const canonical = converter.convert(config, { preserveLabels: false });
      const result = await deployer.deploy(canonical, { dryRun: true });

      expect(result.success).toBe(true);
    });
  });

  describe('Error handling across components', () => {
    it('should handle adapter read errors', async () => {
      vi.mocked(mockDevice.readCustomMode).mockResolvedValue(null);

      await expect(adapter.readConfiguration(0)).rejects.toThrow('No configuration found in slot 0');
    });

    it('should handle converter validation errors', async () => {
      const invalidConfig = {
        name: 'Invalid',
        controls: [] as any[],
      };

      expect(converter.canConvert(invalidConfig)).toBe(false);
      expect(() => converter.convert(invalidConfig, { preserveLabels: false })).toThrow();
    });

    it('should handle workflow errors gracefully', async () => {
      mockDevice.readCustomMode.mockRejectedValue(new Error('Device error'));

      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers: new Map([['ardour', deployer]]),
      });

      // Add error listener to prevent unhandled error event
      workflow.on('error', () => {
        // Intentionally empty - we expect errors in this test
      });

      const result = await workflow.execute({
        configSlot: 0,
        targets: ['ardour'],
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Progress tracking', () => {
    it('should emit progress events throughout workflow', async () => {
      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers: new Map([['ardour', deployer]]),
      });

      const progressEvents: any[] = [];
      workflow.on('progress', (event) => progressEvents.push(event));

      await workflow.execute({
        configSlot: 0,
        targets: ['ardour'],
        dryRun: true,
      });

      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents.some(e => e.step === 1)).toBe(true); // Reading
      expect(progressEvents.some(e => e.step === 2)).toBe(true); // Converting
      expect(progressEvents.some(e => e.step === 4)).toBe(true); // Deploying
    });
  });

  describe('Configuration validation', () => {
    it('should validate slot numbers', async () => {
      await expect(adapter.readConfiguration(-1)).rejects.toThrow('Invalid slot number');
      await expect(adapter.readConfiguration(16)).rejects.toThrow('Invalid slot number');
    });

    it('should require valid control types', async () => {
      const config = await adapter.readConfiguration(0);
      expect(config.controls.every(c => ['encoder', 'slider', 'button'].includes(c.type))).toBe(true);
    });

    it('should require CC numbers', async () => {
      const config = await adapter.readConfiguration(0);
      expect(converter.canConvert(config)).toBe(true);

      const invalidConfig = {
        ...config,
        controls: config.controls.map(c => ({ ...c, cc: undefined })),
      };

      expect(converter.canConvert(invalidConfig)).toBe(false);
    });
  });
});
