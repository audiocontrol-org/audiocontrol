/**
 * Integration test for reading custom modes from Launch Control XL 3
 * Tests reading and parsing the CHANNEV custom mode from the device
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SysExParser } from '@/core/SysExParser';
import { MockMidiBackend } from '@/core/backends/MockMidiBackend';
import type { MidiInputPort, MidiOutputPort } from '@/core/MidiInterface';

describe('Custom Mode Read Integration Tests', () => {
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

  describe('Reading Factory Custom Mode', () => {
    it('should build correct read request for slot 0', () => {
      const readRequest = SysExParser.buildCustomModeReadRequest(0);

      expect(readRequest).toEqual([
        0xF0,             // SysEx start
        0x00, 0x20, 0x29, // Manufacturer ID (Novation)
        0x02,             // Device ID (Launch Control XL 3)
        0x15,             // Command (Custom mode)
        0x05,             // Sub-command
        0x00,             // Reserved
        0x40,             // Read operation
        0,                // Slot number (0 for slot 1)
        0x00,             // Parameter
        0xF7              // SysEx end
      ]);
    });

    it('should validate slot range for read requests', () => {
      expect(() => SysExParser.buildCustomModeReadRequest(-1)).toThrow('Custom mode slot must be 0-15');
      expect(() => SysExParser.buildCustomModeReadRequest(16)).toThrow('Custom mode slot must be 0-15');
    });

    it('should handle successful device response', async () => {
      // Simulate a successful custom mode read response (based on actual CHANNEV response)
      const mockResponse = [
        0xF0, // SysEx start
        0x00, 0x20, 0x29, // Manufacturer ID
        0x02, 0x15, 0x05, 0x00, // Device header
        0x10, // Response operation
        0x00, // Slot
        // Custom mode data starts here
        0x06, 0x20, 0x08, // Data header
        // Mode name "CHANNEV"
        0x43, 0x48, 0x41, 0x4E, 0x4E, 0x45, 0x56, 0x00,
        0x21, 0x00, // Name terminator
        // Control definitions (using 0x48 markers for READ response)
        0x48, 0x10, 0x02, 0x05, 0x00, 0x01, 0x48, 0x00, 0x0D, 0x7F, // Top encoder 1, CC 13
        0x48, 0x11, 0x02, 0x05, 0x00, 0x01, 0x48, 0x00, 0x0E, 0x7F, // Top encoder 2, CC 14
        0x48, 0x12, 0x02, 0x05, 0x00, 0x01, 0x48, 0x00, 0x0F, 0x7F, // Top encoder 3, CC 15
        0x48, 0x00, 0x02, 0x00, 0x00, 0x01, 0x48, 0x00, 0x0A, 0x7F, // Fader 1, CC 10
        0x48, 0x01, 0x02, 0x00, 0x00, 0x01, 0x48, 0x00, 0x0B, 0x7F, // Fader 2, CC 11
        0xF7 // SysEx end
      ];

      let responseReceived = false;
      let parsedResponse: any = null;
      let parseError: Error | null = null;

      inputPort.onMessage = (message) => {
        if (message.data[0] === 0xF0) {
          responseReceived = true;
          try {
            parsedResponse = SysExParser.parse(Array.from(message.data));
          } catch (error) {
            parseError = error as Error;
          }
        }
      };

      // Send read request
      const readRequest = SysExParser.buildCustomModeReadRequest(0);
      await mockBackend.sendMessage(outputPort, {
        timestamp: Date.now(),
        data: readRequest
      });

      // Simulate device response
      if (inputPort.onMessage) {
        inputPort.onMessage({
          timestamp: Date.now(),
          data: mockResponse
        });
      }

      expect(responseReceived).toBe(true);
      expect(parseError).toBeNull();
      expect(parsedResponse).toBeDefined();
      expect(parsedResponse.type).toBe('custom_mode_response');
      expect(parsedResponse.slot).toBe(0);
      expect(parsedResponse.name).toBe('CHANNEV');
      expect(parsedResponse.controls).toHaveLength(5);

      // Verify specific control mappings
      const controls = parsedResponse.controls;
      expect(controls.find((c: any) => c.controlId === 0x10 && c.ccNumber === 13)).toBeDefined(); // Top encoder 1
      expect(controls.find((c: any) => c.controlId === 0x11 && c.ccNumber === 14)).toBeDefined(); // Top encoder 2
      expect(controls.find((c: any) => c.controlId === 0x12 && c.ccNumber === 15)).toBeDefined(); // Top encoder 3
      expect(controls.find((c: any) => c.controlId === 0x00 && c.ccNumber === 10)).toBeDefined(); // Fader 1
      expect(controls.find((c: any) => c.controlId === 0x01 && c.ccNumber === 11)).toBeDefined(); // Fader 2
    });

    it('should handle timeout when device does not respond', async () => {
      let responseReceived = false;

      inputPort.onMessage = () => {
        responseReceived = true;
      };

      // Send read request
      const readRequest = SysExParser.buildCustomModeReadRequest(0);
      await mockBackend.sendMessage(outputPort, {
        timestamp: Date.now(),
        data: readRequest
      });

      // Wait a short time to verify no response
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(responseReceived).toBe(false);
      expect(mockBackend.sentMessages).toHaveLength(1);
      expect(mockBackend.sentMessages[0].data).toEqual(readRequest);
    });
  });

  describe('Control Structure Validation', () => {
    it('should correctly identify control markers in read response', () => {
      const testData = [
        0x48, 0x10, 0x02, 0x05, 0x00, 0x01, 0x48, 0x00, 0x0D, 0x7F, // Valid control
        0x48, 0x11, 0x02, 0x05, 0x00, 0x01, 0x48, 0x00, 0x0E, 0x7F, // Valid control
        0x00, 0x48, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // Invalid (not at start)
      ];

      // Test our parsing logic can distinguish valid control markers
      const { controls } = (SysExParser as any).parseCustomModeData(testData);

      expect(controls).toHaveLength(2);
      expect(controls[0].controlId).toBe(0x10);
      expect(controls[0].ccNumber).toBe(13);
      expect(controls[1].controlId).toBe(0x11);
      expect(controls[1].ccNumber).toBe(14);
    });

    it('should validate control structure format', () => {
      // Control with invalid definition type (should be 0x02)
      const invalidDefType = [
        0x48, 0x10, 0xFF, 0x05, 0x00, 0x01, 0x48, 0x00, 0x0D, 0x7F
      ];

      const { controls: invalidControls } = (SysExParser as any).parseCustomModeData(invalidDefType);
      expect(invalidControls).toHaveLength(0); // Should reject invalid structure

      // Control with valid structure
      const validControl = [
        0x48, 0x10, 0x02, 0x05, 0x00, 0x01, 0x48, 0x00, 0x0D, 0x7F
      ];

      const { controls: validControls } = (SysExParser as any).parseCustomModeData(validControl);
      expect(validControls).toHaveLength(1);
    });
  });

  describe('Mode Name Parsing', () => {
    it('should extract mode name from response data', () => {
      const testData = [
        0x06, 0x20, 0x08, // Header
        0x43, 0x48, 0x41, 0x4E, 0x4E, 0x45, 0x56, // "CHANNEV"
        0x21, 0x00, // Terminator
        // Rest of data...
      ];

      const { name } = (SysExParser as any).parseCustomModeData(testData);
      expect(name).toBe('CHANNEV');
    });

    it('should handle mode name without explicit terminator', () => {
      const testData = [
        0x06, 0x20, 0x08, // Header
        0x54, 0x45, 0x53, 0x54, // "TEST"
        0x48, 0x10, 0x02, 0x05, 0x00, 0x01, 0x48, 0x00, 0x0D, 0x7F, // Control follows
      ];

      const { name } = (SysExParser as any).parseCustomModeData(testData);
      expect(name).toBe('TEST');
    });

    it('should handle empty or missing mode name', () => {
      const testData = [
        0x06, 0x20, 0x08, // Header
        0x48, 0x10, 0x02, 0x05, 0x00, 0x01, 0x48, 0x00, 0x0D, 0x7F, // Control immediately
      ];

      const { name } = (SysExParser as any).parseCustomModeData(testData);
      expect(name).toBeUndefined();
    });
  });
});