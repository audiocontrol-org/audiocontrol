/**
 * End-to-end integration tests for controller-workflow module
 *
 * Tests the complete workflow from controller configuration to DAW deployment.
 * Uses mock implementations of all components to simulate the full pipeline.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeploymentWorkflow } from '@/orchestrator/DeploymentWorkflow.js';
import { LaunchControlXL3Adapter } from '@/adapters/controllers/LaunchControlXL3Adapter.js';
import { LaunchControlXL3Converter } from '@/converters/LaunchControlXL3Converter.js';
import { ArdourDeployer } from '@/adapters/daws/ArdourDeployer.js';
import type { LaunchControlXL3 } from '@audiocontrol/launch-control-xl3';
import type { CustomMode as LCXL3CustomMode } from '@audiocontrol/launch-control-xl3';
import type { CanonicalMidiMap } from '@audiocontrol/canonical-midi-maps';
import type { WorkflowOptions, WorkflowResult } from '@/orchestrator/DeploymentWorkflow.js';
import * as fs from 'node:fs/promises';

// Mock file system for deployment tests
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
}));

describe('End-to-End Workflow', () => {
  let mockDevice: jest.Mocked<LaunchControlXL3>;
  let sampleLCXL3Mode: LCXL3CustomMode;

  beforeEach(() => {
    // Create a realistic LCXL3 custom mode configuration
    sampleLCXL3Mode = {
      name: 'E2E Test',
      controls: {
        // Row 1: Send A encoders
        SEND_A1: { name: 'Cutoff', type: 'knob', cc: 13, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_A2: { name: 'Resonance', type: 'knob', cc: 14, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_A3: { name: 'Attack', type: 'knob', cc: 15, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_A4: { name: 'Decay', type: 'knob', cc: 16, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },

        // Row 2: Send B encoders
        SEND_B1: { name: 'Sustain', type: 'knob', cc: 29, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_B2: { name: 'Release', type: 'knob', cc: 30, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },

        // Row 3: Pan encoders
        PAN1: { name: 'Pan 1', type: 'knob', cc: 49, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        PAN2: { name: 'Pan 2', type: 'knob', cc: 50, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },

        // Faders
        FADER1: { name: 'Volume 1', type: 'fader', cc: 77, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        FADER2: { name: 'Volume 2', type: 'fader', cc: 78, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },

        // Focus buttons
        FOCUS1: { name: 'Solo 1', type: 'button', cc: 41, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        FOCUS2: { name: 'Solo 2', type: 'button', cc: 42, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },

        // Control buttons
        CONTROL1: { name: 'Mute 1', type: 'button', cc: 73, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        CONTROL2: { name: 'Mute 2', type: 'button', cc: 74, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
      },
      metadata: {
        slot: 0,
      },
    };

    // Create mock LCXL3 device
    mockDevice = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      readCustomMode: vi.fn().mockResolvedValue(sampleLCXL3Mode),
      writeCustomMode: vi.fn().mockResolvedValue(undefined),
      verifyDevice: vi.fn().mockResolvedValue({
        manufacturer: 'Novation',
        model: 'Launch Control XL 3',
        firmwareVersion: '1.0.0',
      }),
    } as unknown as jest.Mocked<LaunchControlXL3>;

    // Reset file system mocks
    vi.mocked(fs.mkdir).mockClear();
    vi.mocked(fs.writeFile).mockClear();
    vi.mocked(fs.access).mockClear();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockResolvedValue(undefined);
  });

  describe('Complete Workflow Pipeline', () => {
    it('should execute full workflow from LCXL3 device to Ardour deployment', async () => {
      // Setup components
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      const converter = new LaunchControlXL3Converter();
      const deployer = ArdourDeployer.create();
      const deployers = new Map([['ardour', deployer]]);

      // Create workflow
      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers,
      });

      // Track progress events
      const progressMessages: string[] = [];
      workflow.on('progress', ({ step, message }) => {
        progressMessages.push(`Step ${step}: ${message}`);
      });

      // Execute workflow
      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
        outputDir: '/tmp/test-output',
        preserveLabels: true,
      };

      const result = await workflow.execute(options);

      // Verify workflow success
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      // Verify controller configuration was read
      expect(result.controllerConfig).toBeDefined();
      expect(result.controllerConfig?.name).toBe('E2E Test');
      expect(result.controllerConfig?.controls).toHaveLength(14);

      // Verify canonical map was created
      expect(result.canonicalMap).toBeDefined();
      expect(result.canonicalMap?.version).toBe('1.0.0');
      expect(result.canonicalMap?.device.manufacturer).toBe('Novation');
      expect(result.canonicalMap?.device.model).toBe('Launch Control XL 3');
      expect(result.canonicalMap?.controls).toHaveLength(14);

      // Verify canonical YAML was saved
      expect(result.canonicalPath).toBeDefined();
      expect(result.canonicalPath).toContain('/tmp/test-output');
      expect(result.canonicalPath).toMatch(/\.yaml$/);

      // Verify deployment succeeded
      expect(result.deployments).toHaveLength(1);
      expect(result.deployments[0].success).toBe(true);
      expect(result.deployments[0].dawName).toBe('Ardour');

      // Verify all 4 steps executed
      expect(progressMessages.some(m => m.includes('Step 1'))).toBe(true);
      expect(progressMessages.some(m => m.includes('Step 2'))).toBe(true);
      expect(progressMessages.some(m => m.includes('Step 3'))).toBe(true);
      expect(progressMessages.some(m => m.includes('Step 4'))).toBe(true);

      // Cleanup
      await workflow.cleanup();
      expect(mockDevice.disconnect).toHaveBeenCalled();
    });

    it('should preserve custom labels throughout workflow', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      const converter = new LaunchControlXL3Converter();
      const deployer = ArdourDeployer.create();
      const deployers = new Map([['ardour', deployer]]);

      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers,
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
        preserveLabels: true,
      };

      const result = await workflow.execute(options);

      // Verify labels were preserved in controller config
      const cutoffControl = result.controllerConfig?.controls.find(c => c.id === 'SEND_A1');
      expect(cutoffControl?.name).toBe('Cutoff');

      // Verify labels were preserved in canonical map
      const canonicalCutoff = result.canonicalMap?.controls.find(c => c.name === 'Cutoff');
      expect(canonicalCutoff).toBeDefined();
      expect(canonicalCutoff?.id).toBe('encoder_1');
    });

    it('should map all control types correctly', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      const converter = new LaunchControlXL3Converter();
      const deployer = ArdourDeployer.create();
      const deployers = new Map([['ardour', deployer]]);

      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers,
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
      };

      const result = await workflow.execute(options);

      const canonicalMap = result.canonicalMap!;

      // Verify encoders (8 total in sample config)
      const encoders = canonicalMap.controls.filter(c => c.type === 'encoder');
      expect(encoders).toHaveLength(8);
      expect(encoders.some(e => e.id === 'encoder_1')).toBe(true); // SEND_A1
      expect(encoders.some(e => e.id === 'encoder_9')).toBe(true); // SEND_B1
      expect(encoders.some(e => e.id === 'encoder_17')).toBe(true); // PAN1

      // Verify sliders (2 total in sample config)
      const sliders = canonicalMap.controls.filter(c => c.type === 'slider');
      expect(sliders).toHaveLength(2);
      expect(sliders.some(s => s.id === 'slider_1')).toBe(true); // FADER1

      // Verify buttons (4 total in sample config)
      const buttons = canonicalMap.controls.filter(c => c.type === 'button');
      expect(buttons).toHaveLength(4);
      expect(buttons.some(b => b.id === 'button_1')).toBe(true); // FOCUS1
      expect(buttons.some(b => b.id === 'button_9')).toBe(true); // CONTROL1
    });

    it('should handle plugin mapping workflow', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      const converter = new LaunchControlXL3Converter();
      const deployer = ArdourDeployer.create();
      const deployers = new Map([['ardour', deployer]]);

      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers,
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
        pluginInfo: {
          name: 'Synth Plugin',
          manufacturer: 'Test Audio',
          uri: 'urn:test:synth',
        },
        preserveLabels: true,
      };

      const result = await workflow.execute(options);

      // Verify plugin info in canonical map
      expect(result.canonicalMap?.plugin).toBeDefined();
      expect(result.canonicalMap?.plugin?.name).toBe('Synth Plugin');
      expect(result.canonicalMap?.plugin?.manufacturer).toBe('Test Audio');
      expect(result.canonicalMap?.plugin?.uri).toBe('urn:test:synth');
    });

    it('should deploy to multiple DAWs simultaneously', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      const converter = new LaunchControlXL3Converter();
      const ardourDeployer = ArdourDeployer.create();

      // Mock a second DAW deployer
      const mockLiveDeployer = {
        dawName: 'Ableton Live',
        version: '12.x',
        deploy: vi.fn().mockResolvedValue({
          success: true,
          dawName: 'Ableton Live',
          outputPath: '/tmp/live.map',
        }),
        isInstalled: vi.fn().mockResolvedValue(true),
        getConfigDirectory: vi.fn().mockResolvedValue('/tmp/live'),
      };

      const deployers = new Map([
        ['ardour', ardourDeployer],
        ['live', mockLiveDeployer],
      ]);

      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour', 'live'],
        deployers,
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour', 'live'],
      };

      const result = await workflow.execute(options);

      expect(result.success).toBe(true);
      expect(result.deployments).toHaveLength(2);
      expect(result.deployments[0].dawName).toBe('Ardour');
      expect(result.deployments[1].dawName).toBe('Ableton Live');
      expect(result.deployments.every(d => d.success)).toBe(true);
    });

    it('should handle dry run mode without side effects', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      const converter = new LaunchControlXL3Converter();
      const deployer = ArdourDeployer.create();
      const deployers = new Map([['ardour', deployer]]);

      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers,
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
        outputDir: '/tmp/dry-run',
        dryRun: true,
      };

      const result = await workflow.execute(options);

      expect(result.success).toBe(true);

      // Verify no files were written
      expect(fs.writeFile).not.toHaveBeenCalled();

      // Verify canonical path was not set
      expect(result.canonicalPath).toBeUndefined();

      // Verify deployment reported as not installed
      expect(result.deployments[0].installed).toBe(false);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle device connection failure', async () => {
      mockDevice.connect.mockRejectedValue(new Error('Device not found'));
      mockDevice.isConnected.mockReturnValue(false);

      const adapter = new LaunchControlXL3Adapter(mockDevice);
      const converter = new LaunchControlXL3Converter();
      const deployer = ArdourDeployer.create();
      const deployers = new Map([['ardour', deployer]]);

      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers,
      });

      // Add error listener to prevent unhandled error event
      workflow.on('error', () => {
        // Intentionally empty - we expect errors in this test
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
      };

      const result = await workflow.execute(options);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Device not found'))).toBe(true);
    });

    it('should handle empty controller slot', async () => {
      mockDevice.readCustomMode.mockResolvedValue(null);

      const adapter = new LaunchControlXL3Adapter(mockDevice);
      const converter = new LaunchControlXL3Converter();
      const deployer = ArdourDeployer.create();
      const deployers = new Map([['ardour', deployer]]);

      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers,
      });

      // Add error listener to prevent unhandled error event
      workflow.on('error', () => {
        // Intentionally empty - we expect errors in this test
      });

      const options: WorkflowOptions = {
        configSlot: 5,
        targets: ['ardour'],
      };

      const result = await workflow.execute(options);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('No configuration found in slot 5'))).toBe(true);
    });

    it('should handle file system errors during deployment', async () => {
      // Reset to success first, then set rejection for this test
      vi.mocked(fs.writeFile).mockClear();
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Disk full'));

      const adapter = new LaunchControlXL3Adapter(mockDevice);
      const converter = new LaunchControlXL3Converter();
      const deployer = ArdourDeployer.create();
      const deployers = new Map([['ardour', deployer]]);

      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers,
      });

      // Add error listener to prevent unhandled error event
      workflow.on('error', () => {
        // Intentionally empty - we expect errors in this test
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
        outputDir: '/tmp/full-disk',
      };

      const result = await workflow.execute(options);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Disk full'))).toBe(true);
    });

    it('should continue workflow even if one DAW deployment fails', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      const converter = new LaunchControlXL3Converter();
      const ardourDeployer = ArdourDeployer.create();

      // Mock a failing deployer
      const failingDeployer = {
        dawName: 'Failing DAW',
        version: '1.x',
        deploy: vi.fn().mockResolvedValue({
          success: false,
          dawName: 'Failing DAW',
          errors: ['Deployment failed'],
        }),
        isInstalled: vi.fn().mockResolvedValue(false),
        getConfigDirectory: vi.fn().mockResolvedValue('/tmp/failing'),
      };

      const deployers = new Map([
        ['failing', failingDeployer],
        ['ardour', ardourDeployer],
      ]);

      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['failing', 'ardour'],
        deployers,
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['failing', 'ardour'],
      };

      const result = await workflow.execute(options);

      // Workflow should partially succeed
      expect(result.deployments).toHaveLength(2);
      expect(result.deployments[0].success).toBe(false);
      expect(result.deployments[1].success).toBe(true);
      expect(result.errors).toContain('Deployment failed');
    });
  });

  describe('Event-Driven Workflow', () => {
    it('should emit events throughout the pipeline', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      const converter = new LaunchControlXL3Converter();
      const deployer = ArdourDeployer.create();
      const deployers = new Map([['ardour', deployer]]);

      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers,
      });

      const events: { type: string; data: any }[] = [];

      workflow.on('progress', (event) => {
        events.push({ type: 'progress', data: event });
      });

      workflow.on('canonical-saved', (event) => {
        events.push({ type: 'canonical-saved', data: event });
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
        outputDir: '/tmp/events',
      };

      await workflow.execute(options);

      // Verify progress events
      const progressEvents = events.filter(e => e.type === 'progress');
      expect(progressEvents.length).toBeGreaterThan(0);

      // Verify canonical-saved event
      const savedEvents = events.filter(e => e.type === 'canonical-saved');
      expect(savedEvents).toHaveLength(1);
      expect(savedEvents[0].data.map).toBeDefined();
      expect(savedEvents[0].data.path).toBeDefined();
    });

    it('should provide detailed progress information', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      const converter = new LaunchControlXL3Converter();
      const deployer = ArdourDeployer.create();
      const deployers = new Map([['ardour', deployer]]);

      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers,
      });

      const progressDetails: Array<{ step: number; message: string; hasData: boolean }> = [];

      workflow.on('progress', ({ step, message, data }) => {
        progressDetails.push({
          step,
          message,
          hasData: data !== undefined,
        });
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
      };

      await workflow.execute(options);

      // Verify each step has progress events
      expect(progressDetails.some(p => p.step === 1)).toBe(true);
      expect(progressDetails.some(p => p.step === 2)).toBe(true);
      expect(progressDetails.some(p => p.step === 3)).toBe(true);
      expect(progressDetails.some(p => p.step === 4)).toBe(true);

      // Verify messages are descriptive
      expect(progressDetails.some(p => p.message.includes('Reading'))).toBe(true);
      expect(progressDetails.some(p => p.message.includes('Converting'))).toBe(true);
      expect(progressDetails.some(p => p.message.includes('Deploying'))).toBe(true);

      // Verify some events include data
      expect(progressDetails.some(p => p.hasData)).toBe(true);
    });
  });

  describe('Canonical Map Validation', () => {
    it('should produce valid canonical MIDI map structure', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      const converter = new LaunchControlXL3Converter();
      const deployer = ArdourDeployer.create();
      const deployers = new Map([['ardour', deployer]]);

      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers,
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
      };

      const result = await workflow.execute(options);

      const map = result.canonicalMap as CanonicalMidiMap;

      // Validate structure
      expect(map.version).toBe('1.0.0');
      expect(map.device).toBeDefined();
      expect(map.device.manufacturer).toBeTruthy();
      expect(map.device.model).toBeTruthy();
      expect(map.metadata).toBeDefined();
      expect(map.metadata.name).toBeTruthy();
      expect(map.metadata.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(map.controls).toBeInstanceOf(Array);

      // Validate all controls have required properties
      map.controls.forEach(control => {
        expect(control.id).toBeTruthy();
        expect(control.name).toBeTruthy();
        expect(control.type).toBeTruthy();
        expect(['encoder', 'slider', 'button', 'button_group']).toContain(control.type);

        if (control.type !== 'button_group') {
          expect(control.cc).toBeGreaterThanOrEqual(0);
          expect(control.cc).toBeLessThanOrEqual(127);
        }
      });
    });
  });
});
