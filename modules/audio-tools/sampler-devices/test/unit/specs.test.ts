/**
 * Tests for Device Specifications
 */

import { describe, it } from 'mocha';
import { expect } from 'chai';
import {
  DeviceSpec,
  programOutputSpec,
  programMidTuneSpec,
  programPitchBendSpec,
  programLfosSpec,
  getDeviceSpecs
} from '@/devices/specs';

describe('Device Specifications', () => {
  describe('DeviceSpec Interface', () => {
    it('should define the correct structure', () => {
      const spec: DeviceSpec = {
        specName: 'testSpec',
        className: 'TestClass',
        sectionCode: 0x0A,
        items: []
      };

      expect(spec).to.have.property('specName');
      expect(spec).to.have.property('className');
      expect(spec).to.have.property('sectionCode');
      expect(spec).to.have.property('items');
    });
  });

  describe('programOutputSpec', () => {
    it('should have correct metadata', () => {
      expect(programOutputSpec.specName).to.equal('programOutputSpec');
      expect(programOutputSpec.className).to.equal('ProgramOutput');
      expect(programOutputSpec.sectionCode).to.equal(0x0A);
    });

    it('should contain items array', () => {
      expect(programOutputSpec.items).to.be.an('array');
      expect(programOutputSpec.items.length).to.be.greaterThan(0);
    });

    it('should have Loudness item', () => {
      const loudness = programOutputSpec.items.find(
        (item: unknown[]) => item[0] === 'Loudness'
      );
      expect(loudness).to.exist;
      expect(loudness![1]).to.equal('number|0|100|1');
    });

    it('should have VelocitySensitivity item', () => {
      const velocitySens = programOutputSpec.items.find(
        (item: unknown[]) => item[0] === 'VelocitySensitivity'
      );
      expect(velocitySens).to.exist;
      expect(velocitySens![1]).to.equal('number|-100|100|1');
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
        expect(item, `Missing item: ${expectedItem}`).to.exist;
      }
    });
  });

  describe('programMidTuneSpec', () => {
    it('should have correct metadata', () => {
      expect(programMidTuneSpec.specName).to.equal('programMidTuneSpec');
      expect(programMidTuneSpec.className).to.equal('ProgramMidiTune');
      expect(programMidTuneSpec.sectionCode).to.equal(0x0A);
    });

    it('should contain items array', () => {
      expect(programMidTuneSpec.items).to.be.an('array');
      expect(programMidTuneSpec.items.length).to.be.greaterThan(0);
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
        expect(item, `Missing item: ${expectedItem}`).to.exist;
      }
    });

    it('should have SemitoneTune with correct range', () => {
      const semitoneTune = programMidTuneSpec.items.find(
        (item: unknown[]) => item[0] === 'SemitoneTune'
      );
      expect(semitoneTune![1]).to.equal('number|-36|36|1');
    });
  });

  describe('programPitchBendSpec', () => {
    it('should have correct metadata', () => {
      expect(programPitchBendSpec.specName).to.equal('programPitchBendSpec');
      expect(programPitchBendSpec.className).to.equal('ProgramPitchBend');
      expect(programPitchBendSpec.sectionCode).to.equal(0x0A);
    });

    it('should contain items array', () => {
      expect(programPitchBendSpec.items).to.be.an('array');
      expect(programPitchBendSpec.items.length).to.be.greaterThan(0);
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
        expect(item, `Missing item: ${expectedItem}`).to.exist;
      }
    });

    it('should have PitchBendUp with correct range', () => {
      const pitchBendUp = programPitchBendSpec.items.find(
        (item: unknown[]) => item[0] === 'PitchBendUp'
      );
      expect(pitchBendUp![1]).to.equal('number|0|24|1');
    });
  });

  describe('programLfosSpec', () => {
    it('should have correct metadata', () => {
      expect(programLfosSpec.specName).to.equal('programLfosSpec');
      expect(programLfosSpec.className).to.equal('ProgramLfos');
      expect(programLfosSpec.sectionCode).to.equal(0x0A);
    });

    it('should contain items array', () => {
      expect(programLfosSpec.items).to.be.an('array');
      expect(programLfosSpec.items.length).to.be.greaterThan(0);
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
        expect(item, `Missing item: ${expectedItem}`).to.exist;
      }
    });

    it('should have LFO items with correct ranges', () => {
      const lfo1Rate = programLfosSpec.items.find(
        (item: unknown[]) => item[0] === 'Lfo1Rate'
      );
      expect(lfo1Rate![1]).to.equal('number|0|100|1');
    });
  });

  describe('getDeviceSpecs', () => {
    it('should return array of all device specs', () => {
      const specs = getDeviceSpecs();
      expect(specs).to.be.an('array');
      expect(specs).to.have.length(4);
    });

    it('should return specs in correct order', () => {
      const specs = getDeviceSpecs();
      expect(specs[0]).to.equal(programOutputSpec);
      expect(specs[1]).to.equal(programMidTuneSpec);
      expect(specs[2]).to.equal(programPitchBendSpec);
      expect(specs[3]).to.equal(programLfosSpec);
    });

    it('should return all specs with valid structure', () => {
      const specs = getDeviceSpecs();

      for (const spec of specs) {
        expect(spec).to.have.property('specName');
        expect(spec).to.have.property('className');
        expect(spec).to.have.property('sectionCode');
        expect(spec).to.have.property('items');
        expect(spec.items).to.be.an('array');
      }
    });
  });

  describe('Item Structure Validation', () => {
    it('should have consistent item structure across all specs', () => {
      const allSpecs = getDeviceSpecs();

      for (const spec of allSpecs) {
        for (const item of spec.items as unknown[][]) {
          // Each item should be an array
          expect(item).to.be.an('array');

          // First element should be method name (string)
          expect(item[0]).to.be.a('string');

          // Second element should be data type spec (string)
          expect(item[1]).to.be.a('string');

          // Third element should be getter item code (number)
          expect(item[2]).to.be.a('number');

          // Fourth element should be getter request data (array)
          expect(item[3]).to.be.an('array');

          // Fifth element should be response type (string)
          expect(item[4]).to.be.a('string');

          // Sixth element should be response size (number)
          expect(item[5]).to.be.a('number');
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

          expect(isValid, `Invalid data type spec: ${dataTypeSpec}`).to.be.true;
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
          ).to.include(responseType);
        }
      }
    });
  });

  describe('Section Codes', () => {
    it('should all use PROGRAM section code', () => {
      const specs = getDeviceSpecs();

      for (const spec of specs) {
        expect(spec.sectionCode).to.equal(0x0A);
      }
    });
  });
});
