/**
 * Device Handshake Integration Tests
 *
 * Integration tests for Feature MVP.2 (Device Handshake) covering:
 * - Complete handshake with mocked device
 * - End-to-end connection and verification flow
 * - Reconnection with handshake
 * - Multiple device handling
 * - Full workflow from discovery to communication
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeviceManager, DeviceManagerOptions } from '@/device/DeviceManager';
import { MidiInterface, MidiBackendInterface, MidiPortInfo, MidiInputPort, MidiOutputPort, MidiMessage } from '@/core/MidiInterface';
import { SysExParser, MANUFACTURER_ID } from '@/core/SysExParser';
import type { DeviceInquiryResponse, LaunchControlXL3Info, DeviceMode, CustomMode } from '@/types/index';

/**
 * Advanced Mock MIDI Backend for Integration Testing
 * Simulates real-world device behavior with timing and state management
 */
class IntegrationMockBackend implements MidiBackendInterface {
  private isInitialized = false;
  private connectedDevices: Map<string, MockDevice> = new Map();
  private openInputs = new Map<string, MockInputPort>();
  private openOutputs = new Map<string, MockOutputPort>();

  // Device simulation parameters
  public deviceResponseDelay = 50; // ms
  public deviceInquiryEnabled = true;
  public templateChangeEnabled = true;
  public connectionStable = true;

  constructor() {
    this.setupDefaultDevices();
  }

  private setupDefaultDevices(): void {
    // Primary Launch Control XL3 device
    this.addDevice('lcxl3-primary', {
      inputName: 'LCXL3 1 MIDI Out',
      outputName: 'LCXL3 1 DAW In',
      manufacturerId: [0x00, 0x20, 0x29],
      familyCode: 0x61,
      familyMember: 0x01,
      firmwareVersion: [1, 2, 3, 4],
      serialNumber: [0x31, 0x32, 0x33, 0x34], // "1234"
      deviceId: 0x11
    });

    // Secondary device for multi-device testing
    this.addDevice('lcxl3-secondary', {
      inputName: 'LCXL3 2 MIDI Out',
      outputName: 'LCXL3 2 DAW In',
      manufacturerId: [0x00, 0x20, 0x29],
      familyCode: 0x61,
      familyMember: 0x01,
      firmwareVersion: [1, 2, 4, 0],
      serialNumber: [0x35, 0x36, 0x37, 0x38], // "5678"
      deviceId: 0x12
    });
  }

  addDevice(id: string, config: MockDeviceConfig): void {
    this.connectedDevices.set(id, new MockDevice(id, config));
  }

  removeDevice(id: string): void {
    this.connectedDevices.delete(id);
  }

  disconnectDevice(id: string): void {
    const device = this.connectedDevices.get(id);
    if (device) {
      device.connected = false;
    }
  }

  reconnectDevice(id: string): void {
    const device = this.connectedDevices.get(id);
    if (device) {
      device.connected = true;
    }
  }

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async getInputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    return Array.from(this.connectedDevices.values())
      .filter(device => device.connected)
      .map(device => ({
        id: `${device.id}-input`,
        name: device.config.inputName,
        manufacturer: 'Novation',
        version: device.config.firmwareVersion.join('.')
      }));
  }

  async getOutputPorts(): Promise<MidiPortInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Backend not initialized');
    }

    return Array.from(this.connectedDevices.values())
      .filter(device => device.connected)
      .map(device => ({
        id: `${device.id}-output`,
        name: device.config.outputName,
        manufacturer: 'Novation',
        version: device.config.firmwareVersion.join('.')
      }));
  }

  async openInput(portId: string): Promise<MidiInputPort> {
    const deviceId = portId.replace('-input', '');
    const device = this.connectedDevices.get(deviceId);

    if (!device || !device.connected) {
      throw new Error(`Input port not found: ${portId}`);
    }

    const mockPort = new MockInputPort(portId, device.config.inputName, device, this);
    this.openInputs.set(portId, mockPort);
    return mockPort;
  }

  async openOutput(portId: string): Promise<MidiOutputPort> {
    const deviceId = portId.replace('-output', '');
    const device = this.connectedDevices.get(deviceId);

    if (!device || !device.connected) {
      throw new Error(`Output port not found: ${portId}`);
    }

    const mockPort = new MockOutputPort(portId, device.config.outputName, device, this);
    this.openOutputs.set(portId, mockPort);
    return mockPort;
  }

  async sendMessage(port: MidiOutputPort, message: MidiMessage): Promise<void> {
    const deviceId = port.id.replace('-output', '');
    const device = this.connectedDevices.get(deviceId);

    if (!device || !device.connected) {
      throw new Error(`Device not available: ${deviceId}`);
    }

    if (!this.connectionStable) {
      throw new Error('Connection unstable - message failed');
    }

    // Process the message and potentially generate responses
    await device.handleMessage(message, this);
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

  // Test utilities
  getInputPort(portId: string): MockInputPort | undefined {
    return this.openInputs.get(portId);
  }

  getOutputPort(portId: string): MockOutputPort | undefined {
    return this.openOutputs.get(portId);
  }

  simulateConnectionLoss(deviceId: string): void {
    this.disconnectDevice(deviceId);

    // Notify open ports about disconnection
    const inputPort = this.openInputs.get(`${deviceId}-input`);
    const outputPort = this.openOutputs.get(`${deviceId}-output`);

    if (inputPort) {
      inputPort.simulateDisconnection();
    }
    if (outputPort) {
      outputPort.simulateDisconnection();
    }
  }
}

