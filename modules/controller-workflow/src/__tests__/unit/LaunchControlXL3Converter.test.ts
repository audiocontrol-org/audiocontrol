/**
 * Unit tests for LaunchControlXL3Converter
 *
 * Tests conversion from LCXL3 controller configurations to canonical MIDI map format.
 * Validates control ID mapping, label preservation, and proper handling of all 48 controls.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LaunchControlXL3Converter } from '@/converters/LaunchControlXL3Converter.js';
import type { ControllerConfiguration, ControlMapping } from '@/types/controller-adapter.js';
import type { ConversionOptions } from '@/types/canonical-converter.js';

describe('LaunchControlXL3Converter', () => {
  let converter: LaunchControlXL3Converter;

  beforeEach(() => {
    converter = new LaunchControlXL3Converter();
  });

  describe('getConverterInfo', () => {
    it('should return converter metadata', () => {
      const info = converter.getConverterInfo();

      expect(info.supportedController).toBe('Novation Launch Control XL 3');
      expect(info.version).toBe('1.0.0');
      expect(info.features).toContain('custom-modes');
      expect(info.features).toContain('label-preservation');
      expect(info.features).toContain('all-control-types');
      expect(info.features).toContain('48-controls');
    });
  });

  describe('canConvert', () => {
    it('should return true for valid configuration with CC assignments', () => {
      const config: ControllerConfiguration = {
        name: 'Test Config',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: 13, channel: 0 },
          { id: 'FADER1', name: 'Fader 1', type: 'slider', cc: 77, channel: 0 },
        ],
      };

      expect(converter.canConvert(config)).toBe(true);
    });

    it('should return false for empty controls array', () => {
      const config: ControllerConfiguration = {
        name: 'Empty Config',
        controls: [],
      };

      expect(converter.canConvert(config)).toBe(false);
    });

    it('should return false when controls missing CC numbers', () => {
      const config: ControllerConfiguration = {
        name: 'Invalid Config',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder' } as ControlMapping,
        ],
      };

      expect(converter.canConvert(config)).toBe(false);
    });

    it('should return false for invalid CC numbers', () => {
      const config: ControllerConfiguration = {
        name: 'Invalid CC',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: 128 }, // Out of range
        ],
      };

      expect(converter.canConvert(config)).toBe(false);
    });

    it('should return false for negative CC numbers', () => {
      const config: ControllerConfiguration = {
        name: 'Negative CC',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: -1 },
        ],
      };

      expect(converter.canConvert(config)).toBe(false);
    });
  });

  describe('convert', () => {
    it('should throw error for invalid configuration', () => {
      const config: ControllerConfiguration = {
        name: 'Invalid',
        controls: [],
      };
      const options: ConversionOptions = {};

      expect(() => converter.convert(config, options)).toThrow(
        'Invalid LCXL3 configuration: missing controls or CC assignments',
      );
    });

    it('should convert basic configuration to canonical format', () => {
      const config: ControllerConfiguration = {
        name: 'Basic Config',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: 13, channel: 0 },
          { id: 'FADER1', name: 'Fader 1', type: 'slider', cc: 77, channel: 0 },
        ],
      };
      const options: ConversionOptions = {
        preserveLabels: true,
      };

      const result = converter.convert(config, options);

      expect(result.version).toBe('1.0.0');
      expect(result.device.manufacturer).toBe('Novation');
      expect(result.device.model).toBe('Launch Control XL 3');
      expect(result.metadata.name).toBe('Basic Config');
      expect(result.metadata.description).toContain('Basic Config');
      expect(result.metadata.tags).toContain('launch-control-xl3');
      expect(result.metadata.tags).toContain('auto-generated');
      expect(result.controls).toHaveLength(2);
    });

    it('should include plugin info when provided', () => {
      const config: ControllerConfiguration = {
        name: 'Plugin Config',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: 13, channel: 0 },
        ],
      };
      const options: ConversionOptions = {
        pluginInfo: {
          name: 'Test Plugin',
          manufacturer: 'Test Vendor',
          uri: 'urn:test:plugin',
        },
      };

      const result = converter.convert(config, options);

      expect(result.plugin).toBeDefined();
      expect(result.plugin?.name).toBe('Test Plugin');
      expect(result.plugin?.manufacturer).toBe('Test Vendor');
      expect(result.plugin?.uri).toBe('urn:test:plugin');
    });

    it('should apply MIDI channel override', () => {
      const config: ControllerConfiguration = {
        name: 'Channel Config',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: 13 },
        ],
      };
      const options: ConversionOptions = {
        midiChannel: 5,
      };

      const result = converter.convert(config, options);

      expect(result.midi_channel).toBe(5);
      expect(result.controls[0].channel).toBe(5);
    });

    it('should apply device overrides', () => {
      const config: ControllerConfiguration = {
        name: 'Override Config',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: 13, channel: 0 },
        ],
      };
      const options: ConversionOptions = {
        deviceOverrides: {
          firmware: '1.2.3',
        },
      };

      const result = converter.convert(config, options);

      expect(result.device.firmware).toBe('1.2.3');
    });
  });

  describe('control ID mapping', () => {
    it('should map all Send A encoders (Row 1)', () => {
      const controls: ControlMapping[] = [];
      for (let i = 1; i <= 8; i++) {
        controls.push({
          id: `SEND_A${i}`,
          name: `Send A${i}`,
          type: 'encoder',
          cc: 12 + i,
          channel: 0,
        });
      }

      const config: ControllerConfiguration = { name: 'Send A Test', controls };
      const result = converter.convert(config, { preserveLabels: false });

      result.controls.forEach((control, idx) => {
        expect(control.id).toBe(`encoder_${idx + 1}`);
        expect(control.type).toBe('encoder');
      });
    });

    it('should map all Send B encoders (Row 2)', () => {
      const controls: ControlMapping[] = [];
      for (let i = 1; i <= 8; i++) {
        controls.push({
          id: `SEND_B${i}`,
          name: `Send B${i}`,
          type: 'encoder',
          cc: 28 + i,
          channel: 0,
        });
      }

      const config: ControllerConfiguration = { name: 'Send B Test', controls };
      const result = converter.convert(config, { preserveLabels: false });

      result.controls.forEach((control, idx) => {
        expect(control.id).toBe(`encoder_${idx + 9}`); // encoders 9-16
        expect(control.type).toBe('encoder');
      });
    });

    it('should map all Pan encoders (Row 3)', () => {
      const controls: ControlMapping[] = [];
      for (let i = 1; i <= 8; i++) {
        controls.push({
          id: `PAN${i}`,
          name: `Pan ${i}`,
          type: 'encoder',
          cc: 48 + i,
          channel: 0,
        });
      }

      const config: ControllerConfiguration = { name: 'Pan Test', controls };
      const result = converter.convert(config, { preserveLabels: false });

      result.controls.forEach((control, idx) => {
        expect(control.id).toBe(`encoder_${idx + 17}`); // encoders 17-24
        expect(control.type).toBe('encoder');
      });
    });

    it('should map all faders (sliders)', () => {
      const controls: ControlMapping[] = [];
      for (let i = 1; i <= 8; i++) {
        controls.push({
          id: `FADER${i}`,
          name: `Fader ${i}`,
          type: 'slider',
          cc: 76 + i,
          channel: 0,
        });
      }

      const config: ControllerConfiguration = { name: 'Fader Test', controls };
      const result = converter.convert(config, { preserveLabels: false });

      result.controls.forEach((control, idx) => {
        expect(control.id).toBe(`slider_${idx + 1}`);
        expect(control.type).toBe('slider');
      });
    });

    it('should map all focus buttons (buttons 1-8)', () => {
      const controls: ControlMapping[] = [];
      for (let i = 1; i <= 8; i++) {
        controls.push({
          id: `FOCUS${i}`,
          name: `Focus ${i}`,
          type: 'button',
          cc: 40 + i,
          channel: 0,
        });
      }

      const config: ControllerConfiguration = { name: 'Focus Test', controls };
      const result = converter.convert(config, { preserveLabels: false });

      result.controls.forEach((control, idx) => {
        expect(control.id).toBe(`button_${idx + 1}`);
        expect(control.type).toBe('button');
      });
    });

    it('should map all control buttons (buttons 9-16)', () => {
      const controls: ControlMapping[] = [];
      for (let i = 1; i <= 8; i++) {
        controls.push({
          id: `CONTROL${i}`,
          name: `Control ${i}`,
          type: 'button',
          cc: 72 + i,
          channel: 0,
        });
      }

      const config: ControllerConfiguration = { name: 'Control Test', controls };
      const result = converter.convert(config, { preserveLabels: false });

      result.controls.forEach((control, idx) => {
        expect(control.id).toBe(`button_${idx + 9}`); // buttons 9-16
        expect(control.type).toBe('button');
      });
    });

    it('should handle all 48 controls in single configuration', () => {
      const controls: ControlMapping[] = [];

      // 24 encoders (3 rows of 8)
      for (let i = 1; i <= 8; i++) {
        controls.push({ id: `SEND_A${i}`, name: `Send A${i}`, type: 'encoder', cc: 12 + i, channel: 0 });
        controls.push({ id: `SEND_B${i}`, name: `Send B${i}`, type: 'encoder', cc: 28 + i, channel: 0 });
        controls.push({ id: `PAN${i}`, name: `Pan ${i}`, type: 'encoder', cc: 48 + i, channel: 0 });
      }

      // 8 faders
      for (let i = 1; i <= 8; i++) {
        controls.push({ id: `FADER${i}`, name: `Fader ${i}`, type: 'slider', cc: 76 + i, channel: 0 });
      }

      // 16 buttons
      for (let i = 1; i <= 8; i++) {
        controls.push({ id: `FOCUS${i}`, name: `Focus ${i}`, type: 'button', cc: 40 + i, channel: 0 });
        controls.push({ id: `CONTROL${i}`, name: `Control ${i}`, type: 'button', cc: 72 + i, channel: 0 });
      }

      const config: ControllerConfiguration = { name: 'Full Config', controls };
      const result = converter.convert(config, { preserveLabels: false });

      expect(result.controls).toHaveLength(48);

      // Verify control counts by type
      const encoders = result.controls.filter(c => c.type === 'encoder');
      const sliders = result.controls.filter(c => c.type === 'slider');
      const buttons = result.controls.filter(c => c.type === 'button');

      expect(encoders).toHaveLength(24);
      expect(sliders).toHaveLength(8);
      expect(buttons).toHaveLength(16);
    });

    it('should use lowercase fallback for unmapped control IDs', () => {
      const config: ControllerConfiguration = {
        name: 'Unknown Control',
        controls: [
          { id: 'CUSTOM_CONTROL', name: 'Custom', type: 'encoder', cc: 99, channel: 0 },
        ],
      };

      const result = converter.convert(config, { preserveLabels: false });

      expect(result.controls[0].id).toBe('custom_control');
    });
  });

  describe('label preservation', () => {
    it('should preserve controller labels when preserveLabels is true', () => {
      const config: ControllerConfiguration = {
        name: 'Label Test',
        controls: [
          { id: 'SEND_A1', name: 'Custom Label', type: 'encoder', cc: 13, channel: 0 },
        ],
      };
      const options: ConversionOptions = {
        preserveLabels: true,
      };

      const result = converter.convert(config, options);

      expect(result.controls[0].name).toBe('Custom Label');
    });

    it('should generate default names when preserveLabels is false', () => {
      const config: ControllerConfiguration = {
        name: 'Default Name Test',
        controls: [
          { id: 'SEND_A1', name: 'Custom Label', type: 'encoder', cc: 13, channel: 0 },
        ],
      };
      const options: ConversionOptions = {
        preserveLabels: false,
      };

      const result = converter.convert(config, options);

      expect(result.controls[0].name).toBe('Encoder 1');
    });

    it('should generate default names when control has no name', () => {
      const config: ControllerConfiguration = {
        name: 'No Name Test',
        controls: [
          { id: 'SEND_A1', type: 'encoder', cc: 13, channel: 0 } as ControlMapping,
        ],
      };
      const options: ConversionOptions = {
        preserveLabels: true,
      };

      const result = converter.convert(config, options);

      expect(result.controls[0].name).toBe('Encoder 1');
    });

    it('should generate properly formatted default names', () => {
      const config: ControllerConfiguration = {
        name: 'Name Format Test',
        controls: [
          { id: 'SEND_A1', type: 'encoder', cc: 13, channel: 0 },
          { id: 'FADER1', type: 'slider', cc: 77, channel: 0 },
          { id: 'FOCUS1', type: 'button', cc: 41, channel: 0 },
        ],
      };
      const options: ConversionOptions = {
        preserveLabels: false,
      };

      const result = converter.convert(config, options);

      expect(result.controls[0].name).toBe('Encoder 1');
      expect(result.controls[1].name).toBe('Slider 1');
      expect(result.controls[2].name).toBe('Button 1');
    });
  });

  describe('MIDI channel handling', () => {
    it('should use control-specific channel when provided', () => {
      const config: ControllerConfiguration = {
        name: 'Channel Test',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: 13, channel: 3 },
        ],
      };
      const options: ConversionOptions = {};

      const result = converter.convert(config, options);

      expect(result.controls[0].channel).toBe(3);
    });

    it('should use options channel when control channel not specified', () => {
      const config: ControllerConfiguration = {
        name: 'Options Channel Test',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: 13 },
        ],
      };
      const options: ConversionOptions = {
        midiChannel: 7,
      };

      const result = converter.convert(config, options);

      expect(result.controls[0].channel).toBe(7);
    });

    it('should default to channel 0 when no channel specified', () => {
      const config: ControllerConfiguration = {
        name: 'Default Channel Test',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: 13 },
        ],
      };
      const options: ConversionOptions = {};

      const result = converter.convert(config, options);

      expect(result.controls[0].channel).toBe(0);
    });

    it('should prioritize control channel over options channel', () => {
      const config: ControllerConfiguration = {
        name: 'Priority Test',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: 13, channel: 5 },
        ],
      };
      const options: ConversionOptions = {
        midiChannel: 10,
      };

      const result = converter.convert(config, options);

      expect(result.controls[0].channel).toBe(5);
    });
  });

  describe('control range handling', () => {
    it('should preserve custom ranges', () => {
      const config: ControllerConfiguration = {
        name: 'Range Test',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: 13, channel: 0, range: [10, 100] },
        ],
      };
      const options: ConversionOptions = {};

      const result = converter.convert(config, options);

      expect(result.controls[0].range).toEqual([10, 100]);
    });

    it('should default to [0, 127] when range not specified', () => {
      const config: ControllerConfiguration = {
        name: 'Default Range Test',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: 13, channel: 0 },
        ],
      };
      const options: ConversionOptions = {};

      const result = converter.convert(config, options);

      expect(result.controls[0].range).toEqual([0, 127]);
    });
  });

  describe('metadata handling', () => {
    it('should include proper date in metadata', () => {
      const config: ControllerConfiguration = {
        name: 'Date Test',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: 13, channel: 0 },
        ],
      };
      const options: ConversionOptions = {};

      const result = converter.convert(config, options);

      // Verify date format (YYYY-MM-DD)
      expect(result.metadata.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should include proper description', () => {
      const config: ControllerConfiguration = {
        name: 'My Custom Mode',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: 13, channel: 0 },
        ],
      };
      const options: ConversionOptions = {};

      const result = converter.convert(config, options);

      expect(result.metadata.description).toContain('My Custom Mode');
      expect(result.metadata.description).toContain('LCXL3 custom mode');
    });

    it('should include correct control description', () => {
      const config: ControllerConfiguration = {
        name: 'Description Test',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder', cc: 13, channel: 0 },
        ],
      };
      const options: ConversionOptions = {};

      const result = converter.convert(config, options);

      expect(result.controls[0].description).toContain('LCXL3 control: SEND_A1');
    });
  });

  describe('plugin_parameter preservation', () => {
    it('should preserve plugin_parameter when present', () => {
      const config: ControllerConfiguration = {
        name: 'AI Matched Config',
        controls: [
          {
            id: 'SEND_A1',
            name: 'VCF Cutoff',
            type: 'encoder',
            cc: 13,
            channel: 0,
            range: [0, 127],
            plugin_parameter: 105, // From AI matching
          },
          {
            id: 'SEND_A2',
            name: 'Resonance',
            type: 'encoder',
            cc: 14,
            channel: 0,
            range: [0, 127],
            plugin_parameter: 107, // From AI matching
          },
          {
            id: 'FADER1',
            name: 'Attack',
            type: 'slider',
            cc: 53,
            channel: 0,
            range: [0, 127],
            // No plugin_parameter - should work fine
          },
        ],
      };

      const options: ConversionOptions = { preserveLabels: true };
      const result = converter.convert(config, options);

      // Controls with plugin_parameter should preserve it
      expect(result.controls[0].plugin_parameter).toBe(105);
      expect(result.controls[1].plugin_parameter).toBe(107);

      // Controls without plugin_parameter should not have the field
      expect(result.controls[2].plugin_parameter).toBeUndefined();
    });

    it('should handle plugin_parameter with pluginInfo', () => {
      const config: ControllerConfiguration = {
        name: 'TAL-J-8 Mapping',
        controls: [
          {
            id: 'SEND_A1',
            name: 'VCF Cutoff',
            type: 'encoder',
            cc: 13,
            channel: 0,
            range: [0, 127],
            plugin_parameter: 105,
          },
        ],
      };

      const options: ConversionOptions = {
        preserveLabels: true,
        pluginInfo: {
          manufacturer: 'TAL Software',
          name: 'TAL-J-8',
        },
      };

      const result = converter.convert(config, options);

      expect(result.plugin).toBeDefined();
      expect(result.plugin?.name).toBe('TAL-J-8');
      expect(result.controls[0].plugin_parameter).toBe(105);
    });

    it('should preserve plugin_parameter even when preserveLabels is false', () => {
      const config: ControllerConfiguration = {
        name: 'Plugin Param Test',
        controls: [
          {
            id: 'SEND_A1',
            name: 'Custom Name',
            type: 'encoder',
            cc: 13,
            channel: 0,
            plugin_parameter: 42,
          },
        ],
      };

      const options: ConversionOptions = { preserveLabels: false };
      const result = converter.convert(config, options);

      // Name should be default because preserveLabels is false
      expect(result.controls[0].name).toBe('Encoder 1');
      // But plugin_parameter should still be preserved
      expect(result.controls[0].plugin_parameter).toBe(42);
    });

    it('should handle zero as valid plugin_parameter', () => {
      const config: ControllerConfiguration = {
        name: 'Zero Param Test',
        controls: [
          {
            id: 'SEND_A1',
            name: 'Param Zero',
            type: 'encoder',
            cc: 13,
            channel: 0,
            plugin_parameter: 0, // Zero is a valid parameter index
          },
        ],
      };

      const options: ConversionOptions = {};
      const result = converter.convert(config, options);

      expect(result.controls[0].plugin_parameter).toBe(0);
    });

    it('should preserve plugin_parameter for all control types', () => {
      const config: ControllerConfiguration = {
        name: 'All Types Test',
        controls: [
          {
            id: 'SEND_A1',
            type: 'encoder',
            cc: 13,
            channel: 0,
            plugin_parameter: 10,
          },
          {
            id: 'FADER1',
            type: 'slider',
            cc: 77,
            channel: 0,
            plugin_parameter: 20,
          },
          {
            id: 'FOCUS1',
            type: 'button',
            cc: 41,
            channel: 0,
            plugin_parameter: 30,
          },
        ],
      };

      const options: ConversionOptions = {};
      const result = converter.convert(config, options);

      expect(result.controls[0].plugin_parameter).toBe(10);
      expect(result.controls[1].plugin_parameter).toBe(20);
      expect(result.controls[2].plugin_parameter).toBe(30);
    });
  });
});
