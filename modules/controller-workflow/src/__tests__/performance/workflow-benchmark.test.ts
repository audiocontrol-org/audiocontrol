/**
 * Performance Benchmarks for controller-workflow module
 *
 * Verifies end-to-end workflow completes in <10 seconds and identifies performance bottlenecks.
 * Uses mock adapters for consistent timing without requiring real hardware.
 *
 * Performance Targets:
 * - Controller read: <1s per slot
 * - List all slots: <5s
 * - Conversion: <100ms
 * - Deployment: <500ms per DAW
 * - End-to-end: <10s
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { performance } from 'perf_hooks';
import { DeploymentWorkflow } from '@/orchestrator/DeploymentWorkflow.js';
import { LaunchControlXL3Adapter } from '@/adapters/controllers/LaunchControlXL3Adapter.js';
import { LaunchControlXL3Converter } from '@/converters/LaunchControlXL3Converter.js';
import { ArdourDeployer } from '@/adapters/daws/ArdourDeployer.js';
import type { LaunchControlXL3 } from '@audiocontrol/launch-control-xl3';
import type { CustomMode as LCXL3CustomMode } from '@audiocontrol/launch-control-xl3';
import type { WorkflowOptions } from '@/orchestrator/DeploymentWorkflow.js';
import * as fs from 'node:fs/promises';

// Mock file system for deployment tests
vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  access: vi.fn(),
}));

/**
 * Statistics helper for benchmark results
 */
interface BenchmarkStats {
  min: number;
  max: number;
  avg: number;
  median: number;
  stdDev: number;
  iterations: number;
}

/**
 * Calculate statistics from timing samples
 */
