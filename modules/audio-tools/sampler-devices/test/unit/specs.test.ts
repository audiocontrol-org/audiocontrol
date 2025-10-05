/**
 * Tests for Device Specifications
 */

import { describe, it, expect } from 'vitest';
import {
  DeviceSpec,
  programOutputSpec,
  programMidTuneSpec,
  programPitchBendSpec,
  programLfosSpec,
  getDeviceSpecs
} from '@/devices/specs.js';

describe('Device Specifications', () => {
  describe('DeviceSpec Interface', () => {
    it('should define the correct structure', () => {
      const spec: DeviceSpec = {
        specName: 'testSpec',
        className: 'TestClass',
        sectionCode: 0x0A,
        items: []
      };

      expect(spec).toHaveProperty('specName');
      expect(spec).toHaveProperty('className');
      expect(spec).toHaveProperty('sectionCode');
      expect(spec).toHaveProperty('items');
    });
  });

  describe('programOutputSpec', () => {
    it('should have correct metadata', () => {
      expect(programOutputSpec.specName).toBe('programOutputSpec');
      expect(programOutputSpec.className).toBe('ProgramOutput');
      expect(programOutputSpec.sectionCode).toBe(0x0A);
    });

    it('should contain items array', () => {
      expect(programOutputSpec.items).toBeInstanceOf(Array);
      expect(programOutputSpec.items.length).toBeGreaterThan(0);
    });

    it('should have Loudness item', () => {
      const loudness = programOutputSpec.items.find(
        (item: unknown[]) => item[0] === 'Loudness'
      );
      expect(loudness).toBeDefined();
      expect(loudness![1]).toBe('number|0|100|1');
    });

    it('should have VelocitySensitivity item', () => {
      const velocitySens = programOutputSpec.items.find(
        (item: unknown[]) => item[0] === 'VelocitySensitivity'
      );
      expect(velocitySens).toBeDefined();
      expect(velocitySens![1]).toBe('number|-100|100|1');
    });

    it('should have all expected items', () => {
      const expectedItems = [
        'Loudness',
        'VelocitySensitivity',
        'AmpMod1Source',
        'AmpMod2Source',
        'AmpMod1Value',
        'AmpMod2Value',
        'PanMod1Source',
        'PanMod2Source',
        'PanMod3source',
        'PanMod1Value',
        'PanMod2Value',
        'PanMod3Value'
      ];

      for (const expectedItem of expectedItems) {
        const item = programOutputSpec.items.find(
          (i: unknown[]) => i[0] === expectedItem
        );
        expect(item, `Missing item: ${expectedItem}`).toBeDefined();
      }
    });
  });

  describe('programMidTuneSpec', () => {
    it('should have correct metadata', () => {
      expect(programMidTuneSpec.specName).toBe('programMidTuneSpec');
      expect(programMidTuneSpec.className).toBe('ProgramMidiTune');
      expect(programMidTuneSpec.sectionCode).toBe(0x0A);
    });

    it('should contain items array', () => {
      expect(programMidTuneSpec.items).toBeInstanceOf(Array);
      expect(programMidTuneSpec.items.length).toBeGreaterThan(0);
    });

    it('should have all expected items', () => {
      const expectedItems = [
        'SemitoneTune',
        'FineTune',
        'TuneTemplate',
        'Key'
      ];

      for (const expectedItem of expectedItems) {
        const item = programMidTuneSpec.items.find(
          (i: unknown[]) => i[0] === expectedItem
        );
        expect(item, `Missing item: ${expectedItem}`).toBeDefined();
      }
    });

    it('should have SemitoneTune with correct range', () => {
      const semitoneTune = programMidTuneSpec.items.find(
        (item: unknown[]) => item[0] === 'SemitoneTune'
      );
      expect(semitoneTune![1]).toBe('number|-36|36|1');
    });
  });

  describe('programPitchBendSpec', () => {
    it('should have correct metadata', () => {
      expect(programPitchBendSpec.specName).toBe('programPitchBendSpec');
      expect(programPitchBendSpec.className).toBe('ProgramPitchBend');
      expect(programPitchBendSpec.sectionCode).toBe(0x0A);
    });

    it('should contain items array', () => {
      expect(programPitchBendSpec.items).toBeInstanceOf(Array);
      expect(programPitchBendSpec.items.length).toBeGreaterThan(0);
    });

    it('should have all expected items', () => {
      const expectedItems = [
        'PitchBendUp',
        'PitchBendDown',
        'BendMode',
        'AftertouchValue',
        'LegatoEnable',
        'PortamentoEnable',
        'PortamentoMode',
        'PortamentoTime'
      ];

      for (const expectedItem of expectedItems) {
        const item = programPitchBendSpec.items.find(
          (i: unknown[]) => i[0] === expectedItem
        );
        expect(item, `Missing item: ${expectedItem}`).toBeDefined();
      }
    });

    it('should have PitchBendUp with correct range', () => {
      const pitchBendUp = programPitchBendSpec.items.find(
        (item: unknown[]) => item[0] === 'PitchBendUp'
      );
      expect(pitchBendUp![1]).toBe('number|0|24|1');
    });
  });

  describe('programLfosSpec', () => {
    it('should have correct metadata', () => {
      expect(programLfosSpec.specName).toBe('programLfosSpec');
      expect(programLfosSpec.className).toBe('ProgramLfos');
      expect(programLfosSpec.sectionCode).toBe(0x0A);
    });

    it('should contain items array', () => {
      expect(programLfosSpec.items).toBeInstanceOf(Array);
      expect(programLfosSpec.items.length).toBeGreaterThan(0);
    });

    it('should have all expected items', () => {
      const expectedItems = [
        'Lfo1Rate',
        'Lfo2Rate',
        'Lfo1Delay',
        'Lfo2Delay',
        'Lfo1Depth',
        'Lfo2Depth',
        'Lfo1Waveform',
        'Lfo2Waveform',
        'Lfo1Sync',
        'Lfo2Retrigger',
        'Lfo1RateModSource'
      ];

      for (const expectedItem of expectedItems) {
        const item = programLfosSpec.items.find(
          (i: unknown[]) => i[0] === expectedItem
        );
        expect(item, `Missing item: ${expectedItem}`).toBeDefined();
      }
    });

    it('should have LFO items with correct ranges', () => {
      const lfo1Rate = programLfosSpec.items.find(
        (item: unknown[]) => item[0] === 'Lfo1Rate'
      );
      expect(lfo1Rate![1]).toBe('number|0|100|1');
    });
  });

  describe('getDeviceSpecs', () => {
    it('should return array of all device specs', () => {
      const specs = getDeviceSpecs();
      expect(specs).toBeInstanceOf(Array);
      expect(specs).toHaveLength(4);
    });

    it('should return specs in correct order', () => {
      const specs = getDeviceSpecs();
      expect(specs[0]).toBe(programOutputSpec);
      expect(specs[1]).toBe(programMidTuneSpec);
      expect(specs[2]).toBe(programPitchBendSpec);
      expect(specs[3]).toBe(programLfosSpec);
    });

    it('should return all specs with valid structure', () => {
      const specs = getDeviceSpecs();

      for (const spec of specs) {
        expect(spec).toHaveProperty('specName');
        expect(spec).toHaveProperty('className');
        expect(spec).toHaveProperty('sectionCode');
        expect(spec).toHaveProperty('items');
        expect(spec.items).toBeInstanceOf(Array);
      }
    });
  });

  describe('Item Structure Validation', () => {
    it('should have consistent item structure across all specs', () => {
      const allSpecs = getDeviceSpecs();

      for (const spec of allSpecs) {
        for (const item of spec.items as unknown[][]) {
          // Each item should be an array
          expect(item).toBeInstanceOf(Array);

          // First element should be method name (string)
          expect(item[0]).toEqual(expect.any(String));

          // Second element should be data type spec (string)
          expect(item[1]).toEqual(expect.any(String));

          // Third element should be getter item code (number)
          expect(item[2]).toEqual(expect.any(Number));

          // Fourth element should be getter request data (array)
          expect(item[3]).toBeInstanceOf(Array);

          // Fifth element should be response type (string)
          expect(item[4]).toEqual(expect.any(String));

          // Sixth element should be response size (number)
          expect(item[5]).toEqual(expect.any(Number));
        }
      }
    });

    it('should have valid data type specifications', () => {
      const allSpecs = getDeviceSpecs();
      const validTypePatterns = [
        /^number\|-?\d+\|\d+\|\d+$/,
        /^string\|\d+$/
      ];

      for (const spec of allSpecs) {
        for (const item of spec.items as unknown[][]) {
          const dataTypeSpec = item[1] as string;
          const isValid = validTypePatterns.some(pattern =>
            pattern.test(dataTypeSpec)
          );

          expect(isValid, `Invalid data type spec: ${dataTypeSpec}`).toBe(true);
        }
      }
    });

    it('should have valid response types', () => {
      const allSpecs = getDeviceSpecs();
      const validResponseTypes = ['uint8', 'int8', 'string'];

      for (const spec of allSpecs) {
        for (const item of spec.items as unknown[][]) {
          const responseType = item[4] as string;
          expect(
            validResponseTypes,
            `Invalid response type: ${responseType}`
          ).toContain(responseType);
        }
      }
    });
  });

  describe('Section Codes', () => {
    it('should all use PROGRAM section code', () => {
      const specs = getDeviceSpecs();

      for (const spec of specs) {
        expect(spec.sectionCode).toBe(0x0A);
      }
    });
  });
});
