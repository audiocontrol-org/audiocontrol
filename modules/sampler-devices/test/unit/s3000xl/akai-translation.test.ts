import { describe, it, expect } from 'vitest';
import {
  akaiSampleToCommon,
  akaiProgramToCommon,
  akaiKeygroupToZones,
} from '@/devices/s3000xl/akai-to-common';
import {
  commonToAkaiProgram,
  commonToAkaiSample,
} from '@/devices/s3000xl/common-to-akai';
import type { AkaiDiskProgram, AkaiDiskKeygroup } from '@/devices/s3000xl/akai-disk-program';
import type { AkaiDiskSampleHeader } from '@/devices/s3000xl/akai-disk-sample';

function makeSampleHeader(overrides: Partial<AkaiDiskSampleHeader> = {}): AkaiDiskSampleHeader {
  return {
    name: 'TESTSAMPLE  ',
    bandwidth: 1,
    originalPitch: 60,
    sampleRate: 44100,
    sampleLength: 44100,
    playStart: 0,
    playEnd: 44100,
    loopCount: 0,
    playbackType: 0,
    rawHeader: new Uint8Array(150),
    ...overrides,
  };
}

function makeKeygroup(overrides: Partial<AkaiDiskKeygroup> = {}): AkaiDiskKeygroup {
  return {
    lowNote: 36,
    highNote: 72,
    sampleNames: ['KICK        '],
    rawData: new Uint8Array(512),
    ...overrides,
  };
}

function makeProgram(overrides: Partial<AkaiDiskProgram> = {}): AkaiDiskProgram {
  return {
    name: 'TEST PROG   ',
    midiProgramNumber: 0,
    midiChannel: 0,
    polyphony: 16,
    numKeygroups: 1,
    keygroups: [makeKeygroup()],
    rawProgramHeader: new Uint8Array(512),
    ...overrides,
  };
}

describe('akaiSampleToCommon', () => {
  it('converts basic sample header', () => {
    const header = makeSampleHeader({ name: 'PIANO C3    ', sampleRate: 44100, originalPitch: 60 });
    const result = akaiSampleToCommon(header);

    expect(result.format).toBe('sample');
    expect(result.version).toBe(1);
    expect(result.name).toBe('PIANO C3');
    expect(result.sampleRate).toBe(44100);
    expect(result.rootKey).toBe(60);
    expect(result.file).toBe('sample.wav');
  });

  it('converts looping sample', () => {
    const header = makeSampleHeader({ playbackType: 1, loopCount: 1, playStart: 100, playEnd: 44000 });
    const result = akaiSampleToCommon(header);

    expect(result.loopMode).toBe('forward');
    expect(result.loopStart).toBe(100);
    expect(result.loopEnd).toBe(44000);
  });

  it('one-shot sample has no loop fields', () => {
    const header = makeSampleHeader({ playbackType: 0, loopCount: 0 });
    const result = akaiSampleToCommon(header);

    expect(result.loopMode).toBeUndefined();
    expect(result.loopStart).toBeUndefined();
    expect(result.loopEnd).toBeUndefined();
  });
});

describe('akaiProgramToCommon', () => {
  it('converts single-keygroup program', () => {
    const program = makeProgram();
    const result = akaiProgramToCommon(program);

    expect(result.format).toBe('program');
    expect(result.name).toBe('TEST PROG');
    expect(result.zones.length).toBe(1);
    expect(result.zones[0].sample).toBe('KICK.wav');
    expect(result.zones[0].keyRange).toEqual([36, 72]);
  });

  it('converts multi-velocity keygroup to multiple zones', () => {
    const kg = makeKeygroup({
      sampleNames: ['KICK SOFT   ', 'KICK HARD   '],
    });
    const program = makeProgram({ keygroups: [kg], numKeygroups: 1 });
    const result = akaiProgramToCommon(program);

    expect(result.zones.length).toBe(2);
    expect(result.zones[0].sample).toBe('KICK SOFT.wav');
    expect(result.zones[1].sample).toBe('KICK HARD.wav');
    // Velocity ranges should be distributed
    expect(result.zones[0].velocityRange).toBeDefined();
    expect(result.zones[1].velocityRange).toBeDefined();
    expect(result.zones[0].velocityRange![0]).toBeLessThan(result.zones[1].velocityRange![0]);
  });

  it('includes root key from sample headers when provided', () => {
    const program = makeProgram();
    const headers = new Map<string, AkaiDiskSampleHeader>();
    headers.set('KICK', makeSampleHeader({ originalPitch: 36 }));

    const result = akaiProgramToCommon(program, headers);
    expect(result.zones[0].rootKey).toBe(36);
  });
});

describe('akaiKeygroupToZones', () => {
  it('skips empty sample names', () => {
    const kg = makeKeygroup({ sampleNames: ['KICK        ', '            ', ''] });
    const zones = akaiKeygroupToZones(kg);
    expect(zones.length).toBe(1);
  });

  it('returns empty for keygroup with no samples', () => {
    const kg = makeKeygroup({ sampleNames: ['            '] });
    const zones = akaiKeygroupToZones(kg);
    expect(zones.length).toBe(0);
  });
});

describe('commonToAkaiProgram', () => {
  it('groups zones by key range into keygroups', () => {
    const program = akaiProgramToCommon(makeProgram({
      keygroups: [
        makeKeygroup({ lowNote: 36, highNote: 59, sampleNames: ['BASS        '] }),
        makeKeygroup({ lowNote: 60, highNote: 96, sampleNames: ['PIANO       '] }),
      ],
      numKeygroups: 2,
    }));

    const result = commonToAkaiProgram(program);
    expect(result.keygroups.length).toBe(2);
    expect(result.keygroups[0].lowNote).toBe(36);
    expect(result.keygroups[0].highNote).toBe(59);
    expect(result.keygroups[1].lowNote).toBe(60);
    expect(result.keygroups[1].highNote).toBe(96);
  });

  it('truncates name to 12 characters', () => {
    const program = akaiProgramToCommon(makeProgram());
    program.name = 'THIS NAME IS VERY LONG';
    const result = commonToAkaiProgram(program);
    expect(result.name.length).toBeLessThanOrEqual(12);
  });
});

describe('commonToAkaiSample', () => {
  it('converts basic sample', () => {
    const header = makeSampleHeader();
    const common = akaiSampleToCommon(header);
    const result = commonToAkaiSample(common, 44100);

    expect(result.sampleRate).toBe(44100);
    expect(result.originalPitch).toBe(60);
    expect(result.playbackType).toBe(0);
    expect(result.loopCount).toBe(0);
  });

  it('round-trips loop mode', () => {
    const header = makeSampleHeader({ playbackType: 1, loopCount: 1, playStart: 100, playEnd: 1000 });
    const common = akaiSampleToCommon(header);
    const result = commonToAkaiSample(common, 44100);

    expect(result.playbackType).toBe(1);
    expect(result.loopCount).toBe(1);
    expect(result.playStart).toBe(100);
    expect(result.playEnd).toBe(1000);
  });
});
