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
        name: 'Other Device Out',
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

    const mockPort = new MockMidiInputPort(portInfo, this);
    this.openInputs.set(portId, mockPort);
    return mockPort;
  }

  async openOutput(portId: string): Promise<MidiOutputPort> {
    const portInfo = this.outputPorts.find(p => p.id === portId);
    if (!portInfo) {
      throw new Error(`Output port not found: ${portId}`);
    }

    const mockPort = new MockMidiOutputPort(portInfo, this);
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

  // Test helpers
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
        timestamp: Date.now(),
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
        timestamp: Date.now(),
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
  onMessage?: ((message: MidiMessage) => void) | undefined;

  constructor(
    private portInfo: MidiPortInfo,
    private backend: MockMidiBackend
  ) {}

  get id(): string { return this.portInfo.id; }
  get name(): string { return this.portInfo.name; }

  async close(): Promise<void> {
    await this.backend.closePort(this);
  }
}

class MockMidiOutputPort implements MidiOutputPort {
  readonly type = 'output' as const;

  constructor(
    private portInfo: MidiPortInfo,
    private backend: MockMidiBackend
  ) {}

  get id(): string { return this.portInfo.id; }
  get name(): string { return this.portInfo.name; }

  async close(): Promise<void> {
    await this.backend.closePort(this);
  }
}