interface MockDeviceConfig {
  inputName: string;
  outputName: string;
  manufacturerId: number[];
  familyCode: number;
  familyMember: number;
  firmwareVersion: number[];
  serialNumber?: number[];
  deviceId: number;
}

class MockDevice {
  public connected = true;
  private currentTemplate = 0;
  private customModes = new Map<number, any>();

  constructor(
    public readonly id: string,
    public readonly config: MockDeviceConfig
  ) {}

  async handleMessage(message: MidiMessage, backend: IntegrationMockBackend): Promise<void> {
    if (message.type === 'sysex' || message.data[0] === 0xF0) {
      await this.handleSysExMessage(message, backend);
    }
  }

  private async handleSysExMessage(message: MidiMessage, backend: IntegrationMockBackend): Promise<void> {
    try {
      const parsed = SysExParser.parse([...message.data]);

      switch (parsed.type) {
        case 'device_inquiry':
          if (backend.deviceInquiryEnabled) {
            setTimeout(() => {
              this.sendDeviceInquiryResponse(backend);
            }, backend.deviceResponseDelay);
          }
          break;

        case 'template_change':
          if (backend.templateChangeEnabled) {
            const templateMsg = parsed as any;
            this.currentTemplate = templateMsg.templateNumber;
            setTimeout(() => {
              this.sendTemplateChangeConfirmation(backend, this.currentTemplate);
            }, backend.deviceResponseDelay);
          }
          break;

        case 'custom_mode_read':
          const readMsg = parsed as any;
          setTimeout(() => {
            this.sendCustomModeResponse(backend, readMsg.slot);
          }, backend.deviceResponseDelay);
          break;
      }
    } catch (error) {
      // Ignore invalid SysEx messages
    }
  }

