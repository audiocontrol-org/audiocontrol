/**
 * Unit Tests for LedController
 *
 * Tests LED color setting, state management, batch updates, color palette validation,
 * SysEx message generation, animation modes, and error handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LedController, LED_COLOR_VALUES, LED_NOTE_MAP } from '@/src/led/LedController.js';
import { DeviceManager } from '@/src/device/DeviceManager.js';
import { LedColor, LedBehaviour } from '@/src/types/index.js';
import { SysExParser } from '@/src/core/SysExParser.js';
import { setupFakeTimers, createMockMidiBackend } from '@/test/helpers/test-utils.js';

// Mock SysExParser
vi.mock('@/src/core/SysExParser.js', () => ({
  SysExParser: {
    buildLedControl: vi.fn((noteValue: number, color: number, behaviour: string) => [
      0xF0, 0x00, 0x20, 0x29, 0x02, 0x03, 0x03, noteValue, color, 0xF7
    ]),
    buildLedReset: vi.fn(() => [
      0xF0, 0x00, 0x20, 0x29, 0x02, 0x03, 0x14, 0x00, 0xF7
    ]),
  },
}));

describe('LedController', () => {
  setupFakeTimers();

  let ledController: LedController;
  let mockDeviceManager: Partial<DeviceManager>;
  let sendSysExSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendSysExSpy = vi.fn().mockResolvedValue(undefined);

    mockDeviceManager = {
      sendSysEx: sendSysExSpy,
    };

    ledController = new LedController({
      deviceManager: mockDeviceManager as DeviceManager,
      enableAnimations: true,
      animationFrameRate: 30,
      enableColorCorrection: false,
    });
  });

  afterEach(() => {
    ledController.cleanup();
  });

  describe('LED Color Setting', () => {
    it('should set LED color successfully', async () => {
      const onLedChanged = vi.fn();
      ledController.on('led:changed', onLedChanged);

      await ledController.setLed('FOCUS1', LED_COLOR_VALUES.GREEN_FULL, 'static');

      expect(sendSysExSpy).toHaveBeenCalledWith([
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x03, 0x03,
        LED_NOTE_MAP.FOCUS1, LED_COLOR_VALUES.GREEN_FULL, 0xF7
      ]);

      expect(onLedChanged).toHaveBeenCalledWith('FOCUS1', {
        controlId: 'FOCUS1',
        color: LED_COLOR_VALUES.GREEN_FULL,
        behaviour: 'static',
        active: true,
        brightness: expect.any(Number),
      });
    });

    it('should set LED with numeric color value', async () => {
      await ledController.setLed('CONTROL1', 0x3C, 'flash');

      expect(sendSysExSpy).toHaveBeenCalledWith([
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x03, 0x03,
        LED_NOTE_MAP.CONTROL1, 0x3C, 0xF7
      ]);
    });

    it('should throw error for invalid control ID', async () => {
      await expect(ledController.setLed('INVALID_CONTROL', LED_COLOR_VALUES.RED_FULL))
        .rejects.toThrow('Invalid control ID for LED: INVALID_CONTROL');
    });

    it('should use default static behaviour when not specified', async () => {
      await ledController.setLed('FOCUS2', LED_COLOR_VALUES.AMBER_FULL);

      const state = ledController.getLedState('FOCUS2');
      expect(state?.behaviour).toBe('static');
    });

    it('should update LED state correctly', async () => {
      await ledController.setLed('FOCUS3', LED_COLOR_VALUES.RED_MEDIUM, 'pulse');

      const state = ledController.getLedState('FOCUS3');
      expect(state).toEqual({
        controlId: 'FOCUS3',
        color: LED_COLOR_VALUES.RED_MEDIUM,
        behaviour: 'pulse',
        active: true,
        brightness: expect.any(Number),
      });
    });
  });

  describe('LED State Management', () => {
    it('should initialize all control LEDs as off', () => {
      const allStates = ledController.getAllLedStates();

      // Check some known controls
      expect(allStates.get('FOCUS1')).toEqual({
        controlId: 'FOCUS1',
        color: LED_COLOR_VALUES.OFF,
        behaviour: 'static',
        active: false,
        brightness: 0,
      });

      expect(allStates.get('DEVICE')).toEqual({
        controlId: 'DEVICE',
        color: LED_COLOR_VALUES.OFF,
        behaviour: 'static',
        active: false,
        brightness: 0,
      });
    });

    it('should track active state correctly', async () => {
      // Initially off
      let state = ledController.getLedState('FOCUS4');
      expect(state?.active).toBe(false);

      // Set to color - should be active
      await ledController.setLed('FOCUS4', LED_COLOR_VALUES.GREEN_LOW);
      state = ledController.getLedState('FOCUS4');
      expect(state?.active).toBe(true);

      // Turn off - should be inactive
      await ledController.turnOff('FOCUS4');
      state = ledController.getLedState('FOCUS4');
      expect(state?.active).toBe(false);
    });

    it('should calculate brightness from color value', async () => {
      await ledController.setLed('FOCUS5', LED_COLOR_VALUES.GREEN_FULL);
      const state = ledController.getLedState('FOCUS5');
      expect(state?.brightness).toBeGreaterThan(0);

      await ledController.setLed('FOCUS5', LED_COLOR_VALUES.GREEN_LOW);
      const lowState = ledController.getLedState('FOCUS5');
      expect(lowState?.brightness).toBeLessThan(state?.brightness!);
    });

    it('should return undefined for non-existent control', () => {
      const state = ledController.getLedState('NON_EXISTENT');
      expect(state).toBeUndefined();
    });
  });

  describe('Batch LED Updates', () => {
    it('should set multiple LEDs at once', async () => {
      const onBatch = vi.fn();
      ledController.on('led:batch', onBatch);

      const updates = [
        { controlId: 'FOCUS1', color: LED_COLOR_VALUES.RED_FULL, behaviour: 'static' as LedBehaviour },
        { controlId: 'FOCUS2', color: LED_COLOR_VALUES.GREEN_FULL, behaviour: 'flash' as LedBehaviour },
        { controlId: 'CONTROL1', color: LED_COLOR_VALUES.AMBER_FULL },
      ];

      await ledController.setMultipleLeds(updates);

      expect(sendSysExSpy).toHaveBeenCalledTimes(3);
      expect(onBatch).toHaveBeenCalledWith([
        expect.objectContaining({ controlId: 'FOCUS1', color: LED_COLOR_VALUES.RED_FULL }),
        expect.objectContaining({ controlId: 'FOCUS2', color: LED_COLOR_VALUES.GREEN_FULL }),
        expect.objectContaining({ controlId: 'CONTROL1', color: LED_COLOR_VALUES.AMBER_FULL }),
      ]);
    });

    it('should handle empty batch updates', async () => {
      await ledController.setMultipleLeds([]);
      expect(sendSysExSpy).not.toHaveBeenCalled();
    });
  });

  describe('LED Control Operations', () => {
    it('should turn off single LED', async () => {
      // First set it on
      await ledController.setLed('FOCUS6', LED_COLOR_VALUES.RED_FULL);
      expect(ledController.getLedState('FOCUS6')?.active).toBe(true);

      // Then turn it off
      await ledController.turnOff('FOCUS6');

      expect(sendSysExSpy).toHaveBeenLastCalledWith([
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x03, 0x03,
        LED_NOTE_MAP.FOCUS6, LED_COLOR_VALUES.OFF, 0xF7
      ]);

      const state = ledController.getLedState('FOCUS6');
      expect(state?.active).toBe(false);
      expect(state?.color).toBe(LED_COLOR_VALUES.OFF);
    });

    it('should turn off all LEDs', async () => {
      // Set some LEDs on first
      await ledController.setLed('FOCUS1', LED_COLOR_VALUES.GREEN_FULL);
      await ledController.setLed('CONTROL1', LED_COLOR_VALUES.RED_FULL);

      await ledController.turnOffAll();

      expect(sendSysExSpy).toHaveBeenLastCalledWith([
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x03, 0x14, 0x00, 0xF7
      ]);

      // Check that all states are updated
      const allStates = ledController.getAllLedStates();
      for (const state of allStates.values()) {
        expect(state.active).toBe(false);
        expect(state.color).toBe(LED_COLOR_VALUES.OFF);
        expect(state.brightness).toBe(0);
      }
    });

    it('should flash LED for specified duration', async () => {
      const duration = 500;

      await ledController.flashLed('FOCUS7', LED_COLOR_VALUES.YELLOW_FULL, duration);

      // Should set to flash behavior
      expect(sendSysExSpy).toHaveBeenCalledWith([
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x03, 0x03,
        LED_NOTE_MAP.FOCUS7, LED_COLOR_VALUES.YELLOW_FULL, 0xF7
      ]);

      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(duration);

      // Should turn off after duration
      expect(sendSysExSpy).toHaveBeenLastCalledWith([
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x03, 0x03,
        LED_NOTE_MAP.FOCUS7, LED_COLOR_VALUES.OFF, 0xF7
      ]);
    });

    it('should flash LED without timeout when duration is 0', async () => {
      sendSysExSpy.mockClear();

      await ledController.flashLed('FOCUS8', LED_COLOR_VALUES.RED_LOW, 0);

      expect(sendSysExSpy).toHaveBeenCalledTimes(1);

      // Fast-forward time - should not turn off
      vi.advanceTimersByTime(10000);
      expect(sendSysExSpy).toHaveBeenCalledTimes(1);
    });

    it('should pulse LED', async () => {
      await ledController.pulseLed('CONTROL2', LED_COLOR_VALUES.GREEN_MEDIUM);

      expect(sendSysExSpy).toHaveBeenCalledWith([
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x03, 0x03,
        LED_NOTE_MAP.CONTROL2, LED_COLOR_VALUES.GREEN_MEDIUM, 0xF7
      ]);

      const state = ledController.getLedState('CONTROL2');
      expect(state?.behaviour).toBe('pulse');
    });
  });

  describe('Color Palette Validation', () => {
    it('should handle all standard color values', async () => {
      const colorTests = [
        ['OFF', LED_COLOR_VALUES.OFF],
        ['RED_LOW', LED_COLOR_VALUES.RED_LOW],
        ['RED_MEDIUM', LED_COLOR_VALUES.RED_MEDIUM],
        ['RED_FULL', LED_COLOR_VALUES.RED_FULL],
        ['AMBER_LOW', LED_COLOR_VALUES.AMBER_LOW],
        ['AMBER_MEDIUM', LED_COLOR_VALUES.AMBER_MEDIUM],
        ['AMBER_FULL', LED_COLOR_VALUES.AMBER_FULL],
        ['YELLOW_LOW', LED_COLOR_VALUES.YELLOW_LOW],
        ['YELLOW_FULL', LED_COLOR_VALUES.YELLOW_FULL],
        ['GREEN_LOW', LED_COLOR_VALUES.GREEN_LOW],
        ['GREEN_MEDIUM', LED_COLOR_VALUES.GREEN_MEDIUM],
        ['GREEN_FULL', LED_COLOR_VALUES.GREEN_FULL],
      ];

      for (const [name, value] of colorTests) {
        sendSysExSpy.mockClear();
        await ledController.setLed('FOCUS1', value);

        expect(sendSysExSpy).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.any(Number), // F0
            expect.any(Number), // ...
            expect.any(Number), // ...
            expect.any(Number), // ...
            expect.any(Number), // ...
            expect.any(Number), // ...
            expect.any(Number), // ...
            LED_NOTE_MAP.FOCUS1,
            value,
            0xF7
          ])
        );
      }
    });

    it('should handle custom numeric color values', async () => {
      const customColor = 0x25;
      await ledController.setLed('DEVICE', customColor);

      expect(sendSysExSpy).toHaveBeenCalledWith([
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x03, 0x03,
        LED_NOTE_MAP.DEVICE, customColor, 0xF7
      ]);
    });
  });

  describe('SysEx Message Generation', () => {
    it('should call SysExParser.buildLedControl with correct parameters', async () => {
      const buildLedControlSpy = vi.mocked(SysExParser.buildLedControl);

      await ledController.setLed('MUTE', LED_COLOR_VALUES.AMBER_LOW, 'flash');

      expect(buildLedControlSpy).toHaveBeenCalledWith(
        LED_NOTE_MAP.MUTE,
        LED_COLOR_VALUES.AMBER_LOW,
        'flash'
      );
    });

    it('should call SysExParser.buildLedReset for turnOffAll', async () => {
      const buildLedResetSpy = vi.mocked(SysExParser.buildLedReset);

      await ledController.turnOffAll();

      expect(buildLedResetSpy).toHaveBeenCalled();
    });

    it('should handle SysEx send errors gracefully', async () => {
      sendSysExSpy.mockRejectedValue(new Error('Device not connected'));

      await expect(ledController.setLed('SOLO', LED_COLOR_VALUES.RED_FULL))
        .rejects.toThrow('Device not connected');

      // State should not be updated on error
      const state = ledController.getLedState('SOLO');
      expect(state?.active).toBe(false);
    });
  });

  describe('Animation Support', () => {
    it('should start fade animation', async () => {
      const onAnimationStarted = vi.fn();
      ledController.on('animation:started', onAnimationStarted);

      const animation = {
        type: 'fade' as const,
        duration: 2000,
        controls: ['FOCUS1', 'FOCUS2'],
        colors: [LED_COLOR_VALUES.RED_FULL.toString(), LED_COLOR_VALUES.GREEN_FULL.toString()],
      };

      ledController.startAnimation('test-fade', animation);

      expect(onAnimationStarted).toHaveBeenCalledWith(animation);
    });

    it('should start pulse animation', async () => {
      const animation = {
        type: 'pulse' as const,
        duration: 1000,
        controls: ['CONTROL1', 'CONTROL2'],
        colors: [LED_COLOR_VALUES.AMBER_FULL.toString()],
      };

      ledController.startAnimation('test-pulse', animation);

      // Should set LEDs to pulse mode
      vi.advanceTimersByTime(100); // Let animation run a bit

      // Verify pulse mode was set (this tests the animation frame processing)
      expect(sendSysExSpy).toHaveBeenCalledWith(
        expect.arrayContaining([expect.any(Number), expect.any(Number)])
      );
    });

    it('should start flash animation', async () => {
      const animation = {
        type: 'flash' as const,
        duration: 1000,
        controls: ['FOCUS3'],
        colors: [LED_COLOR_VALUES.RED_FULL.toString()],
      };

      ledController.startAnimation('test-flash', animation);

      // Should alternate between on and off
      vi.advanceTimersByTime(250); // Quarter of a second
      expect(sendSysExSpy).toHaveBeenCalled();
    });

    it('should start chase animation', async () => {
      const animation = {
        type: 'chase' as const,
        duration: 2000,
        controls: ['FOCUS1', 'FOCUS2', 'FOCUS3', 'FOCUS4'],
        colors: [LED_COLOR_VALUES.GREEN_FULL.toString()],
      };

      ledController.startAnimation('test-chase', animation);

      // Let animation run
      vi.advanceTimersByTime(100);

      // Should activate controls in sequence
      expect(sendSysExSpy).toHaveBeenCalled();
    });

    it('should start rainbow animation', async () => {
      const animation = {
        type: 'rainbow' as const,
        duration: 2000,
        controls: ['CONTROL1', 'CONTROL2'],
      };

      ledController.startAnimation('test-rainbow', animation);

      vi.advanceTimersByTime(500); // Let it cycle colors
      expect(sendSysExSpy).toHaveBeenCalled();
    });

    it('should start custom animation with callback', async () => {
      const customCallback = vi.fn();
      const animation = {
        type: 'custom' as const,
        duration: 1000,
        callback: customCallback,
      };

      ledController.startAnimation('test-custom', animation);

      vi.advanceTimersByTime(100);
      expect(customCallback).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should stop animation', async () => {
      const animation = {
        type: 'pulse' as const,
        duration: 5000,
        controls: ['FOCUS1'],
        colors: [LED_COLOR_VALUES.GREEN_FULL.toString()],
      };

      ledController.startAnimation('test-stop', animation);
      vi.advanceTimersByTime(100);

      sendSysExSpy.mockClear();
      ledController.stopAnimation('test-stop');

      // Should not continue after stopping
      vi.advanceTimersByTime(1000);
      expect(sendSysExSpy).not.toHaveBeenCalled();
    });

    it('should stop all animations', async () => {
      const animation1 = {
        type: 'pulse' as const,
        duration: 5000,
        controls: ['FOCUS1'],
        colors: [LED_COLOR_VALUES.RED_FULL.toString()],
      };

      const animation2 = {
        type: 'flash' as const,
        duration: 5000,
        controls: ['FOCUS2'],
        colors: [LED_COLOR_VALUES.GREEN_FULL.toString()],
      };

      ledController.startAnimation('anim1', animation1);
      ledController.startAnimation('anim2', animation2);

      sendSysExSpy.mockClear();
      ledController.stopAllAnimations();

      // Should not continue after stopping all
      vi.advanceTimersByTime(1000);
      expect(sendSysExSpy).not.toHaveBeenCalled();
    });

    it('should handle animation completion', async () => {
      const onAnimationCompleted = vi.fn();
      ledController.on('animation:completed', onAnimationCompleted);

      const animation = {
        type: 'pulse' as const,
        duration: 100, // Short duration
        controls: ['FOCUS1'],
        colors: [LED_COLOR_VALUES.RED_FULL.toString()],
      };

      ledController.startAnimation('test-complete', animation);

      // Fast-forward past animation duration
      vi.advanceTimersByTime(200);

      expect(onAnimationCompleted).toHaveBeenCalledWith(animation);
    });

    it('should handle infinite repeat animations', async () => {
      const animation = {
        type: 'pulse' as const,
        duration: 100,
        repeat: 'infinite' as const,
        controls: ['FOCUS1'],
        colors: [LED_COLOR_VALUES.GREEN_FULL.toString()],
      };

      ledController.startAnimation('test-infinite', animation);

      // Should continue running
      vi.advanceTimersByTime(500); // 5x duration
      expect(sendSysExSpy).toHaveBeenCalled();

      ledController.stopAnimation('test-infinite');
    });

    it('should handle numbered repeat animations', async () => {
      const onAnimationCompleted = vi.fn();
      ledController.on('animation:completed', onAnimationCompleted);

      const animation = {
        type: 'pulse' as const,
        duration: 100,
        repeat: 2,
        controls: ['FOCUS1'],
        colors: [LED_COLOR_VALUES.AMBER_FULL.toString()],
      };

      ledController.startAnimation('test-repeat', animation);

      // Fast-forward past 2 repetitions
      vi.advanceTimersByTime(250);

      expect(onAnimationCompleted).toHaveBeenCalledWith(animation);
    });

    it('should not start animations when disabled', async () => {
      ledController = new LedController({
        deviceManager: mockDeviceManager as DeviceManager,
        enableAnimations: false,
      });

      const animation = {
        type: 'pulse' as const,
        duration: 1000,
        controls: ['FOCUS1'],
        colors: [LED_COLOR_VALUES.RED_FULL.toString()],
      };

      ledController.startAnimation('test-disabled', animation);

      vi.advanceTimersByTime(100);
      expect(sendSysExSpy).not.toHaveBeenCalled();
    });

    it('should handle animation errors gracefully', async () => {
      const onError = vi.fn();
      ledController.on('error', onError);

      // Create animation that will throw error
      sendSysExSpy.mockRejectedValue(new Error('Animation error'));

      const animation = {
        type: 'pulse' as const,
        duration: 1000,
        controls: ['FOCUS1'],
        colors: [LED_COLOR_VALUES.RED_FULL.toString()],
      };

      ledController.startAnimation('test-error', animation);

      vi.advanceTimersByTime(100);

      // Animation should stop on error
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('Startup Animation', () => {
    it('should play startup animation', async () => {
      await ledController.playStartupAnimation();

      // Should start chase animations
      vi.advanceTimersByTime(100);
      expect(sendSysExSpy).toHaveBeenCalled();

      // Should turn off all LEDs after completion
      vi.advanceTimersByTime(3500);
      expect(sendSysExSpy).toHaveBeenLastCalledWith([
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x03, 0x14, 0x00, 0xF7
      ]);
    });
  });

  describe('Error Handling', () => {
    it('should handle device communication errors', async () => {
      sendSysExSpy.mockRejectedValue(new Error('Communication failed'));

      await expect(ledController.setLed('RECORD', LED_COLOR_VALUES.RED_FULL))
        .rejects.toThrow('Communication failed');
    });

    it('should validate control IDs for LED operations', async () => {
      const invalidControls = ['INVALID', 'NOT_A_CONTROL', ''];

      for (const controlId of invalidControls) {
        await expect(ledController.setLed(controlId, LED_COLOR_VALUES.GREEN_FULL))
          .rejects.toThrow(`Invalid control ID for LED: ${controlId}`);
      }
    });
  });

  describe('Color Correction', () => {
    it('should apply color correction when enabled', async () => {
      ledController = new LedController({
        deviceManager: mockDeviceManager as DeviceManager,
        enableColorCorrection: true,
      });

      await ledController.setLed('UP', LED_COLOR_VALUES.RED_MEDIUM);

      // Color correction should be applied (though implementation is simple in this case)
      expect(sendSysExSpy).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources', () => {
      // Start some animations
      ledController.startAnimation('anim1', {
        type: 'pulse',
        duration: 5000,
        controls: ['FOCUS1'],
        colors: [LED_COLOR_VALUES.RED_FULL.toString()],
      });

      ledController.cleanup();

      // Should clear all state
      expect(ledController.getAllLedStates().size).toBe(0);

      // Should not continue animations
      vi.advanceTimersByTime(1000);
      expect(sendSysExSpy).not.toHaveBeenCalled();
    });
  });
});

describe('LED Constants', () => {
  it('should have valid color values', () => {
    expect(LED_COLOR_VALUES.OFF).toBe(0x0C);
    expect(LED_COLOR_VALUES.RED_FULL).toBe(0x0F);
    expect(LED_COLOR_VALUES.GREEN_FULL).toBe(0x3C);
    expect(LED_COLOR_VALUES.AMBER_FULL).toBe(0x3F);
  });

  it('should have note mappings for all controls', () => {
    expect(LED_NOTE_MAP.FOCUS1).toBe(0x29);
    expect(LED_NOTE_MAP.CONTROL1).toBe(0x39);
    expect(LED_NOTE_MAP.DEVICE).toBe(0x69);
    expect(LED_NOTE_MAP.UP).toBe(0x68);
  });
});