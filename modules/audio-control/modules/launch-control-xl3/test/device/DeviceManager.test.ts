/**
 * DeviceManager Unit Tests
 *
 * Tests for Feature MVP.2 (Device Handshake) functionality including:
 * - Device discovery and connection
 * - SysEx-based handshake protocol
 * - Timeout and error handling
 * - Connection state management
 * - Reconnection scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeviceManager, DeviceManagerOptions } from '@/device/DeviceManager';
import { MidiInterface, MidiBackendInterface, MidiPortInfo, MidiInputPort, MidiOutputPort, MidiMessage, createMockBackend } from '@/core/MidiInterface';
import { SysExParser, MANUFACTURER_ID } from '@/core/SysExParser';
import type { DeviceInquiryResponse, LaunchControlXL3Info } from '@/types/index';

// Mock implementations
class MockMidiBackend implements MidiBackendInterface {
  private isInitialized = false;
  private inputPorts: MidiPortInfo[] = [];
  private outputPorts: MidiPortInfo[] = [];
  private openInputs = new Map<string, MockMidiInputPort>();
  private openOutputs = new Map<string, MockMidiOutputPort>();
  public messageHandler?: (port: string, message: MidiMessage) => void;
  private mockTime = 1704067200000; // Fixed timestamp for deterministic testing

  constructor() {
    this.setupDefaultPorts();
  }

  private setupDefaultPorts(): void {
    this.inputPorts = [
      {
        id: 'lcxl3-input',
        name: 'LCXL3 1 MIDI Out',
        manufacturer: 'Novation',
        version: '1.0.0'
      },
      {
        id: 'other-input',
        name: 'Other Device',
        manufacturer: 'Other',
        version: '1.0.0'
      }
    ];

    this.outputPorts = [
      {
        id: 'lcxl3-output',
        name: 'LCXL3 1 DAW In',
        manufacturer: 'Novation',
        version: '1.0.0'
      },
      {
        id: 'other-output',
        name: 'Other Device',
        manufacturer: 'Other',
        version: '1.0.0'
      }
    ];
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async getInputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }
    return [...this.inputPorts];
  }

  async getOutputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }
    return [...this.outputPorts];
  }

  async openInput(portId: string): Promise<MidiInputPort> {
    const portInfo = this.inputPorts.find(p => p.id === portId);
    if (!portInfo) {
      throw new Error(`Input port not found: ${portId}`);
    }

    const mockPort = new MockMidiInputPort(portInfo.id, portInfo.name);
    this.openInputs.set(portId, mockPort);
    return mockPort;
  }

  async openOutput(portId: string): Promise<MidiOutputPort> {
    const portInfo = this.outputPorts.find(p => p.id === portId);
    if (!portInfo) {
      throw new Error(`Output port not found: ${portId}`);
    }

    const mockPort = new MockMidiOutputPort(portInfo.id, portInfo.name);
    this.openOutputs.set(portId, mockPort);
    return mockPort;
  }

  async sendMessage(port: MidiOutputPort, message: MidiMessage): Promise<void> {
    // Simulate message being sent - can be intercepted by tests
    if (this.messageHandler) {
      this.messageHandler(port.id, message);
    }
  }

  async closePort(port: MidiInputPort | MidiOutputPort): Promise<void> {
    if (port.type === 'input') {
      this.openInputs.delete(port.id);
    } else {
      this.openOutputs.delete(port.id);
    }
  }

  async cleanup(): Promise<void> {
    this.openInputs.clear();
    this.openOutputs.clear();
    this.isInitialized = false;
  }

  // Test helpers - these are now synchronous and deterministic
  simulateDeviceInquiryResponse(): void {
    const inputPort = this.openInputs.get('lcxl3-input');
    if (inputPort && inputPort.onMessage) {
      const responseData = [
        0xF0, // Start
        0x7E, // Universal non-realtime
        0x00, // Device ID
        0x06, // Inquiry response
        0x02, // Sub-ID
        0x00, 0x20, 0x29, // Manufacturer ID (Novation)
        0x00, 0x61, // Family code
        0x00, 0x01, // Family member
        0x01, 0x00, 0x00, 0x00, // Software revision
        0xF7, // End
      ];

      const message: MidiMessage = {
        timestamp: this.mockTime, // Use fixed timestamp instead of Date.now()
        data: responseData,
        type: 'sysex'
      };

      inputPort.onMessage(message);
    }
  }

  simulateTemplateChangeResponse(templateNumber: number): void {
    const inputPort = this.openInputs.get('lcxl3-input');
    if (inputPort && inputPort.onMessage) {
      const responseData = [
        0xF0, // Start
        ...MANUFACTURER_ID,
        0x11, // Device ID
        0x00, // Template change response
        templateNumber,
        0xF7, // End
      ];

      const message: MidiMessage = {
        timestamp: this.mockTime, // Use fixed timestamp instead of Date.now()
        data: responseData,
        type: 'sysex'
      };

      inputPort.onMessage(message);
    }
  }

  removeDevice(): void {
    this.inputPorts = this.inputPorts.filter(p => !p.name.includes('LCXL3'));
    this.outputPorts = this.outputPorts.filter(p => !p.name.includes('LCXL3'));
  }

  addDevice(): void {
    if (!this.inputPorts.find(p => p.id === 'lcxl3-input')) {
      this.inputPorts.unshift({
        id: 'lcxl3-input',
        name: 'LCXL3 1 MIDI Out',
        manufacturer: 'Novation',
        version: '1.0.0'
      });
    }
    if (!this.outputPorts.find(p => p.id === 'lcxl3-output')) {
      this.outputPorts.unshift({
        id: 'lcxl3-output',
        name: 'LCXL3 1 DAW In',
        manufacturer: 'Novation',
        version: '1.0.0'
      });
    }
  }
}

class MockMidiInputPort implements MidiInputPort {
  readonly type = 'input' as const;
  onMessage?: (message: MidiMessage) => void;

  constructor(
    public readonly id: string,
    public readonly name: string
  ) {}

  async close(): Promise<void> {
    // Mock close operation
  }
}

class MockMidiOutputPort implements MidiOutputPort {
  readonly type = 'output' as const;

  constructor(
    public readonly id: string,
    public readonly name: string
  ) {}

  async close(): Promise<void> {
    // Mock close operation
  }
}

describe('DeviceManager', () => {
  let deviceManager: DeviceManager;
  let mockBackend: MockMidiBackend;
  let mockTime: number;

  beforeEach(() => {
    vi.useFakeTimers();
    mockTime = 1704067200000; // 2024-01-01T00:00:00Z
    vi.setSystemTime(mockTime);

    mockBackend = new MockMidiBackend();
    deviceManager = new DeviceManager({
      midiBackend: mockBackend,
      inquiryTimeout: 1000
    });
  });

  afterEach(async () => {
    vi.clearAllTimers();
    vi.useRealTimers();
    await deviceManager.cleanup();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid backend', async () => {
      await expect(deviceManager.initialize()).resolves.not.toThrow();
    });

    it('should initialize and auto-connect when autoConnect is true', async () => {
      const autoConnectManager = new DeviceManager({
        midiBackend: mockBackend,
        autoConnect: true,
        inquiryTimeout: 100
      });

      const connectSpy = vi.spyOn(autoConnectManager, 'connect');

      const initPromise = autoConnectManager.initialize();

      // Advance timers to trigger auto-connect and simulate device response
      await vi.runOnlyPendingTimersAsync();
      mockBackend.simulateDeviceInquiryResponse();
      await vi.runOnlyPendingTimersAsync();

      await initPromise;

      expect(connectSpy).toHaveBeenCalled();
      await autoConnectManager.cleanup();
    });

    it('should handle initialization errors gracefully', async () => {
      const errorBackend = {
        ...mockBackend,
        initialize: vi.fn().mockRejectedValue(new Error('Backend init failed'))
      };

      const errorManager = new DeviceManager({
        midiBackend: errorBackend as MidiBackendInterface
      });

      await expect(errorManager.initialize()).rejects.toThrow('Backend init failed');
    });
  });

  describe('device discovery and connection', () => {
    beforeEach(async () => {
      await deviceManager.initialize();
    });

    it('should successfully connect to Launch Control XL3', async () => {
      const connectPromise = deviceManager.connect();

      // Advance timers to trigger inquiry and simulate device response
      await vi.runOnlyPendingTimersAsync();
      mockBackend.simulateDeviceInquiryResponse();
      await vi.runOnlyPendingTimersAsync();

      await connectPromise;

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
      expect(status.state).toBe('connected');
      expect(status.deviceInfo).toBeDefined();
    });

    it('should handle connection to device without inquiry response', async () => {
      // Don't simulate device inquiry response - should still connect with fallback info
      const connectPromise = deviceManager.connect();

      // Advance timers to trigger timeout
      await vi.advanceTimersByTimeAsync(1000);

      await connectPromise;

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
      expect(status.deviceInfo?.name).toBe('Launch Control XL 3');
      expect(status.deviceInfo?.firmwareVersion).toBe('Unknown');
    });

    it('should emit device:connected and device:ready events', async () => {
      const connectedSpy = vi.fn();
      const readySpy = vi.fn();

      deviceManager.on('device:connected', connectedSpy);
      deviceManager.on('device:ready', readySpy);

      const connectPromise = deviceManager.connect();

      // Advance timers and simulate device response
      await vi.runOnlyPendingTimersAsync();
      mockBackend.simulateDeviceInquiryResponse();
      await vi.runOnlyPendingTimersAsync();

      await connectPromise;

      expect(connectedSpy).toHaveBeenCalledWith(expect.objectContaining({
        manufacturerId: '00 20 29',
        deviceFamily: 0x61,
        modelNumber: 0x01
      }));
      expect(readySpy).toHaveBeenCalled();
    });

    it('should not reconnect if already connected', async () => {
      const connectPromise1 = deviceManager.connect();

      await vi.runOnlyPendingTimersAsync();
      mockBackend.simulateDeviceInquiryResponse();
      await vi.runOnlyPendingTimersAsync();

      await connectPromise1;

      // Should not throw or change state
      await expect(deviceManager.connect()).resolves.not.toThrow();

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
    });

    it('should not reconnect if already connecting', async () => {
      const connectPromise1 = deviceManager.connect();
      const connectPromise2 = deviceManager.connect();

      await vi.runOnlyPendingTimersAsync();
      mockBackend.simulateDeviceInquiryResponse();
      await vi.runOnlyPendingTimersAsync();

      await Promise.all([connectPromise1, connectPromise2]);

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
    });

    it('should fail when device not found', async () => {
      mockBackend.removeDevice();

      await expect(deviceManager.connect()).rejects.toThrow('Launch Control XL 3 not found');

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(false);
      expect(status.state).toBe('disconnected');
    });
  });

  describe('handshake timeout handling', () => {
    beforeEach(async () => {
      await deviceManager.initialize();
    });

    it('should timeout when device does not respond to inquiry', async () => {
      const shortTimeoutManager = new DeviceManager({
        midiBackend: mockBackend,
        inquiryTimeout: 100 // Very short timeout
      });

      await shortTimeoutManager.initialize();

      const connectPromise = shortTimeoutManager.connect();

      // Advance timers to trigger timeout without simulating response
      await vi.advanceTimersByTimeAsync(100);

      await connectPromise;

      // Should still connect with fallback device info
      const status = shortTimeoutManager.getStatus();
      expect(status.connected).toBe(true);
      expect(status.deviceInfo?.firmwareVersion).toBe('Unknown');

      await shortTimeoutManager.cleanup();
    });

    it('should handle device that responds after timeout', async () => {
      const shortTimeoutManager = new DeviceManager({
        midiBackend: mockBackend,
        inquiryTimeout: 50
      });

      await shortTimeoutManager.initialize();

      const connectPromise = shortTimeoutManager.connect();

      // Advance past timeout
      await vi.advanceTimersByTimeAsync(60);

      // Late response should be ignored
      mockBackend.simulateDeviceInquiryResponse();

      await connectPromise;

      const status = shortTimeoutManager.getStatus();
      expect(status.connected).toBe(true);
      expect(status.deviceInfo?.firmwareVersion).toBe('Unknown');

      await shortTimeoutManager.cleanup();
    });
  });

  describe('reconnection scenarios', () => {
    beforeEach(async () => {
      await deviceManager.initialize();
    });

    it('should reconnect after device disconnection', async () => {
      // Initial connection
      const connectPromise1 = deviceManager.connect();
      await vi.runOnlyPendingTimersAsync();
      mockBackend.simulateDeviceInquiryResponse();
      await vi.runOnlyPendingTimersAsync();
      await connectPromise1;

      expect(deviceManager.getStatus().connected).toBe(true);

      // Simulate device removal and reconnection
      await deviceManager.disconnect();
      expect(deviceManager.getStatus().connected).toBe(false);

      // Reconnect
      const connectPromise2 = deviceManager.connect();
      await vi.runOnlyPendingTimersAsync();
      mockBackend.simulateDeviceInquiryResponse();
      await vi.runOnlyPendingTimersAsync();
      await connectPromise2;

      expect(deviceManager.getStatus().connected).toBe(true);
    });

    it('should handle device being physically removed and added back', async () => {
      // Initial connection
      const connectPromise1 = deviceManager.connect();
      await vi.runOnlyPendingTimersAsync();
      mockBackend.simulateDeviceInquiryResponse();
      await vi.runOnlyPendingTimersAsync();
      await connectPromise1;

      expect(deviceManager.getStatus().connected).toBe(true);

      // Simulate device removal
      mockBackend.removeDevice();
      await deviceManager.disconnect();

      // Try to connect - should fail
      await expect(deviceManager.connect()).rejects.toThrow('Launch Control XL 3 not found');

      // Add device back
      mockBackend.addDevice();

      // Should be able to connect again
      const connectPromise2 = deviceManager.connect();
      await vi.runOnlyPendingTimersAsync();
      mockBackend.simulateDeviceInquiryResponse();
      await vi.runOnlyPendingTimersAsync();
      await connectPromise2;

      expect(deviceManager.getStatus().connected).toBe(true);
    });
  });

  describe('disconnection', () => {
    beforeEach(async () => {
      await deviceManager.initialize();
    });

    it('should disconnect cleanly', async () => {
      // Connect first
      const connectPromise = deviceManager.connect();
      await vi.runOnlyPendingTimersAsync();
      mockBackend.simulateDeviceInquiryResponse();
      await vi.runOnlyPendingTimersAsync();
      await connectPromise;

      expect(deviceManager.getStatus().connected).toBe(true);

      // Disconnect
      await deviceManager.disconnect();

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(false);
      expect(status.state).toBe('disconnected');
      expect(status.deviceInfo).toBeUndefined();
    });

    it('should handle disconnect when not connected', async () => {
      await expect(deviceManager.disconnect()).resolves.not.toThrow();

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(false);
      expect(status.state).toBe('disconnected');
    });

    it('should emit device:disconnected event', async () => {
      const disconnectedSpy = vi.fn();
      deviceManager.on('device:disconnected', disconnectedSpy);

      // Connect first
      const connectPromise = deviceManager.connect();
      await vi.runOnlyPendingTimersAsync();
      mockBackend.simulateDeviceInquiryResponse();
      await vi.runOnlyPendingTimersAsync();
      await connectPromise;

      // Disconnect
      await deviceManager.disconnect();

      expect(disconnectedSpy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await deviceManager.initialize();
    });

    it('should handle MIDI backend errors during connection', async () => {
      const errorBackend = {
        ...mockBackend,
        openInput: vi.fn().mockRejectedValue(new Error('Failed to open input'))
      };

      const errorManager = new DeviceManager({
        midiBackend: errorBackend as MidiBackendInterface
      });

      await errorManager.initialize();

      await expect(errorManager.connect()).rejects.toThrow('Failed to open input');

      await errorManager.cleanup();
    });

    it('should emit device:error event on connection errors', async () => {
      const errorSpy = vi.fn();
      deviceManager.on('device:error', errorSpy);

      mockBackend.removeDevice(); // No device available

      await expect(deviceManager.connect()).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('device status', () => {
    beforeEach(async () => {
      await deviceManager.initialize();
    });

    it('should return correct initial status', () => {
      const status = deviceManager.getStatus();

      expect(status).toEqual({
        connected: false,
        state: 'disconnected',
        deviceInfo: undefined,
        lastConnected: undefined,
        errorCount: 0
      });
    });

    it('should update status after successful connection', async () => {
      const connectPromise = deviceManager.connect();
      await vi.runOnlyPendingTimersAsync();
      mockBackend.simulateDeviceInquiryResponse();
      await vi.runOnlyPendingTimersAsync();
      await connectPromise;

      const status = deviceManager.getStatus();

      expect(status.connected).toBe(true);
      expect(status.state).toBe('connected');
      expect(status.deviceInfo).toBeDefined();
      expect(status.lastConnected).toBeDefined();
      expect(status.errorCount).toBe(0);
    });

    it('should track error count', async () => {
      // Remove device to cause connection error
      mockBackend.removeDevice();

      try {
        await deviceManager.connect();
      } catch {
        // Expected to fail
      }

      const status = deviceManager.getStatus();
      expect(status.errorCount).toBe(1);

      // Try again
      try {
        await deviceManager.connect();
      } catch {
        // Expected to fail
      }

      const status2 = deviceManager.getStatus();
      expect(status2.errorCount).toBe(2);
    });
  });
});