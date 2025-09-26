/**
 * Device Integration Tests
 *
 * Tests device connection, initialization, and basic operations
 * Note: These tests require a Launch Control XL 3 to be connected
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { LaunchControlXL3 } from '@/LaunchControlXL3';
import { LED_COLOR_VALUES } from '@/led/LedController';

// Skip these tests if no device is connected
const SKIP_HARDWARE_TESTS = process.env.SKIP_HARDWARE_TESTS === 'true';

describe.skipIf(SKIP_HARDWARE_TESTS)('Device Integration', () => {
  let controller: LaunchControlXL3;

  beforeAll(async () => {
    controller = new LaunchControlXL3({
      autoConnect: false,
      enableLedControl: true,
      enableCustomModes: true,
    });
  });

  afterAll(async () => {
    if (controller) {
      await controller.cleanup();
    }
  });

  describe('Connection', () => {
    it('should initialize without connecting', async () => {
      await controller.initialize();
      expect(controller.isConnected()).toBe(false);
    });

    it('should connect to device', async () => {
      await controller.connect();
      expect(controller.isConnected()).toBe(true);
    });

    it('should get device status', () => {
      const status = controller.getStatus();
      expect(status.connected).toBe(true);
      expect(status.state).toBe('connected');
      expect(status.deviceInfo).toBeDefined();
      expect(status.deviceInfo?.firmwareVersion).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should handle disconnect and reconnect', async () => {
      await controller.disconnect();
      expect(controller.isConnected()).toBe(false);

      await controller.connect();
      expect(controller.isConnected()).toBe(true);
    });
  });

  describe('LED Control', () => {
    beforeEach(async () => {
      if (!controller.isConnected()) {
        await controller.connect();
      }
      await controller.turnOffAllLeds();
    });

    it('should set LED color', async () => {
      await controller.setLed('FOCUS1', LED_COLOR_VALUES.GREEN_FULL);
      // Visual verification required
      await new Promise(resolve => setTimeout(resolve, 500));
    });

    it('should flash LED', async () => {
      await controller.flashLed('CONTROL1', LED_COLOR_VALUES.RED_FULL, 200);
      await new Promise(resolve => setTimeout(resolve, 300));
    });

    it('should run LED animation', async () => {
      controller.startLedAnimation('test-chase', {
        type: 'chase',
        duration: 1000,
        controls: ['FOCUS1', 'FOCUS2', 'FOCUS3', 'FOCUS4'],
        colors: [LED_COLOR_VALUES.AMBER_FULL],
      });

      await new Promise(resolve => setTimeout(resolve, 1100));
      controller.stopLedAnimation('test-chase');
    });

    it('should turn off all LEDs', async () => {
      // Set some LEDs first
      await controller.setLed('FOCUS1', LED_COLOR_VALUES.GREEN_FULL);
      await controller.setLed('FOCUS2', LED_COLOR_VALUES.RED_FULL);

      // Turn all off
      await controller.turnOffAllLeds();
      // Visual verification required
    });
  });

  describe('Control Events', () => {
    beforeEach(async () => {
      if (!controller.isConnected()) {
        await controller.connect();
      }
    });

    it('should receive control change events', async () => {
      const events: any[] = [];

      const handler = (controlId: string, value: number) => {
        events.push({ controlId, value });
      };

      controller.on('control:change', handler);

      // Wait for manual control movement
      console.log('Move a control on the device...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      controller.off('control:change', handler);

      // Should have received at least one event if control was moved
      // This test requires manual interaction
      if (events.length > 0) {
        expect(events[0]).toHaveProperty('controlId');
        expect(events[0]).toHaveProperty('value');
        expect(events[0].value).toBeGreaterThanOrEqual(0);
        expect(events[0].value).toBeLessThanOrEqual(127);
      }
    });
  });

  describe('Control Mapping', () => {
    beforeEach(async () => {
      if (!controller.isConnected()) {
        await controller.connect();
      }
    });

    it('should map control with linear transform', () => {
      controller.mapControl('FADER1', 0, 7, {
        min: 0,
        max: 127,
        behaviour: 'absolute',
      });

      const mapping = controller.getControlMapping('FADER1');
      expect(mapping).toBeDefined();
      expect(mapping?.cc).toBe(7);
      expect(mapping?.channel).toBe(0);
    });

    it('should map control with exponential transform', () => {
      controller.mapControl('FADER2', 0, 11, {
        min: 0,
        max: 127,
        behaviour: 'absolute',
        transform: {
          type: 'exponential',
          curve: 2,
        },
      });

      const mapping = controller.getControlMapping('FADER2');
      expect(mapping).toBeDefined();
      expect(mapping?.transform?.type).toBe('exponential');
    });

    it('should unmap control', () => {
      controller.mapControl('SEND_A1', 0, 20, {
        min: 0,
        max: 127,
        behaviour: 'absolute',
      });

      controller.unmapControl('SEND_A1');
      const mapping = controller.getControlMapping('SEND_A1');
      expect(mapping).toBeUndefined();
    });
  });

  describe('Custom Modes', () => {
    beforeEach(async () => {
      if (!controller.isConnected()) {
        await controller.connect();
      }
    });

    it('should create custom mode', () => {
      const mode = controller.createCustomMode('Test Mode');
      expect(mode.name).toBe('Test Mode');
      expect(mode.controls).toBeDefined();
      expect(mode.leds).toBeDefined();
    });

    it('should save and load custom mode', async () => {
      const mode = controller.createCustomMode('Integration Test');

      mode.controls['FADER1'] = {
        type: 'fader',
        channel: 0,
        cc: 10,
        min: 0,
        max: 127,
        behaviour: 'absolute',
      };

      // Save to slot 15 (least likely to be in use)
      await controller.saveCustomMode(15, mode);

      // Load it back
      const loaded = await controller.loadCustomMode(15);
      expect(loaded.name).toBeDefined();
      // Note: Device may modify the name
    }, 10000); // Longer timeout for device operations

    it('should export current state as custom mode', () => {
      const exported = controller.exportCurrentAsCustomMode('Exported');
      expect(exported.name).toBe('Exported');
      expect(exported.controls).toBeDefined();
      expect(exported.metadata).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid LED control ID', async () => {
      if (!controller.isConnected()) {
        await controller.connect();
      }

      await expect(
        controller.setLed('INVALID_LED', LED_COLOR_VALUES.GREEN_FULL)
      ).rejects.toThrow();
    });

    it('should handle invalid custom mode slot', async () => {
      if (!controller.isConnected()) {
        await controller.connect();
      }

      await expect(
        controller.loadCustomMode(16 as any)
      ).rejects.toThrow('slot');
    });

    it('should handle disconnection during operation', async () => {
      if (!controller.isConnected()) {
        await controller.connect();
      }

      await controller.disconnect();

      await expect(
        controller.setLed('FOCUS1', LED_COLOR_VALUES.GREEN_FULL)
      ).rejects.toThrow();
    });
  });
});

describe('Device Mock Tests', () => {
  it('should create controller without device', () => {
    const controller = new LaunchControlXL3({
      autoConnect: false,
    });

    expect(controller).toBeDefined();
    expect(controller.isConnected()).toBe(false);
  });

  it('should handle connection failure gracefully', async () => {
    const controller = new LaunchControlXL3({
      autoConnect: false,
      deviceNameFilter: 'Non-existent Device',
      maxReconnectAttempts: 1,
      reconnectDelay: 100,
    });

    await controller.initialize();

    await expect(controller.connect()).rejects.toThrow();
  });
});