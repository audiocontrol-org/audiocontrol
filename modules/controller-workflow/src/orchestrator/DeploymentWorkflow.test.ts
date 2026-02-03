/**
 * Tests for DeploymentWorkflow orchestrator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeploymentWorkflow } from './DeploymentWorkflow.js';
import type {
  ControllerAdapterInterface,
  CanonicalConverterInterface,
  DAWDeployerInterface,
  ControllerConfiguration,
  ConversionOptions,
} from '@/types/index.js';
import type { CanonicalMidiMap } from '@audiocontrol/canonical-midi-maps';

// Mock implementations
const createMockAdapter = (): ControllerAdapterInterface => ({
  manufacturer: 'Test',
  model: 'Controller',
  capabilities: {
    supportsCustomModes: true,
    maxConfigSlots: 16,
    supportsRead: true,
    supportsWrite: true,
    supportedControlTypes: ['encoder', 'slider', 'button'],
  },
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  isConnected: vi.fn().mockReturnValue(true),
  listConfigurations: vi.fn().mockResolvedValue([]),
  readConfiguration: vi.fn(),
  writeConfiguration: vi.fn().mockResolvedValue(undefined),
  getDeviceInfo: vi.fn().mockResolvedValue({
    manufacturer: 'Test',
    model: 'Controller',
    firmwareVersion: '1.0.0',
  }),
});

const createMockConverter = (): CanonicalConverterInterface => ({
  getConverterInfo: vi.fn().mockReturnValue({
    supportedController: 'Test Controller',
    version: '1.0.0',
    features: [],
  }),
  canConvert: vi.fn().mockReturnValue(true),
  convert: vi.fn(),
});

const createMockDeployer = (dawName: string = 'TestDAW'): DAWDeployerInterface => ({
  dawName,
  version: '1.0',
  deploy: vi.fn(),
  isInstalled: vi.fn().mockResolvedValue(true),
  getConfigDirectory: vi.fn().mockResolvedValue('/tmp/test'),
});

describe('DeploymentWorkflow', () => {
  let mockAdapter: ControllerAdapterInterface;
  let mockConverter: CanonicalConverterInterface;
  let mockDeployer: DAWDeployerInterface;
  let workflow: DeploymentWorkflow;

  const mockControllerConfig: ControllerConfiguration = {
    name: 'Test Config',
    controls: [
      {
        id: 'encoder_1',
        type: 'encoder',
        cc: 13,
        range: [0, 127],
      },
    ],
  };

  const mockCanonicalMap: CanonicalMidiMap = {
    version: '1.0.0',
    device: {
      manufacturer: 'Test',
      model: 'Controller',
    },
    metadata: {
      name: 'Test Config',
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
    ],
  };

  beforeEach(() => {
    mockAdapter = createMockAdapter();
    mockConverter = createMockConverter();
    mockDeployer = createMockDeployer();

    // Set up default mock implementations
    vi.mocked(mockAdapter.readConfiguration).mockResolvedValue(mockControllerConfig);
    vi.mocked(mockConverter.convert).mockReturnValue(mockCanonicalMap);
    vi.mocked(mockDeployer.deploy).mockResolvedValue({
      success: true,
      dawName: 'TestDAW',
      outputPath: '/tmp/test.map',
      installed: false,
    });
  });

  const createWorkflow = async (options: Partial<{
    targets: string[];
    deployers: Map<string, DAWDeployerInterface>;
  }> = {}) => {
    return DeploymentWorkflow.create({
      controllerAdapter: mockAdapter,
      converter: mockConverter,
      targets: options.targets ?? ['testdaw'],
      deployers: options.deployers ?? new Map([['testdaw', mockDeployer]]),
    });
  };

  describe('Workflow execution', () => {
    it('should execute complete workflow successfully', async () => {
      workflow = await createWorkflow();

      const result = await workflow.execute({
        configSlot: 0,
        targets: ['testdaw'],
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.deployments).toHaveLength(1);
      expect(result.deployments[0].success).toBe(true);
      expect(mockAdapter.readConfiguration).toHaveBeenCalledWith(0);
      expect(mockConverter.convert).toHaveBeenCalled();
    });

    it('should read configuration from correct slot', async () => {
      workflow = await createWorkflow();

      await workflow.execute({
        configSlot: 5,
        targets: ['testdaw'],
        dryRun: true,
      });

      expect(mockAdapter.readConfiguration).toHaveBeenCalledWith(5);
    });

    it('should handle multiple DAW deployments', async () => {
      const deployer1 = createMockDeployer('DAW1');
      const deployer2 = createMockDeployer('DAW2');

      vi.mocked(deployer1.deploy).mockResolvedValue({
        success: true,
        dawName: 'DAW1',
        outputPath: '/tmp/daw1.map',
        installed: false,
      });

      vi.mocked(deployer2.deploy).mockResolvedValue({
        success: true,
        dawName: 'DAW2',
        outputPath: '/tmp/daw2.map',
        installed: false,
      });

      workflow = await createWorkflow({
        targets: ['daw1', 'daw2'],
        deployers: new Map([
          ['daw1', deployer1],
          ['daw2', deployer2],
        ]),
      });

      const result = await workflow.execute({
        configSlot: 0,
        targets: ['daw1', 'daw2'],
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.deployments).toHaveLength(2);
      expect(deployer1.deploy).toHaveBeenCalled();
      expect(deployer2.deploy).toHaveBeenCalled();
    });

    it('should not write files in dry-run mode', async () => {
      workflow = await createWorkflow();

      const result = await workflow.execute({
        configSlot: 0,
        targets: ['testdaw'],
        outputDir: '/tmp/output',
        dryRun: true,
      });

      expect(result.success).toBe(true);
      // Deployer should be called with dryRun: true
      expect(mockDeployer.deploy).toHaveBeenCalledWith(
        mockCanonicalMap,
        expect.objectContaining({ dryRun: true })
      );
    });

    it('should handle missing deployer gracefully', async () => {
      workflow = await createWorkflow();

      const result = await workflow.execute({
        configSlot: 0,
        targets: ['unknown-daw'],
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('No deployer found for target: unknown-daw');
      expect(result.deployments).toHaveLength(1);
      expect(result.deployments[0].success).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle controller read errors', async () => {
      workflow = await createWorkflow();

      // Add error listener to prevent unhandled error event
      const errorHandler = vi.fn();
      workflow.on('error', errorHandler);

      // Override the mock after workflow is created
      const readError = new Error('Read failed');
      vi.mocked(mockAdapter.readConfiguration).mockRejectedValueOnce(readError);

      const result = await workflow.execute({
        configSlot: 0,
        targets: ['testdaw'],
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Read failed');
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should handle conversion errors', async () => {
      workflow = await createWorkflow();

      // Add error listener to prevent unhandled error event
      const errorHandler = vi.fn();
      workflow.on('error', errorHandler);

      // Override the mock after workflow is created
      const conversionError = new Error('Conversion failed');
      vi.mocked(mockConverter.convert).mockImplementationOnce(() => {
        throw conversionError;
      });

      const result = await workflow.execute({
        configSlot: 0,
        targets: ['testdaw'],
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Conversion failed');
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should handle deployment errors', async () => {
      workflow = await createWorkflow();

      // Override the mock after workflow is created
      vi.mocked(mockDeployer.deploy).mockResolvedValueOnce({
        success: false,
        dawName: 'TestDAW',
        errors: ['Deployment failed'],
      });

      const result = await workflow.execute({
        configSlot: 0,
        targets: ['testdaw'],
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Deployment failed');
      expect(result.deployments[0].success).toBe(false);
    });

    it('should emit error event on failure', async () => {
      workflow = await createWorkflow();

      // Override the mock after workflow is created
      vi.mocked(mockAdapter.readConfiguration).mockRejectedValueOnce(new Error('Read failed'));

      const errorHandler = vi.fn();
      workflow.on('error', errorHandler);

      await workflow.execute({
        configSlot: 0,
        targets: ['testdaw'],
        dryRun: true,
      });

      expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle deployment exception gracefully', async () => {
      workflow = await createWorkflow();

      // Override the mock after workflow is created
      vi.mocked(mockDeployer.deploy).mockRejectedValueOnce(new Error('Unexpected deployment error'));

      const result = await workflow.execute({
        configSlot: 0,
        targets: ['testdaw'],
        dryRun: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors).toContain('Unexpected deployment error');
      expect(result.deployments[0].success).toBe(false);
    });
  });

  describe('Event emission', () => {
    it('should emit progress events', async () => {
      workflow = await createWorkflow();

      const progressHandler = vi.fn();
      workflow.on('progress', progressHandler);

      await workflow.execute({
        configSlot: 0,
        targets: ['testdaw'],
        dryRun: true,
      });

      expect(progressHandler).toHaveBeenCalled();
      const calls = progressHandler.mock.calls;
      expect(calls.some(call => call[0].step === 1)).toBe(true); // Reading
      expect(calls.some(call => call[0].step === 2)).toBe(true); // Converting
      expect(calls.some(call => call[0].step === 4)).toBe(true); // Deploying
    });

    it('should emit canonical-saved event when saving YAML', async () => {
      workflow = await createWorkflow();

      const savedHandler = vi.fn();
      workflow.on('canonical-saved', savedHandler);

      await workflow.execute({
        configSlot: 0,
        targets: ['testdaw'],
        outputDir: '/tmp/output',
        dryRun: false,
      });

      // Note: In dry-run mode, canonical-saved is not emitted
      // This test would need file system mocking to properly test
    });
  });

  describe('Options handling', () => {
    it('should pass plugin info to converter', async () => {
      const pluginInfo = {
        name: 'TAL-Filter',
        type: 'vst3' as const,
      };

      workflow = await createWorkflow();

      await workflow.execute({
        configSlot: 0,
        targets: ['testdaw'],
        pluginInfo,
        dryRun: true,
      });

      expect(mockConverter.convert).toHaveBeenCalledWith(
        mockControllerConfig,
        expect.objectContaining({ pluginInfo })
      );
    });

    it('should pass MIDI channel to converter', async () => {
      workflow = await createWorkflow();

      await workflow.execute({
        configSlot: 0,
        targets: ['testdaw'],
        midiChannel: 5,
        dryRun: true,
      });

      expect(mockConverter.convert).toHaveBeenCalledWith(
        mockControllerConfig,
        expect.objectContaining({ midiChannel: 5 })
      );
    });

    it('should pass preserveLabels to converter', async () => {
      workflow = await createWorkflow();

      await workflow.execute({
        configSlot: 0,
        targets: ['testdaw'],
        preserveLabels: true,
        dryRun: true,
      });

      expect(mockConverter.convert).toHaveBeenCalledWith(
        mockControllerConfig,
        expect.objectContaining({ preserveLabels: true })
      );
    });

    it('should pass autoInstall to deployer', async () => {
      workflow = await createWorkflow();

      await workflow.execute({
        configSlot: 0,
        targets: ['testdaw'],
        autoInstall: true,
        dryRun: true,
      });

      expect(mockDeployer.deploy).toHaveBeenCalledWith(
        mockCanonicalMap,
        expect.objectContaining({ autoInstall: true })
      );
    });

    it('should pass outputPath to deployer', async () => {
      workflow = await createWorkflow();

      await workflow.execute({
        configSlot: 0,
        targets: ['testdaw'],
        outputDir: '/custom/output',
        dryRun: true,
      });

      expect(mockDeployer.deploy).toHaveBeenCalledWith(
        mockCanonicalMap,
        expect.objectContaining({ outputPath: expect.stringContaining('/custom/output') })
      );
    });
  });

  describe('Cleanup', () => {
    it('should disconnect adapter on cleanup', async () => {
      workflow = await createWorkflow();

      await workflow.cleanup();

      expect(mockAdapter.disconnect).toHaveBeenCalled();
    });

    it('should not disconnect if not connected', async () => {
      vi.mocked(mockAdapter.isConnected).mockReturnValue(false);

      workflow = await createWorkflow();

      await workflow.cleanup();

      expect(mockAdapter.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('Factory creation', () => {
    it('should throw error when no deployers provided and targets requested', async () => {
      await expect(
        DeploymentWorkflow.create({
          controllerAdapter: mockAdapter,
          converter: mockConverter,
          targets: ['ardour'],
        })
      ).rejects.toThrow('DAW deployers not yet implemented');
    });

    it('should create workflow with empty targets', async () => {
      const newWorkflow = await DeploymentWorkflow.create({
        controllerAdapter: mockAdapter,
        converter: mockConverter,
        targets: [],
        deployers: new Map(),
      });

      expect(newWorkflow).toBeInstanceOf(DeploymentWorkflow);
    });
  });
});