function calculateStats(samples: number[]): BenchmarkStats {
  if (samples.length === 0) {
    throw new Error('No samples provided');
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = samples.reduce((a, b) => a + b, 0);
  const avg = sum / samples.length;

  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  const variance = samples.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / samples.length;
  const stdDev = Math.sqrt(variance);

  return {
    min,
    max,
    avg,
    median,
    stdDev,
    iterations: samples.length,
  };
}

/**
 * Format timing results for console output
 */
function formatTiming(label: string, duration: number, target?: number): string {
  const status = target && duration > target ? '❌ EXCEEDS TARGET' : '✓';
  const targetStr = target ? ` (target: ${target}ms)` : '';
  return `${status} ${label}: ${duration.toFixed(2)}ms${targetStr}`;
}

/**
 * Format statistics for console output
 */
function formatStats(label: string, stats: BenchmarkStats, target?: number): string {
  const status = target && stats.avg > target ? '❌ EXCEEDS TARGET' : '✓';
  const targetStr = target ? ` (target: ${target}ms)` : '';
  return `${status} ${label}:
  Iterations: ${stats.iterations}
  Min: ${stats.min.toFixed(2)}ms
  Max: ${stats.max.toFixed(2)}ms
  Avg: ${stats.avg.toFixed(2)}ms${targetStr}
  Median: ${stats.median.toFixed(2)}ms
  StdDev: ${stats.stdDev.toFixed(2)}ms`;
}

describe('Performance Benchmarks', () => {
  let mockDevice: jest.Mocked<LaunchControlXL3>;
  let sampleLCXL3Mode: LCXL3CustomMode;

  beforeEach(() => {
    // Create realistic LCXL3 custom mode with all 48 controls
    sampleLCXL3Mode = {
      name: 'PerfTest',
      controls: {
        // Row 1: Send A encoders (8 encoders)
        SEND_A1: { name: 'Send A1', type: 'knob', cc: 13, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_A2: { name: 'Send A2', type: 'knob', cc: 14, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_A3: { name: 'Send A3', type: 'knob', cc: 15, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_A4: { name: 'Send A4', type: 'knob', cc: 16, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_A5: { name: 'Send A5', type: 'knob', cc: 17, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_A6: { name: 'Send A6', type: 'knob', cc: 18, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_A7: { name: 'Send A7', type: 'knob', cc: 19, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_A8: { name: 'Send A8', type: 'knob', cc: 20, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },

        // Row 2: Send B encoders (8 encoders)
        SEND_B1: { name: 'Send B1', type: 'knob', cc: 29, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_B2: { name: 'Send B2', type: 'knob', cc: 30, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_B3: { name: 'Send B3', type: 'knob', cc: 31, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_B4: { name: 'Send B4', type: 'knob', cc: 32, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_B5: { name: 'Send B5', type: 'knob', cc: 33, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_B6: { name: 'Send B6', type: 'knob', cc: 34, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_B7: { name: 'Send B7', type: 'knob', cc: 35, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        SEND_B8: { name: 'Send B8', type: 'knob', cc: 36, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },

        // Row 3: Pan encoders (8 encoders)
        PAN1: { name: 'Pan 1', type: 'knob', cc: 49, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        PAN2: { name: 'Pan 2', type: 'knob', cc: 50, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        PAN3: { name: 'Pan 3', type: 'knob', cc: 51, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        PAN4: { name: 'Pan 4', type: 'knob', cc: 52, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        PAN5: { name: 'Pan 5', type: 'knob', cc: 53, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        PAN6: { name: 'Pan 6', type: 'knob', cc: 54, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        PAN7: { name: 'Pan 7', type: 'knob', cc: 55, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        PAN8: { name: 'Pan 8', type: 'knob', cc: 56, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },

        // Faders (8 sliders)
        FADER1: { name: 'Volume 1', type: 'fader', cc: 77, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        FADER2: { name: 'Volume 2', type: 'fader', cc: 78, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        FADER3: { name: 'Volume 3', type: 'fader', cc: 79, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        FADER4: { name: 'Volume 4', type: 'fader', cc: 80, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        FADER5: { name: 'Volume 5', type: 'fader', cc: 81, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        FADER6: { name: 'Volume 6', type: 'fader', cc: 82, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        FADER7: { name: 'Volume 7', type: 'fader', cc: 83, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        FADER8: { name: 'Volume 8', type: 'fader', cc: 84, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },

        // Focus buttons (8 buttons)
        FOCUS1: { name: 'Focus 1', type: 'button', cc: 41, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        FOCUS2: { name: 'Focus 2', type: 'button', cc: 42, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        FOCUS3: { name: 'Focus 3', type: 'button', cc: 43, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        FOCUS4: { name: 'Focus 4', type: 'button', cc: 44, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        FOCUS5: { name: 'Focus 5', type: 'button', cc: 45, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        FOCUS6: { name: 'Focus 6', type: 'button', cc: 46, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        FOCUS7: { name: 'Focus 7', type: 'button', cc: 47, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        FOCUS8: { name: 'Focus 8', type: 'button', cc: 48, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },

        // Control buttons (8 buttons)
        CONTROL1: { name: 'Control 1', type: 'button', cc: 73, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        CONTROL2: { name: 'Control 2', type: 'button', cc: 74, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        CONTROL3: { name: 'Control 3', type: 'button', cc: 75, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        CONTROL4: { name: 'Control 4', type: 'button', cc: 76, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        CONTROL5: { name: 'Control 5', type: 'button', cc: 89, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        CONTROL6: { name: 'Control 6', type: 'button', cc: 90, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        CONTROL7: { name: 'Control 7', type: 'button', cc: 91, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
        CONTROL8: { name: 'Control 8', type: 'button', cc: 92, channel: 0, minValue: 0, maxValue: 127, behavior: 'absolute' },
      },
      metadata: {
        slot: 0,
      },
    };

    // Create mock LCXL3 device with instant responses
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

    // Reset and configure file system mocks for instant responses
    vi.mocked(fs.mkdir).mockClear();
    vi.mocked(fs.writeFile).mockClear();
    vi.mocked(fs.access).mockClear();
    vi.mocked(fs.mkdir).mockResolvedValue(undefined);
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    vi.mocked(fs.access).mockResolvedValue(undefined);
  });

  describe('End-to-End Workflow Performance', () => {
    it('should complete end-to-end workflow in <10s', async () => {
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
        outputDir: '/tmp/perf-test',
        preserveLabels: true,
      };

      const start = performance.now();
      const result = await workflow.execute(options);
      const duration = performance.now() - start;

      console.log('\n' + formatTiming('End-to-End Workflow', duration, 10000));

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(10000); // 10 seconds

      await workflow.cleanup();
    });

    it('should complete end-to-end workflow with multiple iterations (consistency check)', async () => {
      const ITERATIONS = 5;
      const samples: number[] = [];

      const adapter = new LaunchControlXL3Adapter(mockDevice);
      const converter = new LaunchControlXL3Converter();
      const deployer = ArdourDeployer.create();
      const deployers = new Map([['ardour', deployer]]);

      for (let i = 0; i < ITERATIONS; i++) {
        const workflow = await DeploymentWorkflow.create({
          controllerAdapter: adapter,
          targets: ['ardour'],
          deployers,
        });

        const options: WorkflowOptions = {
          configSlot: 0,
          targets: ['ardour'],
          outputDir: `/tmp/perf-test-${i}`,
        };

        const start = performance.now();
        const result = await workflow.execute(options);
        const duration = performance.now() - start;

        samples.push(duration);
        expect(result.success).toBe(true);

        await workflow.cleanup();
      }

      const stats = calculateStats(samples);
      console.log('\n' + formatStats('End-to-End Workflow (multiple iterations)', stats, 10000));

      expect(stats.avg).toBeLessThan(10000);
      expect(stats.max).toBeLessThan(10000);
    });
  });

  describe('Component-Level Performance', () => {
    it('should read single configuration from controller in <1s', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      await adapter.connect();

      const start = performance.now();
      const config = await adapter.readConfiguration(0);
      const duration = performance.now() - start;

      console.log('\n' + formatTiming('Controller Read (single slot)', duration, 1000));

      expect(config).toBeDefined();
      expect(config.controls.length).toBe(48); // Full LCXL3 configuration
      expect(duration).toBeLessThan(1000); // 1 second

      await adapter.disconnect();
    });

    it('should list all 16 configuration slots in <5s', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      await adapter.connect();

      // Mock different configurations in different slots
      mockDevice.readCustomMode.mockImplementation(async (slot: number) => {
        if (slot === 15) {
          return null; // Empty slot
        }
        return {
          ...sampleLCXL3Mode,
          name: `Config ${slot}`,
          metadata: { slot },
        };
      });

      const start = performance.now();
      const slots = await adapter.listConfigurations();
      const duration = performance.now() - start;

      console.log('\n' + formatTiming('List All Slots (16 slots)', duration, 5000));

      expect(slots).toHaveLength(16);
      expect(duration).toBeLessThan(5000); // 5 seconds

      await adapter.disconnect();
    });

    it('should convert LCXL3 to canonical format in <100ms', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      await adapter.connect();
      const config = await adapter.readConfiguration(0);

      const converter = new LaunchControlXL3Converter();

      const start = performance.now();
      const canonicalMap = converter.convert(config, {
        preserveLabels: true,
      });
      const duration = performance.now() - start;

      console.log('\n' + formatTiming('Conversion (LCXL3 → Canonical)', duration, 100));

      expect(canonicalMap).toBeDefined();
      expect(canonicalMap.controls.length).toBe(48);
      expect(duration).toBeLessThan(100); // 100ms

      await adapter.disconnect();
    });

    it('should convert multiple times with consistent performance', async () => {
      const ITERATIONS = 10;
      const samples: number[] = [];

      const adapter = new LaunchControlXL3Adapter(mockDevice);
      await adapter.connect();
      const config = await adapter.readConfiguration(0);
      const converter = new LaunchControlXL3Converter();

      for (let i = 0; i < ITERATIONS; i++) {
        const start = performance.now();
        const canonicalMap = converter.convert(config, { preserveLabels: true });
        const duration = performance.now() - start;

        samples.push(duration);
        expect(canonicalMap).toBeDefined();
      }

      const stats = calculateStats(samples);
      console.log('\n' + formatStats('Conversion (multiple iterations)', stats, 100));

      expect(stats.avg).toBeLessThan(100);

      await adapter.disconnect();
    });

    it('should deploy to Ardour in <500ms', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      await adapter.connect();
      const config = await adapter.readConfiguration(0);

      const converter = new LaunchControlXL3Converter();
      const canonicalMap = converter.convert(config, {});

      const deployer = ArdourDeployer.create();

      const start = performance.now();
      const result = await deployer.deploy(canonicalMap, {
        outputPath: '/tmp/perf-test/ardour.map',
      });
      const duration = performance.now() - start;

      console.log('\n' + formatTiming('Deployment (Ardour)', duration, 500));

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(500); // 500ms

      await adapter.disconnect();
    });

    it('should deploy to multiple DAWs in <1s', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      await adapter.connect();
      const config = await adapter.readConfiguration(0);

      const converter = new LaunchControlXL3Converter();
      const canonicalMap = converter.convert(config, {});

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

      const start = performance.now();

      // Deploy to both DAWs
      const results = await Promise.all([
        ardourDeployer.deploy(canonicalMap, { outputPath: '/tmp/perf-test/ardour.map' }),
        mockLiveDeployer.deploy(canonicalMap, { outputPath: '/tmp/perf-test/live.map' }),
      ]);

      const duration = performance.now() - start;

      console.log('\n' + formatTiming('Deployment (2 DAWs in parallel)', duration, 1000));

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(duration).toBeLessThan(1000); // 1 second for both

      await adapter.disconnect();
    });
  });

  describe('File I/O Performance', () => {
    it('should write canonical YAML efficiently', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      await adapter.connect();
      const config = await adapter.readConfiguration(0);

      const converter = new LaunchControlXL3Converter();
      const canonicalMap = converter.convert(config, {});

      // Import CanonicalMapParser for serialization
      const { CanonicalMapParser } = await import('@audiocontrol/canonical-midi-maps');

      const start = performance.now();
      const yamlContent = CanonicalMapParser.serializeToYAML(canonicalMap);
      const duration = performance.now() - start;

      console.log('\n' + formatTiming('YAML Serialization', duration));

      expect(yamlContent).toBeDefined();
      expect(yamlContent.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should be very fast

      await adapter.disconnect();
    });

    it('should write Ardour XML efficiently', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      await adapter.connect();
      const config = await adapter.readConfiguration(0);

      const converter = new LaunchControlXL3Converter();
      const canonicalMap = converter.convert(config, {});

      // Import Ardour serializer
      const { MidiMapBuilder, ArdourXMLSerializer } = await import('@audiocontrol/ardour-midi-maps');

      const builder = new MidiMapBuilder({ name: 'Test Map' });
      // Add some bindings
      for (const control of canonicalMap.controls.slice(0, 10)) {
        if (control.cc !== undefined) {
          builder.addCCBinding({
            channel: 0,
            controller: control.cc,
            uri: `/plugins/parameter/${control.id}`,
          });
        }
      }
      const ardourMap = builder.build();

      const serializer = new ArdourXMLSerializer();

      const start = performance.now();
      const xmlContent = serializer.serializeMidiMap(ardourMap);
      const duration = performance.now() - start;

      console.log('\n' + formatTiming('Ardour XML Serialization', duration));

      expect(xmlContent).toBeDefined();
      expect(xmlContent.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(100); // Should be very fast

      await adapter.disconnect();
    });
  });

  describe('Memory and Resource Efficiency', () => {
    it('should handle multiple workflow executions without performance degradation', async () => {
      const WARMUP_ITERATIONS = 2;
      const TEST_ITERATIONS = 3;
      const samples: number[] = [];

      const adapter = new LaunchControlXL3Adapter(mockDevice);
      const converter = new LaunchControlXL3Converter();
      const deployer = ArdourDeployer.create();
      const deployers = new Map([['ardour', deployer]]);

      // Warmup iterations to stabilize JIT
      for (let i = 0; i < WARMUP_ITERATIONS; i++) {
        const workflow = await DeploymentWorkflow.create({
          controllerAdapter: adapter,
          targets: ['ardour'],
          deployers,
        });

        await workflow.execute({
          configSlot: 0,
          targets: ['ardour'],
          outputDir: `/tmp/perf-warmup-${i}`,
        });

        await workflow.cleanup();
      }

      // Actual test iterations
      for (let i = 0; i < TEST_ITERATIONS; i++) {
        const workflow = await DeploymentWorkflow.create({
          controllerAdapter: adapter,
          targets: ['ardour'],
          deployers,
        });

        const options: WorkflowOptions = {
          configSlot: 0,
          targets: ['ardour'],
          outputDir: `/tmp/perf-resource-${i}`,
        };

        const start = performance.now();
        await workflow.execute(options);
        const duration = performance.now() - start;

        samples.push(duration);
        await workflow.cleanup();
      }

      const stats = calculateStats(samples);
      console.log('\n' + formatStats('Resource Efficiency (3 iterations, after warmup)', stats));

      // After warmup, performance should be stable
      // Standard deviation should be reasonable relative to average
      const cvPercent = (stats.stdDev / stats.avg) * 100;
      expect(cvPercent).toBeLessThan(50); // Coefficient of variation <50%

      // Check that performance remains fast
      expect(stats.avg).toBeLessThan(10000); // Average under 10s
    });

    it('should process large configurations efficiently', async () => {
      // Create a large configuration with all 48 controls
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      await adapter.connect();

      const start = performance.now();
      const config = await adapter.readConfiguration(0);
      const readDuration = performance.now() - start;

      const converter = new LaunchControlXL3Converter();
      const convertStart = performance.now();
      const canonicalMap = converter.convert(config, { preserveLabels: true });
      const convertDuration = performance.now() - convertStart;

      const deployer = ArdourDeployer.create();
      const deployStart = performance.now();
      const result = await deployer.deploy(canonicalMap, {
        outputPath: '/tmp/perf-large/ardour.map',
      });
      const deployDuration = performance.now() - deployStart;

      console.log('\nLarge Configuration Processing:');
      console.log(formatTiming('  Read (48 controls)', readDuration, 1000));
      console.log(formatTiming('  Convert (48 controls)', convertDuration, 100));
      console.log(formatTiming('  Deploy (48 controls)', deployDuration, 500));

      expect(config.controls.length).toBe(48);
      expect(canonicalMap.controls.length).toBe(48);
      expect(result.success).toBe(true);

      await adapter.disconnect();
    });
  });

  describe('Performance Bottleneck Analysis', () => {
    it('should identify slowest workflow stage', async () => {
      const adapter = new LaunchControlXL3Adapter(mockDevice);
      const converter = new LaunchControlXL3Converter();
      const deployer = ArdourDeployer.create();
      const deployers = new Map([['ardour', deployer]]);

      const workflow = await DeploymentWorkflow.create({
        controllerAdapter: adapter,
        targets: ['ardour'],
        deployers,
      });

      const timings: Record<string, number> = {};

      // Step 1: Read controller
      let start = performance.now();
      await adapter.connect();
      const config = await adapter.readConfiguration(0);
      timings['Read Controller'] = performance.now() - start;

      // Step 2: Convert to canonical
      start = performance.now();
      const canonicalMap = converter.convert(config, { preserveLabels: true });
      timings['Convert to Canonical'] = performance.now() - start;

      // Step 3: Serialize to YAML
      start = performance.now();
      const { CanonicalMapParser } = await import('@audiocontrol/canonical-midi-maps');
      const yamlContent = CanonicalMapParser.serializeToYAML(canonicalMap);
      timings['Serialize to YAML'] = performance.now() - start;

      // Step 4: Deploy to Ardour
      start = performance.now();
      await deployer.deploy(canonicalMap, { outputPath: '/tmp/perf-bottleneck/ardour.map' });
      timings['Deploy to Ardour'] = performance.now() - start;

      console.log('\n=== BOTTLENECK ANALYSIS ===');
      const sortedTimings = Object.entries(timings).sort((a, b) => b[1] - a[1]);
      for (const [stage, duration] of sortedTimings) {
        console.log(formatTiming(`  ${stage}`, duration));
      }

      const totalTime = Object.values(timings).reduce((a, b) => a + b, 0);
      console.log(`\nTotal Time: ${totalTime.toFixed(2)}ms`);
      console.log(`Slowest Stage: ${sortedTimings[0][0]} (${((sortedTimings[0][1] / totalTime) * 100).toFixed(1)}% of total)`);

      await workflow.cleanup();
    });
  });
});