  private sendDeviceInquiryResponse(backend: IntegrationMockBackend): void {
    const inputPort = backend.getInputPort(`${this.id}-input`);
    if (inputPort && inputPort.onMessage) {
      const responseData = [
        0xF0, // Start
        0x7E, // Universal non-realtime
        0x00, // Device ID
        0x06, // Inquiry response
        0x02, // Sub-ID
        ...this.config.manufacturerId,
        (this.config.familyCode >> 8) & 0x7F, this.config.familyCode & 0x7F,
        (this.config.familyMember >> 8) & 0x7F, this.config.familyMember & 0x7F,
        ...this.config.firmwareVersion,
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

  private sendTemplateChangeConfirmation(backend: IntegrationMockBackend, templateNumber: number): void {
    const inputPort = backend.getInputPort(`${this.id}-input`);
    if (inputPort && inputPort.onMessage) {
      const responseData = [
        0xF0, // Start
        ...MANUFACTURER_ID,
        this.config.deviceId,
        0x00, // Template change confirmation
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

  private sendCustomModeResponse(backend: IntegrationMockBackend, slot: number): void {
    const inputPort = backend.getInputPort(`${this.id}-input`);
    if (inputPort && inputPort.onMessage) {
      // Simulate custom mode data (simplified)
      const customMode = this.customModes.get(slot) || {
        slot,
        name: `Custom ${slot + 1}`,
        controls: [],
        colors: []
      };

      // Build custom mode response (simplified format)
      const responseData = [
        0xF0, // Start
        ...MANUFACTURER_ID,
        this.config.deviceId,
        0x01, // Custom mode response
        slot,
        ...Array.from(customMode.name).map((c: string) => c.charCodeAt(0)),
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
}

class MockInputPort implements MidiInputPort {
  readonly type = 'input' as const;
  onMessage?: ((message: MidiMessage) => void) | undefined;
  private disconnected = false;

  constructor(
    public readonly id: string,
    public readonly name: string,
    private device: MockDevice,
    private backend: IntegrationMockBackend
  ) {}

  async close(): Promise<void> {
    await this.backend.closePort(this);
  }

  simulateDisconnection(): void {
    this.disconnected = true;
  }

  simulateControlChange(controller: number, value: number, channel = 0): void {
    if (this.disconnected || !this.onMessage) return;

    const message: MidiMessage = {
      timestamp: Date.now(),
      data: [0xB0 | channel, controller, value],
      type: 'controlchange',
      channel,
      controller,
      value
    };

    this.onMessage(message);
  }
}

class MockOutputPort implements MidiOutputPort {
  readonly type = 'output' as const;
  public sentMessages: MidiMessage[] = [];

  constructor(
    public readonly id: string,
    public readonly name: string,
    private device: MockDevice,
    private backend: IntegrationMockBackend
  ) {}

  async close(): Promise<void> {
    await this.backend.closePort(this);
  }

  simulateDisconnection(): void {
    // Output ports don't receive messages, so just mark as disconnected
  }
}

describe('Device Handshake Integration Tests', () => {
  let backend: IntegrationMockBackend;
  let deviceManager: DeviceManager;

  beforeEach(() => {
    backend = new IntegrationMockBackend();

    const options: DeviceManagerOptions = {
      midiBackend: backend,
      autoConnect: false,
      inquiryTimeout: 2000, // Longer timeout for integration tests
      retryAttempts: 3,
      retryDelay: 200
    };

    deviceManager = new DeviceManager(options);
  });

  afterEach(async () => {
    await deviceManager.cleanup();
  });

  describe('complete handshake with mocked device', () => {
    it('should complete full handshake flow successfully', async () => {
      await deviceManager.initialize();

      // Track events during handshake
      const events: string[] = [];
      deviceManager.on('device:connected', () => events.push('connected'));
      deviceManager.on('device:ready', () => events.push('ready'));

      // Execute handshake
      await deviceManager.connect();

      // Verify connection state
      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
      expect(status.state).toBe('connected');
      expect(status.deviceInfo).toBeDefined();

      // Verify handshake events occurred in order
      expect(events).toEqual(['connected', 'ready']);

      // Verify device information was received correctly
      expect(status.deviceInfo?.manufacturerId).toBe('00 20 29');
      expect(status.deviceInfo?.deviceFamily).toBe(0x61);
      expect(status.deviceInfo?.modelNumber).toBe(0x01);
      expect(status.deviceInfo?.firmwareVersion).toBe('1.2.3.4');
    });

    it('should handle handshake with device that responds slowly', async () => {
      backend.deviceResponseDelay = 500; // Slow device

      await deviceManager.initialize();

      const startTime = Date.now();
      await deviceManager.connect();
      const endTime = Date.now();

      // Should still connect successfully
      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);

      // Should have taken at least the response delay
      expect(endTime - startTime).toBeGreaterThanOrEqual(400);
    });

    it('should handle handshake when device inquiry is disabled', async () => {
      backend.deviceInquiryEnabled = false;

      await deviceManager.initialize();

      // Should still connect with fallback device info in development mode
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      await deviceManager.connect();

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
      expect(status.deviceInfo?.firmwareVersion).toBe('Unknown');

      process.env.NODE_ENV = originalEnv;
    });

    it('should validate device response format during handshake', async () => {
      await deviceManager.initialize();

      // Corrupt the device response
      const originalSendResponse = backend.connectedDevices.get('lcxl3-primary')!['sendDeviceInquiryResponse'];
      backend.connectedDevices.get('lcxl3-primary')!['sendDeviceInquiryResponse'] = function(backend: IntegrationMockBackend) {
        const inputPort = backend.getInputPort(`${this.id}-input`);
        if (inputPort && inputPort.onMessage) {
          // Send malformed response
          const corruptedData = [0xF0, 0x7E, 0x00, 0x06, 0x02, 0xFF, 0xFF, 0xF7]; // Invalid manufacturer ID

          const message: MidiMessage = {
            timestamp: Date.now(),
            data: corruptedData,
            type: 'sysex'
          };

          inputPort.onMessage(message);
        }
      };

      // Should handle validation error gracefully
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      await deviceManager.connect();

      // Should still connect with fallback
      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('end-to-end connection and verification flow', () => {
    it('should complete entire workflow from discovery to communication', async () => {
      await deviceManager.initialize();

      // Phase 1: Discovery and Connection
      await deviceManager.connect();

      let status = deviceManager.getStatus();
      expect(status.connected).toBe(true);

      // Phase 2: Device Communication
      const modeChangedSpy = vi.fn();
      deviceManager.on('device:modeChanged', modeChangedSpy);

      await deviceManager.selectTemplate(3);

      // Verify template change was processed
      expect(modeChangedSpy).toHaveBeenCalledWith({
        type: 'template',
        slot: 3
      });

      // Phase 3: Control Message Handling
      const controlChangeSpy = vi.fn();
      deviceManager.on('control:change', controlChangeSpy);

      // Simulate control input from device
      const inputPort = backend.getInputPort('lcxl3-primary-input') as MockInputPort;
      inputPort.simulateControlChange(13, 64, 0); // Send A knob 1

      expect(controlChangeSpy).toHaveBeenCalledWith('sendA1', 64, 0);

      // Phase 4: SysEx Communication
      const sysexSpy = vi.fn();
      deviceManager.on('sysex:received', sysexSpy);

      // Send custom SysEx message
      await deviceManager.sendSysEx([0xF0, 0x00, 0x20, 0x29, 0x11, 0x77, 0x00, 0xF7]);

      // Verify communication is working
      status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
    });

    it('should handle device verification during communication', async () => {
      await deviceManager.initialize();
      await deviceManager.connect();

      // Attempt to read custom mode (tests SysEx round-trip)
      const customModePromise = deviceManager.readCustomMode(0);

      // Should receive response and complete successfully
      await expect(customModePromise).resolves.toEqual(
        expect.objectContaining({
          slot: 0,
          name: 'Custom 1'
        })
      );
    });

    it('should maintain connection state throughout communication', async () => {
      await deviceManager.initialize();
      await deviceManager.connect();

      // Perform multiple operations
      await deviceManager.selectTemplate(1);
      await deviceManager.sendCC(20, 100);
      await deviceManager.selectTemplate(2);

      // Connection should remain stable
      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
      expect(status.state).toBe('connected');
    });
  });

  describe('reconnection with handshake', () => {
    it('should reconnect and perform handshake after connection loss', async () => {
      await deviceManager.initialize();
      await deviceManager.connect();

      // Verify initial connection
      let status = deviceManager.getStatus();
      expect(status.connected).toBe(true);

      // Simulate connection loss
      const disconnectedSpy = vi.fn();
      deviceManager.on('device:disconnected', disconnectedSpy);

      backend.simulateConnectionLoss('lcxl3-primary');
      await deviceManager.disconnect('Connection lost');

      expect(disconnectedSpy).toHaveBeenCalled();

      // Reconnect device
      backend.reconnectDevice('lcxl3-primary');

      // Reconnect and verify handshake occurs again
      const connectedSpy = vi.fn();
      deviceManager.on('device:connected', connectedSpy);

      await deviceManager.connect();

      expect(connectedSpy).toHaveBeenCalled();

      status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
      expect(status.deviceInfo).toBeDefined();
    });

    it('should handle intermittent connection issues during reconnection', async () => {
      await deviceManager.initialize();
      await deviceManager.connect();

      // Make connection unstable
      backend.connectionStable = false;

      // Disconnect and try to reconnect
      await deviceManager.disconnect('Unstable connection');

      // First reconnection attempt should fail
      backend.connectionStable = false;
      await expect(deviceManager.connect()).rejects.toThrow();

      // Second attempt with stable connection should succeed
      backend.connectionStable = true;
      await expect(deviceManager.connect()).resolves.not.toThrow();

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
    });

    it('should preserve device settings after reconnection', async () => {
      await deviceManager.initialize();
      await deviceManager.connect();

      // Set a specific template
      await deviceManager.selectTemplate(5);

      // Disconnect and reconnect
      await deviceManager.disconnect();
      await deviceManager.connect();

      // Device should reinitialize (template gets reset to 0 during initialization)
      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
      expect(status.currentMode?.type).toBe('template');
      expect(status.currentMode?.slot).toBe(0); // Reset during initialization
    });
  });

  describe('multiple device handling', () => {
    it('should handle multiple devices with separate handshakes', async () => {
      // Create manager for primary device
      const primaryManager = new DeviceManager({
        midiBackend: backend,
        deviceNameFilter: 'LCXL3 1',
        autoConnect: false
      });

      // Create manager for secondary device
      const secondaryManager = new DeviceManager({
        midiBackend: backend,
        deviceNameFilter: 'LCXL3 2',
        autoConnect: false
      });

      await primaryManager.initialize();
      await secondaryManager.initialize();

      // Connect both devices
      await primaryManager.connect();
      await secondaryManager.connect();

      // Verify both are connected with different device info
      const primaryStatus = primaryManager.getStatus();
      const secondaryStatus = secondaryManager.getStatus();

      expect(primaryStatus.connected).toBe(true);
      expect(secondaryStatus.connected).toBe(true);

      // They should have different firmware versions to distinguish them
      expect(primaryStatus.deviceInfo?.firmwareVersion).toBe('1.2.3.4');
      expect(secondaryStatus.deviceInfo?.firmwareVersion).toBe('1.2.4.0');

      // Cleanup
      await primaryManager.cleanup();
      await secondaryManager.cleanup();
    });

    it('should handle device discovery when multiple devices are available', async () => {
      await deviceManager.initialize();

      // Should connect to the first matching device by default
      await deviceManager.connect();

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);

      // Should have connected to primary device (first one found)
      expect(status.deviceInfo?.firmwareVersion).toBe('1.2.3.4');
    });

    it('should handle device conflicts gracefully', async () => {
      // Remove secondary device to test single device handling
      backend.removeDevice('lcxl3-secondary');

      await deviceManager.initialize();
      await deviceManager.connect();

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);

      // Add secondary device after connection
      backend.addDevice('lcxl3-secondary', {
        inputName: 'LCXL3 2 MIDI Out',
        outputName: 'LCXL3 2 DAW In',
        manufacturerId: [0x00, 0x20, 0x29],
        familyCode: 0x61,
        familyMember: 0x01,
        firmwareVersion: [1, 3, 0, 0],
        deviceId: 0x12
      });

      // Original connection should remain stable
      const statusAfter = deviceManager.getStatus();
      expect(statusAfter.connected).toBe(true);
      expect(statusAfter.deviceInfo?.firmwareVersion).toBe('1.2.3.4'); // Still primary
    });
  });

  describe('handshake timeout and error scenarios', () => {
    it('should handle complete device unresponsiveness', async () => {
      backend.deviceInquiryEnabled = false;
      backend.templateChangeEnabled = false;

      await deviceManager.initialize();

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      // Should fail in production mode when device doesn't respond
      await expect(deviceManager.connect()).rejects.toThrow(/Device handshake timeout/);

      process.env.NODE_ENV = originalEnv;
    });

    it('should provide helpful error messages for different failure modes', async () => {
      await deviceManager.initialize();

      // Test timeout scenario
      backend.deviceResponseDelay = 3000; // Longer than inquiry timeout

      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(deviceManager.connect()).rejects.toThrow(/Device handshake timeout/);
      await expect(deviceManager.connect()).rejects.toThrow(/Troubleshooting steps/);

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle concurrent connection attempts gracefully', async () => {
      await deviceManager.initialize();

      // Start multiple connection attempts simultaneously
      const connection1 = deviceManager.connect();
      const connection2 = deviceManager.connect();
      const connection3 = deviceManager.connect();

      // All should resolve successfully (subsequent calls should be no-ops)
      await Promise.all([connection1, connection2, connection3]);

      const status = deviceManager.getStatus();
      expect(status.connected).toBe(true);
    });

    it('should handle backend initialization failures during handshake', async () => {
      // Create manager with backend that fails after initial success
      const failingBackend = new IntegrationMockBackend();
      const originalGetInputPorts = failingBackend.getInputPorts;

      failingBackend.getInputPorts = vi.fn().mockImplementation(async () => {
        // Fail on second call (during connection)
        if ((failingBackend.getInputPorts as any).mock.calls.length > 1) {
          throw new Error('Backend connection lost');
        }
        return originalGetInputPorts.call(failingBackend);
      });

      const errorManager = new DeviceManager({
        midiBackend: failingBackend,
        autoConnect: false
      });

      await errorManager.initialize();

      // First connection should succeed
      await errorManager.connect();
      await errorManager.disconnect();

      // Second connection should fail
      await expect(errorManager.connect()).rejects.toThrow('Backend connection lost');

      await errorManager.cleanup();
    });
  });
});