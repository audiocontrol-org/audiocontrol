/**
 * Integration tests for complete custom mode operations
 * Tests reading, writing, and acknowledgment handling for Launch Control XL 3
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SysExParser, type CustomModeMessage } from '@/core/SysExParser';
import { MockMidiBackend } from '@/core/backends/MockMidiBackend';
import type { MidiInputPort, MidiOutputPort } from '@/core/MidiInterface';

describe('Custom Mode Operations Integration Tests', () => {
  let mockBackend: MockMidiBackend;
  let inputPort: MidiInputPort;
  let outputPort: MidiOutputPort;

  beforeEach(async () => {
    mockBackend = new MockMidiBackend();
    await mockBackend.initialize();

    const inputPorts = await mockBackend.getInputPorts();
    const outputPorts = await mockBackend.getOutputPorts();

    inputPort = await mockBackend.openInput(inputPorts[0].id);
    outputPort = await mockBackend.openOutput(outputPorts[0].id);
  });

  afterEach(async () => {
    await mockBackend.cleanup();
  });

  describe('Reading Factory Custom Modes', () => {
    it('should read multiple slots successfully', async () => {
      const mockResponses = [
        // Response for slot 0
        [
          0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x10, 0x00,
          0x06, 0x20, 0x08,
          0x53, 0x4C, 0x4F, 0x54, 0x30, 0x00, 0x00, 0x00, // "SLOT0"
          0x21, 0x00,
          0x48, 0x10, 0x02, 0x05, 0x00, 0x01, 0x48, 0x00, 0x0D, 0x7F, // Top encoder 1
          0xF7
        ],
        // Response for slot 1
        [
          0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x10, 0x01,
          0x06, 0x20, 0x08,
          0x53, 0x4C, 0x4F, 0x54, 0x31, 0x00, 0x00, 0x00, // "SLOT1"
          0x21, 0x00,
          0x48, 0x11, 0x02, 0x05, 0x00, 0x01, 0x48, 0x00, 0x0E, 0x7F, // Top encoder 2
          0xF7
        ]
      ];

      const responses: any[] = [];
      let responseCount = 0;

      inputPort.onMessage = (message) => {
        if (message.data[0] === 0xF0) {
          const parsed = SysExParser.parse(Array.from(message.data));
          responses.push(parsed);
          responseCount++;
        }
      };

      // Read from slot 0
      const readRequest0 = SysExParser.buildCustomModeReadRequest(0);
      await mockBackend.sendMessage(outputPort, { timestamp: Date.now(), data: readRequest0 });

      // Simulate response for slot 0
      if (inputPort.onMessage) {
        inputPort.onMessage({ timestamp: Date.now(), data: mockResponses[0] });
      }

      // Read from slot 1
      const readRequest1 = SysExParser.buildCustomModeReadRequest(1);
      await mockBackend.sendMessage(outputPort, { timestamp: Date.now(), data: readRequest1 });

      // Simulate response for slot 1
      if (inputPort.onMessage) {
        inputPort.onMessage({ timestamp: Date.now(), data: mockResponses[1] });
      }

      expect(responseCount).toBe(2);
      expect(responses[0].name).toBe('SLOT0');
      expect(responses[0].slot).toBe(0);
      expect(responses[1].name).toBe('SLOT1');
      expect(responses[1].slot).toBe(1);
    });

    it('should handle corrupted response data gracefully', async () => {
      const corruptedResponse = [
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x10, 0x00,
        0x06, 0x20, 0x08,
        0xFF, 0xFF, 0xFF, 0xFF, // Corrupted data
        0x21, 0x00,
        0x48, 0x10, 0xFF, 0x05, 0x00, 0x01, 0x48, 0x00, 0x0D, 0x7F, // Invalid control
        0xF7
      ];

      let parseError: Error | null = null;
      let parsedResponse: any = null;

      inputPort.onMessage = (message) => {
        if (message.data[0] === 0xF0) {
          try {
            parsedResponse = SysExParser.parse(Array.from(message.data));
          } catch (error) {
            parseError = error as Error;
          }
        }
      };

      // Send read request
      const readRequest = SysExParser.buildCustomModeReadRequest(0);
      await mockBackend.sendMessage(outputPort, { timestamp: Date.now(), data: readRequest });

      // Simulate corrupted response
      if (inputPort.onMessage) {
        inputPort.onMessage({ timestamp: Date.now(), data: corruptedResponse });
      }

      // Should parse without throwing but with graceful handling
      expect(parseError).toBeNull();
      expect(parsedResponse).toBeDefined();
      expect(parsedResponse.type).toBe('custom_mode_response');
      // Controls with invalid structure should be filtered out
      expect(parsedResponse.controls.length).toBe(0);
    });
  });

  describe('Writing Simple Custom Mode', () => {
    it('should create and send a simple custom mode successfully', async () => {
      const simpleMode: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: [0x00, 0x20, 0x29],
        slot: 0,
        name: 'SIMPLE',
        controls: [
          {
            controlId: 0x00, // Fader 1
            channel: 0,
            ccNumber: 20,
            minValue: 0,
            maxValue: 127,
            behaviour: 'absolute' as const
          }
        ],
        colors: [
          {
            controlId: 0x00,
            color: 0x3F,
            behaviour: 'static' as const
          }
        ],
        data: []
      };

      let acknowledgmentReceived = false;

      inputPort.onMessage = (message) => {
        // Check for acknowledgment: F0 00 20 29 02 15 05 00 15 [SLOT] 06 F7
        if (message.data.length === 12 &&
            message.data[0] === 0xF0 &&
            message.data[8] === 0x15 && // Write ACK operation
            message.data[10] === 0x06) { // Success code
          acknowledgmentReceived = true;
        }
      };

      // Build and send write request
      const writeRequest = SysExParser.buildCustomModeWriteRequest(0, simpleMode);
      await mockBackend.sendMessage(outputPort, { timestamp: Date.now(), data: writeRequest });

      // Verify write request structure
      expect(writeRequest[0]).toBe(0xF0); // SysEx start
      expect(writeRequest.slice(1, 4)).toEqual([0x00, 0x20, 0x29]); // Manufacturer ID
      expect(writeRequest[8]).toBe(0x45); // Write operation
      expect(writeRequest[9]).toBe(0); // Slot 0
      expect(writeRequest[writeRequest.length - 1]).toBe(0xF7); // SysEx end

      // Simulate device acknowledgment
      const mockAck = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x15, 0x00, 0x06, 0xF7];
      if (inputPort.onMessage) {
        inputPort.onMessage({ timestamp: Date.now(), data: mockAck });
      }

      expect(acknowledgmentReceived).toBe(true);
      expect(mockBackend.sentMessages).toHaveLength(1);
    });

    it('should validate custom mode data before sending', () => {
      const invalidMode: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: [0x00, 0x20, 0x29],
        slot: 0,
        name: 'INVALID',
        controls: [
          {
            controlId: 0x00,
            channel: 16, // Invalid channel (should be 0-15)
            ccNumber: 128, // Invalid CC (should be 0-127)
            minValue: 0,
            maxValue: 127,
            behaviour: 'absolute' as const
          }
        ],
        colors: [],
        data: []
      };

      expect(() => {
        SysExParser.buildCustomModeWriteRequest(0, invalidMode);
      }).toThrow();
    });

    it('should handle missing required sections', () => {
      const incompleteMode: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: [0x00, 0x20, 0x29],
        slot: 0,
        name: 'INCOMPLETE',
        controls: [], // Empty controls
        colors: [], // Empty colors
        data: []
      };

      expect(() => {
        SysExParser.buildCustomModeWriteRequest(0, incompleteMode);
      }).toThrow('Custom mode must have controls array');
    });
  });

  describe('Writing Complex Multi-Control Mode', () => {
    it('should create and send a complex custom mode with all control types', async () => {
      const complexMode: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: [0x00, 0x20, 0x29],
        slot: 1,
        name: 'COMPLEX',
        controls: [
          // Faders
          { controlId: 0x00, channel: 0, ccNumber: 10, minValue: 0, maxValue: 127, behaviour: 'absolute' as const },
          { controlId: 0x01, channel: 0, ccNumber: 11, minValue: 0, maxValue: 127, behaviour: 'absolute' as const },
          // Top encoders
          { controlId: 0x10, channel: 0, ccNumber: 20, minValue: 0, maxValue: 127, behaviour: 'absolute' as const },
          { controlId: 0x11, channel: 0, ccNumber: 21, minValue: 0, maxValue: 127, behaviour: 'absolute' as const },
          // Middle encoders
          { controlId: 0x18, channel: 0, ccNumber: 30, minValue: 0, maxValue: 127, behaviour: 'absolute' as const },
          { controlId: 0x19, channel: 0, ccNumber: 31, minValue: 0, maxValue: 127, behaviour: 'absolute' as const },
          // Bottom encoders
          { controlId: 0x20, channel: 0, ccNumber: 40, minValue: 0, maxValue: 127, behaviour: 'absolute' as const },
          { controlId: 0x21, channel: 0, ccNumber: 41, minValue: 0, maxValue: 127, behaviour: 'absolute' as const },
        ],
        colors: [
          { controlId: 0x00, color: 0x0F, behaviour: 'static' as const }, // Red faders
          { controlId: 0x01, color: 0x0F, behaviour: 'static' as const },
          { controlId: 0x10, color: 0x60, behaviour: 'static' as const }, // Blue top encoders
          { controlId: 0x11, color: 0x60, behaviour: 'static' as const },
          { controlId: 0x18, color: 0x48, behaviour: 'static' as const }, // Yellow middle encoders
          { controlId: 0x19, color: 0x48, behaviour: 'static' as const },
          { controlId: 0x20, color: 0x3C, behaviour: 'static' as const }, // Green bottom encoders
          { controlId: 0x21, color: 0x3C, behaviour: 'static' as const },
        ],
        data: []
      };

      const writeRequest = SysExParser.buildCustomModeWriteRequest(1, complexMode);
      await mockBackend.sendMessage(outputPort, { timestamp: Date.now(), data: writeRequest });

      // Verify the message structure
      expect(writeRequest[0]).toBe(0xF0); // SysEx start
      expect(writeRequest[9]).toBe(1); // Slot 1
      expect(writeRequest[writeRequest.length - 1]).toBe(0xF7); // SysEx end

      // Message should be significantly larger due to all the controls and labels
      expect(writeRequest.length).toBeGreaterThan(200);

      // Verify we have the expected data header
      const dataStart = 10; // After header
      expect(writeRequest.slice(dataStart, dataStart + 3)).toEqual([0x00, 0x20, 0x08]);

      // Verify mode name "COMPLEX" is present
      const nameBytes = writeRequest.slice(dataStart + 3, dataStart + 3 + 7);
      const nameString = String.fromCharCode(...nameBytes);
      expect(nameString).toBe('COMPLEX');
    });

    it('should maintain correct control ID offset (+0x28) for all control types', async () => {
      const testMode: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: [0x00, 0x20, 0x29],
        slot: 0,
        name: 'OFFSET',
        controls: [
          { controlId: 0x10, channel: 0, ccNumber: 13, minValue: 0, maxValue: 127, behaviour: 'absolute' as const }, // Should become 0x38
        ],
        colors: [
          { controlId: 0x10, color: 0x60, behaviour: 'static' as const }
        ],
        data: []
      };

      const writeRequest = SysExParser.buildCustomModeWriteRequest(0, testMode);

      // Find the control definition in the message
      let controlFoundAt = -1;
      for (let i = 0; i < writeRequest.length - 10; i++) {
        if (writeRequest[i] === 0x49) { // Write control marker
          controlFoundAt = i;
          break;
        }
      }

      expect(controlFoundAt).toBeGreaterThan(-1);
      expect(writeRequest[controlFoundAt + 1]).toBe(0x10 + 0x28); // Control ID with offset
    });
  });

  describe('Acknowledgment Handling', () => {
    it('should properly handle successful write acknowledgments', async () => {
      const mode: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: [0x00, 0x20, 0x29],
        slot: 2,
        name: 'ACKTEST',
        controls: [
          { controlId: 0x00, channel: 0, ccNumber: 50, minValue: 0, maxValue: 127, behaviour: 'absolute' as const }
        ],
        colors: [
          { controlId: 0x00, color: 0x3F, behaviour: 'static' as const }
        ],
        data: []
      };

      let ackSlot = -1;
      let ackStatus = -1;

      inputPort.onMessage = (message) => {
        const data = Array.from(message.data);
        // Check for acknowledgment format: F0 00 20 29 02 15 05 00 15 [SLOT] [STATUS] F7
        if (data.length === 12 &&
            data[0] === 0xF0 &&
            data[1] === 0x00 && data[2] === 0x20 && data[3] === 0x29 &&
            data[8] === 0x15) { // Write ACK operation
          ackSlot = data[9];
          ackStatus = data[10];
        }
      };

      const writeRequest = SysExParser.buildCustomModeWriteRequest(2, mode);
      await mockBackend.sendMessage(outputPort, { timestamp: Date.now(), data: writeRequest });

      // Simulate successful acknowledgment
      const successAck = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x15, 0x02, 0x06, 0xF7];
      if (inputPort.onMessage) {
        inputPort.onMessage({ timestamp: Date.now(), data: successAck });
      }

      expect(ackSlot).toBe(2);
      expect(ackStatus).toBe(0x06); // Success status
    });

    it('should handle error acknowledgments', async () => {
      const mode: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: [0x00, 0x20, 0x29],
        slot: 0,
        name: 'ERROR',
        controls: [
          { controlId: 0x00, channel: 0, ccNumber: 60, minValue: 0, maxValue: 127, behaviour: 'absolute' as const }
        ],
        colors: [
          { controlId: 0x00, color: 0x3F, behaviour: 'static' as const }
        ],
        data: []
      };

      let ackStatus = -1;

      inputPort.onMessage = (message) => {
        const data = Array.from(message.data);
        if (data.length === 12 && data[8] === 0x15) {
          ackStatus = data[10];
        }
      };

      const writeRequest = SysExParser.buildCustomModeWriteRequest(0, mode);
      await mockBackend.sendMessage(outputPort, { timestamp: Date.now(), data: writeRequest });

      // Simulate error acknowledgment (status != 0x06)
      const errorAck = [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x15, 0x00, 0x01, 0xF7];
      if (inputPort.onMessage) {
        inputPort.onMessage({ timestamp: Date.now(), data: errorAck });
      }

      expect(ackStatus).toBe(0x01); // Error status
    });
  });

  describe('Error Cases', () => {
    it('should handle invalid slot numbers gracefully', () => {
      const mode: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: [0x00, 0x20, 0x29],
        slot: 0,
        name: 'TEST',
        controls: [
          { controlId: 0x00, channel: 0, ccNumber: 10, minValue: 0, maxValue: 127, behaviour: 'absolute' as const }
        ],
        colors: [
          { controlId: 0x00, color: 0x3F, behaviour: 'static' as const }
        ],
        data: []
      };

      expect(() => SysExParser.buildCustomModeWriteRequest(-1, mode)).toThrow('Custom mode slot must be 0-15');
      expect(() => SysExParser.buildCustomModeWriteRequest(16, mode)).toThrow('Custom mode slot must be 0-15');
    });

    it('should handle malformed SysEx messages', async () => {
      const malformedMessages = [
        [0xF0], // Missing end byte
        [0x80, 0x40, 0x7F], // Not a SysEx message
        [0xF0, 0xF7], // Too short
        [0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x10, 0x00, 0xFF], // Missing F7
      ];

      let parseErrors = 0;

      inputPort.onMessage = (message) => {
        try {
          SysExParser.parse(Array.from(message.data));
        } catch (error) {
          parseErrors++;
        }
      };

      for (const malformed of malformedMessages) {
        if (inputPort.onMessage) {
          inputPort.onMessage({ timestamp: Date.now(), data: malformed });
        }
      }

      expect(parseErrors).toBe(4); // All malformed messages should cause parse errors
    });

    it('should handle device communication timeouts', async () => {
      let messagesSent = 0;
      let responsesReceived = 0;

      inputPort.onMessage = () => {
        responsesReceived++;
      };

      // Send multiple read requests without responses
      for (let slot = 0; slot < 3; slot++) {
        const readRequest = SysExParser.buildCustomModeReadRequest(slot);
        await mockBackend.sendMessage(outputPort, { timestamp: Date.now(), data: readRequest });
        messagesSent++;
      }

      // Wait briefly - no responses should be received from mock
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(messagesSent).toBe(3);
      expect(responsesReceived).toBe(0); // Mock backend doesn't auto-respond to custom mode reads
      expect(mockBackend.sentMessages).toHaveLength(3);
    });
  });
});