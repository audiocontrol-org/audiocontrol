import { describe, it, expect } from 'vitest';
import { CustomModeBuilder, Color } from '@/builders/CustomModeBuilder';

describe('CustomModeBuilder', () => {
  describe('Basic builder functionality', () => {
    it('should create a simple custom mode', () => {
      const mode = new CustomModeBuilder()
        .name('TEST')
        .addFader(1, { cc: 10, channel: 1 })
        .addEncoder(1, 1, { cc: 20, channel: 1 })
        .build();

      expect(mode.name).toBe('TEST');
      expect(mode.controls).toHaveLength(2);
      expect(mode.controls[0]).toMatchObject({
        controlId: 0,
        controlType: 0x00,
        midiChannel: 0,
        ccNumber: 10
      });
      expect(mode.controls[1]).toMatchObject({
        controlId: 0x10,
        controlType: 0x05,
        midiChannel: 0,
        ccNumber: 20
      });
    });

    it('should add labels to controls', () => {
      const mode = new CustomModeBuilder()
        .name('LABELED')
        .addFader(1, { cc: 10 })
        .addFaderLabel(1, 'Volume')
        .addEncoder(1, 1, { cc: 20 })
        .addEncoderLabel(1, 1, 'Pan')
        .build();

      expect(mode.labels?.get(0)).toBe('Volume');
      expect(mode.labels?.get(0x10)).toBe('Pan');
    });

    it('should add colors to buttons', () => {
      const mode = new CustomModeBuilder()
        .name('COLORED')
        .addSideButton(1, { cc: 60 })
        .addSideButtonColor(1, Color.RED_FULL)
        .addBottomButton(1, { cc: 70 })
        .addBottomButtonColor(1, Color.GREEN_FULL)
        .build();

      expect(mode.colors?.get(0x28)).toBe(Color.RED_FULL);
      expect(mode.colors?.get(0x30)).toBe(Color.GREEN_FULL);
    });

    it('should sort controls by ID', () => {
      const mode = new CustomModeBuilder()
        .name('SORTED')
        .addEncoder(3, 1, { cc: 30 }) // ID 0x20
        .addEncoder(1, 1, { cc: 10 }) // ID 0x10
        .addFader(1, { cc: 5 })       // ID 0x00
        .build();

      expect(mode.controls[0].controlId).toBe(0x00);
      expect(mode.controls[1].controlId).toBe(0x10);
      expect(mode.controls[2].controlId).toBe(0x20);
    });
  });

  describe('Validation', () => {
    it('should throw error for invalid fader number', () => {
      const builder = new CustomModeBuilder();
      expect(() => builder.addFader(0, { cc: 10 })).toThrow('Fader number must be 1-8');
      expect(() => builder.addFader(9, { cc: 10 })).toThrow('Fader number must be 1-8');
    });

    it('should throw error for invalid encoder number', () => {
      const builder = new CustomModeBuilder();
      expect(() => builder.addEncoder(1, 0, { cc: 10 })).toThrow('Encoder number must be 1-8');
      expect(() => builder.addEncoder(1, 9, { cc: 10 })).toThrow('Encoder number must be 1-8');
    });

    it('should throw error for invalid CC number', () => {
      const builder = new CustomModeBuilder().name('TEST');
      expect(() => builder.addFader(1, { cc: -1 })).toThrow('CC number must be 0-127');
      expect(() => builder.addFader(1, { cc: 128 })).toThrow('CC number must be 0-127');
    });

    it('should throw error for duplicate control', () => {
      const builder = new CustomModeBuilder()
        .name('DUP')
        .addFader(1, { cc: 10 });

      expect(() => builder.addFader(1, { cc: 20 })).toThrow('Control 0 already defined');
    });

    it('should throw error for mode name too long', () => {
      const builder = new CustomModeBuilder();
      expect(() => builder.name('TOOLONGNAME')).toThrow('Mode name must be 8 characters or less');
    });

    it('should throw error when building without name', () => {
      const builder = new CustomModeBuilder()
        .addFader(1, { cc: 10 });

      expect(() => builder.build()).toThrow('Mode name is required');
    });

    it('should throw error when building without controls', () => {
      const builder = new CustomModeBuilder()
        .name('EMPTY');

      expect(() => builder.build()).toThrow('At least one control mapping is required');
    });
  });

  describe('Pre-configured modes', () => {
    it('should create test mode', () => {
      const mode = CustomModeBuilder.createTestMode().build();

      expect(mode.name).toBe('TEST');
      expect(mode.controls).toHaveLength(2);
      expect(mode.labels?.size).toBe(2);
    });

    it('should create CHANNEV mode', () => {
      const mode = CustomModeBuilder.createChannevMode().build();

      expect(mode.name).toBe('CHANNEV');
      expect(mode.controls).toHaveLength(24); // 3 rows of 8 encoders
      expect(mode.labels?.size).toBeGreaterThan(0);
    });
  });

  describe('Encoder rows', () => {
    it('should assign correct control types for each row', () => {
      const mode = new CustomModeBuilder()
        .name('ROWS')
        .addEncoder(1, 1, { cc: 10 }) // Top row
        .addEncoder(2, 1, { cc: 20 }) // Middle row
        .addEncoder(3, 1, { cc: 30 }) // Bottom row
        .build();

      expect(mode.controls[0]).toMatchObject({
        controlId: 0x10,
        controlType: 0x05
      });
      expect(mode.controls[1]).toMatchObject({
        controlId: 0x18,
        controlType: 0x09
      });
      expect(mode.controls[2]).toMatchObject({
        controlId: 0x20,
        controlType: 0x0D
      });
    });
  });
});