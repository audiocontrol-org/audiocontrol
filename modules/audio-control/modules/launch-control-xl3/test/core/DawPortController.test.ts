import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DawPortControllerImpl } from '../../src/core/DawPortController';

describe('DawPortController', () => {
  let sendMessage: ReturnType<typeof vi.fn>;
  let controller: DawPortControllerImpl;

  beforeEach(() => {
    sendMessage = vi.fn().mockResolvedValue(undefined);
    controller = new DawPortControllerImpl(sendMessage);
  });

  describe('selectSlot', () => {
    it('should send correct message sequence for slot 0 (physical slot 1)', async () => {
      await controller.selectSlot(0);

      expect(sendMessage).toHaveBeenCalledTimes(3);

      // Note On: channel 15 (0x9F), note 11, velocity 127
      expect(sendMessage).toHaveBeenNthCalledWith(1, [0x9F, 11, 127]);

      // CC: channel 5 (0xB5), controller 30, value 6 (slot 0 + 1 + 5)
      expect(sendMessage).toHaveBeenNthCalledWith(2, [0xB5, 30, 6]);

      // Note Off: channel 15 (0x9F), note 11, velocity 0
      expect(sendMessage).toHaveBeenNthCalledWith(3, [0x9F, 11, 0]);
    });

    it('should send correct message sequence for slot 1 (physical slot 2)', async () => {
      await controller.selectSlot(1);

      expect(sendMessage).toHaveBeenCalledTimes(3);

      // CC value should be 7 (slot 1 + 1 + 5)
      expect(sendMessage).toHaveBeenNthCalledWith(2, [0xB5, 30, 7]);
    });

    it('should send correct message sequence for slot 14 (physical slot 15)', async () => {
      await controller.selectSlot(14);

      expect(sendMessage).toHaveBeenCalledTimes(3);

      // CC value should be 20 (slot 14 + 1 + 5)
      expect(sendMessage).toHaveBeenNthCalledWith(2, [0xB5, 30, 20]);
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
        sendMessage.mockClear();
        await controller.selectSlot(slot);

        // Check the CC message (2nd call)
        expect(sendMessage).toHaveBeenNthCalledWith(2, [0xB5, 30, ccValue]);
      }
    });

    it('should throw error for invalid slot number (negative)', async () => {
      await expect(controller.selectSlot(-1)).rejects.toThrow('Invalid slot: -1. Must be 0-14');
    });

    it('should throw error for invalid slot number (> 14)', async () => {
      await expect(controller.selectSlot(15)).rejects.toThrow('Invalid slot: 15. Must be 0-14');
    });

    it('should add delay after sending messages', async () => {
      const start = Date.now();
      await controller.selectSlot(0);
      const duration = Date.now() - start;

      // Should have at least 50ms delay
      expect(duration).toBeGreaterThanOrEqual(45); // Allow some margin
    });

    it('should use correct MIDI channels', async () => {
      await controller.selectSlot(0);

      const [noteOn] = sendMessage.mock.calls[0][0];
      const [cc] = sendMessage.mock.calls[1][0];
      const [noteOff] = sendMessage.mock.calls[2][0];

      // Note messages on channel 15 (0x9F = 0x90 | 0x0F)
      expect(noteOn & 0xF0).toBe(0x90); // Note On status
      expect(noteOn & 0x0F).toBe(0x0F); // Channel 15

      // CC on channel 5 (0xB5 = 0xB0 | 0x05)
      expect(cc & 0xF0).toBe(0xB0); // CC status
      expect(cc & 0x0F).toBe(0x05); // Channel 5 (6 in 1-based)

      // Note Off is Note On with velocity 0
      expect(noteOff & 0xF0).toBe(0x90);
      expect(noteOff & 0x0F).toBe(0x0F);
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
  });
});