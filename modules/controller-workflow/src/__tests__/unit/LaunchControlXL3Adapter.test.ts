/**
 * Unit tests for LaunchControlXL3Adapter
 *
 * Tests the adapter layer between the LCXL3 device library and the controller-workflow system.
 * Uses dependency injection with mock LaunchControlXL3 device instance.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LaunchControlXL3Adapter } from '@/adapters/controllers/LaunchControlXL3Adapter.js';
import type { LaunchControlXL3 } from '@audiocontrol/launch-control-xl3';
import type {
  CustomMode as LCXL3CustomMode,
  ControlMapping as LCXL3ControlMapping,
} from '@audiocontrol/launch-control-xl3';

describe('LaunchControlXL3Adapter', () => {
  let mockDevice: jest.Mocked<LaunchControlXL3>;
  let adapter: LaunchControlXL3Adapter;

  beforeEach(() => {
    // Create mock device with all required methods
    mockDevice = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(true),
      readCustomMode: vi.fn(),
      writeCustomMode: vi.fn().mockResolvedValue(undefined),
      verifyDevice: vi.fn(),
    } as unknown as jest.Mocked<LaunchControlXL3>;

    adapter = new LaunchControlXL3Adapter(mockDevice);
  });

  describe('static properties', () => {
    it('should have correct manufacturer', () => {
      expect(adapter.manufacturer).toBe('Novation');
    });

    it('should have correct model', () => {
      expect(adapter.model).toBe('Launch Control XL 3');
    });

    it('should have correct capabilities', () => {
      expect(adapter.capabilities.supportsCustomModes).toBe(true);
      expect(adapter.capabilities.maxConfigSlots).toBe(16);
      expect(adapter.capabilities.supportsRead).toBe(true);
      expect(adapter.capabilities.supportsWrite).toBe(true);
      expect(adapter.capabilities.supportedControlTypes).toEqual(['encoder', 'slider', 'button']);
    });
  });

  describe('connect', () => {
    it('should connect to device when not connected', async () => {
      mockDevice.isConnected.mockReturnValue(false);

      await adapter.connect();

      expect(mockDevice.connect).toHaveBeenCalledOnce();
    });

    it('should not connect if already connected', async () => {
      mockDevice.isConnected.mockReturnValue(true);

      await adapter.connect();

      expect(mockDevice.connect).not.toHaveBeenCalled();
    });

    it('should propagate connection errors', async () => {
      mockDevice.isConnected.mockReturnValue(false);
      mockDevice.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(adapter.connect()).rejects.toThrow('Connection failed');
    });
  });

  describe('disconnect', () => {
    it('should disconnect from device when connected', async () => {
      mockDevice.isConnected.mockReturnValue(true);

      await adapter.disconnect();

      expect(mockDevice.disconnect).toHaveBeenCalledOnce();
    });

    it('should not disconnect if not connected', async () => {
      mockDevice.isConnected.mockReturnValue(false);

      await adapter.disconnect();

      expect(mockDevice.disconnect).not.toHaveBeenCalled();
    });

    it('should propagate disconnection errors', async () => {
      mockDevice.isConnected.mockReturnValue(true);
      mockDevice.disconnect.mockRejectedValue(new Error('Disconnection failed'));

      await expect(adapter.disconnect()).rejects.toThrow('Disconnection failed');
    });
  });

  describe('isConnected', () => {
    it('should return device connection status', () => {
      mockDevice.isConnected.mockReturnValue(true);
      expect(adapter.isConnected()).toBe(true);

      mockDevice.isConnected.mockReturnValue(false);
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('listConfigurations', () => {
    it('should read all 16 custom mode slots', async () => {
      mockDevice.readCustomMode.mockResolvedValue(null);

      await adapter.listConfigurations();

      expect(mockDevice.readCustomMode).toHaveBeenCalledTimes(16);
      for (let i = 0; i < 16; i++) {
        expect(mockDevice.readCustomMode).toHaveBeenCalledWith(i);
      }
    });

    it('should return empty slots correctly', async () => {
      mockDevice.readCustomMode.mockResolvedValue(null);

      const slots = await adapter.listConfigurations();

      expect(slots).toHaveLength(16);
      slots.forEach((slot, idx) => {
        expect(slot.index).toBe(idx);
        expect(slot.isEmpty).toBe(true);
        expect(slot.name).toBeUndefined();
      });
    });

    it('should return populated slots with names', async () => {
      mockDevice.readCustomMode.mockImplementation(async (slot: number) => {
        if (slot === 0) {
          return { name: 'Mode A', controls: {}, metadata: {} } as LCXL3CustomMode;
        }
        if (slot === 5) {
          return { name: 'Mode B', controls: {}, metadata: {} } as LCXL3CustomMode;
        }
        return null;
      });

      const slots = await adapter.listConfigurations();

      expect(slots[0].isEmpty).toBe(false);
      expect(slots[0].name).toBe('Mode A');
      expect(slots[5].isEmpty).toBe(false);
      expect(slots[5].name).toBe('Mode B');
      expect(slots[1].isEmpty).toBe(true);
    });

    it('should handle read errors gracefully', async () => {
      // Mock: first slot fails, rest succeed with various states
      mockDevice.readCustomMode.mockImplementation(async (slot: number) => {
        if (slot === 0) {
          throw new Error('SysEx timeout');
        }
        if (slot === 1) {
          return {
            name: 'Working Slot',
            controls: {
              SEND_A1: {
                name: 'Test Control',
                type: 'knob',
                cc: 13,
                channel: 0,
                minValue: 0,
                maxValue: 127,
                behavior: 'absolute',
              },
            },
            metadata: { slot },
          };
        }
        return null; // Rest are empty
      });

      const slots = await adapter.listConfigurations();

      // Should have all 16 slots
      expect(slots).toHaveLength(16);

      // First slot should be marked as empty due to error
      expect(slots[0]).toEqual({
        index: 0,
        isEmpty: true,
      });

      // Second slot should be populated
      expect(slots[1]).toEqual({
        index: 1,
        isEmpty: false,
        name: 'Working Slot',
      });

      // Rest should be empty
      expect(slots[2].isEmpty).toBe(true);
    });
  });

  describe('readConfiguration', () => {
    it('should validate slot number range', async () => {
      await expect(adapter.readConfiguration(-1)).rejects.toThrow('Invalid slot number');
      await expect(adapter.readConfiguration(16)).rejects.toThrow('Invalid slot number');
    });

    it('should throw error for empty slot', async () => {
      mockDevice.readCustomMode.mockResolvedValue(null);

      await expect(adapter.readConfiguration(0)).rejects.toThrow('No configuration found in slot 0');
    });

    it('should convert LCXL3 custom mode to generic format', async () => {
      const lcxl3Mode: LCXL3CustomMode = {
        name: 'Test Mode',
        controls: {
          SEND_A1: {
            name: 'Send A1',
            type: 'knob',
            cc: 13,
            channel: 0,
            minValue: 0,
            maxValue: 127,
            behavior: 'absolute',
          },
          FADER1: {
            name: 'Fader 1',
            type: 'fader',
            cc: 77,
            channel: 0,
            minValue: 0,
            maxValue: 127,
            behavior: 'absolute',
          },
        },
        metadata: {
          slot: 0,
        },
      };

      mockDevice.readCustomMode.mockResolvedValue(lcxl3Mode);

      const config = await adapter.readConfiguration(0);

      expect(config.name).toBe('Test Mode');
      expect(config.controls).toHaveLength(2);
      expect(config.controls[0].id).toBe('SEND_A1');
      expect(config.controls[0].type).toBe('encoder');
      expect(config.controls[0].cc).toBe(13);
      expect(config.controls[1].id).toBe('FADER1');
      expect(config.controls[1].type).toBe('slider');
      expect(config.controls[1].cc).toBe(77);
    });

    it('should handle numeric control type codes', async () => {
      const lcxl3Mode: LCXL3CustomMode = {
        name: 'Numeric Types',
        controls: {
          SEND_A1: { name: 'Encoder', type: 0x00, cc: 13 } as LCXL3ControlMapping,
          FADER1: { name: 'Fader', type: 0x0d, cc: 77 } as LCXL3ControlMapping,
          FOCUS1: { name: 'Button', type: 0x19, cc: 41 } as LCXL3ControlMapping,
        },
        metadata: {},
      };

      mockDevice.readCustomMode.mockResolvedValue(lcxl3Mode);

      const config = await adapter.readConfiguration(0);

      expect(config.controls[0].type).toBe('encoder');
      expect(config.controls[1].type).toBe('slider');
      expect(config.controls[2].type).toBe('button');
    });

    it('should handle alternative property names', async () => {
      const lcxl3Mode: LCXL3CustomMode = {
        name: 'Alt Props',
        controls: {
          SEND_A1: {
            name: 'Send A1',
            controlType: 'knob',
            ccNumber: 13,
            midiChannel: 5,
            min: 10,
            max: 100,
          } as unknown as LCXL3ControlMapping,
        },
        metadata: {},
      };

      mockDevice.readCustomMode.mockResolvedValue(lcxl3Mode);

      const config = await adapter.readConfiguration(0);

      expect(config.controls[0].cc).toBe(13);
      expect(config.controls[0].channel).toBe(5);
      expect(config.controls[0].range).toEqual([10, 100]);
    });

    it('should preserve metadata including labels and colors', async () => {
      const labels = new Map<number, string>([[0, 'Label 1'], [1, 'Label 2']]);
      const colors = new Map<number, number>([[0, 0x0f], [1, 0x3c]]);

      const lcxl3Mode: LCXL3CustomMode = {
        name: 'Metadata Test',
        controls: {
          SEND_A1: { name: 'Send A1', type: 'knob', cc: 13 } as LCXL3ControlMapping,
        },
        metadata: {
          slot: 3,
          labels,
          colors,
        },
      };

      mockDevice.readCustomMode.mockResolvedValue(lcxl3Mode);

      const config = await adapter.readConfiguration(0);

      expect(config.metadata?.slot).toBe(3);
      expect(config.metadata?.labels).toEqual({ 0: 'Label 1', 1: 'Label 2' });
      expect(config.metadata?.colors).toEqual({ 0: 0x0f, 1: 0x3c });
    });
  });

  describe('writeConfiguration', () => {
    it('should validate slot number range', async () => {
      const config = { name: 'Test', controls: [] };

      await expect(adapter.writeConfiguration(-1, config)).rejects.toThrow('Invalid slot number');
      await expect(adapter.writeConfiguration(16, config)).rejects.toThrow('Invalid slot number');
    });

    it('should convert generic configuration to LCXL3 format', async () => {
      const config = {
        name: 'Generic Config',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder' as const, cc: 13, channel: 0 },
          { id: 'FADER1', name: 'Fader 1', type: 'slider' as const, cc: 77, channel: 0 },
        ],
      };

      await adapter.writeConfiguration(0, config);

      expect(mockDevice.writeCustomMode).toHaveBeenCalledOnce();
      const [slot, lcxl3Mode] = mockDevice.writeCustomMode.mock.calls[0];

      expect(slot).toBe(0);
      expect(lcxl3Mode.name).toBe('Generic '); // LCXL3 truncates to 8 chars
      expect(lcxl3Mode.controls.SEND_A1).toBeDefined();
      expect(lcxl3Mode.controls.SEND_A1.type).toBe('knob'); // LCXL3 uses 'knob' for encoders
      expect(lcxl3Mode.controls.FADER1).toBeDefined();
      expect(lcxl3Mode.controls.FADER1.type).toBe('fader'); // LCXL3 uses 'fader' for sliders
    });

    it('should truncate mode name to 8 characters', async () => {
      const config = {
        name: 'Very Long Mode Name',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder' as const, cc: 13 },
        ],
      };

      await adapter.writeConfiguration(0, config);

      const [, lcxl3Mode] = mockDevice.writeCustomMode.mock.calls[0];
      expect(lcxl3Mode.name).toHaveLength(8);
      expect(lcxl3Mode.name).toBe('Very Lon');
    });

    it('should handle controls with custom ranges', async () => {
      const config = {
        name: 'Range Test',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder' as const, cc: 13, range: [20, 100] },
        ],
      };

      await adapter.writeConfiguration(0, config);

      const [, lcxl3Mode] = mockDevice.writeCustomMode.mock.calls[0];
      expect(lcxl3Mode.controls.SEND_A1.minValue).toBe(20);
      expect(lcxl3Mode.controls.SEND_A1.maxValue).toBe(100);
    });

    it('should use default range when not specified', async () => {
      const config = {
        name: 'Default Range',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder' as const, cc: 13 },
        ],
      };

      await adapter.writeConfiguration(0, config);

      const [, lcxl3Mode] = mockDevice.writeCustomMode.mock.calls[0];
      expect(lcxl3Mode.controls.SEND_A1.minValue).toBe(0);
      expect(lcxl3Mode.controls.SEND_A1.maxValue).toBe(127);
    });

    it('should set absolute behavior by default', async () => {
      const config = {
        name: 'Behavior Test',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder' as const, cc: 13 },
        ],
      };

      await adapter.writeConfiguration(0, config);

      const [, lcxl3Mode] = mockDevice.writeCustomMode.mock.calls[0];
      expect(lcxl3Mode.controls.SEND_A1.behavior).toBe('absolute');
    });

    it('should preserve metadata in conversion', async () => {
      const config = {
        name: 'Meta Test',
        controls: [
          { id: 'SEND_A1', name: 'Send A1', type: 'encoder' as const, cc: 13 },
        ],
        metadata: {
          custom: 'value',
          slot: 5,
        },
      };

      await adapter.writeConfiguration(0, config);

      const [, lcxl3Mode] = mockDevice.writeCustomMode.mock.calls[0];
      expect(lcxl3Mode.metadata).toEqual({
        custom: 'value',
        slot: 5,
      });
    });

    it('should propagate write errors', async () => {
      const config = { name: 'Test', controls: [] };
      mockDevice.writeCustomMode.mockRejectedValue(new Error('Write failed'));

      await expect(adapter.writeConfiguration(0, config)).rejects.toThrow('Write failed');
    });
  });

  describe('getDeviceInfo', () => {
    it('should retrieve device information', async () => {
      mockDevice.verifyDevice.mockResolvedValue({
        manufacturer: 'Novation',
        model: 'Launch Control XL 3',
        firmwareVersion: '1.2.3',
      });

      const info = await adapter.getDeviceInfo();

      expect(info.manufacturer).toBe('Novation');
      expect(info.model).toBe('Launch Control XL 3');
      expect(info.firmwareVersion).toBe('1.2.3');
    });

    it('should propagate verification errors', async () => {
      mockDevice.verifyDevice.mockRejectedValue(new Error('Device verification failed'));

      await expect(adapter.getDeviceInfo()).rejects.toThrow('Device verification failed');
    });
  });

  describe('control type mapping', () => {
    it('should map knob string type to encoder', async () => {
      const lcxl3Mode: LCXL3CustomMode = {
        name: 'Knob Test',
        controls: {
          SEND_A1: { name: 'Knob', type: 'knob', cc: 13 } as LCXL3ControlMapping,
        },
        metadata: {},
      };

      mockDevice.readCustomMode.mockResolvedValue(lcxl3Mode);

      const config = await adapter.readConfiguration(0);
      expect(config.controls[0].type).toBe('encoder');
    });

    it('should map fader string type to slider', async () => {
      const lcxl3Mode: LCXL3CustomMode = {
        name: 'Fader Test',
        controls: {
          FADER1: { name: 'Fader', type: 'fader', cc: 77 } as LCXL3ControlMapping,
        },
        metadata: {},
      };

      mockDevice.readCustomMode.mockResolvedValue(lcxl3Mode);

      const config = await adapter.readConfiguration(0);
      expect(config.controls[0].type).toBe('slider');
    });

    it('should map button string type to button', async () => {
      const lcxl3Mode: LCXL3CustomMode = {
        name: 'Button Test',
        controls: {
          FOCUS1: { name: 'Button', type: 'button', cc: 41 } as LCXL3ControlMapping,
        },
        metadata: {},
      };

      mockDevice.readCustomMode.mockResolvedValue(lcxl3Mode);

      const config = await adapter.readConfiguration(0);
      expect(config.controls[0].type).toBe('button');
    });

    it('should handle all numeric control types', async () => {
      const lcxl3Mode: LCXL3CustomMode = {
        name: 'Numeric Types',
        controls: {
          ENCODER1: { name: 'Enc1', type: 0x00, cc: 13 } as LCXL3ControlMapping,
          ENCODER2: { name: 'Enc2', type: 0x05, cc: 14 } as LCXL3ControlMapping,
          ENCODER3: { name: 'Enc3', type: 0x09, cc: 15 } as LCXL3ControlMapping,
          FADER: { name: 'Fader', type: 0x0d, cc: 77 } as LCXL3ControlMapping,
          BUTTON1: { name: 'Btn1', type: 0x19, cc: 41 } as LCXL3ControlMapping,
          BUTTON2: { name: 'Btn2', type: 0x25, cc: 42 } as LCXL3ControlMapping,
        },
        metadata: {},
      };

      mockDevice.readCustomMode.mockResolvedValue(lcxl3Mode);

      const config = await adapter.readConfiguration(0);

      expect(config.controls[0].type).toBe('encoder'); // 0x00
      expect(config.controls[1].type).toBe('encoder'); // 0x05
      expect(config.controls[2].type).toBe('encoder'); // 0x09
      expect(config.controls[3].type).toBe('slider');  // 0x0d
      expect(config.controls[4].type).toBe('button');  // 0x19
      expect(config.controls[5].type).toBe('button');  // 0x25
    });

    it('should default unknown numeric types to encoder', async () => {
      const lcxl3Mode: LCXL3CustomMode = {
        name: 'Unknown Type',
        controls: {
          UNKNOWN: { name: 'Unknown', type: 0xff, cc: 99 } as LCXL3ControlMapping,
        },
        metadata: {},
      };

      mockDevice.readCustomMode.mockResolvedValue(lcxl3Mode);

      const config = await adapter.readConfiguration(0);
      expect(config.controls[0].type).toBe('encoder');
    });
  });
});
