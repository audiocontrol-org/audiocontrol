/**
 * SysEx Parser Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  SysExParser,
  MANUFACTURER_ID,
  SysExMessageType,
  DEVICE_FAMILY
} from '@/core/SysExParser';

describe('SysExParser', () => {
  describe('parse', () => {
    it('should parse device inquiry response', () => {
      const message = [
        0xF0, // Start
        0x7E, // Universal non-realtime
        0x00, // Device ID
        0x06, // Inquiry response
        0x02, // Sub-ID
        0x00, 0x20, 0x29, // Manufacturer ID (Novation)
        0x00, 0x61, // Family code
        0x00, 0x01, // Family member
        0x01, 0x00, 0x00, 0x00, // Software revision
        0xF7, // End
      ];

      const result = SysExParser.parse(message);
      expect(result.type).toBe('device_inquiry_response');
      expect(result.manufacturerId).toEqual([0x00, 0x20, 0x29]);

      const inquiry = result as any;
      expect(inquiry.familyCode).toBe(0x61);
      expect(inquiry.familyMember).toBe(0x01);
      expect(inquiry.softwareRevision).toEqual([0x01, 0x00, 0x00, 0x00]);
    });

    it('should parse template change message', () => {
      const message = [
        0xF0, // Start
        ...MANUFACTURER_ID,
        0x11, // Device ID
        SysExMessageType.TEMPLATE_CHANGE,
        0x05, // Template number
        0xF7, // End
      ];

      const result = SysExParser.parse(message);
      expect(result.type).toBe('template_change');

      const templateChange = result as any;
      expect(templateChange.templateNumber).toBe(0x05);
    });

    it('should throw error for invalid SysEx', () => {
      // Missing start byte
      expect(() => SysExParser.parse([0x00, 0xF7])).toThrow('Invalid SysEx message: missing start byte');

      // Missing end byte
      expect(() => SysExParser.parse([0xF0, 0x00])).toThrow('Invalid SysEx message: missing end byte');

      // Too short
      expect(() => SysExParser.parse([0xF0, 0xF7])).toThrow('Invalid SysEx message: too short');
    });

    it('should handle unknown message types', () => {
      const message = [
        0xF0,
        ...MANUFACTURER_ID,
        0x11,
        0xFF, // Unknown message type
        0x00, 0x01, 0x02,
        0xF7,
      ];

      const result = SysExParser.parse(message);
      expect(result.type).toBe('unknown');
      expect(result.manufacturerId).toEqual(MANUFACTURER_ID);
    });
  });

  describe('buildDeviceQuery', () => {
    it('should build device inquiry request', () => {
      const message = SysExParser.buildDeviceQuery();

      expect(message[0]).toBe(0xF0); // Start
      expect(message[1]).toBe(0x7E); // Universal non-realtime
      expect(message[2]).toBe(0x00); // Device ID (broadcast)
      expect(message[3]).toBe(0x06); // General information
      expect(message[4]).toBe(0x01); // Identity request
      expect(message[5]).toBe(0xF7); // End
    });
  });

  describe('buildTemplateChange', () => {
    it('should build template change message', () => {
      const message = SysExParser.buildTemplateChange(5);

      expect(message[0]).toBe(0xF0);
      expect(message.slice(1, 4)).toEqual(MANUFACTURER_ID);
      expect(message[4]).toBe(0x11); // Device ID
      expect(message[5]).toBe(SysExMessageType.TEMPLATE_CHANGE);
      expect(message[6]).toBe(5); // Template number
      expect(message[7]).toBe(0xF7);
    });

    it('should validate template number range', () => {
      expect(() => SysExParser.buildTemplateChange(-1)).toThrow('Template number must be 0-15');
      expect(() => SysExParser.buildTemplateChange(16)).toThrow('Template number must be 0-15');
    });
  });

  describe('buildCustomModeReadRequest', () => {
    it('should build custom mode read request', () => {
      const message = SysExParser.buildCustomModeReadRequest(3);

      expect(message[0]).toBe(0xF0);
      expect(message.slice(1, 4)).toEqual(MANUFACTURER_ID);
      expect(message[4]).toBe(0x02); // Device ID
      expect(message[5]).toBe(0x15); // Command (Custom mode)
      expect(message[6]).toBe(0x05); // Sub-command
      expect(message[7]).toBe(0x00); // Reserved
      expect(message[8]).toBe(0x40); // Read operation
      expect(message[9]).toBe(3); // Slot number
      expect(message[10]).toBe(0x00); // Parameter
      expect(message[11]).toBe(0xF7);
    });

    it('should validate slot number range', () => {
      expect(() => SysExParser.buildCustomModeReadRequest(-1)).toThrow('slot must be 0-15');
      expect(() => SysExParser.buildCustomModeReadRequest(16)).toThrow('slot must be 0-15');
    });
  });

  describe('buildLedControl', () => {
    it('should build LED control message', () => {
      const message = SysExParser.buildLedControl(0x29, 0x3C, 'static');

      expect(message[0]).toBe(0xF0);
      expect(message.slice(1, 4)).toEqual(MANUFACTURER_ID);
      expect(message[4]).toBe(0x11);
      expect(message[5]).toBe(SysExMessageType.LED_CONTROL);
      expect(message[6]).toBe(0x29); // Control ID
      expect(message[7]).toBe(0x3C); // Color
      expect(message[8]).toBe(0xF7);
    });

    it('should handle flash behavior', () => {
      const message = SysExParser.buildLedControl(0x29, 0x3C, 'flash');
      expect(message[7]).toBe(0x3C | 0x08); // Color with flash bit
    });

    it('should handle pulse behavior', () => {
      const message = SysExParser.buildLedControl(0x29, 0x3C, 'pulse');
      expect(message[7]).toBe(0x3C | 0x10); // Color with pulse bit
    });

    it('should validate control ID range', () => {
      expect(() => SysExParser.buildLedControl(-1, 0x3C)).toThrow('Control ID must be 0-127');
      expect(() => SysExParser.buildLedControl(128, 0x3C)).toThrow('Control ID must be 0-127');
    });

    it('should validate color range', () => {
      expect(() => SysExParser.buildLedControl(0x29, -1)).toThrow('Color must be 0-127');
      expect(() => SysExParser.buildLedControl(0x29, 128)).toThrow('Color must be 0-127');
    });
  });

  describe('buildLedReset', () => {
    it('should build LED reset message', () => {
      const message = SysExParser.buildLedReset();

      expect(message[0]).toBe(0xF0);
      expect(message.slice(1, 4)).toEqual(MANUFACTURER_ID);
      expect(message[4]).toBe(0x11);
      expect(message[5]).toBe(SysExMessageType.RESET_LED);
      expect(message[6]).toBe(0x00); // Reset all
      expect(message[7]).toBe(0xF7);
    });
  });

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
  });

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

    it('should return null for universal messages', () => {
      const message = [0xF0, 0x7E, 0x00, 0x06, 0x01, 0xF7];
      const id = SysExParser.getManufacturerId(message);
      expect(id).toBeNull();

      const realtime = [0xF0, 0x7F, 0x00, 0x06, 0x01, 0xF7];
      const id2 = SysExParser.getManufacturerId(realtime);
      expect(id2).toBeNull();
    });

    it('should return null for invalid SysEx', () => {
      const id = SysExParser.getManufacturerId([0x00, 0x01]);
      expect(id).toBeNull();
    });
  });

  describe('validateCustomModeData', () => {
    it('should validate valid custom mode data', () => {
      const modeData = {
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

      expect(() => SysExParser.validateCustomModeData(modeData as any)).not.toThrow();
    });

    it('should reject invalid control data', () => {
      const invalidCC = {
        type: 'custom_mode_write',
        manufacturerId: MANUFACTURER_ID,
        slot: 0,
        controls: [
          {
            controlId: 0x0D,
            channel: 0,
            ccNumber: 128, // Invalid
            minValue: 0,
            maxValue: 127,
            behaviour: 'absolute',
          },
        ],
        colors: [],
        data: [],
      };

      expect(() => SysExParser.validateCustomModeData(invalidCC as any)).toThrow('CC number must be 0-127');
    });

    it('should reject invalid channel', () => {
      const invalidChannel = {
        type: 'custom_mode_write',
        manufacturerId: MANUFACTURER_ID,
        slot: 0,
        controls: [
          {
            controlId: 0x0D,
            channel: 16, // Invalid
            ccNumber: 20,
            minValue: 0,
            maxValue: 127,
            behaviour: 'absolute',
          },
        ],
        colors: [],
        data: [],
      };

      expect(() => SysExParser.validateCustomModeData(invalidChannel as any)).toThrow('Channel must be 0-15');
    });

    it('should reject invalid value ranges', () => {
      const invalidRange = {
        type: 'custom_mode_write',
        manufacturerId: MANUFACTURER_ID,
        slot: 0,
        controls: [
          {
            controlId: 0x0D,
            channel: 0,
            ccNumber: 20,
            minValue: 100,
            maxValue: 50, // Min > Max
            behaviour: 'absolute',
          },
        ],
        colors: [],
        data: [],
      };

      expect(() => SysExParser.validateCustomModeData(invalidRange as any)).toThrow('Min value cannot be greater than max value');
    });

    it('should reject invalid color values', () => {
      const invalidColor = {
        type: 'custom_mode_write',
        manufacturerId: MANUFACTURER_ID,
        slot: 0,
        controls: [],
        colors: [
          {
            controlId: 0x29,
            color: 128, // Invalid
            behaviour: 'static',
          },
        ],
        data: [],
      };

      expect(() => SysExParser.validateCustomModeData(invalidColor as any)).toThrow('Color value must be 0-127');
    });
  });
});