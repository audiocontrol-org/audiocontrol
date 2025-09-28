/**
 * LaunchControlXL3 Handshake Unit Tests
 *
 * Tests that the controller properly facilitates the device handshake
 * according to the MIDI-PROTOCOL.md specification including the new
 * 4-message handshake sequence.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LaunchControlXL3 } from '@/LaunchControlXL3.js';
import type { MidiBackendInterface, MidiMessage, MidiPortInfo, MidiInputPort, MidiOutputPort } from '@/core/MidiInterface.js';
import type { Logger } from '@/core/Logger.js';

describe('LaunchControlXL3 - Device Handshake', () => {
  let controller: LaunchControlXL3;
  let mockBackend: MockMidiBackend;

  beforeEach(() => {
    mockBackend = new MockMidiBackend();
    const noopLogger: Logger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    controller = new LaunchControlXL3({
      midiBackend: mockBackend,
      logger: noopLogger,
    });
  });

  afterEach(async () => {
    vi.clearAllTimers();
    await controller.cleanup();
    vi.clearAllMocks();
  });

  describe('Legacy Device Inquiry Handshake', () => {
    it('should send device inquiry message when connecting (legacy mode)', async () => {
      // Force fallback to legacy handshake
      mockBackend.shouldRespondToSyn = false;
      mockBackend.shouldRespondToInquiry = true;

      const sendSpy = vi.spyOn(mockBackend, 'sendMessage');

      const connectionPromise = controller.connect();
      mockBackend.simulateDeviceResponse();
      await connectionPromise;

      const deviceInquiryMessage = [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7];
      const calls = sendSpy.mock.calls;
      const inquirySent = calls.some(call => {
        const message = call[1];
        return arraysEqual(Array.from(message.data), deviceInquiryMessage);
      });

      expect(inquirySent).toBe(true);
    });

    it('should accept valid device inquiry response (legacy mode)', async () => {
      // Force fallback to legacy handshake
      mockBackend.shouldRespondToSyn = false;
      mockBackend.shouldRespondToInquiry = true;

      const validResponse: number[] = [
        0xF0, 0x7E, 0x00, 0x06, 0x02,
        0x00, 0x20, 0x29,
        0x48, 0x01,
        0x00, 0x00,
        0x01, 0x00, 0x0A, 0x54,
        0xF7
      ];

      const connectionPromise = controller.connect();

      mockBackend.simulateIncomingMessage({
        timestamp: Date.now(),
        data: validResponse,
        type: 'sysex',
      });

      await expect(connectionPromise).resolves.not.toThrow();
      expect(controller.isConnected()).toBe(true);
    });

    it('should timeout if no response received (legacy mode)', async () => {
      vi.useFakeTimers();
      const noopLogger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: noopLogger,
      });

      // Disable all responses
      mockBackend.shouldRespondToSyn = false;
      mockBackend.shouldRespondToInquiry = false;

      const connectionPromise = controller.connect();
      await vi.advanceTimersByTimeAsync(5000);

      await expect(connectionPromise).rejects.toThrow(/timeout/i);
      vi.clearAllTimers();
      vi.useRealTimers();
    });
  });

  describe('Complete 4-Message Handshake Sequence', () => {
    beforeEach(() => {
      // Enable complete handshake by default
      mockBackend.shouldRespondToSyn = true;
      mockBackend.shouldRespondToInquiry = true;
    });

    it('should perform full 4-message handshake sequence', async () => {
      const sendSpy = vi.spyOn(mockBackend, 'sendMessage');

      const connectionPromise = controller.connect();

      // Simulate the complete handshake flow
      await vi.waitFor(() => {
        // Check if SYN was sent
        const calls = sendSpy.mock.calls;
        const synSent = calls.some(call => {
          const message = Array.from(call[1].data);
          return arraysEqual(message, [0xF0, 0x00, 0x20, 0x29, 0x00, 0x42, 0x02, 0xF7]);
        });
        if (synSent) {
          // Simulate SYN-ACK response
          mockBackend.simulateNovationSynAck();
        }
      });

      await vi.waitFor(() => {
        // Check if Universal Device Inquiry (ACK) was sent with correct device ID
        const calls = sendSpy.mock.calls;
        const ackSent = calls.some(call => {
          const message = Array.from(call[1].data);
          return arraysEqual(message, [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7]);
        });
        if (ackSent) {
          // Simulate device response
          mockBackend.simulateDeviceInquiryResponse();
        }
      });

      await connectionPromise;
      expect(controller.isConnected()).toBe(true);

      // Verify all expected messages were sent
      const sentMessages = sendSpy.mock.calls.map(call => Array.from(call[1].data));

      // Should contain SYN message
      expect(sentMessages.some(msg =>
        arraysEqual(msg, [0xF0, 0x00, 0x20, 0x29, 0x00, 0x42, 0x02, 0xF7])
      )).toBe(true);

      // Should contain Universal Device Inquiry with correct device ID (0x7F)
      expect(sentMessages.some(msg =>
        arraysEqual(msg, [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7])
      )).toBe(true);
    });

    it('should extract serial number from SYN-ACK response', async () => {
      const deviceHandler = vi.fn();
      controller.on('device:connected', deviceHandler);

      await controller.connect();

      expect(deviceHandler).toHaveBeenCalled();
      const deviceInfo = deviceHandler.mock.calls[0][0];
      expect(deviceInfo).toMatchObject({
        serialNumber: expect.stringMatching(/^LX2\d{11}$/),
      });
      expect(deviceInfo.serialNumber).toBe('LX21234567890123');
    });

    it('should fallback to simple handshake when SYN-ACK times out', async () => {
      vi.useFakeTimers();

      const noopLogger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: noopLogger,
      });

      // Disable SYN response but allow inquiry response
      mockBackend.shouldRespondToSyn = false;
      mockBackend.shouldRespondToInquiry = true;

      const sendSpy = vi.spyOn(mockBackend, 'sendMessage');
      const connectionPromise = controller.connect();

      // Advance time to trigger SYN timeout
      await vi.advanceTimersByTimeAsync(2000);

      // Should fall back to simple inquiry and succeed
      await connectionPromise;
      expect(controller.isConnected()).toBe(true);

      // Verify fallback message was sent (legacy device inquiry with 0x00 device ID)
      const sentMessages = sendSpy.mock.calls.map(call => Array.from(call[1].data));
      expect(sentMessages.some(msg =>
        arraysEqual(msg, [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7])
      )).toBe(true);

      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('should timeout if SYN-ACK not received', async () => {
      vi.useFakeTimers();

      const noopLogger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: noopLogger,
      });

      // Disable all responses
      mockBackend.shouldRespondToSyn = false;
      mockBackend.shouldRespondToInquiry = false;

      const connectionPromise = controller.connect();
      await vi.advanceTimersByTimeAsync(5000);

      await expect(connectionPromise).rejects.toThrow(/timeout/i);

      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('should timeout if device response not received after ACK', async () => {
      vi.useFakeTimers();

      const noopLogger: Logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: noopLogger,
      });

      // Respond to SYN but not to device inquiry
      mockBackend.shouldRespondToSyn = true;
      mockBackend.shouldRespondToInquiry = false;

      const connectionPromise = controller.connect();
      await vi.advanceTimersByTimeAsync(5000);

      await expect(connectionPromise).rejects.toThrow(/timeout/i);

      vi.clearAllTimers();
      vi.useRealTimers();
    });

    it('should reject invalid SYN-ACK message format', async () => {
      mockBackend.invalidSynAck = true;

      await expect(controller.connect()).rejects.toThrow(/invalid.*SYN-ACK/i);
    });

    it('should handle concurrent connection attempts gracefully', async () => {
      const connection1 = controller.connect();
      const connection2 = controller.connect();

      // Only one should succeed, the other should reject
      const results = await Promise.allSettled([connection1, connection2]);

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful).toBe(1);
      expect(failed).toBe(1);
    });
  });

  describe('Message Ordering and Validation', () => {
    it('should send messages in correct order', async () => {
      const sendSpy = vi.spyOn(mockBackend, 'sendMessage');

      await controller.connect();

      const sentMessages = sendSpy.mock.calls.map(call => Array.from(call[1].data));

      // Find indices of key messages
      const synIndex = sentMessages.findIndex(msg =>
        arraysEqual(msg, [0xF0, 0x00, 0x20, 0x29, 0x00, 0x42, 0x02, 0xF7])
      );
      const ackIndex = sentMessages.findIndex(msg =>
        arraysEqual(msg, [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7])
      );

      // SYN should come before ACK
      expect(synIndex).toBeGreaterThanOrEqual(0);
      expect(ackIndex).toBeGreaterThanOrEqual(0);
      expect(synIndex).toBeLessThan(ackIndex);
    });

    it('should validate Novation manufacturer ID in SYN-ACK', async () => {
      mockBackend.corruptManufacturerId = true;

      await expect(controller.connect()).rejects.toThrow(/invalid.*manufacturer/i);
    });
  });

  describe('Event Emission', () => {
    it('should emit device:connected event after successful handshake', async () => {
      const connectedHandler = vi.fn();
      controller.on('device:connected', connectedHandler);

      await controller.connect();

      expect(connectedHandler).toHaveBeenCalled();
      expect(connectedHandler.mock.calls[0][0]).toMatchObject({
        manufacturerId: expect.any(String),
        deviceFamily: expect.any(Number),
        modelNumber: expect.any(Number),
        firmwareVersion: expect.any(String),
        serialNumber: expect.any(String),
      });
    });

    it('should emit device:error event if handshake fails', async () => {
      const errorHandler = vi.fn();
      controller.on('device:error', errorHandler);

      mockBackend.shouldRespondToSyn = false;
      mockBackend.shouldRespondToInquiry = false;

      await expect(controller.connect()).rejects.toThrow();
      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it('should not proceed with connection if handshake fails', async () => {
      mockBackend.shouldRespondToSyn = false;
      mockBackend.shouldRespondToInquiry = false;

      await expect(controller.connect()).rejects.toThrow();
      expect(controller.isConnected()).toBe(false);
    });
  });
});

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, idx) => val === b[idx]);
}

class MockMidiBackend implements MidiBackendInterface {
  inputPort?: MidiInputPort;
  outputPort?: MidiOutputPort;
  shouldRespondToInquiry = true;
  shouldRespondToSyn = true;
  invalidSynAck = false;
  corruptManufacturerId = false;
  private initCount = 0;

  async initialize(): Promise<void> {
    this.initCount++;
  }

  async getInputPorts(): Promise<MidiPortInfo[]> {
    return [
      { id: 'test-input', name: 'Launch Control XL' },
    ];
  }

  async getOutputPorts(): Promise<MidiPortInfo[]> {
    return [
      { id: 'test-output', name: 'Launch Control XL' },
    ];
  }

  async openInput(portId: string): Promise<MidiInputPort> {
    this.inputPort = {
      id: portId,
      name: 'Launch Control XL',
      type: 'input',
      onMessage: undefined,
      close: async () => {
        this.inputPort = undefined;
      },
    };
    return this.inputPort;
  }

  async openOutput(portId: string): Promise<MidiOutputPort> {
    this.outputPort = {
      id: portId,
      name: 'Launch Control XL',
      type: 'output',
      close: async () => {
        this.outputPort = undefined;
      },
    };
    return this.outputPort;
  }

  async sendMessage(_port: MidiOutputPort, message: MidiMessage): Promise<void> {
    const data = Array.isArray(message.data) ? message.data : Array.from(message.data);

    // Handle Novation SYN message
    if (this.isNovationSyn(data)) {
      if (this.shouldRespondToSyn) {
        queueMicrotask(() => {
          this.simulateNovationSynAck();
        });
      }
      return;
    }

    // Handle Universal Device Inquiry
    if (this.shouldRespondToInquiry && this.isDeviceInquiry(data)) {
      queueMicrotask(() => {
        this.simulateDeviceResponse();
      });
    }
  }

  private isNovationSyn(data: number[]): boolean {
    const synPattern = [0xF0, 0x00, 0x20, 0x29, 0x00, 0x42, 0x02, 0xF7];
    return arraysEqual(data, synPattern);
  }

  private isDeviceInquiry(data: number[]): boolean {
    // Accept both legacy (0x00) and new (0x7F) device IDs
    const legacyInquiryPattern = [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7];
    const newInquiryPattern = [0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7];
    return arraysEqual(data, legacyInquiryPattern) || arraysEqual(data, newInquiryPattern);
  }

  simulateNovationSynAck(): void {
    if (!this.inputPort || !this.inputPort.onMessage) {
      return;
    }

    const serialNumber = 'LX21234567890123'; // 14 character serial
    let response: number[] = [
      0xF0, 0x00, 0x20, 0x29,  // Start + Novation manufacturer ID
      0x00, 0x42, 0x02,        // Device model + command + sub-command
      ...Array.from(serialNumber).map(c => c.charCodeAt(0)), // Serial number
      0xF7                     // End
    ];

    // Corrupt message if requested
    if (this.invalidSynAck) {
      response[6] = 0xFF; // Corrupt sub-command byte
    }

    if (this.corruptManufacturerId) {
      response[1] = 0xFF; // Corrupt manufacturer ID
    }

    this.inputPort.onMessage({
      timestamp: Date.now(),
      data: response,
      type: 'sysex',
    });
  }

  simulateDeviceResponse(): void {
    if (!this.inputPort || !this.inputPort.onMessage) {
      return;
    }

    const response: number[] = [
      0xF0, 0x7E, 0x00, 0x06, 0x02,
      0x00, 0x20, 0x29,
      0x48, 0x01,
      0x00, 0x00,
      0x01, 0x00, 0x0A, 0x54,
      0xF7
    ];

    this.inputPort.onMessage({
      timestamp: Date.now(),
      data: response,
      type: 'sysex',
    });
  }

  simulateDeviceInquiryResponse(): void {
    this.simulateDeviceResponse(); // Same as device response
  }

  simulateIncomingMessage(message: MidiMessage): void {
    if (this.inputPort && this.inputPort.onMessage) {
      this.inputPort.onMessage(message);
    }
  }

  async closePort(port: { close: () => Promise<void> }): Promise<void> {
    await port.close();
  }

  async cleanup(): Promise<void> {
    if (this.inputPort) {
      await this.inputPort.close();
    }
    if (this.outputPort) {
      await this.outputPort.close();
    }
  }
}