/**
 * Unit tests for DeploymentWorkflow
 *
 * Tests the orchestration of controller interrogation, conversion, and deployment.
 * Uses dependency injection for all components (no module stubbing).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { DeploymentWorkflow } from '@/orchestrator/DeploymentWorkflow.js';
import type {
  ControllerAdapterInterface,
  CanonicalConverterInterface,
  DAWDeployerInterface,
  ControllerConfiguration,
  ControllerCapabilities,
  ConfigurationSlot,
  DeviceInfo,
} from '@/types/index.js';
import type { CanonicalMidiMap } from '@audiocontrol/canonical-midi-maps';
import type { WorkflowOptions, ProgressEvent, CanonicalSavedEvent } from '@/orchestrator/DeploymentWorkflow.js';

describe('DeploymentWorkflow', () => {
  let mockAdapter: jest.Mocked<ControllerAdapterInterface>;
  let mockConverter: jest.Mocked<CanonicalConverterInterface>;
  let mockDeployer: jest.Mocked<DAWDeployerInterface>;
  let mockCanonicalMap: CanonicalMidiMap;
  let mockControllerConfig: ControllerConfiguration;
  let deployers: Map<string, DAWDeployerInterface>;

  beforeEach(() => {
    // Mock controller configuration
    mockControllerConfig = {
      name: 'Test Mode',
      controls: [
        { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: 13, channel: 0 },
        { id: 'FADER1', name: 'Fader 1', type: 'slider', cc: 77, channel: 0 },
      ],
    };

    // Mock canonical map
    mockCanonicalMap = {
      version: '1.0.0',
      device: {
        manufacturer: 'Novation',
        model: 'Launch Control XL 3',
      },
      metadata: {
        name: 'Test Mode',
        description: 'Test MIDI map',
        date: '2025-10-05',
      },
      controls: [
        { id: 'encoder_1', name: 'Send A1', type: 'encoder', cc: 13, channel: 0 },
        { id: 'slider_1', name: 'Fader 1', type: 'slider', cc: 77, channel: 0 },
      ],
    };

    // Mock controller adapter
    const capabilities: ControllerCapabilities = {
      supportsCustomModes: true,
      maxConfigSlots: 16,
      supportsRead: true,
      supportsWrite: true,
      supportedControlTypes: ['encoder', 'slider', 'button'],
    };

    mockAdapter = {
      manufacturer: 'Novation',
      model: 'Launch Control XL 3',
      capabilities,
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      listConfigurations: vi.fn().mockResolvedValue([]),
      readConfiguration: vi.fn().mockResolvedValue(mockControllerConfig),
      writeConfiguration: vi.fn().mockResolvedValue(undefined),
      getDeviceInfo: vi.fn().mockResolvedValue({
        manufacturer: 'Novation',
        model: 'Launch Control XL 3',
        firmwareVersion: '1.0.0',
      } as DeviceInfo),
    } as jest.Mocked<ControllerAdapterInterface>;

    // Mock canonical converter
    mockConverter = {
      getConverterInfo: vi.fn().mockReturnValue({
        supportedController: 'Novation Launch Control XL 3',
        version: '1.0.0',
        features: ['custom-modes'],
      }),
      canConvert: vi.fn().mockReturnValue(true),
      convert: vi.fn().mockReturnValue(mockCanonicalMap),
    } as jest.Mocked<CanonicalConverterInterface>;

    // Mock DAW deployer
    mockDeployer = {
      dawName: 'Ardour',
      version: '8.x',
      deploy: vi.fn().mockResolvedValue({
        success: true,
        dawName: 'Ardour',
        outputPath: '/test/output.map',
        installed: false,
      }),
      isInstalled: vi.fn().mockResolvedValue(true),
      getConfigDirectory: vi.fn().mockResolvedValue('/test/config'),
    } as jest.Mocked<DAWDeployerInterface>;

    deployers = new Map([['ardour', mockDeployer]]);
  });

  describe('create', () => {
    it('should create workflow with provided dependencies', async () => {
      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: mockAdapter,
        targets: ['ardour'],
        deployers,
      });

      expect(workflow).toBeInstanceOf(DeploymentWorkflow);
    });

    it('should throw error when no deployers provided and targets specified', async () => {
      await expect(
        DeploymentWorkflow.create({
          controllerAdapter: mockAdapter,
          targets: ['ardour'],
        }),
      ).rejects.toThrow('DAW deployers not yet implemented');
    });

    it('should succeed when no targets specified', async () => {
      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: mockAdapter,
        targets: [],
      });

      expect(workflow).toBeInstanceOf(DeploymentWorkflow);
    });
  });

  describe('execute', () => {
    let workflow: DeploymentWorkflow;
    let tempDir: string | undefined;

    beforeEach(async () => {
      workflow = await DeploymentWorkflow.create({
        controllerAdapter: mockAdapter,
        converter: mockConverter,
        targets: ['ardour'],
        deployers,
      });
    });

    afterEach(async () => {
      // Clean up temporary directory if it was created
      if (tempDir) {
        try {
          await rm(tempDir, { recursive: true, force: true });
        } catch (error) {
          // Ignore cleanup errors
        }
        tempDir = undefined;
      }
    });

    it('should execute complete workflow successfully', async () => {
      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
      };

      const result = await workflow.execute(options);

      expect(result.success).toBe(true);
      expect(result.controllerConfig).toEqual(mockControllerConfig);
      expect(result.canonicalMap).toEqual(mockCanonicalMap);
      expect(result.deployments).toHaveLength(1);
      expect(result.deployments[0].success).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should emit progress events for all 4 steps', async () => {
      const progressEvents: ProgressEvent[] = [];
      workflow.on('progress', (event: ProgressEvent) => {
        progressEvents.push(event);
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
      };

      await workflow.execute(options);

      // Should have events for steps 1, 2, 3, and 4 (some steps emit multiple events)
      expect(progressEvents.length).toBeGreaterThanOrEqual(4);
      expect(progressEvents.some(e => e.step === 1)).toBe(true);
      expect(progressEvents.some(e => e.step === 2)).toBe(true);
      expect(progressEvents.some(e => e.step === 3)).toBe(true);
      expect(progressEvents.some(e => e.step === 4)).toBe(true);
    });

    it('should connect to controller if not connected', async () => {
      mockAdapter.isConnected.mockReturnValue(false);

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
      };

      await workflow.execute(options);

      expect(mockAdapter.connect).toHaveBeenCalled();
    });

    it('should not connect if already connected', async () => {
      mockAdapter.isConnected.mockReturnValue(true);

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
      };

      await workflow.execute(options);

      expect(mockAdapter.connect).not.toHaveBeenCalled();
    });

    it('should read configuration from specified slot', async () => {
      const options: WorkflowOptions = {
        configSlot: 5,
        targets: ['ardour'],
      };

      await workflow.execute(options);

      expect(mockAdapter.readConfiguration).toHaveBeenCalledWith(5);
    });

    it('should convert with provided plugin info', async () => {
      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
        pluginInfo: {
          name: 'Test Plugin',
          manufacturer: 'Test Vendor',
        },
      };

      await workflow.execute(options);

      expect(mockConverter.convert).toHaveBeenCalledWith(
        mockControllerConfig,
        expect.objectContaining({
          pluginInfo: {
            name: 'Test Plugin',
            manufacturer: 'Test Vendor',
          },
        }),
      );
    });

    it('should convert with MIDI channel override', async () => {
      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
        midiChannel: 7,
      };

      await workflow.execute(options);

      expect(mockConverter.convert).toHaveBeenCalledWith(
        mockControllerConfig,
        expect.objectContaining({
          midiChannel: 7,
        }),
      );
    });

    it('should preserve labels when specified', async () => {
      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
        preserveLabels: true,
      };

      await workflow.execute(options);

      expect(mockConverter.convert).toHaveBeenCalledWith(
        mockControllerConfig,
        expect.objectContaining({
          preserveLabels: true,
        }),
      );
    });

    it('should save canonical YAML when output directory specified', async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'workflow-test-'));

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
        outputDir: tempDir,
      };

      const result = await workflow.execute(options);

      expect(result.canonicalPath).toBeDefined();
      expect(result.canonicalPath).toContain(tempDir);
      expect(result.canonicalPath).toMatch(/\.yaml$/);
    });

    it('should emit canonical-saved event when YAML saved', async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'workflow-test-'));

      let savedEvent: CanonicalSavedEvent | undefined;
      workflow.on('canonical-saved', (event: CanonicalSavedEvent) => {
        savedEvent = event;
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
        outputDir: tempDir,
      };

      await workflow.execute(options);

      expect(savedEvent).toBeDefined();
      expect(savedEvent?.map).toEqual(mockCanonicalMap);
      expect(savedEvent?.path).toBeDefined();
    });

    it('should skip canonical YAML save in dry run mode', async () => {
      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
        outputDir: '/test/output',
        dryRun: true,
      };

      const result = await workflow.execute(options);

      expect(result.canonicalPath).toBeUndefined();
    });

    it('should deploy to all specified targets', async () => {
      const mockDeployer2 = { ...mockDeployer, dawName: 'Live' };
      deployers.set('live', mockDeployer2);

      workflow = await DeploymentWorkflow.create({
        controllerAdapter: mockAdapter,
        converter: mockConverter,
        targets: ['ardour', 'live'],
        deployers,
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour', 'live'],
      };

      const result = await workflow.execute(options);

      expect(result.deployments).toHaveLength(2);
      expect(mockDeployer.deploy).toHaveBeenCalled();
      expect(mockDeployer2.deploy).toHaveBeenCalled();
    });

    it('should pass deployment options to deployers', async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'workflow-test-'));

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
        outputDir: tempDir,
        autoInstall: true,
        dryRun: false,
      };

      await workflow.execute(options);

      expect(mockDeployer.deploy).toHaveBeenCalledWith(
        mockCanonicalMap,
        expect.objectContaining({
          autoInstall: true,
          outputPath: expect.stringContaining('/ardour'),
          dryRun: false,
        }),
      );
    });

    it('should handle deployment errors gracefully', async () => {
      mockDeployer.deploy.mockResolvedValue({
        success: false,
        dawName: 'Ardour',
        errors: ['Deployment failed'],
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
      };

      const result = await workflow.execute(options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Deployment failed');
      expect(result.deployments[0].success).toBe(false);
    });

    it('should handle missing deployer for target', async () => {
      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['nonexistent'],
      };

      const result = await workflow.execute(options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No deployer found for target: nonexistent');
      expect(result.deployments[0].success).toBe(false);
    });

    it('should handle controller read errors', async () => {
      // Add error listener to prevent unhandled error event
      const errorHandler = vi.fn();
      workflow.on('error', errorHandler);

      mockAdapter.readConfiguration.mockRejectedValue(new Error('SysEx timeout'));

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
      };

      const result = await workflow.execute(options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('SysEx timeout');
      expect(result.controllerConfig).toBeUndefined();
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should handle empty configuration', async () => {
      // Add error listener to prevent unhandled error event
      const errorHandler = vi.fn();
      workflow.on('error', errorHandler);

      mockAdapter.readConfiguration.mockResolvedValue({
        name: 'Empty',
        controls: [],
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
      };

      const result = await workflow.execute(options);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('No valid configuration'))).toBe(true);
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should handle conversion errors', async () => {
      // Add error listener to prevent unhandled error event
      const errorHandler = vi.fn();
      workflow.on('error', errorHandler);

      mockConverter.canConvert.mockReturnValue(false);

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
      };

      const result = await workflow.execute(options);

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('cannot be converted'))).toBe(true);
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should emit error event on failure', async () => {
      let errorEvent: Error | undefined;
      workflow.on('error', (error: Error) => {
        errorEvent = error;
      });

      mockAdapter.readConfiguration.mockRejectedValue(new Error('Test error'));

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
      };

      await workflow.execute(options);

      expect(errorEvent).toBeDefined();
      expect(errorEvent?.message).toContain('Test error');
    });

    it('should handle deployer exceptions', async () => {
      mockDeployer.deploy.mockRejectedValue(new Error('Deploy exception'));

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
      };

      const result = await workflow.execute(options);

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Deploy exception');
      expect(result.deployments[0].success).toBe(false);
    });

    it('should continue deploying after one deployer fails', async () => {
      const mockDeployer2 = {
        ...mockDeployer,
        dawName: 'Live',
        deploy: vi.fn().mockResolvedValue({
          success: true,
          dawName: 'Live',
          outputPath: '/test/live.map',
        }),
      } as jest.Mocked<DAWDeployerInterface>;

      deployers.set('live', mockDeployer2);
      mockDeployer.deploy.mockResolvedValue({
        success: false,
        dawName: 'Ardour',
        errors: ['Ardour failed'],
      });

      workflow = await DeploymentWorkflow.create({
        controllerAdapter: mockAdapter,
        converter: mockConverter,
        targets: ['ardour', 'live'],
        deployers,
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour', 'live'],
      };

      const result = await workflow.execute(options);

      expect(result.deployments).toHaveLength(2);
      expect(result.deployments[0].success).toBe(false);
      expect(result.deployments[1].success).toBe(true);
    });

    it('should sanitize canonical filename from map name', async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'workflow-test-'));

      mockCanonicalMap.metadata.name = 'Test Map (Special #1)';
      mockConverter.convert.mockReturnValue(mockCanonicalMap);

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
        outputDir: tempDir,
      };

      const result = await workflow.execute(options);

      expect(result.canonicalPath).toMatch(/test-map-special-1\.yaml$/);
    });
  });

  describe('cleanup', () => {
    it('should disconnect from controller when connected', async () => {
      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: mockAdapter,
        targets: [],
      });

      mockAdapter.isConnected.mockReturnValue(true);

      await workflow.cleanup();

      expect(mockAdapter.disconnect).toHaveBeenCalled();
    });

    it('should not disconnect when not connected', async () => {
      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: mockAdapter,
        targets: [],
      });

      mockAdapter.isConnected.mockReturnValue(false);

      await workflow.cleanup();

      expect(mockAdapter.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('progress event data', () => {
    let workflow: DeploymentWorkflow;

    beforeEach(async () => {
      workflow = await DeploymentWorkflow.create({
        controllerAdapter: mockAdapter,
        converter: mockConverter,
        targets: ['ardour'],
        deployers,
      });
    });

    it('should include control count in step 1 progress data', async () => {
      const progressEvents: ProgressEvent[] = [];
      workflow.on('progress', (event: ProgressEvent) => {
        progressEvents.push(event);
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
      };

      await workflow.execute(options);

      const step1Events = progressEvents.filter(e => e.step === 1);
      const successEvent = step1Events.find(e => e.data !== undefined);

      expect(successEvent).toBeDefined();
      expect(successEvent?.data).toHaveProperty('controlCount', 2);
    });

    it('should include control count in step 2 progress message', async () => {
      const progressEvents: ProgressEvent[] = [];
      workflow.on('progress', (event: ProgressEvent) => {
        progressEvents.push(event);
      });

      const options: WorkflowOptions = {
        configSlot: 0,
        targets: ['ardour'],
      };

      await workflow.execute(options);

      const step2Events = progressEvents.filter(e => e.step === 2);
      const successEvent = step2Events.find(e => e.message.includes('controls'));

      expect(successEvent).toBeDefined();
      expect(successEvent?.message).toContain('2 controls');
    });
  });
});
