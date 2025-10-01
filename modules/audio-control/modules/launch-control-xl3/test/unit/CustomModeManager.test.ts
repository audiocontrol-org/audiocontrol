/**
 * Unit Tests for CustomModeManager
 *
 * Tests custom mode loading/saving, mode slot management, mode data validation,
 * control mapping within modes, mode switching, and error handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CustomModeManager, CONTROL_IDS, LED_COLORS } from '@/modes/CustomModeManager.js';
import { DeviceManager } from '@/device/DeviceManager.js';
import { CustomMode, CustomModeSlot, ControlBehaviour, ControlType } from '@/types/index.js';
import { setupFakeTimers, DeterministicMidiBackend } from '../../test/helpers/test-utils.js';

describe('CustomModeManager', () => {
  setupFakeTimers();

  let customModeManager: CustomModeManager;
  let mockDeviceManager: Partial<DeviceManager>;
  let readCustomModeSpy: ReturnType<typeof vi.fn>;
  let writeCustomModeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    readCustomModeSpy = vi.fn();
    writeCustomModeSpy = vi.fn();

    mockDeviceManager = {
      readCustomMode: readCustomModeSpy,
      writeCustomMode: writeCustomModeSpy,
      on: vi.fn(),
    };

    customModeManager = new CustomModeManager({
      deviceManager: mockDeviceManager as DeviceManager,
      autoSync: false, // Disable for unit tests
      cacheTimeout: 300000,
    });
  });

  afterEach(() => {
    customModeManager.cleanup();
  });

  describe('Mode Slot Management', () => {
    it('should validate slot numbers correctly', async () => {
      const validSlots = [0, 7, 15];
      const invalidSlots = [-1, 16, 100];

      // Valid slots should not throw
      for (const slot of validSlots) {
        readCustomModeSpy.mockResolvedValue({
          name: `Mode ${slot}`,
          controls: [],
          colors: [],
        });

        await expect(customModeManager.readMode(slot as CustomModeSlot))
          .resolves.toBeDefined();
      }

      // Invalid slots should throw
      for (const slot of invalidSlots) {
        await expect(customModeManager.readMode(slot as CustomModeSlot))
          .rejects.toThrow(`Invalid slot number: ${slot}. Must be 0-15.`);
      }
    });

    it('should handle all 16 available slots', () => {
      for (let slot = 0; slot < 16; slot++) {
        expect(() => {
          // This will call validateSlot internally
          customModeManager.createDefaultMode(`Test Mode ${slot}`);
        }).not.toThrow();
      }
    });
  });

  describe('Custom Mode Loading', () => {
    it('should read mode from device successfully', async () => {
      const mockDeviceResponse = {
        name: 'Test Mode',
        controls: [
          {
            controlId: CONTROL_IDS.SEND_A1,
            channel: 5,
            ccNumber: 100,
            minValue: 10,
            maxValue: 90,
            behaviour: 'absolute',
          },
        ],
        colors: [
          {
            controlId: CONTROL_IDS.FOCUS1,
            color: LED_COLORS.GREEN_FULL,
            behaviour: 'static',
          },
        ],
      };

      readCustomModeSpy.mockResolvedValue(mockDeviceResponse);

      const onModeLoaded = vi.fn();
      customModeManager.on('mode:loaded', onModeLoaded);

      const mode = await customModeManager.readMode(3);

      expect(readCustomModeSpy).toHaveBeenCalledWith(3);
      expect(mode.name).toBe('Test Mode');
      expect(mode.controls.SEND_A1).toBeDefined();
      expect(mode.controls.SEND_A1.channel).toBe(5);
      expect(mode.controls.SEND_A1.cc).toBe(100);
      expect(onModeLoaded).toHaveBeenCalledWith(3, mode);
    });

    it('should handle mode with no controls or colors', async () => {
      const mockDeviceResponse = {
        name: 'Empty Mode',
        controls: [],
        colors: [],
      };

      readCustomModeSpy.mockResolvedValue(mockDeviceResponse);

      const mode = await customModeManager.readMode(0);

      expect(mode.name).toBe('Empty Mode');
      expect(Object.keys(mode.controls)).toHaveLength(0);
      expect(mode.leds?.size).toBe(0);
    });

    it('should use default name when none provided', async () => {
      const mockDeviceResponse = {
        controls: [],
        colors: [],
      };

      readCustomModeSpy.mockResolvedValue(mockDeviceResponse);

      const mode = await customModeManager.readMode(5);

      expect(mode.name).toBe('Custom 6'); // Slot 5 = Display slot 6
    });

    it('should map control IDs from numeric to string format', async () => {
      const mockDeviceResponse = {
        name: 'Control Mapping Test',
        controls: [
          {
            controlId: CONTROL_IDS.SEND_B3, // 0x1F
            channel: 2,
            ccNumber: 50,
            minValue: 0,
            maxValue: 127,
            behaviour: 'relative1',
          },
          {
            controlId: CONTROL_IDS.FADER5, // 0x51
            channel: 3,
            ccNumber: 85,
            minValue: 20,
            maxValue: 100,
            behaviour: 'absolute',
          },
        ],
        colors: [],
      };

      readCustomModeSpy.mockResolvedValue(mockDeviceResponse);

      const mode = await customModeManager.readMode(1);

      expect(mode.controls.SEND_B3).toBeDefined();
      expect(mode.controls.SEND_B3.type).toBe('knob');
      expect(mode.controls.SEND_B3.behaviour).toBe('relative1');

      expect(mode.controls.FADER5).toBeDefined();
      expect(mode.controls.FADER5.type).toBe('fader');
      expect(mode.controls.FADER5.behaviour).toBe('absolute');
    });

    it('should determine control types correctly', async () => {
      const mockDeviceResponse = {
        name: 'Type Test',
        controls: [
          { controlId: CONTROL_IDS.SEND_A1, channel: 0, ccNumber: 10, behaviour: 'absolute' }, // Knob
          { controlId: CONTROL_IDS.FADER3, channel: 0, ccNumber: 20, behaviour: 'absolute' }, // Fader
          { controlId: CONTROL_IDS.FOCUS2, channel: 0, ccNumber: 30, behaviour: 'toggle' }, // Button
        ],
        colors: [],
      };

      readCustomModeSpy.mockResolvedValue(mockDeviceResponse);

      const mode = await customModeManager.readMode(2);

      expect(mode.controls.SEND_A1.type).toBe('knob');
      expect(mode.controls.FADER3.type).toBe('fader');
      expect(mode.controls.FOCUS2.type).toBe('button');
    });

    it('should handle controls in object format (real device format)', async () => {
      // Real device returns controls as an object keyed by control ID, not an array
      const mockDeviceResponse = {
        name: 'Object Format Test',
        controls: {  // Object format, keyed by control ID
          '0x10': {
            controlId: CONTROL_IDS.SEND_A1,
            channel: 5,
            ccNumber: 100,
            minValue: 0,
            maxValue: 127,
            behaviour: 'absolute',
          },
          '0x18': {
            controlId: CONTROL_IDS.SEND_B1,
            channel: 3,
            ccNumber: 50,
            minValue: 0,
            maxValue: 127,
            behaviour: 'relative1',
          },
        },
        colors: [],
      };

      readCustomModeSpy.mockResolvedValue(mockDeviceResponse);

      const mode = await customModeManager.readMode(1);

      // Should successfully parse object format
      expect(mode.controls.SEND_A1).toBeDefined();
      expect(mode.controls.SEND_A1.channel).toBe(5);
      expect(mode.controls.SEND_A1.cc).toBe(100);

      expect(mode.controls.SEND_B1).toBeDefined();
      expect(mode.controls.SEND_B1.channel).toBe(3);
      expect(mode.controls.SEND_B1.cc).toBe(50);
    });

    it('should handle device read errors', async () => {
      readCustomModeSpy.mockRejectedValue(new Error('Device communication failed'));

      await expect(customModeManager.readMode(4))
        .rejects.toThrow('Device communication failed');
    });
  });

  describe('Custom Mode Saving', () => {
    it('should write mode to device successfully', async () => {
      writeCustomModeSpy.mockResolvedValue(undefined);

      const onModeSaved = vi.fn();
      customModeManager.on('mode:saved', onModeSaved);

      const testMode: CustomMode = {
        name: 'Save Test',
        controls: {
          SEND_A2: {
            type: 'knob',
            channel: 8,
            cc: 75,
            min: 5,
            max: 120,
            behaviour: 'absolute',
          },
        },
        leds: new Map([
          [CONTROL_IDS.CONTROL2, {
            color: LED_COLORS.AMBER_FULL,
            behaviour: 'flash',
          }],
        ]),
        metadata: {
          createdAt: new Date(),
          modifiedAt: new Date(),
        },
      };

      await customModeManager.writeMode(7, testMode);

      expect(writeCustomModeSpy).toHaveBeenCalledWith(7, expect.objectContaining({
        slot: 7,
        name: 'Save Test',
        controls: expect.arrayContaining([
          expect.objectContaining({
            controlId: CONTROL_IDS.SEND_A2,
            channel: 8,
            ccNumber: 75,
            minValue: 5,
            maxValue: 120,
            behaviour: 'absolute',
          }),
        ]),
        colors: expect.arrayContaining([
          expect.objectContaining({
            controlId: CONTROL_IDS.CONTROL2,
            color: LED_COLORS.AMBER_FULL,
            behaviour: 'flash',
          }),
        ]),
      }));

      expect(onModeSaved).toHaveBeenCalledWith(7, testMode);
    });

    it('should convert control mappings to device format', async () => {
      writeCustomModeSpy.mockResolvedValue(undefined);

      const testMode: CustomMode = {
        name: 'Conversion Test',
        controls: {
          PAN4: {
            type: 'knob',
            channel: 3,
            cc: 60,
            min: 0,
            max: 127,
            behaviour: 'relative2',
          },
          FADER8: {
            type: 'fader',
            channel: 1,
            cc: 90,
            min: 10,
            max: 110,
            behaviour: 'absolute',
          },
        },
        leds: new Map(),
        metadata: {
          createdAt: new Date(),
          modifiedAt: new Date(),
        },
      };

      await customModeManager.writeMode(10, testMode);

      const deviceMode = writeCustomModeSpy.mock.calls[0][1];

      expect(deviceMode.controls).toContainEqual({
        controlId: CONTROL_IDS.PAN4,
        channel: 3,
        ccNumber: 60,
        minValue: 0,
        maxValue: 127,
        behaviour: 'relative2',
      });

      expect(deviceMode.controls).toContainEqual({
        controlId: CONTROL_IDS.FADER8,
        channel: 1,
        ccNumber: 90,
        minValue: 10,
        maxValue: 110,
        behaviour: 'absolute',
      });
    });

    it('should handle device write errors', async () => {
      writeCustomModeSpy.mockRejectedValue(new Error('Write failed'));

      const testMode = customModeManager.createDefaultMode('Error Test');

      await expect(customModeManager.writeMode(12, testMode))
        .rejects.toThrow('Write failed');
    });
  });

  describe('Mode Data Validation', () => {
    it('should validate mode structure', () => {
      const invalidModes = [
        { controls: {} }, // Missing name
        { name: '', controls: {} }, // Empty name
        { name: 'Test' }, // Missing controls
        { name: 'Test', controls: null }, // Invalid controls
      ];

      for (const invalidMode of invalidModes) {
        expect(() => {
          // Access private method through any cast for testing
          (customModeManager as any).validateMode(invalidMode);
        }).toThrow();
      }
    });

    it('should validate control mappings', () => {
      const modeWithInvalidChannel = {
        name: 'Invalid Channel',
        controls: {
          SEND_A1: {
            type: 'knob',
            channel: 16, // Invalid - must be 0-15
            cc: 10,
            min: 0,
            max: 127,
            behaviour: 'absolute',
          },
        },
      };

      expect(() => {
        (customModeManager as any).validateMode(modeWithInvalidChannel);
      }).toThrow('Invalid channel for SEND_A1: 16');
    });

    it('should validate CC numbers', () => {
      const modeWithInvalidCC = {
        name: 'Invalid CC',
        controls: {
          SEND_A1: {
            type: 'knob',
            channel: 0,
            cc: 128, // Invalid - must be 0-127
            min: 0,
            max: 127,
            behaviour: 'absolute',
          },
        },
      };

      expect(() => {
        (customModeManager as any).validateMode(modeWithInvalidCC);
      }).toThrow('Invalid CC for SEND_A1: 128');
    });

    it('should validate min/max ranges', () => {
      const modeWithInvalidRange = {
        name: 'Invalid Range',
        controls: {
          SEND_A1: {
            type: 'knob',
            channel: 0,
            cc: 10,
            min: 100,
            max: 50, // Invalid - min > max
            behaviour: 'absolute',
          },
        },
      };

      expect(() => {
        (customModeManager as any).validateMode(modeWithInvalidRange);
      }).toThrow('Min value greater than max for SEND_A1');
    });

    it('should validate LED behaviours', () => {
      const modeWithInvalidLedBehaviour = {
        name: 'Invalid LED',
        controls: {},
        leds: {
          FOCUS1: {
            color: LED_COLORS.RED_FULL,
            behaviour: 'invalid_behaviour',
          },
        },
      };

      expect(() => {
        (customModeManager as any).validateMode(modeWithInvalidLedBehaviour);
      }).toThrow('Invalid LED behaviour for FOCUS1: invalid_behaviour');
    });

    it('should validate control IDs', () => {
      const modeWithInvalidControlId = {
        name: 'Invalid Control ID',
        controls: {
          INVALID_CONTROL: {
            type: 'knob',
            channel: 0,
            cc: 10,
            min: 0,
            max: 127,
            behaviour: 'absolute',
          },
        },
      };

      expect(() => {
        (customModeManager as any).validateMode(modeWithInvalidControlId);
      }).toThrow('Invalid control ID: INVALID_CONTROL');
    });
  });

  describe('Default Mode Creation', () => {
    it('should create default mode with standard mappings', () => {
      const defaultMode = customModeManager.createDefaultMode('Default Test');

      expect(defaultMode.name).toBe('Default Test');
      expect(defaultMode.metadata).toBeDefined();
      expect(defaultMode.metadata?.createdAt).toBeInstanceOf(Date);
      expect(defaultMode.metadata?.modifiedAt).toBeInstanceOf(Date);

      // Check send A knobs (CC 13-20)
      for (let i = 1; i <= 8; i++) {
        const control = defaultMode.controls[`SEND_A${i}`];
        expect(control).toBeDefined();
        expect(control.type).toBe('knob');
        expect(control.channel).toBe(0);
        expect(control.cc).toBe(12 + i);
        expect(control.behaviour).toBe('absolute');
      }

      // Check send B knobs (CC 29-36)
      for (let i = 1; i <= 8; i++) {
        const control = defaultMode.controls[`SEND_B${i}`];
        expect(control).toBeDefined();
        expect(control.cc).toBe(28 + i);
      }

      // Check pan knobs (CC 49-56)
      for (let i = 1; i <= 8; i++) {
        const control = defaultMode.controls[`PAN${i}`];
        expect(control).toBeDefined();
        expect(control.cc).toBe(48 + i);
      }

      // Check faders (CC 77-84)
      for (let i = 1; i <= 8; i++) {
        const control = defaultMode.controls[`FADER${i}`];
        expect(control).toBeDefined();
        expect(control.type).toBe('fader');
        expect(control.cc).toBe(76 + i);
      }
    });

    it('should create default mode with LED mappings', () => {
      const defaultMode = customModeManager.createDefaultMode();

      expect(defaultMode.leds).toBeDefined();
      expect(defaultMode.leds!.size).toBeGreaterThan(0);

      // Check some LED mappings exist
      const ledArray = Array.from(defaultMode.leds!.entries());
      expect(ledArray.length).toBeGreaterThan(0);

      for (const [_controlId, led] of ledArray) {
        expect(led.colour || led.color).toBeDefined();
        expect(led.behaviour).toBe('static');
      }
    });

    it('should use default name when none provided', () => {
      const defaultMode = customModeManager.createDefaultMode();
      expect(defaultMode.name).toBe('Default Mode');
    });
  });

  describe('Mode Caching', () => {
    beforeEach(() => {
      // Enable caching for these tests
      customModeManager = new CustomModeManager({
        deviceManager: mockDeviceManager as DeviceManager,
        autoSync: false,
        cacheTimeout: 1000, // Short timeout for testing
      });
    });

    it('should cache loaded modes', async () => {
      const mockResponse = {
        name: 'Cached Mode',
        controls: [],
        colors: [],
      };

      readCustomModeSpy.mockResolvedValue(mockResponse);

      // First call should hit device
      await customModeManager.readMode(5);
      expect(readCustomModeSpy).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await customModeManager.readMode(5);
      expect(readCustomModeSpy).toHaveBeenCalledTimes(1);
    });

    it('should expire cached modes after timeout', async () => {
      const mockResponse = {
        name: 'Expiring Mode',
        controls: [],
        colors: [],
      };

      readCustomModeSpy.mockResolvedValue(mockResponse);

      // First call
      await customModeManager.readMode(8);
      expect(readCustomModeSpy).toHaveBeenCalledTimes(1);

      // Fast-forward past cache timeout
      vi.advanceTimersByTime(1500);

      // Second call should hit device again
      await customModeManager.readMode(8);
      expect(readCustomModeSpy).toHaveBeenCalledTimes(2);
    });

    it('should update cache when saving modes', async () => {
      writeCustomModeSpy.mockResolvedValue(undefined);

      const testMode = customModeManager.createDefaultMode('Cache Update Test');
      await customModeManager.writeMode(9, testMode);

      // Should be able to read from cache
      readCustomModeSpy.mockClear();
      const cachedMode = await customModeManager.readMode(9);

      expect(readCustomModeSpy).not.toHaveBeenCalled();
      expect(cachedMode.name).toBe('Cache Update Test');
    });

    it('should clear cache manually', async () => {
      const mockResponse = {
        name: 'Clear Cache Test',
        controls: [],
        colors: [],
      };

      readCustomModeSpy.mockResolvedValue(mockResponse);

      await customModeManager.readMode(11);
      customModeManager.clearCache();

      // Should hit device again after cache clear
      await customModeManager.readMode(11);
      expect(readCustomModeSpy).toHaveBeenCalledTimes(2);
    });

    it('should emit cache events', async () => {
      const onCacheUpdated = vi.fn();
      const onCacheCleared = vi.fn();

      customModeManager.on('cache:updated', onCacheUpdated);
      customModeManager.on('cache:cleared', onCacheCleared);

      const mockResponse = {
        name: 'Cache Event Test',
        controls: [],
        colors: [],
      };

      readCustomModeSpy.mockResolvedValue(mockResponse);

      await customModeManager.readMode(13);
      expect(onCacheUpdated).toHaveBeenCalledWith(13);

      customModeManager.clearCache();
      expect(onCacheCleared).toHaveBeenCalled();
    });

    it('should get cached modes', async () => {
      const mockResponse1 = { name: 'Mode 1', controls: [], colors: [] };
      const mockResponse2 = { name: 'Mode 2', controls: [], colors: [] };

      readCustomModeSpy.mockResolvedValueOnce(mockResponse1);
      readCustomModeSpy.mockResolvedValueOnce(mockResponse2);

      await customModeManager.readMode(0);
      await customModeManager.readMode(1);

      const cachedModes = customModeManager.getCachedModes();
      expect(cachedModes.size).toBe(2);
      expect(cachedModes.get(0)?.name).toBe('Mode 1');
      expect(cachedModes.get(1)?.name).toBe('Mode 2');
    });
  });

  describe('Mode Operations', () => {
    it('should copy mode from one slot to another', async () => {
      const sourceMode = {
        name: 'Source Mode',
        controls: [
          {
            controlId: CONTROL_IDS.SEND_A1,
            channel: 5,
            ccNumber: 100,
            behaviour: 'absolute',
          },
        ],
        colors: [],
      };

      readCustomModeSpy.mockResolvedValue(sourceMode);
      writeCustomModeSpy.mockResolvedValue(undefined);

      await customModeManager.copyMode(3, 7);

      expect(readCustomModeSpy).toHaveBeenCalledWith(3);
      expect(writeCustomModeSpy).toHaveBeenCalledWith(7, expect.objectContaining({
        name: 'Source Mode',
        metadata: expect.objectContaining({
          slot: 7,
        }),
      }));
    });

    it('should sync all modes from device', async () => {
      const mockModes = Array.from({ length: 16 }, (_, i) => ({
        name: `Mode ${i}`,
        controls: [],
        colors: [],
      }));

      readCustomModeSpy.mockImplementation((slot: number) =>
        Promise.resolve(mockModes[slot])
      );

      const syncedModes = await customModeManager.syncAllModes();

      expect(syncedModes).toHaveLength(16);
      expect(readCustomModeSpy).toHaveBeenCalledTimes(16);

      for (let i = 0; i < 16; i++) {
        expect(readCustomModeSpy).toHaveBeenCalledWith(i);
        expect(syncedModes[i].name).toBe(`Mode ${i}`);
      }
    });

    it('should handle errors during sync gracefully', async () => {
      // Mock some slots to fail
      readCustomModeSpy.mockImplementation((slot: number) => {
        if (slot === 5 || slot === 10) {
          return Promise.reject(new Error(`Failed to read slot ${slot}`));
        }
        return Promise.resolve({
          name: `Mode ${slot}`,
          controls: [],
          colors: [],
        });
      });

      // Should continue syncing other slots despite errors
      const syncedModes = await customModeManager.syncAllModes();

      expect(syncedModes).toHaveLength(14); // 16 - 2 failed slots
      expect(readCustomModeSpy).toHaveBeenCalledTimes(16);
    });
  });

  describe('Import/Export', () => {
    it('should export mode to JSON', () => {
      const testMode = customModeManager.createDefaultMode('Export Test');
      const json = customModeManager.exportMode(testMode);

      const parsed = JSON.parse(json);
      expect(parsed.name).toBe('Export Test');
      expect(parsed.controls).toBeDefined();
      expect(parsed.metadata).toBeDefined();
    });

    it('should import mode from JSON', () => {
      const testMode = customModeManager.createDefaultMode('Import Test');
      const json = customModeManager.exportMode(testMode);

      const imported = customModeManager.importMode(json);

      expect(imported.name).toBe('Import Test');
      expect(imported.controls).toEqual(testMode.controls);
    });

    it('should validate imported mode', () => {
      const invalidJson = JSON.stringify({
        controls: {}, // Missing name
      });

      expect(() => {
        customModeManager.importMode(invalidJson);
      }).toThrow();
    });

    it('should handle malformed JSON', () => {
      expect(() => {
        customModeManager.importMode('invalid json');
      }).toThrow();
    });
  });

  describe('Pending Operations', () => {
    it('should prevent concurrent reads of same slot', async () => {
      const mockResponse = {
        name: 'Concurrent Test',
        controls: [],
        colors: [],
      };

      // Simulate slow device response
      readCustomModeSpy.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve(mockResponse), 100))
      );

      // Start two concurrent reads
      const promise1 = customModeManager.readMode(6);
      const promise2 = customModeManager.readMode(6);

      // Advance time to resolve promises
      vi.advanceTimersByTime(150);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Should have called device only once
      expect(readCustomModeSpy).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });
  });

  describe('Error Handling', () => {
    it('should emit mode:error event on read failure', async () => {
      const onModeError = vi.fn();
      customModeManager.on('mode:error', onModeError);

      readCustomModeSpy.mockRejectedValue(new Error('Read error'));

      await expect(customModeManager.readMode(14))
        .rejects.toThrow('Read error');
    });

    it('should handle unknown control IDs gracefully', async () => {
      const mockResponse = {
        name: 'Unknown Control Test',
        controls: [
          {
            controlId: 0x999, // Unknown control ID
            channel: 0,
            ccNumber: 10,
            behaviour: 'absolute',
          },
        ],
        colors: [],
      };

      readCustomModeSpy.mockResolvedValue(mockResponse);

      const mode = await customModeManager.readMode(15);

      // Should skip unknown controls
      expect(Object.keys(mode.controls)).toHaveLength(0);
    });
  });

  describe('Auto-sync', () => {
    it('should sync modes on device connection when auto-sync enabled', async () => {
      let deviceConnectedCallback: (() => void) | undefined;

      const mockDeviceManagerWithEvents = {
        ...mockDeviceManager,
        on: vi.fn((event: string, callback: () => void) => {
          if (event === 'device:connected') {
            deviceConnectedCallback = callback;
          }
        }),
        readCustomMode: readCustomModeSpy,
        writeCustomMode: writeCustomModeSpy,
      };

      customModeManager = new CustomModeManager({
        deviceManager: mockDeviceManagerWithEvents as DeviceManager,
        autoSync: true,
      });

      readCustomModeSpy.mockResolvedValue({
        name: 'Auto Sync Test',
        controls: [],
        colors: [],
      });

      // Simulate device connection
      if (deviceConnectedCallback) {
        deviceConnectedCallback();
      }

      // Wait for sync to complete
      vi.advanceTimersByTime(100);

      // Should have attempted to read all slots
      expect(readCustomModeSpy).toHaveBeenCalled();
    });

    it('should clear cache on device disconnection', () => {
      let deviceDisconnectedCallback: (() => void) | undefined;

      const mockDeviceManagerWithEvents = {
        ...mockDeviceManager,
        on: vi.fn((event: string, callback: () => void) => {
          if (event === 'device:disconnected') {
            deviceDisconnectedCallback = callback;
          }
        }),
      };

      customModeManager = new CustomModeManager({
        deviceManager: mockDeviceManagerWithEvents as DeviceManager,
        autoSync: true,
      });

      const onCacheCleared = vi.fn();
      customModeManager.on('cache:cleared', onCacheCleared);

      // Simulate device disconnection
      if (deviceDisconnectedCallback) {
        deviceDisconnectedCallback();
      }

      expect(onCacheCleared).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources', () => {
      // Add some cached modes
      const testMode = customModeManager.createDefaultMode('Cleanup Test');
      writeCustomModeSpy.mockResolvedValue(undefined);

      customModeManager.writeMode(1, testMode);

      const cachedModes = customModeManager.getCachedModes();
      expect(cachedModes.size).toBeGreaterThan(0);

      customModeManager.cleanup();

      // Should clear all state
      expect(customModeManager.getCachedModes().size).toBe(0);
    });
  });
});

describe('CONTROL_IDS Constants', () => {
  it('should have all expected control IDs', () => {
    // Send A knobs (top row): 0x10-0x17 (PHASE 1 FIX)
    expect(CONTROL_IDS.SEND_A1).toBe(0x10);
    expect(CONTROL_IDS.SEND_A8).toBe(0x17);

    // Send B knobs (middle row): 0x18-0x1F (PHASE 1 FIX)
    expect(CONTROL_IDS.SEND_B1).toBe(0x18);
    expect(CONTROL_IDS.SEND_B8).toBe(0x1F);

    // Pan/Device knobs (bottom row): 0x20-0x27 (PHASE 1 FIX)
    expect(CONTROL_IDS.PAN1).toBe(0x20);
    expect(CONTROL_IDS.PAN8).toBe(0x27);

    // Faders: 0x28-0x2F (PHASE 1 FIX)
    expect(CONTROL_IDS.FADER1).toBe(0x28);
    expect(CONTROL_IDS.FADER8).toBe(0x2F);

    // Track focus buttons: 0x30-0x37 (PHASE 1 FIX)
    expect(CONTROL_IDS.FOCUS1).toBe(0x30);
    expect(CONTROL_IDS.FOCUS8).toBe(0x37);

    // Track control buttons: 0x38-0x3F (PHASE 1 FIX)
    expect(CONTROL_IDS.CONTROL1).toBe(0x38);
    expect(CONTROL_IDS.CONTROL8).toBe(0x3F);

    // Side buttons
    expect(CONTROL_IDS.DEVICE).toBe(0x69);
    expect(CONTROL_IDS.MUTE).toBe(0x6A);
    expect(CONTROL_IDS.SOLO).toBe(0x6B);
    expect(CONTROL_IDS.RECORD).toBe(0x6C);
  });
});

describe('LED_COLORS Constants', () => {
  it('should have all expected LED colors', () => {
    expect(LED_COLORS.OFF).toBe(0x0C);
    expect(LED_COLORS.RED_LOW).toBe(0x0D);
    expect(LED_COLORS.RED_FULL).toBe(0x0F);
    expect(LED_COLORS.AMBER_LOW).toBe(0x1D);
    expect(LED_COLORS.AMBER_FULL).toBe(0x3F);
    expect(LED_COLORS.YELLOW).toBe(0x3E);
    expect(LED_COLORS.GREEN_LOW).toBe(0x1C);
    expect(LED_COLORS.GREEN_FULL).toBe(0x3C);
  });
});