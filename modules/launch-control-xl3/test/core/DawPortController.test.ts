import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DawPortControllerImpl } from '../../src/core/DawPortController';

describe('DawPortController', () => {
  let sendMessage: ReturnType<typeof vi.fn>;
  let waitForMessage: ReturnType<typeof vi.fn>;
  let controller: DawPortControllerImpl;

  beforeEach(() => {
    sendMessage = vi.fn().mockResolvedValue(undefined);

    // Default mock for waitForMessage - simulates device responses
    waitForMessage = vi.fn()
      .mockResolvedValueOnce([0xB6, 30, 6])   // Phase 1 CC response (slot 0)
      .mockResolvedValueOnce([0x9F, 11, 0])   // Phase 1 Note Off echo
      .mockResolvedValueOnce([0x9F, 11, 0]);  // Phase 2 Note Off echo (if needed)

    controller = new DawPortControllerImpl(sendMessage, waitForMessage);
  });

  describe('selectSlot', () => {
    it('should send correct bidirectional message sequence when changing slots', async () => {
      // Mock device reporting different slot, forcing Phase 2
      waitForMessage.mockReset();
      waitForMessage
        .mockResolvedValueOnce([0xB6, 30, 7])   // Device says slot 1
        .mockResolvedValueOnce([0x9F, 11, 0])   // Phase 1 Note Off echo
        .mockResolvedValueOnce([0x9F, 11, 0]);  // Phase 2 Note Off echo

      await controller.selectSlot(0);

      // Should have 6 messages (Phase 1: 3, Phase 2: 3)
      expect(sendMessage).toHaveBeenCalledTimes(6);

      // Phase 1: Query current slot
      expect(sendMessage).toHaveBeenNthCalledWith(1, [0x9F, 11, 127]);  // Note On ch16
      expect(sendMessage).toHaveBeenNthCalledWith(2, [0xB7, 30, 0]);    // CC query ch8
      expect(sendMessage).toHaveBeenNthCalledWith(3, [0x9F, 11, 0]);    // Note Off ch16

      // Phase 2: Set target slot (because device was on slot 1, not 0)
      expect(sendMessage).toHaveBeenNthCalledWith(4, [0x9F, 11, 127]);  // Note On ch16
      expect(sendMessage).toHaveBeenNthCalledWith(5, [0xB6, 30, 6]);    // CC set ch7, value 6 (slot 0)
      expect(sendMessage).toHaveBeenNthCalledWith(6, [0x9F, 11, 0]);    // Note Off ch16
    });

    it('should skip Phase 2 if already on target slot', async () => {
      // Mock device reporting correct slot
      waitForMessage.mockReset();
      waitForMessage
        .mockResolvedValueOnce([0xB6, 30, 6])   // Device already on slot 0
        .mockResolvedValueOnce([0x9F, 11, 0]);  // Phase 1 Note Off echo

      await controller.selectSlot(0);

      // Should only have Phase 1 (3 messages)
      expect(sendMessage).toHaveBeenCalledTimes(3);

      // Verify no Phase 2 CC set message sent
      const ccSetCalls = sendMessage.mock.calls.filter(
        call => call[0][0] === 0xB6 && call[0][1] === 30 && call[0][2] !== 0
      );
      expect(ccSetCalls).toHaveLength(0);
    });

    it('should send correct bidirectional sequence for slot 1', async () => {
      // Mock device on different slot to force Phase 2
      waitForMessage.mockReset();
      waitForMessage
        .mockResolvedValueOnce([0xB6, 30, 6])   // Device says slot 0
        .mockResolvedValueOnce([0x9F, 11, 0])   // Phase 1 Note Off echo
        .mockResolvedValueOnce([0x9F, 11, 0]);  // Phase 2 Note Off echo

      await controller.selectSlot(1);

      expect(sendMessage).toHaveBeenCalledTimes(6);

      // CC set value should be 7 (slot 1 + 6)
      expect(sendMessage).toHaveBeenNthCalledWith(5, [0xB6, 30, 7]);
    });

    it('should send correct bidirectional sequence for slot 14', async () => {
      // Mock device on different slot to force Phase 2
      waitForMessage.mockReset();
      waitForMessage
        .mockResolvedValueOnce([0xB6, 30, 6])   // Device says slot 0
        .mockResolvedValueOnce([0x9F, 11, 0])   // Phase 1 Note Off echo
        .mockResolvedValueOnce([0x9F, 11, 0]);  // Phase 2 Note Off echo

      await controller.selectSlot(14);

      expect(sendMessage).toHaveBeenCalledTimes(6);

      // CC set value should be 20 (slot 14 + 6)
      expect(sendMessage).toHaveBeenNthCalledWith(5, [0xB6, 30, 20]);
    });

    it('should calculate CC value correctly for all slots', async () => {
      const expectedMappings = [
        { slot: 0, ccValue: 6 },   // Physical slot 1
        { slot: 1, ccValue: 7 },   // Physical slot 2
        { slot: 2, ccValue: 8 },   // Physical slot 3
        { slot: 3, ccValue: 9 },   // Physical slot 4
        { slot: 4, ccValue: 10 },  // Physical slot 5
        { slot: 5, ccValue: 11 },  // Physical slot 6
        { slot: 6, ccValue: 12 },  // Physical slot 7
        { slot: 7, ccValue: 13 },  // Physical slot 8
        { slot: 8, ccValue: 14 },  // Physical slot 9
        { slot: 9, ccValue: 15 },  // Physical slot 10
        { slot: 10, ccValue: 16 }, // Physical slot 11
        { slot: 11, ccValue: 17 }, // Physical slot 12
        { slot: 12, ccValue: 18 }, // Physical slot 13
        { slot: 13, ccValue: 19 }, // Physical slot 14
        { slot: 14, ccValue: 20 }, // Physical slot 15
      ];

      for (const { slot, ccValue } of expectedMappings) {
        // Create fresh mocks for this iteration
        const iterationSendMessage = vi.fn().mockResolvedValue(undefined);
        // Mock device on a DIFFERENT slot to force Phase 2
        // Use (slot + 1) % 15 to ensure device is always on a different slot than target
        const deviceSlot = (slot + 1) % 15;
        const deviceCCValue = deviceSlot + 6;
        const iterationWaitForMessage = vi.fn()
          .mockResolvedValueOnce([0xB6, 30, deviceCCValue])  // Phase 1 response (device on different slot)
          .mockResolvedValueOnce([0x9F, 11, 0])              // Phase 1 Note Off echo
          .mockResolvedValueOnce([0x9F, 11, 0]);             // Phase 2 Note Off echo

        // Create new controller with fresh mocks for this iteration
        const iterationController = new DawPortControllerImpl(iterationSendMessage, iterationWaitForMessage);

        await iterationController.selectSlot(slot);

        // Check the CC set message (5th call in Phase 2)
        expect(iterationSendMessage).toHaveBeenNthCalledWith(5, [0xB6, 30, ccValue]);
      }
    });

    it('should throw error for invalid slot number (negative)', async () => {
      await expect(controller.selectSlot(-1)).rejects.toThrow('Invalid slot: -1. Must be 0-14');
    });

    it('should throw error for invalid slot number (> 14)', async () => {
      await expect(controller.selectSlot(15)).rejects.toThrow('Invalid slot: 15. Must be 0-14');
    });

    it('should complete slot selection within reasonable time', async () => {
      const start = Date.now();
      await controller.selectSlot(0);
      const duration = Date.now() - start;

      // Should complete in under 1 second (generous timeout)
      expect(duration).toBeLessThan(1000);
    });

    it('should use correct MIDI channels', async () => {
      // Force Phase 2 by mocking different slot
      waitForMessage.mockReset();
      waitForMessage
        .mockResolvedValueOnce([0xB6, 30, 7])   // Device on slot 1
        .mockResolvedValueOnce([0x9F, 11, 0])   // Phase 1 Note Off echo
        .mockResolvedValueOnce([0x9F, 11, 0]);  // Phase 2 Note Off echo

      await controller.selectSlot(0);

      const calls = sendMessage.mock.calls;

      // Note messages on channel 16 (0x9F = 0x90 | 0x0F)
      const noteOnCalls = calls.filter(c => (c[0][0] & 0xF0) === 0x90);
      noteOnCalls.forEach(call => {
        expect(call[0][0] & 0x0F).toBe(0x0F); // Channel 16 (15 in 0-based)
      });

      // CC query on channel 8 (0xB7 = 0xB0 | 0x07)
      const ccQuery = calls.find(c => c[0][0] === 0xB7 && c[0][1] === 30 && c[0][2] === 0);
      expect(ccQuery).toBeDefined();

      // CC set on channel 7 (0xB6 = 0xB0 | 0x06)
      const ccSet = calls.find(c => c[0][0] === 0xB6 && c[0][1] === 30 && c[0][2] === 6);
      expect(ccSet).toBeDefined();
    });

    it('should handle missing waitForMessage gracefully', async () => {
      // Create controller without waitForMessage
      const controllerNoWait = new DawPortControllerImpl(sendMessage);

      await controllerNoWait.selectSlot(0);

      // Should still send all messages (assumes Phase 2 needed)
      expect(sendMessage).toHaveBeenCalledTimes(6);

      // Phase 1 messages
      expect(sendMessage).toHaveBeenNthCalledWith(1, [0x9F, 11, 127]);
      expect(sendMessage).toHaveBeenNthCalledWith(2, [0xB7, 30, 0]);
      expect(sendMessage).toHaveBeenNthCalledWith(3, [0x9F, 11, 0]);

      // Phase 2 messages (sent because we can't detect current slot)
      expect(sendMessage).toHaveBeenNthCalledWith(4, [0x9F, 11, 127]);
      expect(sendMessage).toHaveBeenNthCalledWith(5, [0xB6, 30, 6]);
      expect(sendMessage).toHaveBeenNthCalledWith(6, [0x9F, 11, 0]);
    });

    it('should handle waitForMessage timeout gracefully', async () => {
      // Mock waitForMessage to timeout (throw)
      waitForMessage.mockReset();
      waitForMessage.mockRejectedValue(new Error('Timeout'));

      await controller.selectSlot(0);

      // Should complete successfully and send all messages
      expect(sendMessage).toHaveBeenCalledTimes(6);
    });

    it('should verify device response channel and controller', async () => {
      waitForMessage.mockReset();

      // First call returns valid response
      waitForMessage
        .mockResolvedValueOnce([0xB6, 30, 8])   // Slot 2
        .mockResolvedValueOnce([0x9F, 11, 0])   // Phase 1 Note Off
        .mockResolvedValueOnce([0x9F, 11, 0]);  // Phase 2 Note Off

      await controller.selectSlot(0);

      // Verify the predicate checks for correct channel and controller
      const predicateCall = waitForMessage.mock.calls[0][0];

      // Test predicate with correct message
      expect(predicateCall([0xB6, 30, 8])).toBe(true);  // CC ch7, controller 30

      // Test predicate with wrong channel
      expect(predicateCall([0xB5, 30, 8])).toBe(false); // Wrong channel

      // Test predicate with wrong controller
      expect(predicateCall([0xB6, 31, 8])).toBe(false); // Wrong controller

      // Test predicate with wrong message type
      expect(predicateCall([0x9F, 30, 8])).toBe(false); // Note On instead of CC
    });
  });

  describe('sendNoteNotification', () => {
    it('should send note on and off without CC', async () => {
      await controller.sendNoteNotification();

      expect(sendMessage).toHaveBeenCalledTimes(2);

      // Note On
      expect(sendMessage).toHaveBeenNthCalledWith(1, [0x9F, 11, 127]);

      // Note Off
      expect(sendMessage).toHaveBeenNthCalledWith(2, [0x9F, 11, 0]);
    });

    it('should not send CC message', async () => {
      await controller.sendNoteNotification();

      // Verify no CC messages were sent
      const calls = sendMessage.mock.calls;
      const ccMessages = calls.filter(([msg]) =>
        (msg[0] & 0xF0) === 0xB0
      );

      expect(ccMessages).toHaveLength(0);
    });

    it('should use channel 16 for note messages', async () => {
      await controller.sendNoteNotification();

      const calls = sendMessage.mock.calls;

      // Both messages should be on channel 16
      calls.forEach(([msg]) => {
        expect(msg[0] & 0x0F).toBe(0x0F); // Channel 16 (15 in 0-based)
      });
    });
  });

  describe('error handling', () => {
    it('should propagate sendMessage errors', async () => {
      const error = new Error('MIDI port not open');
      sendMessage.mockRejectedValueOnce(error);

      await expect(controller.selectSlot(0)).rejects.toThrow('MIDI port not open');
    });

    it('should handle async errors in sendMessage', async () => {
      sendMessage
        .mockResolvedValueOnce(undefined) // First call succeeds
        .mockRejectedValueOnce(new Error('Connection lost')); // Second fails

      await expect(controller.selectSlot(0)).rejects.toThrow('Connection lost');

      // First message should have been sent
      expect(sendMessage).toHaveBeenCalledTimes(2);
    });

    it('should handle errors during Phase 2', async () => {
      // Phase 1 succeeds, Phase 2 fails
      waitForMessage.mockReset();
      waitForMessage
        .mockResolvedValueOnce([0xB6, 30, 7])   // Device on slot 1
        .mockResolvedValueOnce([0x9F, 11, 0]);  // Phase 1 Note Off

      sendMessage
        .mockResolvedValueOnce(undefined)  // Phase 1: Note On
        .mockResolvedValueOnce(undefined)  // Phase 1: CC query
        .mockResolvedValueOnce(undefined)  // Phase 1: Note Off
        .mockResolvedValueOnce(undefined)  // Phase 2: Note On
        .mockRejectedValueOnce(new Error('Phase 2 failed')); // Phase 2: CC set fails

      await expect(controller.selectSlot(0)).rejects.toThrow('Phase 2 failed');

      // Should have attempted 5 messages before failing
      expect(sendMessage).toHaveBeenCalledTimes(5);
    });
  });
});
