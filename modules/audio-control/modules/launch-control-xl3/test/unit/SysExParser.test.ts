/**
 * SysEx Parser Unit Tests
 *
 * Comprehensive unit tests for all static methods of the SysExParser class.
 * These are pure unit tests with no I/O operations, designed for fast execution.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SysExParser, MANUFACTURER_ID, SysExMessageType, DEVICE_FAMILY } from '@/core/SysExParser';
import type { CustomModeMessage, SysExMessage } from '@/core/SysExParser';
import { setupFakeTimers, createSysExMessage, assertSysExMessage } from '@/test/helpers/test-utils';

describe('SysExParser', () => {
  setupFakeTimers();

  // ===== buildNovationSyn() Tests =====
  describe('buildNovationSyn', () => {
    it('should build correct Novation SYN message', () => {
      const message = SysExParser.buildNovationSyn();

      expect(message).toHaveLength(8);
      expect(message[0]).toBe(0xF0); // SysEx start
      expect(message.slice(1, 4)).toEqual([0x00, 0x20, 0x29]); // Novation manufacturer ID
      expect(message[4]).toBe(0x00); // Device model (Launch Control)
      expect(message[5]).toBe(0x42); // Command (handshake)
      expect(message[6]).toBe(0x02); // Sub-command (SYN)
      expect(message[7]).toBe(0xF7); // SysEx end
    });

    it('should be deterministic', () => {
      const message1 = SysExParser.buildNovationSyn();
      const message2 = SysExParser.buildNovationSyn();

      expect(message1).toEqual(message2);
    });

    it('should create valid SysEx format', () => {
      const message = SysExParser.buildNovationSyn();

      expect(SysExParser.isValidSysEx(message)).toBe(true);
    });
  });

  // ===== parseNovationSynAck() Tests =====
  describe('parseNovationSynAck', () => {
    const validSynAck = [
      0xF0, 0x00, 0x20, 0x29, 0x00, 0x42, 0x02, // Header
      ...Array.from('LX2012345678901').map(c => c.charCodeAt(0)), // 14-char serial
      0xF7
    ];

    it('should parse valid SYN-ACK message', () => {
      const result = SysExParser.parseNovationSynAck(validSynAck);

      expect(result.valid).toBe(true);
      expect(result.serialNumber).toBe('LX2012345678901');
    });

    it('should reject message with wrong length', () => {
      const tooShort = validSynAck.slice(0, 20);
      const tooLong = [...validSynAck, 0x00];

      expect(SysExParser.parseNovationSynAck(tooShort).valid).toBe(false);
      expect(SysExParser.parseNovationSynAck(tooLong).valid).toBe(false);
    });

    it('should reject message without proper SysEx framing', () => {
      const noStart = [...validSynAck];
      noStart[0] = 0x00;

      const noEnd = [...validSynAck];
      noEnd[noEnd.length - 1] = 0x00;

      expect(SysExParser.parseNovationSynAck(noStart).valid).toBe(false);
      expect(SysExParser.parseNovationSynAck(noEnd).valid).toBe(false);
    });

    it('should reject message with wrong manufacturer ID', () => {
      const wrongManufacturer = [...validSynAck];
      wrongManufacturer[1] = 0x43; // Yamaha instead of Novation

      expect(SysExParser.parseNovationSynAck(wrongManufacturer).valid).toBe(false);
    });

    it('should reject message with wrong command bytes', () => {
      const wrongCommand = [...validSynAck];
      wrongCommand[5] = 0x43; // Wrong command

      expect(SysExParser.parseNovationSynAck(wrongCommand).valid).toBe(false);
    });

    it('should reject serial with non-printable characters', () => {
      const invalidSerial = [...validSynAck];
      invalidSerial[7] = 0x00; // Non-printable character

      expect(SysExParser.parseNovationSynAck(invalidSerial).valid).toBe(false);
    });

    it('should reject serial not starting with LX2', () => {
      const invalidPrefix = [...validSynAck];
      invalidPrefix[7] = 'A'.charCodeAt(0); // Change L to A

      expect(SysExParser.parseNovationSynAck(invalidPrefix).valid).toBe(false);
    });

    it('should handle empty input', () => {
      expect(SysExParser.parseNovationSynAck([]).valid).toBe(false);
    });
  });

  // ===== buildUniversalDeviceInquiry() Tests =====
  describe('buildUniversalDeviceInquiry', () => {
    it('should build correct Universal Device Inquiry message', () => {
      const message = SysExParser.buildUniversalDeviceInquiry();

      expect(message).toEqual([0xF0, 0x7E, 0x7F, 0x06, 0x01, 0xF7]);
    });

    it('should use correct broadcast device ID', () => {
      const message = SysExParser.buildUniversalDeviceInquiry();

      expect(message[2]).toBe(0x7F); // Broadcast device ID
    });

    it('should be deterministic', () => {
      const message1 = SysExParser.buildUniversalDeviceInquiry();
      const message2 = SysExParser.buildUniversalDeviceInquiry();

      expect(message1).toEqual(message2);
    });

    it('should create valid SysEx format', () => {
      const message = SysExParser.buildUniversalDeviceInquiry();

      expect(SysExParser.isValidSysEx(message)).toBe(true);
    });
  });

  // ===== parseUniversalDeviceInquiry() Tests =====
  describe('parseUniversalDeviceInquiry', () => {
    const validInquiryResponse = [
      0xF0, 0x7E, 0x00, 0x06, 0x02, // Header
      0x00, 0x20, 0x29, // Novation manufacturer ID
      0x00, 0x61, // Family code
      0x00, 0x01, // Family member
      0x01, 0x00, 0x00, 0x00, // Software revision
      0xF7
    ];

    it('should parse valid device inquiry response', () => {
      const result = SysExParser.parse(validInquiryResponse);

      expect(result.type).toBe('device_inquiry_response');
      expect(result.manufacturerId).toEqual([0x00, 0x20, 0x29]);

      const inquiry = result as any;
      expect(inquiry.familyCode).toBe(0x61);
      expect(inquiry.familyMember).toBe(0x01);
      expect(inquiry.softwareRevision).toEqual([0x01, 0x00, 0x00, 0x00]);
    });

    it('should handle different device IDs', () => {
      const differentDeviceId = [...validInquiryResponse];
      differentDeviceId[2] = 0x10; // Different device ID

      const result = SysExParser.parse(differentDeviceId);
      expect(result.type).toBe('device_inquiry_response');
    });

    it('should reject truncated response', () => {
      const truncated = validInquiryResponse.slice(0, 10);

      expect(() => SysExParser.parse(truncated)).toThrow('Invalid device inquiry response');
    });
  });

  // ===== buildCustomModeReadRequest() Tests =====
  describe('buildCustomModeReadRequest', () => {
    it('should build correct custom mode read request', () => {
      const message = SysExParser.buildCustomModeReadRequest(3);

      expect(message).toEqual([
        0xF0,             // SysEx start
        0x00, 0x20, 0x29, // Manufacturer ID
        0x02,             // Device ID (Launch Control XL 3)
        0x15,             // Command (Custom mode)
        0x05,             // Sub-command
        0x00,             // Reserved
        0x40,             // Read operation
        3,                // Slot number
        0x00,             // Parameter
        0xF7              // SysEx end
      ]);
    });

    it('should handle slot boundaries', () => {
      const slot0 = SysExParser.buildCustomModeReadRequest(0);
      const slot15 = SysExParser.buildCustomModeReadRequest(15);

      expect(slot0[9]).toBe(0); // Slot number at position 9
      expect(slot15[9]).toBe(15);
    });

    it('should validate slot range', () => {
      expect(() => SysExParser.buildCustomModeReadRequest(-1)).toThrow('Custom mode slot must be 0-15');
      expect(() => SysExParser.buildCustomModeReadRequest(16)).toThrow('Custom mode slot must be 0-15');
    });

    it('should create valid SysEx format', () => {
      const message = SysExParser.buildCustomModeReadRequest(5);

      expect(SysExParser.isValidSysEx(message)).toBe(true);
    });
  });

  // ===== parseCustomModeResponseXL3() Tests =====
  describe('parseCustomModeResponseXL3', () => {
    const createCustomModeResponse = (slot: number, customData: number[] = []) => [
      0xF0,             // SysEx start
      0x00, 0x20, 0x29, // Manufacturer ID
      0x02, 0x15, 0x05, 0x00, // Command structure
      0x10,             // Operation (custom mode response)
      slot,             // Slot number
      ...customData,    // Custom mode data
      0xF7              // SysEx end
    ];

    it('should parse valid custom mode response', () => {
      const customData = [
        0x06, 0x20, 0x08, // Header
        ...Array.from('TestMode').map(c => c.charCodeAt(0)), // Mode name
        0x21, 0x00, // Name terminator
        0x48, 0x0D, 0x02, 0x00, 0x00, 0x01, 0x48, 0x00, 0x14, 0x7F // Control data
      ];

      const message = createCustomModeResponse(2, customData);
      const result = SysExParser.parse(message);

      expect(result.type).toBe('custom_mode_response');
      expect((result as any).slot).toBe(2);
      expect((result as any).name).toBe('TestMode');
    });

    it('should handle responses without name', () => {
      const customData = [
        0x48, 0x0D, 0x02, 0x00, 0x00, 0x01, 0x48, 0x00, 0x14, 0x7F // Control data only
      ];

      const message = createCustomModeResponse(1, customData);
      const result = SysExParser.parse(message);

      expect(result.type).toBe('custom_mode_response');
      expect((result as any).slot).toBe(1);
      expect((result as any).name).toBeUndefined();
    });

    it('should reject message with wrong operation code', () => {
      const message = [
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00,
        0x20, // Wrong operation code
        0x01,
        0xF7
      ];

      expect(() => SysExParser.parse(message)).toThrow('Unexpected operation in Launch Control XL 3 response');
    });

    it('should handle empty custom data', () => {
      const message = createCustomModeResponse(0, []);
      const result = SysExParser.parse(message);

      expect(result.type).toBe('custom_mode_response');
      expect((result as any).controls).toEqual([]);
      expect((result as any).colors).toEqual([]);
    });
  });

  // ===== buildCustomModeWriteRequest() Tests =====
  describe('buildCustomModeWriteRequest', () => {
    const mockModeData: CustomModeMessage = {
      type: 'custom_mode_write',
      manufacturerId: MANUFACTURER_ID,
      slot: 0,
      controls: [
        {
          controlId: 0x0D,
          channel: 0,
          ccNumber: 20,
          minValue: 0,
          maxValue: 127,
          behaviour: 'absolute' as const,
        },
      ],
      colors: [
        {
          controlId: 0x29,
          color: 0x3C,
          behaviour: 'static' as const,
        },
      ],
      data: [],
    };

    it('should build valid custom mode write request', () => {
      const message = SysExParser.buildCustomModeWriteRequest(2, mockModeData);

      expect(message[0]).toBe(0xF0); // SysEx start
      expect(message.slice(1, 4)).toEqual([0x00, 0x20, 0x29]); // Manufacturer ID
      expect(message[4]).toBe(0x02); // Device ID
      expect(message[5]).toBe(0x15); // Command
      expect(message[6]).toBe(0x05); // Sub-command
      expect(message[7]).toBe(0x00); // Reserved
      expect(message[8]).toBe(0x45); // Write operation
      expect(message[9]).toBe(2); // Slot number
      expect(message[message.length - 1]).toBe(0xF7); // SysEx end
    });

    it('should validate slot range', () => {
      expect(() => SysExParser.buildCustomModeWriteRequest(-1, mockModeData)).toThrow('Custom mode slot must be 0-15');
      expect(() => SysExParser.buildCustomModeWriteRequest(16, mockModeData)).toThrow('Custom mode slot must be 0-15');
    });

    it('should validate mode data before encoding', () => {
      const invalidModeData = {
        ...mockModeData,
        controls: [
          {
            ...mockModeData.controls[0],
            ccNumber: 128 // Invalid CC number
          }
        ]
      };

      expect(() => SysExParser.buildCustomModeWriteRequest(0, invalidModeData)).toThrow('CC number must be 0-127');
    });

    it('should create valid SysEx format', () => {
      const message = SysExParser.buildCustomModeWriteRequest(0, mockModeData);

      expect(SysExParser.isValidSysEx(message)).toBe(true);
    });
  });

  // ===== parseCustomModeData() Tests =====
  describe('parseCustomModeData', () => {
    it('should parse mode name from header', () => {
      const data = [
        0x06, 0x20, 0x08, // Header
        ...Array.from('MyMode').map(c => c.charCodeAt(0)), // Mode name
        0x21, 0x00, // Name terminator
      ];

      // Use parse method to trigger parseCustomModeData internally
      const message = [
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x10, 0x01,
        ...data,
        0xF7
      ];

      const result = SysExParser.parse(message);
      expect((result as any).name).toBe('MyMode');
    });

    it('should parse control definitions', () => {
      const data = [
        0x48, 0x0D, 0x02, 0x00, 0x00, 0x01, 0x48, 0x00, 0x14, 0x7F, // Control definition
      ];

      const message = [
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x10, 0x01,
        ...data,
        0xF7
      ];

      const result = SysExParser.parse(message);
      const controls = (result as any).controls;

      expect(controls).toHaveLength(1);
      expect(controls[0].controlId).toBe(0x0D);
      expect(controls[0].ccNumber).toBe(0x14);
      expect(controls[0].minValue).toBe(0x00);
      expect(controls[0].maxValue).toBe(0x7F);
    });

    it('should handle multiple controls', () => {
      const data = [
        0x48, 0x0D, 0x02, 0x00, 0x00, 0x01, 0x48, 0x00, 0x14, 0x7F, // Control 1
        0x48, 0x0E, 0x02, 0x00, 0x01, 0x01, 0x48, 0x01, 0x15, 0x7F, // Control 2
      ];

      const message = [
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x10, 0x01,
        ...data,
        0xF7
      ];

      const result = SysExParser.parse(message);
      const controls = (result as any).controls;

      expect(controls).toHaveLength(2);
      expect(controls[0].controlId).toBe(0x0D);
      expect(controls[1].controlId).toBe(0x0E);
    });

    it('should generate color mappings for controls', () => {
      const data = [
        0x48, 0x10, 0x02, 0x05, 0x00, 0x01, 0x48, 0x00, 0x14, 0x7F, // Top row encoder
        0x48, 0x18, 0x02, 0x09, 0x00, 0x01, 0x48, 0x01, 0x15, 0x7F, // Middle row encoder
      ];

      const message = [
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x10, 0x01,
        ...data,
        0xF7
      ];

      const result = SysExParser.parse(message);
      const colors = (result as any).colors;

      expect(colors).toHaveLength(2);
      expect(colors[0].controlId).toBe(0x10);
      expect(colors[0].color).toBe(0x60); // Blue for top row
      expect(colors[1].controlId).toBe(0x18);
      expect(colors[1].color).toBe(0x48); // Yellow for middle row
    });

    it('should handle malformed control data gracefully', () => {
      const data = [
        0x48, 0x0D, 0x02, // Truncated control definition
      ];

      const message = [
        0xF0, 0x00, 0x20, 0x29, 0x02, 0x15, 0x05, 0x00, 0x10, 0x01,
        ...data,
        0xF7
      ];

      const result = SysExParser.parse(message);
      const controls = (result as any).controls;

      expect(controls).toEqual([]); // Should not crash, return empty array
    });
  });

  // ===== Error Handling Tests =====
  describe('Error Cases', () => {
    it('should reject messages without SysEx framing', () => {
      expect(() => SysExParser.parse([0x00, 0x01, 0x02])).toThrow('Invalid SysEx message: missing start byte');
      expect(() => SysExParser.parse([0xF0, 0x00, 0x01])).toThrow('Invalid SysEx message: missing end byte');
    });

    it('should reject messages that are too short', () => {
      expect(() => SysExParser.parse([0xF0, 0xF7])).toThrow('Invalid SysEx message: too short');
      expect(() => SysExParser.parse([0xF0, 0x00, 0xF7])).toThrow('Invalid SysEx message: too short');
    });

    it('should handle empty input gracefully', () => {
      expect(() => SysExParser.parse([])).toThrow('Invalid SysEx message: missing start byte');
    });

    it('should handle unknown manufacturer IDs', () => {
      const unknownManufacturer = [
        0xF0, 0x43, 0x00, 0x01, 0x02, 0xF7 // Yamaha message
      ];

      expect(() => SysExParser.parse(unknownManufacturer)).toThrow('Unknown SysEx message format');
    });

    it('should handle unknown Novation message types', () => {
      const unknownMessage = [
        0xF0, 0x00, 0x20, 0x29, 0x11, 0xFF, 0x00, 0xF7 // Unknown message type 0xFF
      ];

      const result = SysExParser.parse(unknownMessage);
      expect(result.type).toBe('unknown');
      expect(result.manufacturerId).toEqual(MANUFACTURER_ID);
    });
  });

  // ===== isValidSysEx() Tests =====
  describe('isValidSysEx', () => {
    it('should validate correct SysEx messages', () => {
      expect(SysExParser.isValidSysEx([0xF0, 0x00, 0xF7])).toBe(true);
      expect(SysExParser.isValidSysEx([0xF0, 0x00, 0x01, 0x02, 0xF7])).toBe(true);
    });

    it('should reject invalid SysEx messages', () => {
      expect(SysExParser.isValidSysEx([])).toBe(false);
      expect(SysExParser.isValidSysEx([0xF0])).toBe(false);
      expect(SysExParser.isValidSysEx([0xF7])).toBe(false);
      expect(SysExParser.isValidSysEx([0x00, 0x01])).toBe(false);
      expect(SysExParser.isValidSysEx([0xF0, 0x00])).toBe(false); // Missing end
      expect(SysExParser.isValidSysEx([0x00, 0xF7])).toBe(false); // Missing start
    });

    it('should require minimum length', () => {
      expect(SysExParser.isValidSysEx([0xF0, 0xF7])).toBe(false); // Too short
      expect(SysExParser.isValidSysEx([0xF0, 0x00, 0xF7])).toBe(true); // Minimum valid
    });
  });

  // ===== isDeviceInquiryResponse() Tests =====
  describe('isDeviceInquiryResponse', () => {
    const validDeviceInquiry = [
      0xF0, 0x7E, 0x00, 0x06, 0x02,
      0x00, 0x20, 0x29, // Manufacturer ID
      0x00, 0x61, // Family
      0xF7
    ];

    it('should identify valid device inquiry responses', () => {
      expect(SysExParser.isDeviceInquiryResponse(validDeviceInquiry)).toBe(true);
    });

    it('should reject messages that are too short', () => {
      const tooShort = validDeviceInquiry.slice(0, 8);
      expect(SysExParser.isDeviceInquiryResponse(tooShort)).toBe(false);
    });

    it('should reject non-SysEx messages', () => {
      const noStart = [...validDeviceInquiry];
      noStart[0] = 0x00;

      const noEnd = [...validDeviceInquiry];
      noEnd[noEnd.length - 1] = 0x00;

      expect(SysExParser.isDeviceInquiryResponse(noStart)).toBe(false);
      expect(SysExParser.isDeviceInquiryResponse(noEnd)).toBe(false);
    });

    it('should reject non-universal messages', () => {
      const nonUniversal = [...validDeviceInquiry];
      nonUniversal[1] = 0x43; // Not 0x7E

      expect(SysExParser.isDeviceInquiryResponse(nonUniversal)).toBe(false);
    });

    it('should reject wrong sub-IDs', () => {
      const wrongSubId1 = [...validDeviceInquiry];
      wrongSubId1[3] = 0x05; // Not 0x06

      const wrongSubId2 = [...validDeviceInquiry];
      wrongSubId2[4] = 0x01; // Not 0x02

      expect(SysExParser.isDeviceInquiryResponse(wrongSubId1)).toBe(false);
      expect(SysExParser.isDeviceInquiryResponse(wrongSubId2)).toBe(false);
    });

    it('should accept any device ID', () => {
      const deviceId10 = [...validDeviceInquiry];
      deviceId10[2] = 0x10;

      const deviceId7F = [...validDeviceInquiry];
      deviceId7F[2] = 0x7F;

      expect(SysExParser.isDeviceInquiryResponse(deviceId10)).toBe(true);
      expect(SysExParser.isDeviceInquiryResponse(deviceId7F)).toBe(true);
    });
  });

  // ===== getManufacturerId() Tests =====
  describe('getManufacturerId', () => {
    it('should extract 3-byte manufacturer ID', () => {
      const message = [0xF0, 0x00, 0x20, 0x29, 0x01, 0xF7];
      const id = SysExParser.getManufacturerId(message);
      expect(id).toEqual([0x00, 0x20, 0x29]);
    });

    it('should extract single-byte manufacturer ID', () => {
      const message = [0xF0, 0x43, 0x01, 0xF7]; // Yamaha
      const id = SysExParser.getManufacturerId(message);
      expect(id).toEqual([0x43]);
    });

    it('should return null for universal non-realtime messages', () => {
      const message = [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7];
      const id = SysExParser.getManufacturerId(message);
      expect(id).toBeNull();
    });

    it('should return null for universal realtime messages', () => {
      const message = [0xF0, 0x7F, 0x00, 0x06, 0x01, 0xF7];
      const id = SysExParser.getManufacturerId(message);
      expect(id).toBeNull();
    });

    it('should return null for invalid SysEx', () => {
      const id = SysExParser.getManufacturerId([0x00, 0x01]);
      expect(id).toBeNull();
    });

    it('should handle empty manufacturer byte', () => {
      const message = [0xF0, 0xF7]; // Too short
      const id = SysExParser.getManufacturerId(message);
      expect(id).toBeNull();
    });
  });

  // ===== validateCustomModeData() Tests =====
  describe('validateCustomModeData', () => {
    const validModeData: CustomModeMessage = {
      type: 'custom_mode_write',
      manufacturerId: MANUFACTURER_ID,
      slot: 0,
      controls: [
        {
          controlId: 0x0D,
          channel: 0,
          ccNumber: 20,
          minValue: 0,
          maxValue: 127,
          behaviour: 'absolute' as const,
        },
      ],
      colors: [
        {
          controlId: 0x29,
          color: 0x3C,
          behaviour: 'static' as const,
        },
      ],
      data: [],
    };

    it('should accept valid custom mode data', () => {
      expect(() => SysExParser.validateCustomModeData(validModeData)).not.toThrow();
    });

    it('should require controls array', () => {
      const invalidData = { ...validModeData, controls: undefined } as any;
      expect(() => SysExParser.validateCustomModeData(invalidData)).toThrow('Custom mode must have controls array');
    });

    it('should require colors array', () => {
      const invalidData = { ...validModeData, colors: undefined } as any;
      expect(() => SysExParser.validateCustomModeData(invalidData)).toThrow('Custom mode must have colors array');
    });

    it('should validate CC number range', () => {
      const invalidCC = {
        ...validModeData,
        controls: [{ ...validModeData.controls[0], ccNumber: 128 }]
      };
      expect(() => SysExParser.validateCustomModeData(invalidCC)).toThrow('CC number must be 0-127');
    });

    it('should validate channel range', () => {
      const invalidChannel = {
        ...validModeData,
        controls: [{ ...validModeData.controls[0], channel: 16 }]
      };
      expect(() => SysExParser.validateCustomModeData(invalidChannel)).toThrow('Channel must be 0-15');
    });

    it('should validate min/max value ranges', () => {
      const invalidMin = {
        ...validModeData,
        controls: [{ ...validModeData.controls[0], minValue: -1 }]
      };
      const invalidMax = {
        ...validModeData,
        controls: [{ ...validModeData.controls[0], maxValue: 128 }]
      };

      expect(() => SysExParser.validateCustomModeData(invalidMin)).toThrow('Min value must be 0-127');
      expect(() => SysExParser.validateCustomModeData(invalidMax)).toThrow('Max value must be 0-127');
    });

    it('should validate min <= max', () => {
      const invalidRange = {
        ...validModeData,
        controls: [{
          ...validModeData.controls[0],
          minValue: 100,
          maxValue: 50
        }]
      };

      expect(() => SysExParser.validateCustomModeData(invalidRange)).toThrow('Min value cannot be greater than max value');
    });

    it('should validate color values', () => {
      const invalidColor = {
        ...validModeData,
        colors: [{ ...validModeData.colors[0], color: 128 }]
      };

      expect(() => SysExParser.validateCustomModeData(invalidColor)).toThrow('Color value must be 0-127');
    });
  });

  // ===== Boundary Condition Tests =====
  describe('Boundary Conditions', () => {
    it('should handle maximum slot numbers', () => {
      expect(() => SysExParser.buildCustomModeReadRequest(15)).not.toThrow();
      expect(() => SysExParser.buildCustomModeReadRequest(0)).not.toThrow();
    });

    it('should handle maximum CC values', () => {
      const modeData: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: MANUFACTURER_ID,
        slot: 0,
        controls: [{
          controlId: 0x7F,
          channel: 15,
          ccNumber: 127,
          minValue: 0,
          maxValue: 127,
          behaviour: 'absolute' as const,
        }],
        colors: [{
          controlId: 0x7F,
          color: 127,
          behaviour: 'static' as const,
        }],
        data: [],
      };

      expect(() => SysExParser.validateCustomModeData(modeData)).not.toThrow();
    });

    it('should handle empty arrays', () => {
      const emptyModeData: CustomModeMessage = {
        type: 'custom_mode_write',
        manufacturerId: MANUFACTURER_ID,
        slot: 0,
        controls: [],
        colors: [],
        data: [],
      };

      expect(() => SysExParser.validateCustomModeData(emptyModeData)).not.toThrow();
    });

    it('should handle large serial numbers', () => {
      const longSerial = [
        0xF0, 0x00, 0x20, 0x29, 0x00, 0x42, 0x02,
        ...Array.from('LX2999999999999').map(c => c.charCodeAt(0)), // 14 chars
        0xF7
      ];

      const result = SysExParser.parseNovationSynAck(longSerial);
      expect(result.valid).toBe(true);
      expect(result.serialNumber).toBe('LX2999999999999');
    });
  });

  // ===== Performance Tests =====
  describe('Performance', () => {
    it('should parse messages quickly', () => {
      const message = [
        0xF0, 0x7E, 0x00, 0x06, 0x02,
        0x00, 0x20, 0x29,
        0x00, 0x61, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x00,
        0xF7
      ];

      const startTime = performance.now();

      // Parse the same message multiple times
      for (let i = 0; i < 1000; i++) {
        SysExParser.parse(message);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete 1000 parses in less than 100ms
      expect(totalTime).toBeLessThan(100);
    });

    it('should validate messages quickly', () => {
      const validMessage = [0xF0, 0x00, 0x20, 0x29, 0x11, 0x77, 0x05, 0xF7];
      const invalidMessage = [0x00, 0x01, 0x02];

      const startTime = performance.now();

      for (let i = 0; i < 10000; i++) {
        SysExParser.isValidSysEx(validMessage);
        SysExParser.isValidSysEx(invalidMessage);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Should complete 20000 validations in less than 50ms
      expect(totalTime).toBeLessThan(50);
    });
  });
});