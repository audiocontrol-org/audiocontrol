/**
 * Integration tests for D-110 SysEx communication using easymidi virtual ports
 *
 * These tests verify that SysEx messages are correctly generated, sent, received,
 * and parsed using virtual MIDI ports.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as easymidi from 'easymidi';
import { createEasymidiAdapter } from '@/core/midi/EasymidiAdapter';
import {
  buildDT1Message,
  buildRQ1Message,
  parseSysExMessage,
  calculateChecksum,
  getTempToneAddress,
  getSystemAddress,
  getPartTimbreAddress,
  formatBytes,
} from '@/core/midi/sysex';
import {
  ROLAND_ID,
  D110_MODEL_ID,
  DEFAULT_DEVICE_ID,
  D110_COMMANDS,
  TONE_DATA_SIZE,
  SYSTEM_PARAMS_SIZE,
  PART_TIMBRE_SIZE,
} from '@/core/midi/constants';
import type { D110MidiIO } from '@/core/midi/types';

describe('D-110 SysEx Integration Tests', () => {
  let senderInput: easymidi.Input;
  let senderOutput: easymidi.Output;
  let receiverInput: easymidi.Input;
  let receiverOutput: easymidi.Output;
  let senderAdapter: D110MidiIO;
  let receiverAdapter: D110MidiIO;

  beforeEach(() => {
    // Create virtual MIDI ports for testing
    // The sender simulates the computer, receiver simulates the D-110
    senderOutput = new easymidi.Output('D110-Test-Sender', true);
    receiverInput = new easymidi.Input('D110-Test-Sender', false);

    receiverOutput = new easymidi.Output('D110-Test-Receiver', true);
    senderInput = new easymidi.Input('D110-Test-Receiver', false);

    senderAdapter = createEasymidiAdapter(senderInput, senderOutput);
    receiverAdapter = createEasymidiAdapter(receiverInput, receiverOutput);
  });

  afterEach(() => {
    // Clean up virtual ports
    senderInput.close();
    senderOutput.close();
    receiverInput.close();
    receiverOutput.close();
  });

  describe('SysEx message round-trip', () => {
    it('should send and receive a DT1 message correctly', async () => {
      const address = { aa: 0x04, bb: 0x00, cc: 0x00 };
      const data = [0x50, 0x60, 0x70];
      const message = buildDT1Message(address, data);

      const receivedPromise = new Promise<number[]>((resolve) => {
        receiverAdapter.onSysEx((msg) => {
          resolve(msg);
        });
      });

      // Send the message
      senderAdapter.send(message);

      // Wait for receipt
      const received = await receivedPromise;

      // Verify the message was received correctly
      expect(received).toEqual(message);

      // Parse and verify
      const parsed = parseSysExMessage(received);
      expect(parsed.isValid).toBe(true);
      expect(parsed.command).toBe(D110_COMMANDS.DATA);
      expect(parsed.address).toEqual(address);
      expect(parsed.data).toEqual(data);
    });

    it('should send and receive an RQ1 message correctly', async () => {
      const address = getSystemAddress();
      const size = SYSTEM_PARAMS_SIZE;
      const message = buildRQ1Message(address, size);

      const receivedPromise = new Promise<number[]>((resolve) => {
        receiverAdapter.onSysEx((msg) => {
          resolve(msg);
        });
      });

      senderAdapter.send(message);
      const received = await receivedPromise;

      expect(received).toEqual(message);

      const parsed = parseSysExMessage(received);
      expect(parsed.isValid).toBe(true);
      expect(parsed.command).toBe(D110_COMMANDS.REQUEST);
      expect(parsed.address).toEqual(address);
    });

    it('should handle multiple sequential messages', async () => {
      const messages: number[][] = [];
      const addresses = [
        getPartTimbreAddress(0),
        getPartTimbreAddress(1),
        getPartTimbreAddress(2),
      ];

      const receivedMessages: number[][] = [];
      const allReceivedPromise = new Promise<void>((resolve) => {
        receiverAdapter.onSysEx((msg) => {
          receivedMessages.push([...msg]);
          if (receivedMessages.length === 3) {
            resolve();
          }
        });
      });

      // Build and send multiple messages
      for (const address of addresses) {
        const message = buildRQ1Message(address, PART_TIMBRE_SIZE);
        messages.push(message);
        senderAdapter.send(message);
      }

      await allReceivedPromise;

      expect(receivedMessages.length).toBe(3);
      for (let i = 0; i < 3; i++) {
        expect(receivedMessages[i]).toEqual(messages[i]);
      }
    });
  });

  describe('Simulated D-110 responses', () => {
    it('should handle a simulated tone data response', async () => {
      // Simulate a D-110 responding to a tone request
      const requestAddress = getTempToneAddress(0);

      // Create fake tone data (246 bytes)
      const fakeResponseData = new Array(TONE_DATA_SIZE).fill(0).map((_, i) => i % 128);

      // Build response from "D-110"
      const response = buildDT1Message(requestAddress, fakeResponseData);

      const receivedPromise = new Promise<number[]>((resolve) => {
        senderAdapter.onSysEx((msg) => {
          resolve(msg);
        });
      });

      // D-110 (receiver) sends response back
      receiverAdapter.send(response);
      const received = await receivedPromise;

      const parsed = parseSysExMessage(received);
      expect(parsed.isValid).toBe(true);
      expect(parsed.data.length).toBe(TONE_DATA_SIZE);
      expect(parsed.data[0]).toBe(0);
      expect(parsed.data[10]).toBe(10);
    });

    it('should handle a simulated system params response', async () => {
      const address = getSystemAddress();

      // Create fake system params (33 bytes)
      const fakeSystemData = [
        0x00, // Master tune (skipped)
        0x03, // Reverb mode (Hall 2)
        0x05, // Reverb time
        0x06, // Reverb level
        // Partial reserve for 9 parts (8 + rhythm)
        0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04, 0x00,
        // MIDI channels for 9 parts
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x0a,
        // Patch name (10 chars)
        0x44, 0x31, 0x31, 0x30, 0x20, 0x54, 0x45, 0x53, 0x54, 0x20, // "D110 TEST "
      ];

      const response = buildDT1Message(address, fakeSystemData);

      const receivedPromise = new Promise<number[]>((resolve) => {
        senderAdapter.onSysEx((msg) => {
          resolve(msg);
        });
      });

      receiverAdapter.send(response);
      const received = await receivedPromise;

      const parsed = parseSysExMessage(received);
      expect(parsed.isValid).toBe(true);
      expect(parsed.data[1]).toBe(0x03); // Reverb mode
      expect(parsed.data[2]).toBe(0x05); // Reverb time

      // Verify patch name
      const nameBytes = parsed.data.slice(22, 32);
      const name = String.fromCharCode(...nameBytes);
      expect(name).toBe('D110 TEST ');
    });
  });

  describe('Checksum verification', () => {
    it('should reject messages with invalid checksums', () => {
      const address = { aa: 0x04, bb: 0x00, cc: 0x00 };
      const data = [0x50];
      const message = buildDT1Message(address, data);

      // Corrupt the checksum
      const corruptedMessage = [...message];
      corruptedMessage[message.length - 2] = 0xff; // Wrong checksum

      const parsed = parseSysExMessage(corruptedMessage);
      expect(parsed.isValid).toBe(false);
      expect(parsed.error).toContain('Checksum mismatch');
    });

    it('should accept messages with correct checksums', () => {
      // Manually construct a valid message
      const address = { aa: 0x10, bb: 0x00, cc: 0x01 };
      const data = [0x05]; // Reverb time = 5

      const addressAndData = [address.aa, address.bb, address.cc, ...data];
      const checksum = calculateChecksum(addressAndData);

      const message = [
        0xf0, // SysEx start
        ROLAND_ID,
        DEFAULT_DEVICE_ID,
        D110_MODEL_ID,
        D110_COMMANDS.DATA,
        address.aa,
        address.bb,
        address.cc,
        ...data,
        checksum,
        0xf7, // SysEx end
      ];

      const parsed = parseSysExMessage(message);
      expect(parsed.isValid).toBe(true);
      expect(parsed.address).toEqual(address);
      expect(parsed.data).toEqual(data);
    });
  });

  describe('Address calculations', () => {
    it('should calculate tone addresses correctly for all parts', async () => {
      const receivedAddresses: { aa: number; bb: number; cc: number }[] = [];

      const allReceivedPromise = new Promise<void>((resolve) => {
        receiverAdapter.onSysEx((msg) => {
          const parsed = parseSysExMessage(msg);
          if (parsed.isValid) {
            receivedAddresses.push(parsed.address);
          }
          if (receivedAddresses.length === 8) {
            resolve();
          }
        });
      });

      // Send requests for all 8 parts
      for (let i = 0; i < 8; i++) {
        const address = getTempToneAddress(i);
        const message = buildRQ1Message(address, TONE_DATA_SIZE);
        senderAdapter.send(message);
      }

      await allReceivedPromise;

      // Verify addresses follow the expected pattern
      // Part 0: 0x04:0x00:0x00
      expect(receivedAddresses[0]).toEqual({ aa: 0x04, bb: 0x00, cc: 0x00 });

      // Part 1: location = 246, BB = 1, CC = 0x76
      expect(receivedAddresses[1]).toEqual({ aa: 0x04, bb: 0x01, cc: 0x76 });

      // All should have AA = 0x04
      for (const addr of receivedAddresses) {
        expect(addr.aa).toBe(0x04);
      }
    });

    it('should calculate part timbre addresses correctly', async () => {
      const receivedAddresses: { aa: number; bb: number; cc: number }[] = [];

      const allReceivedPromise = new Promise<void>((resolve) => {
        receiverAdapter.onSysEx((msg) => {
          const parsed = parseSysExMessage(msg);
          if (parsed.isValid) {
            receivedAddresses.push(parsed.address);
          }
          if (receivedAddresses.length === 8) {
            resolve();
          }
        });
      });

      // Send requests for all 8 parts
      for (let i = 0; i < 8; i++) {
        const address = getPartTimbreAddress(i);
        const message = buildRQ1Message(address, PART_TIMBRE_SIZE);
        senderAdapter.send(message);
      }

      await allReceivedPromise;

      // Part 0: 0x03:0x00:0x00
      expect(receivedAddresses[0]).toEqual({ aa: 0x03, bb: 0x00, cc: 0x00 });

      // Part 4: 0x03:0x40:0x00 (4 * 0x10 = 0x40)
      expect(receivedAddresses[4]).toEqual({ aa: 0x03, bb: 0x40, cc: 0x00 });

      // Part 7: 0x03:0x70:0x00 (7 * 0x10 = 0x70)
      expect(receivedAddresses[7]).toEqual({ aa: 0x03, bb: 0x70, cc: 0x00 });
    });
  });

  describe('Device ID handling', () => {
    it('should use custom device ID in messages', async () => {
      const customDeviceId = 0x11; // Device 18
      const address = { aa: 0x10, bb: 0x00, cc: 0x00 };
      const message = buildDT1Message(address, [0x00], customDeviceId);

      const receivedPromise = new Promise<number[]>((resolve) => {
        receiverAdapter.onSysEx((msg) => {
          resolve(msg);
        });
      });

      senderAdapter.send(message);
      const received = await receivedPromise;

      // Device ID is at position 2
      expect(received[2]).toBe(customDeviceId);
    });

    it('should correctly parse device ID from response', async () => {
      const deviceId = 0x1f; // Device 32 (max)
      const address = { aa: 0x04, bb: 0x00, cc: 0x00 };
      const response = buildDT1Message(address, [0x50], deviceId);

      const receivedPromise = new Promise<number[]>((resolve) => {
        senderAdapter.onSysEx((msg) => {
          resolve(msg);
        });
      });

      receiverAdapter.send(response);
      const received = await receivedPromise;

      const parsed = parseSysExMessage(received);
      expect(parsed.isValid).toBe(true);
      expect(parsed.deviceId).toBe(deviceId);
    });
  });
});

describe('SysEx message formatting', () => {
  it('should format bytes for debugging', () => {
    const bytes = [0xf0, 0x41, 0x10, 0x16, 0x12, 0x04, 0x00, 0x00, 0x50, 0x2c, 0xf7];
    const formatted = formatBytes(bytes);

    expect(formatted).toBe('f0 41 10 16 12 04 00 00 50 2c f7');
  });
});
