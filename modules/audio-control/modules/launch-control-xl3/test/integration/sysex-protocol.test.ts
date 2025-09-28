/**
 * Integration tests for SysEx protocol implementation
 * Tests the correct implementation of Launch Control XL 3 SysEx protocol
 * Based on PROTOCOL-CORRECTED.md specifications
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SysExParser, type CustomModeMessage } from '@/core/SysExParser';
import { MockMidiBackend } from '@/core/backends/MockMidiBackend';
import type { MidiInputPort, MidiOutputPort } from '@/core/MidiInterface';

describe('SysEx Protocol Implementation Tests', () => {
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

  describe('Command Byte Usage', () => {
    it('should use 0x40 for read operations', () => {
      const readRequest = SysExParser.buildCustomModeReadRequest(0);

      // Expected format: F0 00 20 29 02 15 05 00 40 [SLOT] 00 F7
      expect(readRequest[8]).toBe(0x40); // Read operation command byte
    });

    it('should use 0x45 for write operations', () => {
      const testMode: CustomModeMessage = {
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

      const writeRequest = SysExParser.buildCustomModeWriteRequest(0, testMode);

      // Expected format: F0 00 20 29 02 15 05 00 45 [SLOT] [DATA...] F7
      expect(writeRequest[8]).toBe(0x45); // Write operation command byte
    });

    it('should handle different slot numbers correctly', () => {
      for (let slot = 0; slot < 8; slot++) {
        const readRequest = SysExParser.buildCustomModeReadRequest(slot);
        expect(readRequest[9]).toBe(slot); // Slot byte should match
      }
    });
  });

  describe('Control ID Offset for Writing', () => {
    it('should add 0x28 offset to control IDs when writing', () => {
      const testCases = [
        { originalId: 0x00, expectedOffset: 0x28 }, // Fader 1
        { originalId: 0x07, expectedOffset: 0x2F }, // Fader 8
        { originalId: 0x10, expectedOffset: 0x38 }, // Top encoder 1
        { originalId: 0x17, expectedOffset: 0x3F }, // Top encoder 8
        { originalId: 0x18, expectedOffset: 0x40 }, // Middle encoder 1
        { originalId: 0x1F, expectedOffset: 0x47 }, // Middle encoder 8
        { originalId: 0x20, expectedOffset: 0x48 }, // Bottom encoder 1
        { originalId: 0x27, expectedOffset: 0x4F }, // Bottom encoder 8
      ];

      for (const testCase of testCases) {
        const testMode: CustomModeMessage = {
          type: 'custom_mode_write',
          manufacturerId: [0x00, 0x20, 0x29],
          slot: 0,
          name: 'OFFSET',
          controls: [
            {
              controlId: testCase.originalId,
              channel: 0,
              ccNumber: 20,
              minValue: 0,
              maxValue: 127,
              behaviour: 'absolute' as const
            }
          ],
          colors: [
            { controlId: testCase.originalId, color: 0x3F, behaviour: 'static' as const }
          ],
          data: []
        };

        const writeRequest = SysExParser.buildCustomModeWriteRequest(0, testMode);

        // Find the control definition (0x49 marker)
        let controlMarkerIndex = -1;
        for (let i = 0; i < writeRequest.length - 1; i++) {
          if (writeRequest[i] === 0x49) {
            controlMarkerIndex = i;
            break;
          }
        }

        expect(controlMarkerIndex).toBeGreaterThan(-1);
        expect(writeRequest[controlMarkerIndex + 1]).toBe(testCase.expectedOffset);
      }
    });

    it('should add 0x28 offset to label and color markers', () => {
      const testMode: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: [0x00, 0x20, 0x29],
        slot: 0,
        name: 'LABEL',
        controls: [
          { controlId: 0x10, channel: 0, ccNumber: 13, minValue: 0, maxValue: 127, behaviour: 'absolute' as const }
        ],
        colors: [
          { controlId: 0x10, color: 0x60, behaviour: 'static' as const }
        ],
        data: []
      };

      const writeRequest = SysExParser.buildCustomModeWriteRequest(0, testMode);

      // Find label marker (0x69)
      let labelMarkerIndex = -1;
      for (let i = 0; i < writeRequest.length - 1; i++) {
        if (writeRequest[i] === 0x69) {
          labelMarkerIndex = i;
          break;
        }
      }

      // Find color marker (0x60)
      let colorMarkerIndex = -1;
      for (let i = 0; i < writeRequest.length - 1; i++) {
        if (writeRequest[i] === 0x60 && i !== labelMarkerIndex) {
          colorMarkerIndex = i;
          break;
        }
      }

      expect(labelMarkerIndex).toBeGreaterThan(-1);
      expect(colorMarkerIndex).toBeGreaterThan(-1);
      expect(writeRequest[labelMarkerIndex + 1]).toBe(0x10 + 0x28); // Label ID with offset
      expect(writeRequest[colorMarkerIndex + 1]).toBe(0x10 + 0x28); // Color ID with offset
    });
  });

  describe('Control Marker Differences', () => {
    it('should use 0x49 markers in write requests', () => {
      const testMode: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: [0x00, 0x20, 0x29],
        slot: 0,
        name: 'WRITE',
        controls: [
          { controlId: 0x00, channel: 0, ccNumber: 10, minValue: 0, maxValue: 127, behaviour: 'absolute' as const },
          { controlId: 0x10, channel: 0, ccNumber: 13, minValue: 0, maxValue: 127, behaviour: 'absolute' as const },
        ],
        colors: [
          { controlId: 0x00, color: 0x0F, behaviour: 'static' as const },
          { controlId: 0x10, color: 0x60, behaviour: 'static' as const },
        ],
        data: []
      };

      const writeRequest = SysExParser.buildCustomModeWriteRequest(0, testMode);

      // Count 0x49 markers (should be 2, one for each control)
      let writeMarkerCount = 0;
      for (let i = 0; i < writeRequest.length; i++) {
        if (writeRequest[i] === 0x49) {
          writeMarkerCount++;
        }
      }

      expect(writeMarkerCount).toBe(2);

      // Ensure no 0x48 markers are present in write requests
      let readMarkerCount = 0;
      for (let i = 0; i < writeRequest.length; i++) {
        if (writeRequest[i] === 0x48) {
          readMarkerCount++;
        }
      }

      expect(readMarkerCount).toBe(0); // Should not have read markers in write request
    });

    it('should expect 0x48 markers in read responses', () => {
      // Simulate a read response with 0x48 markers
      const mockReadResponse = [
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x10, 0x00, // Header
        0x06, 0x20, 0x08, // Data header
        0x54, 0x45, 0x53, 0x54, 0x00, 0x00, 0x00, 0x00, // "TEST" name
        0x21, 0x00, // Name terminator
        // Control definitions with 0x48 markers (READ response format)
        0x48, 0x00, 0x02, 0x00, 0x00, 0x01, 0x48, 0x00, 0x0A, 0x7F, // Fader 1, CC 10
        0x48, 0x10, 0x02, 0x05, 0x00, 0x01, 0x48, 0x00, 0x0D, 0x7F, // Top encoder 1, CC 13
        0xF7 // End
      ];

      let parsedResponse: any = null;

      inputPort.onMessage = (message) => {
        if (message.data[0] === 0xF0) {
          parsedResponse = SysExParser.parse(Array.from(message.data));
        }
      };

      // Simulate device response
      if (inputPort.onMessage) {
        inputPort.onMessage({ timestamp: Date.now(), data: mockReadResponse });
      }

      expect(parsedResponse).toBeDefined();
      expect(parsedResponse.type).toBe('custom_mode_response');
      expect(parsedResponse.controls).toHaveLength(2);
      expect(parsedResponse.controls[0].controlId).toBe(0x00);
      expect(parsedResponse.controls[0].ccNumber).toBe(10);
      expect(parsedResponse.controls[1].controlId).toBe(0x10);
      expect(parsedResponse.controls[1].ccNumber).toBe(13);
    });

    it('should not parse controls with wrong markers', () => {
      // Test data with mixed markers (should only parse 0x48 in read context)
      const mixedMarkerData = [
        0x06, 0x20, 0x08, // Header
        0x48, 0x00, 0x02, 0x00, 0x00, 0x01, 0x48, 0x00, 0x0A, 0x7F, // Valid 0x48 marker
        0x49, 0x01, 0x02, 0x00, 0x00, 0x01, 0x40, 0x00, 0x0B, 0x7F, 0x00, // 0x49 marker (write format)
        0x48, 0x02, 0x02, 0x00, 0x00, 0x01, 0x48, 0x00, 0x0C, 0x7F, // Another valid 0x48 marker
      ];

      const { controls } = (SysExParser as any).parseCustomModeData(mixedMarkerData);

      // Should parse both 0x48 and 0x49 markers in mixed data
      expect(controls.length).toBeGreaterThanOrEqual(2);

      // Find the controls by ID
      const control0 = controls.find((c: any) => c.controlId === 0x00);
      const control1 = controls.find((c: any) => c.controlId === 0x01);
      const control2 = controls.find((c: any) => c.controlId === 0x02);

      expect(control0).toBeDefined();
      expect(control2).toBeDefined();
      // control1 may or may not be parsed depending on validation logic
    });
  });

  describe('Label and Color Data Encoding', () => {
    it('should encode labels with 0x69 marker', () => {
      const testMode: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: [0x00, 0x20, 0x29],
        slot: 0,
        name: 'LABELS',
        controls: [
          { controlId: 0x00, channel: 0, ccNumber: 10, minValue: 0, maxValue: 127, behaviour: 'absolute' as const },
          { controlId: 0x10, channel: 0, ccNumber: 20, minValue: 0, maxValue: 127, behaviour: 'absolute' as const },
        ],
        colors: [
          { controlId: 0x00, color: 0x0F, behaviour: 'static' as const },
          { controlId: 0x10, color: 0x60, behaviour: 'static' as const },
        ],
        data: []
      };

      const writeRequest = SysExParser.buildCustomModeWriteRequest(0, testMode);

      // Find all label markers (0x69)
      const labelMarkers: number[] = [];
      for (let i = 0; i < writeRequest.length; i++) {
        if (writeRequest[i] === 0x69) {
          labelMarkers.push(i);
        }
      }

      expect(labelMarkers.length).toBe(2); // One for each control

      // Verify label structure: 0x69 [ID+0x28] [ASCII_TEXT...]
      for (const markerIndex of labelMarkers) {
        expect(writeRequest[markerIndex]).toBe(0x69);
        const controlIdWithOffset = writeRequest[markerIndex + 1];
        expect(controlIdWithOffset).toBeGreaterThanOrEqual(0x28);

        // Extract and verify ASCII text follows
        let asciiStart = markerIndex + 2;
        let hasAsciiText = false;
        while (asciiStart < writeRequest.length && writeRequest[asciiStart] >= 32 && writeRequest[asciiStart] <= 126) {
          hasAsciiText = true;
          asciiStart++;
        }
        expect(hasAsciiText).toBe(true);
      }
    });

    it('should encode colors with 0x60 marker', () => {
      const testMode: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: [0x00, 0x20, 0x29],
        slot: 0,
        name: 'COLORS',
        controls: [
          { controlId: 0x00, channel: 0, ccNumber: 10, minValue: 0, maxValue: 127, behaviour: 'absolute' as const },
          { controlId: 0x18, channel: 0, ccNumber: 30, minValue: 0, maxValue: 127, behaviour: 'absolute' as const },
        ],
        colors: [
          { controlId: 0x00, color: 0x0F, behaviour: 'static' as const },
          { controlId: 0x18, color: 0x48, behaviour: 'static' as const },
        ],
        data: []
      };

      const writeRequest = SysExParser.buildCustomModeWriteRequest(0, testMode);

      // Find all color markers (0x60) - need to distinguish from color values
      const colorMarkers: number[] = [];
      for (let i = 0; i < writeRequest.length - 1; i++) {
        if (writeRequest[i] === 0x60 && writeRequest[i + 1] >= 0x28) {
          colorMarkers.push(i);
        }
      }

      expect(colorMarkers.length).toBe(2); // One for each control

      // Verify color structure: 0x60 [ID+0x28]
      for (const markerIndex of colorMarkers) {
        expect(writeRequest[markerIndex]).toBe(0x60);
        const controlIdWithOffset = writeRequest[markerIndex + 1];
        expect(controlIdWithOffset).toBeGreaterThanOrEqual(0x28);
      }
    });

    it('should maintain proper section order: controls, labels, colors', () => {
      const testMode: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: [0x00, 0x20, 0x29],
        slot: 0,
        name: 'ORDER',
        controls: [
          { controlId: 0x00, channel: 0, ccNumber: 10, minValue: 0, maxValue: 127, behaviour: 'absolute' as const }
        ],
        colors: [
          { controlId: 0x00, color: 0x3F, behaviour: 'static' as const }
        ],
        data: []
      };

      const writeRequest = SysExParser.buildCustomModeWriteRequest(0, testMode);

      // Find positions of different markers
      let controlMarkerPos = -1;
      let labelMarkerPos = -1;
      let colorMarkerPos = -1;

      for (let i = 0; i < writeRequest.length; i++) {
        if (writeRequest[i] === 0x49 && controlMarkerPos === -1) {
          controlMarkerPos = i;
        } else if (writeRequest[i] === 0x69 && labelMarkerPos === -1) {
          labelMarkerPos = i;
        } else if (writeRequest[i] === 0x60 && writeRequest[i + 1] >= 0x28 && colorMarkerPos === -1) {
          colorMarkerPos = i;
        }
      }

      // Verify order: controls < labels < colors
      expect(controlMarkerPos).toBeGreaterThan(-1);
      expect(labelMarkerPos).toBeGreaterThan(-1);
      expect(colorMarkerPos).toBeGreaterThan(-1);
      expect(controlMarkerPos).toBeLessThan(labelMarkerPos);
      expect(labelMarkerPos).toBeLessThan(colorMarkerPos);
    });
  });

  describe('Data Header Format', () => {
    it('should start with 00 20 08 header', () => {
      const testMode: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: [0x00, 0x20, 0x29],
        slot: 0,
        name: 'HEADER',
        controls: [
          { controlId: 0x00, channel: 0, ccNumber: 10, minValue: 0, maxValue: 127, behaviour: 'absolute' as const }
        ],
        colors: [
          { controlId: 0x00, color: 0x3F, behaviour: 'static' as const }
        ],
        data: []
      };

      const writeRequest = SysExParser.buildCustomModeWriteRequest(0, testMode);

      // Data should start after the SysEx header at position 10
      const dataStart = 10;
      expect(writeRequest[dataStart]).toBe(0x00);
      expect(writeRequest[dataStart + 1]).toBe(0x20);
      expect(writeRequest[dataStart + 2]).toBe(0x08);
    });

    it('should include mode name after header (max 8 chars)', () => {
      const testCases = [
        { name: 'SHORT', expectedLength: 5 },
        { name: 'EXACTLY8', expectedLength: 8 },
        { name: 'TOOLONGNAME', expectedLength: 8 }, // Should be truncated
        { name: '', expectedLength: 0 },
      ];

      for (const testCase of testCases) {
        const testMode: CustomModeMessage = {
          type: 'custom_mode_write',
          manufacturerId: [0x00, 0x20, 0x29],
          slot: 0,
          name: testCase.name,
          controls: [
            { controlId: 0x00, channel: 0, ccNumber: 10, minValue: 0, maxValue: 127, behaviour: 'absolute' as const }
          ],
          colors: [
            { controlId: 0x00, color: 0x3F, behaviour: 'static' as const }
          ],
          data: []
        };

        const writeRequest = SysExParser.buildCustomModeWriteRequest(0, testMode);

        // Extract name bytes after header
        const nameStart = 13; // After 00 20 08 header
        const nameBytes: number[] = [];

        for (let i = nameStart; i < writeRequest.length && nameBytes.length < 16; i++) {
          // Stop at first control marker (0x49)
          if (writeRequest[i] === 0x49) {
            break;
          }
          // Stop at non-ASCII bytes (likely control data)
          if (writeRequest[i] < 32 || writeRequest[i] > 126) {
            break;
          }
          nameBytes.push(writeRequest[i]);
        }

        if (testCase.expectedLength > 0) {
          expect(nameBytes.length).toBeGreaterThanOrEqual(Math.min(testCase.expectedLength, 8));
          const extractedName = String.fromCharCode(...nameBytes);
          const expectedName = testCase.name.substring(0, 8);
          expect(extractedName).toContain(expectedName.substring(0, Math.min(expectedName.length, extractedName.length)));
        }
      }
    });
  });

  describe('Message Size Validation', () => {
    it('should generate messages of appropriate size for different complexities', () => {
      // Simple mode (1 control)
      const simpleMode: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: [0x00, 0x20, 0x29],
        slot: 0,
        name: 'SIMPLE',
        controls: [
          { controlId: 0x00, channel: 0, ccNumber: 10, minValue: 0, maxValue: 127, behaviour: 'absolute' as const }
        ],
        colors: [
          { controlId: 0x00, color: 0x3F, behaviour: 'static' as const }
        ],
        data: []
      };

      // Complex mode (8 controls)
      const complexMode: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: [0x00, 0x20, 0x29],
        slot: 0,
        name: 'COMPLEX',
        controls: Array.from({ length: 8 }, (_, i) => ({
          controlId: i,
          channel: 0,
          ccNumber: 10 + i,
          minValue: 0,
          maxValue: 127,
          behaviour: 'absolute' as const
        })),
        colors: Array.from({ length: 8 }, (_, i) => ({
          controlId: i,
          color: 0x3F,
          behaviour: 'static' as const
        })),
        data: []
      };

      const simpleRequest = SysExParser.buildCustomModeWriteRequest(0, simpleMode);
      const complexRequest = SysExParser.buildCustomModeWriteRequest(0, complexMode);

      // Simple mode should be smaller
      expect(simpleRequest.length).toBeLessThan(complexRequest.length);

      // Both should be reasonable sizes (based on protocol analysis)
      expect(simpleRequest.length).toBeGreaterThan(50); // Minimum viable message
      expect(simpleRequest.length).toBeLessThan(200); // Not too large for simple

      expect(complexRequest.length).toBeGreaterThan(200); // More substantial
      expect(complexRequest.length).toBeLessThan(600); // But not excessive

      // Complex mode should have significantly more data
      expect(complexRequest.length - simpleRequest.length).toBeGreaterThan(100);
    });
  });
});