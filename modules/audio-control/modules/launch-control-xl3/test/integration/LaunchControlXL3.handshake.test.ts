/**
 * LaunchControlXL3 Handshake Integration Tests
 *
 * Tests that the controller properly facilitates the device handshake
 * according to the MIDI-PROTOCOL.md specification.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LaunchControlXL3 } from '@/LaunchControlXL3.js';
import type { MidiBackendInterface, MidiMessage, MidiPortInfo, MidiInputPort, MidiOutputPort } from '@/core/MidiInterface.js';
import { NoOpLogger } from '@/core/Logger.js';

describe('LaunchControlXL3 - Device Handshake', () => {
  let controller: LaunchControlXL3;
  let mockBackend: MockMidiBackend;

  beforeEach(() => {
    mockBackend = new MockMidiBackend();
    controller = new LaunchControlXL3({
      midiBackend: mockBackend,
      logger: new NoOpLogger(),
    });
  });

  afterEach(async () => {
    await controller.cleanup();
    vi.clearAllMocks();
  });

  describe('Device Inquiry Handshake', () => {
    it('should send device inquiry message when connecting', async () => {
      const sendSpy = vi.spyOn(mockBackend, 'sendMessage');

      const connectionPromise = controller.connect();

      await vi.waitFor(() => {
        expect(sendSpy).toHaveBeenCalled();
      });

      const deviceInquiryMessage = [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7];
      const calls = sendSpy.mock.calls;
      const inquirySent = calls.some(call => {
        const message = call[1];
        return arraysEqual(Array.from(message.data), deviceInquiryMessage);
      });

      expect(inquirySent).toBe(true);

      mockBackend.simulateDeviceResponse();
      await connectionPromise;
    });

    it('should accept valid device inquiry response', async () => {
      const validResponse: number[] = [
        0xF0, 0x7E, 0x00, 0x06, 0x02,
        0x00, 0x20, 0x29,
        0x48, 0x01,
        0x00, 0x00,
        0x01, 0x00, 0x0A, 0x54,
        0xF7
      ];

      const connectionPromise = controller.connect();

      await vi.waitFor(() => {
        expect(mockBackend.inputPort).toBeDefined();
      });

      mockBackend.simulateIncomingMessage({
        timestamp: Date.now(),
        data: validResponse,
        type: 'sysex',
      });

      await expect(connectionPromise).resolves.not.toThrow();
      expect(controller.isConnected()).toBe(true);
    });

    it('should validate manufacturer ID in response', async () => {
      const invalidResponse: number[] = [
        0xF0, 0x7E, 0x00, 0x06, 0x02,
        0xFF, 0xFF, 0xFF,
        0x48, 0x01,
        0x00, 0x00,
        0x01, 0x00, 0x0A, 0x54,
        0xF7
      ];

      const connectionPromise = controller.connect();

      await vi.waitFor(() => {
        expect(mockBackend.inputPort).toBeDefined();
      });

      mockBackend.simulateIncomingMessage({
        timestamp: Date.now(),
        data: invalidResponse,
        type: 'sysex',
      });

      await expect(connectionPromise).rejects.toThrow();
    });

    it('should timeout if no response received', async () => {
      controller = new LaunchControlXL3({
        midiBackend: mockBackend,
        logger: new NoOpLogger(),
      });

      mockBackend.shouldRespondToInquiry = false;

      const connectionPromise = controller.connect();

      await expect(connectionPromise).rejects.toThrow(/timeout/i);
    }, 10000);

    it('should emit device:connected event after successful handshake', async () => {
      const connectedHandler = vi.fn();
      controller.on('device:connected', connectedHandler);

      const connectionPromise = controller.connect();

      await vi.waitFor(() => {
        expect(mockBackend.inputPort).toBeDefined();
      });

      mockBackend.simulateDeviceResponse();
      await connectionPromise;

      expect(connectedHandler).toHaveBeenCalled();
      expect(connectedHandler.mock.calls[0][0]).toMatchObject({
        manufacturerId: expect.any(String),
        deviceFamily: expect.any(Number),
        modelNumber: expect.any(Number),
        firmwareVersion: expect.any(String),
      });
    });

    it('should emit device:error event if handshake fails', async () => {
      const errorHandler = vi.fn();
      controller.on('device:error', errorHandler);

      mockBackend.shouldRespondToInquiry = false;

      const connectionPromise = controller.connect();

      await expect(connectionPromise).rejects.toThrow();
      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
    });

    it('should not proceed with connection if handshake fails', async () => {
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
    const data = Array.from(message.data);

    if (this.shouldRespondToInquiry && this.isDeviceInquiry(data)) {
      setTimeout(() => {
        this.simulateDeviceResponse();
      }, 10);
    }
  }

  private isDeviceInquiry(data: number[]): boolean {
    const inquiryPattern = [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7];
    return arraysEqual(data, inquiryPattern);
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