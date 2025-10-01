/**
 * Unit Tests for Real Device Fixtures
 *
 * Tests parsing and validation of real device backup fixtures.
 * Validates protocol compliance with actual hardware data.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CustomModeManager } from '@/modes/CustomModeManager.js';
import { DeviceManager } from '@/device/DeviceManager.js';
import { promises as fs } from 'fs';
import { join } from 'path';

describe('Real Device Fixtures', () => {
  let customModeManager: CustomModeManager;
  let mockDeviceManager: Partial<DeviceManager>;

  beforeEach(() => {
    mockDeviceManager = {
      readCustomMode: vi.fn(),
      writeCustomMode: vi.fn(),
      on: vi.fn(),
    };

    customModeManager = new CustomModeManager({
      deviceManager: mockDeviceManager as DeviceManager,
      autoSync: false,
    });
  });

  it('should parse real device fixture data', async () => {
    // Load most recent backup fixture
    const backupDir = join(__dirname, '../../backup');
    const files = await fs.readdir(backupDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    if (jsonFiles.length === 0) {
      console.warn('No backup fixtures found - run: npm run backup');
      return; // Skip test if no fixtures
    }

    const latestFixture = jsonFiles.sort().reverse()[0];
    const fixturePath = join(backupDir, latestFixture);
    const fixtureData = JSON.parse(await fs.readFile(fixturePath, 'utf-8'));

    // Mock DeviceManager to return real fixture data
    (mockDeviceManager.readCustomMode as any).mockResolvedValue(fixtureData);

    const mode = await customModeManager.readMode(0);

    // Validate parsed successfully
    expect(mode).toBeDefined();
    expect(mode.name).toBeDefined();
    expect(mode.name.length).toBeGreaterThan(0);
    expect(mode.name.length).toBeLessThanOrEqual(8); // Max 8 chars per protocol

    // Should have controls parsed
    const controlCount = Object.keys(mode.controls).length;
    expect(controlCount).toBeGreaterThan(0);
    expect(controlCount).toBeLessThanOrEqual(48); // Max 48 controls per protocol

    // Validate control structure
    for (const [controlKey, control] of Object.entries(mode.controls)) {
      expect(control.type).toMatch(/^(knob|fader|button)$/);
      expect(control.channel).toBeGreaterThanOrEqual(0);
      expect(control.channel).toBeLessThanOrEqual(15);
      expect(control.cc).toBeGreaterThanOrEqual(0);
      expect(control.cc).toBeLessThanOrEqual(127);
    }
  });

  it('should handle both array and object control formats', async () => {
    const testCases = [
      {
        name: 'Array Format',
        controls: [
          { controlId: 0x10, channel: 0, ccNumber: 10, behaviour: 'absolute' },
        ],
      },
      {
        name: 'Object Format',
        controls: {
          '0x10': { controlId: 0x10, channel: 0, ccNumber: 10, behaviour: 'absolute' },
        },
      },
    ];

    for (const testCase of testCases) {
      (mockDeviceManager.readCustomMode as any).mockResolvedValue(testCase);

      const mode = await customModeManager.readMode(0);

      expect(mode.controls).toBeDefined();
      expect(Object.keys(mode.controls).length).toBeGreaterThan(0);
    }
  });
});
