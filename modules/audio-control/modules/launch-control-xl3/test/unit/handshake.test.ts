/**
 * LaunchControlXL3 Handshake Unit Tests
 *
 * Tests that the controller properly facilitates the device handshake
 * according to the MIDI-PROTOCOL.md specification including the new
 * 4-message handshake sequence.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LaunchControlXL3 } from '@/LaunchControlXL3.js';
import { MockMidiBackend } from '../mocks/MockMidiBackend.js';
import type { Logger } from '@/core/Logger.js';

describe('LaunchControlXL3 - Device Handshake', () => {
  let controller: LaunchControlXL3;
  let mockBackend: MockMidiBackend;
  let mockTime: number;

  beforeEach(() => {
    vi.useFakeTimers();
    mockTime = 1704067200000; // 2024-01-01T00:00:00Z
    vi.setSystemTime(mockTime);

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
    vi.useRealTimers();
    await controller.cleanup();
    mockBackend.resetTestState();
    vi.clearAllMocks();
  });

  describe('Legacy Device Inquiry Handshake', () => {
    it('should send device inquiry message when connecting (legacy mode)', async () => {
      // Force fallback to legacy handshake
      mockBackend.shouldRespondToSyn = false;
      mockBackend.shouldRespondToInquiry = true;

      const connectionPromise = controller.connect();

      // Process queued responses synchronously
      mockBackend.processQueuedResponses();

      await connectionPromise;

      const deviceInquiryMessage = [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7];
      const sentMessages = mockBackend.sentMessages.map(msg => Array.from(msg.data));
      const inquirySent = sentMessages.some(msg => arraysEqual(msg, deviceInquiryMessage));

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
        timestamp: mockTime,
        data: validResponse,
        type: 'sysex',
      });

      await expect(connectionPromise).resolves.not.toThrow();
      expect(controller.isConnected()).toBe(true);
    });

    it('should timeout if no response received (legacy mode)', async () => {
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
    });
  });

  describe('Complete 4-Message Handshake Sequence', () => {
    beforeEach(() => {
      // Enable complete handshake by default
      mockBackend.shouldRespondToSyn = true;
      mockBackend.shouldRespondToInquiry = true;
    });

    it('should perform full 4-message handshake sequence', async () => {
      const connectionPromise = controller.connect();

      // Process the handshake step by step deterministically
      await vi.runOnlyPendingTimersAsync();
      mockBackend.processQueuedResponses();
      await vi.runOnlyPendingTimersAsync();
      mockBackend.processQueuedResponses();

      await connectionPromise;
      expect(controller.isConnected()).toBe(true);

      // Verify all expected messages were sent
      const sentMessages = mockBackend.sentMessages.map(msg => Array.from(msg.data));

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

      const connectionPromise = controller.connect();

      // Process queued responses synchronously
      await vi.runOnlyPendingTimersAsync();
      mockBackend.processQueuedResponses();
      await vi.runOnlyPendingTimersAsync();
      mockBackend.processQueuedResponses();

      await connectionPromise;

      expect(deviceHandler).toHaveBeenCalled();
      const deviceInfo = deviceHandler.mock.calls[0][0];
      expect(deviceInfo).toMatchObject({
        serialNumber: expect.stringMatching(/^LX2\d{11}$/),
      });
      expect(deviceInfo.serialNumber).toBe('LX21234567890123');
    });

    it('should fallback to simple handshake when SYN-ACK times out', async () => {
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

      const connectionPromise = controller.connect();

      // Advance time to trigger SYN timeout
      await vi.advanceTimersByTimeAsync(2000);
      mockBackend.processQueuedResponses();

      // Should fall back to simple inquiry and succeed
      await connectionPromise;
      expect(controller.isConnected()).toBe(true);

      // Verify fallback message was sent (legacy device inquiry with 0x00 device ID)
      const sentMessages = mockBackend.sentMessages.map(msg => Array.from(msg.data));
      expect(sentMessages.some(msg =>
        arraysEqual(msg, [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7])
      )).toBe(true);
    });

    it('should timeout if SYN-ACK not received', async () => {
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
    });

    it('should timeout if device response not received after ACK', async () => {
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
    });

    it('should reject invalid SYN-ACK message format', async () => {
      mockBackend.invalidSynAck = true;

      await expect(controller.connect()).rejects.toThrow(/invalid.*SYN-ACK/i);
    });

    it('should handle concurrent connection attempts gracefully', async () => {
      const connection1 = controller.connect();
      const connection2 = controller.connect();

      // Process queued responses for both attempts
      await vi.runOnlyPendingTimersAsync();
      mockBackend.processQueuedResponses();
      await vi.runOnlyPendingTimersAsync();
      mockBackend.processQueuedResponses();

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
      const connectionPromise = controller.connect();

      // Process queued responses synchronously
      await vi.runOnlyPendingTimersAsync();
      mockBackend.processQueuedResponses();
      await vi.runOnlyPendingTimersAsync();
      mockBackend.processQueuedResponses();

      await connectionPromise;

      const sentMessages = mockBackend.sentMessages.map(msg => Array.from(msg.data));

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

      const connectionPromise = controller.connect();

      // Process queued responses synchronously
      await vi.runOnlyPendingTimersAsync();
      mockBackend.processQueuedResponses();
      await vi.runOnlyPendingTimersAsync();
      mockBackend.processQueuedResponses();

      await connectionPromise;

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