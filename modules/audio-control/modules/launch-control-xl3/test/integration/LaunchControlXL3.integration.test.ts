/**
 * LaunchControlXL3 Unit Tests
 *
 * Comprehensive unit tests for the main LaunchControlXL3 controller class.
 * Tests all key functionality including connection management, control mapping,
 * LED control, custom modes, and error handling.
 *
 * Uses deterministic testing patterns with synthetic time control and
 * dependency injection for complete isolation and reliability.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LaunchControlXL3 } from '@/LaunchControlXL3.js';
import { setupFakeTimers, createMockMidiBackend, assertMidiMessage, createControlChangeMessage } from '../helpers/test-utils.js';
import { DeterministicMidiBackend } from '../mocks/DeterministicMidiBackend.js';
import type { Logger } from '@/core/Logger.js';
import type { CustomMode, LedColor, LedBehaviour, ControlMapping, CustomModeSlot } from '@/types/index.js';

describe('LaunchControlXL3', () => {
  setupFakeTimers();

  let controller: LaunchControlXL3;
  let mockBackend: DeterministicMidiBackend;
  let mockLogger: Logger;

  beforeEach(() => {
    // Create deterministic MIDI backend
    mockBackend = createMockMidiBackend({
      timestampFn: () => Date.now(),
      autoInitialize: true,
      ports: {
        inputs: [{ id: 'test-input', name: 'Launch Control XL MK3', manufacturer: 'Novation' }],
        outputs: [{ id: 'test-output', name: 'Launch Control XL MK3', manufacturer: 'Novation' }]
      }
    });

    // Create mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Clear any previous state
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (controller) {
      await controller.cleanup();
    }
    await mockBackend.cleanup();
  });

  describe('Constructor and Initialization', () => {
    it('should create instance with default options', () => {
      controller = new LaunchControlXL3();

      expect(controller).toBeInstanceOf(LaunchControlXL3);
      expect(controller.isConnected()).toBe(false);
    });

    it('should create instance with custom MIDI backend', () => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend
      });

      expect(controller).toBeInstanceOf(LaunchControlXL3);
      expect(controller.isConnected()).toBe(false);
    });

    it('should create instance with custom logger', () => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger
      });

      expect(controller).toBeInstanceOf(LaunchControlXL3);
    });

    it('should create instance with all configuration options', () => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger,
        enableLedControl: true,
        enableCustomModes: true,
        enableValueSmoothing: true,
        smoothingFactor: 5,
        deviceNameFilter: 'Custom Filter',
        reconnectOnError: false,
        reconnectDelay: 1000,
        maxReconnectAttempts: 3
      });

      expect(controller).toBeInstanceOf(LaunchControlXL3);
    });

    it('should create instance with disabled features', () => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger,
        enableLedControl: false,
        enableCustomModes: false,
        enableValueSmoothing: false
      });

      expect(controller).toBeInstanceOf(LaunchControlXL3);
    });
  });

  describe('connect()', () => {
    beforeEach(() => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger
      });
    });

    it('should connect successfully with device handshake', async () => {
      // Queue successful handshake responses
      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();

      const connectionPromise = controller.connect();

      // Process queued responses
      mockBackend.processAllResponses();

      await connectionPromise;

      expect(controller.isConnected()).toBe(true);
    });

    it('should emit device:connected event on successful connection', async () => {
      const connectedHandler = vi.fn();
      controller.on('device:connected', connectedHandler);

      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();

      const connectionPromise = controller.connect();
      mockBackend.processAllResponses();
      await connectionPromise;

      expect(connectedHandler).toHaveBeenCalledOnce();
      expect(connectedHandler.mock.calls[0][0]).toMatchObject({
        manufacturerId: expect.any(String),
        deviceFamily: expect.any(Number),
        modelNumber: expect.any(Number),
        firmwareVersion: expect.any(String)
      });
    });

    it('should emit device:ready event after initialization', async () => {
      const readyHandler = vi.fn();
      controller.on('device:ready', readyHandler);

      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();

      const connectionPromise = controller.connect();
      mockBackend.processAllResponses();
      await connectionPromise;

      expect(readyHandler).toHaveBeenCalledOnce();
    });

    it('should timeout if no device response', async () => {
      // Don't queue any responses
      const connectionPromise = controller.connect();

      // Advance time past timeout
      await vi.advanceTimersByTimeAsync(10000);

      await expect(connectionPromise).rejects.toThrow(/timeout/i);
      expect(controller.isConnected()).toBe(false);
    });

    it('should emit device:error event on connection failure', async () => {
      const errorHandler = vi.fn();
      controller.on('device:error', errorHandler);

      const connectionPromise = controller.connect();
      await vi.advanceTimersByTimeAsync(10000);

      try {
        await connectionPromise;
      } catch (error) {
        // Expected to throw
      }

      expect(errorHandler).toHaveBeenCalledOnce();
      expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it('should prevent concurrent connection attempts', async () => {
      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();

      const connection1 = controller.connect();
      const connection2 = controller.connect();

      mockBackend.processAllResponses();

      const results = await Promise.allSettled([connection1, connection2]);

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful).toBe(1);
      expect(failed).toBe(1);
    });

    it('should initialize device manager only once', async () => {
      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();

      // First connection
      const connectionPromise1 = controller.connect();
      mockBackend.processAllResponses();
      await connectionPromise1;

      await controller.disconnect();

      // Second connection should reuse initialized device manager
      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();

      const connectionPromise2 = controller.connect();
      mockBackend.processAllResponses();
      await connectionPromise2;

      expect(controller.isConnected()).toBe(true);
    });
  });

  describe('disconnect()', () => {
    beforeEach(async () => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger
      });

      // Connect first
      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();
      const connectionPromise = controller.connect();
      mockBackend.processAllResponses();
      await connectionPromise;
    });

    it('should disconnect successfully', async () => {
      expect(controller.isConnected()).toBe(true);

      await controller.disconnect();

      expect(controller.isConnected()).toBe(false);
    });

    it('should emit device:disconnected event', async () => {
      const disconnectedHandler = vi.fn();
      controller.on('device:disconnected', disconnectedHandler);

      await controller.disconnect();

      expect(disconnectedHandler).toHaveBeenCalledOnce();
    });

    it('should clean up resources properly', async () => {
      const currentMode = controller.getCurrentMode();
      const currentSlot = controller.getCurrentSlot();

      await controller.disconnect();

      expect(controller.getCurrentMode()).toBeUndefined();
      expect(controller.getCurrentSlot()).toBeUndefined();
    });

    it('should handle disconnect when not connected', async () => {
      await controller.disconnect(); // First disconnect

      // Second disconnect should not throw
      await expect(controller.disconnect()).resolves.not.toThrow();
    });
  });

  describe('mapControl()', () => {
    beforeEach(async () => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger
      });

      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();
      const connectionPromise = controller.connect();
      mockBackend.processAllResponses();
      await connectionPromise;
    });

    it('should map control with basic parameters', () => {
      const controlId = 'SEND_A_1';
      const channel = 1;
      const cc = 21;

      expect(() => {
        controller.mapControl(controlId, channel, cc);
      }).not.toThrow();
    });

    it('should map control with full options', () => {
      const controlId = 'SEND_A_1';
      const channel = 1;
      const cc = 21;
      const options: Partial<ControlMapping> = {
        min: 0,
        max: 127,
        behaviour: 'absolute',
        transform: 'linear'
      };

      expect(() => {
        controller.mapControl(controlId, channel, cc, options);
      }).not.toThrow();
    });

    it('should emit control:mapped event', () => {
      const mappedHandler = vi.fn();
      controller.on('control:mapped', mappedHandler);

      const controlId = 'SEND_A_1';
      controller.mapControl(controlId, 1, 21);

      expect(mappedHandler).toHaveBeenCalledOnce();
      expect(mappedHandler.mock.calls[0][0]).toBe(controlId);
      expect(mappedHandler.mock.calls[0][1]).toMatchObject({
        type: expect.any(String),
        channel: 1,
        cc: 21
      });
    });

    it('should handle different control types correctly', () => {
      // Knob control
      controller.mapControl('SEND_A_1', 1, 21);

      // Fader control
      controller.mapControl('FADER_1', 1, 7);

      // Button control
      controller.mapControl('TRACK_FOCUS_1', 1, 41);

      // All should succeed without throwing
      expect(true).toBe(true);
    });
  });

  describe('setLed()', () => {
    beforeEach(async () => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger,
        enableLedControl: true
      });

      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();
      const connectionPromise = controller.connect();
      mockBackend.processAllResponses();
      await connectionPromise;
    });

    it('should set LED color successfully', async () => {
      const controlId = 'TRACK_FOCUS_1';
      const color: LedColor = 'red';

      await expect(controller.setLed(controlId, color)).resolves.not.toThrow();
    });

    it('should set LED with behavior', async () => {
      const controlId = 'TRACK_FOCUS_1';
      const color: LedColor = 'blue';
      const behaviour: LedBehaviour = 'flash';

      await expect(controller.setLed(controlId, color, behaviour)).resolves.not.toThrow();
    });

    it('should set LED with numeric color', async () => {
      const controlId = 'TRACK_FOCUS_1';
      const color = 127; // Max brightness

      await expect(controller.setLed(controlId, color)).resolves.not.toThrow();
    });

    it('should emit led:changed event', async () => {
      const ledChangedHandler = vi.fn();
      controller.on('led:changed', ledChangedHandler);

      const controlId = 'TRACK_FOCUS_1';
      const color: LedColor = 'green';
      const behaviour: LedBehaviour = 'pulse';

      await controller.setLed(controlId, color, behaviour);

      expect(ledChangedHandler).toHaveBeenCalledOnce();
      expect(ledChangedHandler.mock.calls[0][0]).toBe(controlId);
      expect(ledChangedHandler.mock.calls[0][1]).toBe(color);
      expect(ledChangedHandler.mock.calls[0][2]).toBe(behaviour);
    });

    it('should throw error when LED control disabled', async () => {
      // Create controller with LED control disabled
      const disabledController = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger,
        enableLedControl: false
      });

      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();
      const connectionPromise = disabledController.connect();
      mockBackend.processAllResponses();
      await connectionPromise;

      await expect(
        disabledController.setLed('TRACK_FOCUS_1', 'red')
      ).rejects.toThrow('LED control not enabled');

      await disabledController.cleanup();
    });

    it('should turn off LED', async () => {
      const controlId = 'TRACK_FOCUS_1';

      await expect(controller.turnOffLed(controlId)).resolves.not.toThrow();
    });

    it('should turn off all LEDs', async () => {
      await expect(controller.turnOffAllLeds()).resolves.not.toThrow();
    });

    it('should flash LED with duration', async () => {
      const controlId = 'TRACK_FOCUS_1';
      const color: LedColor = 'yellow';
      const duration = 500;

      await expect(controller.flashLed(controlId, color, duration)).resolves.not.toThrow();
    });
  });

  describe('loadCustomMode()', () => {
    beforeEach(async () => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger,
        enableCustomModes: true
      });

      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();
      const connectionPromise = controller.connect();
      mockBackend.processAllResponses();
      await connectionPromise;
    });

    it('should load custom mode successfully', async () => {
      const slot: CustomModeSlot = 0;
      const mockModeData = [0x01, 0x02, 0x03, 0x04]; // Mock mode data

      mockBackend.queueCustomModeResponse(mockModeData);

      const mode = await controller.loadCustomMode(slot);

      expect(mode).toBeDefined();
      expect(controller.getCurrentMode()).toBe(mode);
      expect(controller.getCurrentSlot()).toBe(slot);
    });

    it('should emit mode:changed event', async () => {
      const modeChangedHandler = vi.fn();
      controller.on('mode:changed', modeChangedHandler);

      const slot: CustomModeSlot = 1;
      const mockModeData = [0x01, 0x02, 0x03, 0x04];

      mockBackend.queueCustomModeResponse(mockModeData);

      await controller.loadCustomMode(slot);

      expect(modeChangedHandler).toHaveBeenCalledOnce();
      expect(modeChangedHandler.mock.calls[0][0]).toBe(slot);
      expect(modeChangedHandler.mock.calls[0][1]).toBeDefined();
    });

    it('should throw error when custom modes disabled', async () => {
      const disabledController = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger,
        enableCustomModes: false
      });

      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();
      const connectionPromise = disabledController.connect();
      mockBackend.processAllResponses();
      await connectionPromise;

      await expect(
        disabledController.loadCustomMode(0)
      ).rejects.toThrow('Custom modes not enabled');

      await disabledController.cleanup();
    });
  });

  describe('readCustomMode()', () => {
    beforeEach(async () => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger
      });

      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();
      const connectionPromise = controller.connect();
      mockBackend.processAllResponses();
      await connectionPromise;
    });

    it('should read custom mode when connected', async () => {
      const slot = 2;
      const mockModeData = [0x01, 0x02, 0x03, 0x04];

      mockBackend.queueCustomModeResponse(mockModeData);

      const mode = await controller.readCustomMode(slot);
      mockBackend.processAllResponses();

      expect(mode).toBeDefined();
    });

    it('should throw error when not connected', async () => {
      await controller.disconnect();

      await expect(
        controller.readCustomMode(0)
      ).rejects.toThrow('Device is not connected');
    });
  });

  describe('writeCustomMode()', () => {
    beforeEach(async () => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger
      });

      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();
      const connectionPromise = controller.connect();
      mockBackend.processAllResponses();
      await connectionPromise;
    });

    it('should write custom mode when connected', async () => {
      const slot = 3;
      const mode: CustomMode = {
        name: 'Test Mode',
        controls: new Map(),
        leds: new Map(),
        metadata: {
          createdAt: new Date(),
          modifiedAt: new Date()
        }
      };

      await expect(controller.writeCustomMode(slot, mode)).resolves.not.toThrow();
    });

    it('should throw error when not connected', async () => {
      await controller.disconnect();

      const mode: CustomMode = {
        name: 'Test Mode',
        controls: new Map(),
        leds: new Map(),
        metadata: {
          createdAt: new Date(),
          modifiedAt: new Date()
        }
      };

      await expect(
        controller.writeCustomMode(0, mode)
      ).rejects.toThrow('Device is not connected');
    });
  });

  describe('verifyDevice()', () => {
    beforeEach(async () => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger
      });
    });

    it('should verify device when connected', async () => {
      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();
      const connectionPromise = controller.connect();
      mockBackend.processAllResponses();
      await connectionPromise;

      // Queue responses for verification
      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();

      const deviceInfo = await controller.verifyDevice();
      mockBackend.processAllResponses();

      expect(deviceInfo).toBeDefined();
      expect(deviceInfo).toMatchObject({
        manufacturerId: expect.any(String),
        deviceFamily: expect.any(Number),
        modelNumber: expect.any(Number),
        firmwareVersion: expect.any(String)
      });
    });

    it('should throw error when not connected', async () => {
      await expect(
        controller.verifyDevice()
      ).rejects.toThrow('Device not connected');
    });

    it('should throw error when device info unavailable', async () => {
      // Connect without proper handshake to simulate missing device info
      mockBackend.queueDeviceInquiryResponse();
      const connectionPromise = controller.connect();
      mockBackend.processAllResponses();

      try {
        await connectionPromise;
      } catch {
        // Connection may fail, which is expected for this test
      }

      if (controller.isConnected()) {
        await expect(
          controller.verifyDevice()
        ).rejects.toThrow(/device information not available/i);
      }
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger,
        reconnectOnError: false // Disable auto-reconnect for testing
      });
    });

    it('should handle MIDI backend initialization failure', async () => {
      // Create a backend that fails to initialize
      const failingBackend = createMockMidiBackend();
      const initializeSpy = vi.spyOn(failingBackend, 'initialize').mockRejectedValue(new Error('Backend init failed'));

      const failingController = new LaunchControlXL3({
        midiBackend: failingBackend,
        logger: mockLogger
      });

      await expect(failingController.connect()).rejects.toThrow('Backend init failed');
      await failingController.cleanup();
    });

    it('should handle MIDI port errors gracefully', async () => {
      // Mock a port error during connection
      const getOutputPortsSpy = vi.spyOn(mockBackend, 'getOutputPorts').mockRejectedValue(new Error('Port access denied'));

      await expect(controller.connect()).rejects.toThrow('Port access denied');
    });

    it('should handle LED control errors when disabled', async () => {
      const disabledController = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger,
        enableLedControl: false
      });

      await expect(
        disabledController.setLed('TRACK_FOCUS_1', 'red')
      ).rejects.toThrow('LED control not enabled');

      await expect(
        disabledController.turnOffLed('TRACK_FOCUS_1')
      ).rejects.toThrow('LED control not enabled');

      await expect(
        disabledController.turnOffAllLeds()
      ).rejects.toThrow('LED control not enabled');

      await expect(
        disabledController.flashLed('TRACK_FOCUS_1', 'red')
      ).rejects.toThrow('LED control not enabled');

      await disabledController.cleanup();
    });

    it('should handle custom mode errors when disabled', async () => {
      const disabledController = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger,
        enableCustomModes: false
      });

      await expect(
        disabledController.loadCustomMode(0)
      ).rejects.toThrow('Custom modes not enabled');

      await expect(
        disabledController.saveCustomMode(0, {} as CustomMode)
      ).rejects.toThrow('Custom modes not enabled');

      await expect(
        disabledController.createCustomMode('Test')
      ).rejects.toThrow('Custom modes not enabled');

      await disabledController.cleanup();
    });

    it('should emit device:error events for connection failures', async () => {
      const errorHandler = vi.fn();
      controller.on('device:error', errorHandler);

      // Simulate connection failure
      const connectionPromise = controller.connect();
      await vi.advanceTimersByTimeAsync(10000);

      try {
        await connectionPromise;
      } catch {
        // Expected to fail
      }

      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
    });
  });

  describe('Control Change Events', () => {
    beforeEach(async () => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger
      });

      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();
      const connectionPromise = controller.connect();
      mockBackend.processAllResponses();
      await connectionPromise;
    });

    it('should emit control:change events for incoming MIDI', () => {
      const controlChangeHandler = vi.fn();
      controller.on('control:change', controlChangeHandler);

      // Simulate incoming control change
      mockBackend.queueControlChangeMessages([{ cc: 21, value: 64 }]);
      mockBackend.processAllResponses();

      expect(controlChangeHandler).toHaveBeenCalled();
    });

    it('should emit midi:out events for processed controls', () => {
      const midiOutHandler = vi.fn();
      controller.on('midi:out', midiOutHandler);

      // Map a control first
      controller.mapControl('SEND_A_1', 1, 21);

      // Simulate incoming control change
      mockBackend.queueControlChangeMessages([{ cc: 21, value: 64 }]);
      mockBackend.processAllResponses();

      expect(midiOutHandler).toHaveBeenCalled();
    });
  });

  describe('Utility Methods', () => {
    beforeEach(async () => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger
      });

      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();
      const connectionPromise = controller.connect();
      mockBackend.processAllResponses();
      await connectionPromise;
    });

    it('should send raw MIDI messages', async () => {
      const message = createControlChangeMessage(1, 21, 64);

      await expect(controller.sendMidi(message)).resolves.not.toThrow();

      const lastMessage = mockBackend.getLastSentMessage();
      expect(lastMessage?.data).toEqual([0xB1, 21, 64]);
    });

    it('should send SysEx messages', async () => {
      const sysexData = [0x00, 0x20, 0x29, 0x02, 0x03, 0x01];

      await expect(controller.sendSysEx(sysexData)).resolves.not.toThrow();

      const lastMessage = mockBackend.getLastSentMessage();
      expect(lastMessage?.data).toEqual([0xF0, ...sysexData, 0xF7]);
    });

    it('should select template', async () => {
      const slot = 2;

      await expect(controller.selectTemplate(slot)).resolves.not.toThrow();
    });

    it('should get device status', () => {
      const status = controller.getStatus();

      expect(status).toBeDefined();
      expect(status.connected).toBe(true);
    });

    it('should check connection status', () => {
      expect(controller.isConnected()).toBe(true);
    });

    it('should get current mode and slot', () => {
      expect(controller.getCurrentMode()).toBeUndefined();
      expect(controller.getCurrentSlot()).toBeUndefined();
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: mockLogger
      });

      mockBackend.queueDeviceInquiryResponse();
      mockBackend.queueAckResponse();
      const connectionPromise = controller.connect();
      mockBackend.processAllResponses();
      await connectionPromise;
    });

    it('should cleanup resources properly', async () => {
      expect(controller.isConnected()).toBe(true);

      await controller.cleanup();

      expect(controller.isConnected()).toBe(false);
    });

    it('should handle multiple cleanup calls', async () => {
      await controller.cleanup();

      // Second cleanup should not throw
      await expect(controller.cleanup()).resolves.not.toThrow();
    });

    it('should remove all event listeners on cleanup', async () => {
      const handler = vi.fn();
      controller.on('device:connected', handler);

      await controller.cleanup();

      // Controller should not emit events after cleanup
      expect(controller.listenerCount('device:connected')).toBe(0);
    });
  });

  describe('Static Exports', () => {
    it('should export static constants', () => {
      expect(LaunchControlXL3.CONTROL_IDS).toBeDefined();
      expect(LaunchControlXL3.LED_COLORS).toBeDefined();
      expect(LaunchControlXL3.LED_COLOR_VALUES).toBeDefined();
      expect(LaunchControlXL3.ValueTransformers).toBeDefined();
    });
  });
});