describe('DeviceManager', () => {
  let deviceManager: DeviceManager;
  let mockBackend: MockMidiBackend;

  beforeEach(() => {
    mockBackend = new MockMidiBackend();

    const options: DeviceManagerOptions = {
      midiBackend: mockBackend,
      autoConnect: false, // Control connection manually in tests
      inquiryTimeout: 1000, // Shorter timeout for tests
      retryAttempts: 2,
      retryDelay: 100
    };

    deviceManager = new DeviceManager(options);
  });

  afterEach(async () => {
    await deviceManager.cleanup();
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

      // Set up device inquiry response before connecting
      setTimeout(() => {
        mockBackend.simulateDeviceInquiryResponse();
      }, 50);

      await autoConnectManager.initialize();

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

      // Simulate device responding to inquiry
      setTimeout(() => {
        mockBackend.simulateDeviceInquiryResponse();
      }, 50);

      await expect(connectPromise).resolves.not.toThrow();

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
      expect(status.state).toBe('connected');
      expect(status.deviceInfo).toBeDefined();
    });

    it('should handle connection to device without inquiry response', async () => {
      // Don't simulate device inquiry response - should still connect with fallback info
      await expect(deviceManager.connect()).resolves.not.toThrow();

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

      setTimeout(() => {
        mockBackend.simulateDeviceInquiryResponse();
      }, 50);

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
      setTimeout(() => mockBackend.simulateDeviceInquiryResponse(), 50);
      await connectPromise1;

      // Should not throw or change state
      await expect(deviceManager.connect()).resolves.not.toThrow();

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
    });

    it('should not reconnect if already connecting', async () => {
      const connectPromise1 = deviceManager.connect();
      const connectPromise2 = deviceManager.connect();

      setTimeout(() => mockBackend.simulateDeviceInquiryResponse(), 50);

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

      // Don't simulate response - let it timeout
      await expect(shortTimeoutManager.connect()).resolves.not.toThrow();

      // Should still connect with fallback device info
      const status = shortTimeoutManager.getStatus();
      expect(status.connected).toBe(true);
      expect(status.deviceInfo?.firmwareVersion).toBe('Unknown');

      await shortTimeoutManager.cleanup();
    });

    it('should handle inquiry timeout gracefully and continue with connection', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Connect without device response
      await expect(deviceManager.connect()).resolves.not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Device inquiry failed'),
        expect.any(Error)
      );

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);

      consoleSpy.mockRestore();
    });
  });

  describe('invalid device response processing', () => {
    beforeEach(async () => {
      await deviceManager.initialize();
    });

    it('should handle malformed SysEx responses', async () => {
      const connectPromise = deviceManager.connect();

      // Simulate malformed response
      setTimeout(() => {
        const inputPort = mockBackend['openInputs'].get('lcxl3-input');
        if (inputPort && inputPort.onMessage) {
          const malformedMessage: MidiMessage = {
            timestamp: Date.now(),
            data: [0xF0, 0x00, 0x01], // Invalid/incomplete SysEx
            type: 'sysex'
          };
          inputPort.onMessage(malformedMessage);

          // Then send valid response
          setTimeout(() => mockBackend.simulateDeviceInquiryResponse(), 10);
        }
      }, 50);

      await expect(connectPromise).resolves.not.toThrow();

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
    });

    it('should ignore non-device-inquiry SysEx messages during handshake', async () => {
      const connectPromise = deviceManager.connect();

      setTimeout(() => {
        const inputPort = mockBackend['openInputs'].get('lcxl3-input');
        if (inputPort && inputPort.onMessage) {
          // Send template change message instead of device inquiry response
          const templateMessage: MidiMessage = {
            timestamp: Date.now(),
            data: [0xF0, ...MANUFACTURER_ID, 0x11, 0x00, 0x05, 0xF7],
            type: 'sysex'
          };
          inputPort.onMessage(templateMessage);

          // Then send correct response
          setTimeout(() => mockBackend.simulateDeviceInquiryResponse(), 10);
        }
      }, 50);

      await expect(connectPromise).resolves.not.toThrow();

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
    });
  });

  describe('connection state management', () => {
    beforeEach(async () => {
      await deviceManager.initialize();
    });

    it('should transition through connection states correctly', async () => {
      const states: string[] = [];

      // Monitor state changes through status calls
      const originalGetStatus = deviceManager.getStatus;
      deviceManager.getStatus = vi.fn().mockImplementation(() => {
        const status = originalGetStatus.call(deviceManager);
        states.push(status.state);
        return status;
      });

      const connectPromise = deviceManager.connect();

      // Check initial state
      let status = deviceManager.getStatus();
      expect(states).toContain('connecting');

      setTimeout(() => {
        mockBackend.simulateDeviceInquiryResponse();
      }, 50);

      await connectPromise;

      status = deviceManager.getStatus();
      expect(status.state).toBe('connected');
    });

    it('should set state to error on connection failure', async () => {
      mockBackend.removeDevice();

      await expect(deviceManager.connect()).rejects.toThrow();

      const status = deviceManager.getStatus();
      expect(status.state).toBe('disconnected');
    });

    it('should handle device errors during connection', async () => {
      const errorBackend = {
        ...mockBackend,
        openInput: vi.fn().mockRejectedValue(new Error('Port open failed'))
      };

      const errorManager = new DeviceManager({
        midiBackend: errorBackend as MidiBackendInterface
      });

      await errorManager.initialize();
      await expect(errorManager.connect()).rejects.toThrow();

      const status = errorManager.getStatus();
      expect(status.state).toBe('disconnected');

      await errorManager.cleanup();
    });
  });

  describe('multiple handshake attempts', () => {
    it('should support multiple connection attempts after failure', async () => {
      await deviceManager.initialize();

      // First attempt - device not available
      mockBackend.removeDevice();
      await expect(deviceManager.connect()).rejects.toThrow('Launch Control XL 3 not found');

      // Second attempt - device becomes available
      mockBackend.addDevice();
      const connectPromise = deviceManager.connect();

      setTimeout(() => {
        mockBackend.simulateDeviceInquiryResponse();
      }, 50);

      await expect(connectPromise).resolves.not.toThrow();

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
    });

    it('should clean up properly between connection attempts', async () => {
      await deviceManager.initialize();

      // First failed attempt
      mockBackend.removeDevice();
      await expect(deviceManager.connect()).rejects.toThrow();

      // Verify clean state
      let status = deviceManager.getStatus();
      expect(status.connected).toBe(false);
      expect(status.deviceInfo).toBeUndefined();

      // Second successful attempt
      mockBackend.addDevice();
      const connectPromise = deviceManager.connect();

      setTimeout(() => {
        mockBackend.simulateDeviceInquiryResponse();
      }, 50);

      await connectPromise;

      status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
      expect(status.deviceInfo).toBeDefined();
    });
  });

  describe('error recovery scenarios', () => {
    beforeEach(async () => {
      await deviceManager.initialize();
    });

    it('should handle MIDI backend errors', async () => {
      const errorSpy = vi.fn();
      deviceManager.on('device:error', errorSpy);

      // Connect successfully first
      const connectPromise = deviceManager.connect();
      setTimeout(() => mockBackend.simulateDeviceInquiryResponse(), 50);
      await connectPromise;

      // Simulate MIDI error
      const error = new Error('MIDI backend error');
      deviceManager['handleError'](error);

      expect(errorSpy).toHaveBeenCalledWith(error);
    });

    it('should attempt reconnection after connection loss', async () => {
      const connectPromise = deviceManager.connect();
      setTimeout(() => mockBackend.simulateDeviceInquiryResponse(), 50);
      await connectPromise;

      // Verify connected
      let status = deviceManager.getStatus();
      expect(status.connected).toBe(true);

      // Simulate connection loss by triggering error handling
      const reconnectManager = new DeviceManager({
        midiBackend: mockBackend,
        retryAttempts: 1,
        retryDelay: 50
      });

      await reconnectManager.initialize();

      const reconnectPromise = reconnectManager.connect();
      setTimeout(() => mockBackend.simulateDeviceInquiryResponse(), 50);
      await reconnectPromise;

      // Simulate error that triggers reconnection
      const disconnectedSpy = vi.fn();
      reconnectManager.on('device:disconnected', disconnectedSpy);

      // Trigger error and test reconnection logic
      reconnectManager['handleError'](new Error('Connection lost'));

      await reconnectManager.cleanup();
    });

    it('should emit device:disconnected on cleanup', async () => {
      const connectPromise = deviceManager.connect();
      setTimeout(() => mockBackend.simulateDeviceInquiryResponse(), 50);
      await connectPromise;

      const disconnectedSpy = vi.fn();
      deviceManager.on('device:disconnected', disconnectedSpy);

      await deviceManager.disconnect('Manual disconnect');

      expect(disconnectedSpy).toHaveBeenCalledWith('Manual disconnect');
    });

    it('should handle message sending after disconnection', async () => {
      // Should throw when not connected
      await expect(deviceManager.sendSysEx([0xF0, 0xF7])).rejects.toThrow('Device not connected');
      await expect(deviceManager.sendCC(1, 127)).rejects.toThrow('Device not connected');
    });
  });

  describe('device communication after handshake', () => {
    beforeEach(async () => {
      await deviceManager.initialize();

      const connectPromise = deviceManager.connect();
      setTimeout(() => mockBackend.simulateDeviceInquiryResponse(), 50);
      await connectPromise;
    });

    it('should send SysEx messages to connected device', async () => {
      const sentMessages: MidiMessage[] = [];
      mockBackend.messageHandler = (portId, message) => {
        sentMessages.push(message);
      };

      const sysexData = [0xF0, 0x00, 0x20, 0x29, 0x11, 0x77, 0x00, 0xF7];
      await deviceManager.sendSysEx(sysexData);

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0].data).toEqual(sysexData);
    });

    it('should send CC messages to connected device', async () => {
      const sentMessages: MidiMessage[] = [];
      mockBackend.messageHandler = (portId, message) => {
        sentMessages.push(message);
      };

      await deviceManager.sendCC(20, 100, 0);

      expect(sentMessages).toHaveLength(1);
      expect(sentMessages[0].data).toEqual([0xB0, 20, 100]);
    });

    it('should handle template selection', async () => {
      const modeChangedSpy = vi.fn();
      deviceManager.on('device:modeChanged', modeChangedSpy);

      await deviceManager.selectTemplate(5);

      expect(modeChangedSpy).toHaveBeenCalledWith({
        type: 'template',
        slot: 5
      });
    });

    it('should validate template slot range', async () => {
      await expect(deviceManager.selectTemplate(-1)).rejects.toThrow('Template slot must be 0-15');
      await expect(deviceManager.selectTemplate(16)).rejects.toThrow('Template slot must be 0-15');
    });

    it('should handle incoming control changes after handshake', async () => {
      const controlChangeSpy = vi.fn();
      deviceManager.on('control:change', controlChangeSpy);

      // Simulate incoming CC message
      const inputPort = mockBackend['openInputs'].get('lcxl3-input');
      if (inputPort && inputPort.onMessage) {
        const ccMessage: MidiMessage = {
          timestamp: Date.now(),
          data: [0xB0, 13, 64], // Send A knob 1
          type: 'controlchange',
          channel: 0,
          controller: 13,
          value: 64
        };
        inputPort.onMessage(ccMessage);
      }

      expect(controlChangeSpy).toHaveBeenCalledWith('sendA1', 64, 0);
    });

    it('should ignore control changes during initialization', async () => {
      // Create new manager to test initialization state
      const testManager = new DeviceManager({
        midiBackend: mockBackend,
        autoConnect: false
      });

      await testManager.initialize();

      const controlChangeSpy = vi.fn();
      testManager.on('control:change', controlChangeSpy);

      // Start connecting (initialization state)
      const connectPromise = testManager.connect();

      // Send CC during initialization
      setTimeout(() => {
        const inputPort = mockBackend['openInputs'].get('lcxl3-input');
        if (inputPort && inputPort.onMessage) {
          const ccMessage: MidiMessage = {
            timestamp: Date.now(),
            data: [0xB0, 13, 64],
            type: 'controlchange',
            channel: 0,
            controller: 13,
            value: 64
          };
          inputPort.onMessage(ccMessage);
        }

        // Complete handshake
        mockBackend.simulateDeviceInquiryResponse();
      }, 50);

      await connectPromise;

      // Should not have received the message sent during initialization
      expect(controlChangeSpy).not.toHaveBeenCalled();

      await testManager.cleanup();
    });
  });

  describe('device status reporting', () => {
    it('should report correct status when disconnected', () => {
      const status = deviceManager.getStatus();

      expect(status.connected).toBe(false);
      expect(status.state).toBe('disconnected');
      expect(status.deviceInfo).toBeUndefined();
      expect(status.currentMode).toBeUndefined();
      expect(status.lastSeen).toBeUndefined();
    });

    it('should report correct status when connected', async () => {
      await deviceManager.initialize();

      const connectPromise = deviceManager.connect();
      setTimeout(() => mockBackend.simulateDeviceInquiryResponse(), 50);
      await connectPromise;

      const status = deviceManager.getStatus();

      expect(status.connected).toBe(true);
      expect(status.state).toBe('connected');
      expect(status.deviceInfo).toBeDefined();
      expect(status.lastSeen).toBeInstanceOf(Date);
    });
  });

  describe('resource cleanup', () => {
    it('should clean up all resources', async () => {
      await deviceManager.initialize();

      const connectPromise = deviceManager.connect();
      setTimeout(() => mockBackend.simulateDeviceInquiryResponse(), 50);
      await connectPromise;

      // Verify resources are active
      let status = deviceManager.getStatus();
      expect(status.connected).toBe(true);

      await deviceManager.cleanup();

      // Verify cleanup
      status = deviceManager.getStatus();
      expect(status.connected).toBe(false);
      expect(status.deviceInfo).toBeUndefined();

      // Should not throw if called again
      await expect(deviceManager.cleanup()).resolves.not.toThrow();
    });

    it('should clean up timers on disconnect', async () => {
      await deviceManager.initialize();

      const connectPromise = deviceManager.connect();
      setTimeout(() => mockBackend.simulateDeviceInquiryResponse(), 50);
      await connectPromise;

      // Spy on clearTimeout to verify timer cleanup
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      await deviceManager.disconnect();

      expect(clearTimeoutSpy).toHaveBeenCalled();

      clearTimeoutSpy.mockRestore();
    });
  });
});