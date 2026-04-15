import { describe, it, expect } from 'vitest';
import {
  serializeProgram,
  deserializeProgram,
  decodeSerializedRaw,
} from '@/lib/program-serialization';
import type { ProgramHeader, KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';

function makeProgramHeader(overrides: Partial<ProgramHeader> = {}): ProgramHeader {
  return {
    KGRP1: 0,
    KGRP1Label: '',
    PRNAME: 'TestProg    ',
    PRNAMELabel: 'Program Name',
    PRGNUM: 0,
    PRGNUMLabel: 'Program Number',
    PMCHAN: 0,
    PMCHANLabel: '',
    POLYPH: 15,
    POLYPHLabel: '',
    PRIORT: 1,
    PRIORTLabel: '',
    PLAYLO: 21,
    PLAYLOLabel: '',
    PLAYHI: 127,
    PLAYHILabel: '',
    OSHIFT: 0,
    OSHIFTLabel: '',
    OUTPUT: 0,
    OUTPUTLabel: '',
    STEREO: 99,
    STEREOLabel: '',
    PANPOS: 0,
    PANPOSLabel: '',
    PRLOUD: 80,
    PRLOUDLabel: '',
    V_LOUD: 25,
    V_LOUDLabel: '',
    K_LOUD: 0,
    K_LOUDLabel: '',
    P_LOUD: 0,
    P_LOUDLabel: '',
    PANRAT: 0,
    PANRATLabel: '',
    PANDEP: 0,
    PANDEPLabel: '',
    PANDEL: 0,
    PANDELLabel: '',
    K_PANP: 0,
    K_PANPLabel: '',
    LFORAT: 50,
    LFORATLabel: '',
    LFODEP: 0,
    LFODEPLabel: '',
    LFODEL: 0,
    LFODELLabel: '',
    MWLDEP: 0,
    MWLDEPLabel: '',
    PRSDEP: 0,
    PRSDEPLabel: '',
    VELDEP: 0,
    VELDEPLabel: '',
    B_PTCH: 2,
    B_PTCHLabel: '',
    P_PTCH: 0,
    P_PTCHLabel: '',
    KXFADE: 0,
    KXFADELabel: '',
    GROUPS: 1,
    GROUPSLabel: '',
    TPNUM: 0,
    TPNUMLabel: '',
    TEMPER: '0,0,0,0,0,0,0,0,0,0,0,0',
    TEMPERLabel: '',
    ECHOUT: 0,
    ECHOUTLabel: '',
    MW_PAN: 0,
    MW_PANLabel: '',
    COHERE: 0,
    COHERELabel: '',
    DESYNC: 0,
    DESYNCLabel: '',
    PLAW: 0,
    PLAWLabel: '',
    VASSOQ: 0,
    VASSOQLabel: '',
    SPLOUD: 0,
    SPLOUDLabel: '',
    SPATT: 0,
    SPATTLabel: '',
    SPFILT: 0,
    SPFILTLabel: '',
    PTUNO: 0,
    PTUNOLabel: '',
    K_LRAT: 0,
    K_LRATLabel: '',
    K_LDEP: 0,
    K_LDEPLabel: '',
    K_LDEL: 0,
    K_LDELLabel: '',
    VOSCL: 0,
    VOSCLLabel: '',
    VSSCL: 0,
    VSSCLLabel: '',
    LEGATO: 0,
    LEGATOLabel: '',
    B_PTCHD: 2,
    B_PTCHDLabel: '',
    B_MODE: 0,
    B_MODELabel: '',
    TRANSPOSE: 0,
    TRANSPOSELabel: '',
    MODSPAN1: 0,
    MODSPAN1Label: '',
    MODSPAN2: 0,
    MODSPAN2Label: '',
    MODSPAN3: 0,
    MODSPAN3Label: '',
    MODSAMP1: 0,
    MODSAMP1Label: '',
    MODSAMP2: 0,
    MODSAMP2Label: '',
    MODSLFOT: 0,
    MODSLFOTLabel: '',
    MODSLFOL: 0,
    MODSLFOLLabel: '',
    MODSLFOD: 0,
    MODSLFODLabel: '',
    MODSFILT1: 0,
    MODSFILT1Label: '',
    MODSFILT2: 0,
    MODSFILT2Label: '',
    MODSFILT3: 0,
    MODSFILT3Label: '',
    MODSPITCH: 0,
    MODSPITCHLabel: '',
    MODSAMP3: 0,
    MODSAMP3Label: '',
    MODVPAN1: 0,
    MODVPAN1Label: '',
    MODVPAN2: 0,
    MODVPAN2Label: '',
    MODVPAN3: 0,
    MODVPAN3Label: '',
    MODVAMP1: 0,
    MODVAMP1Label: '',
    MODVAMP2: 0,
    MODVAMP2Label: '',
    MODVLFOR: 0,
    MODVLFORLabel: '',
    MODVLVOL: 0,
    MODVLVOLLabel: '',
    MODVLFOD: 0,
    MODVLFODLabel: '',
    LFO1WAVE: 0,
    LFO1WAVELabel: '',
    LFO2WAVE: 0,
    LFO2WAVELabel: '',
    MODSLFLT2_1: 0,
    MODSLFLT2_1Label: '',
    MODSLFLT2_2: 0,
    MODSLFLT2_2Label: '',
    MODSLFLT2_3: 0,
    MODSLFLT2_3Label: '',
    LFO2TRIG: 0,
    LFO2TRIGLabel: '',
    RESERVED_1: 0,
    RESERVED_1Label: '',
    PORTIME: 0,
    PORTIMELabel: '',
    PORTYPE: 0,
    PORTYPELabel: '',
    PORTEN: 0,
    PORTENLabel: '',
    PFXCHAN: 0,
    PFXCHANLabel: '',
    raw: [0xF0, 0x47, 0x00, 0x28, 0x48, 0x01, 0x02, 0x03, 0xF7],
    ...overrides,
  } as ProgramHeader;
}

function makeKeygroupHeader(
  sampleNames: [string, string, string, string] = ['Kick        ', '', '', ''],
  overrides: Partial<KeygroupHeader> = {},
): KeygroupHeader {
  return {
    KGIDENT: 2,
    KGIDENTLabel: '',
    NXTKG: 0,
    NXTKGLabel: '',
    LONOTE: 21,
    LONOTELabel: '',
    HINOTE: 127,
    HINOTELabel: '',
    KGTUNO: 0,
    KGTUNOLabel: '',
    FILFRQ: 99,
    FILFRQLabel: '',
    K_FREQ: 0,
    K_FREQLabel: '',
    V_FREQ: 0,
    V_FREQLabel: '',
    P_FREQ: 0,
    P_FREQLabel: '',
    E_FREQ: 0,
    E_FREQLabel: '',
    ATTAK1: 0,
    ATTAK1Label: '',
    DECAY1: 50,
    DECAY1Label: '',
    SUSTN1: 99,
    SUSTN1Label: '',
    RELSE1: 45,
    RELSE1Label: '',
    V_ATT1: 0,
    V_ATT1Label: '',
    V_REL1: 0,
    V_REL1Label: '',
    O_REL1: 0,
    O_REL1Label: '',
    K_DAR1: 0,
    K_DAR1Label: '',
    ENV2R1: 0,
    ENV2R1Label: '',
    ENV2R3: 0,
    ENV2R3Label: '',
    ENV2L3: 0,
    ENV2L3Label: '',
    ENV2R4: 0,
    ENV2R4Label: '',
    V_ATT2: 0,
    V_ATT2Label: '',
    V_REL2: 0,
    V_REL2Label: '',
    O_REL2: 0,
    O_REL2Label: '',
    K_DAR2: 0,
    K_DAR2Label: '',
    V_ENV2: 0,
    V_ENV2Label: '',
    E_PTCH: 0,
    E_PTCHLabel: '',
    VXFADE: 0,
    VXFADELabel: '',
    VZONES: 0,
    VZONESLabel: '',
    LKXF: 0,
    LKXFLabel: '',
    RKXF: 0,
    RKXFLabel: '',
    SNAME1: sampleNames[0],
    SNAME1Label: '',
    LOVEL1: 0,
    LOVEL1Label: '',
    HIVEL1: 127,
    HIVEL1Label: '',
    VTUNO1: 0,
    VTUNO1Label: '',
    VLOUD1: 0,
    VLOUD1Label: '',
    VFREQ1: 0,
    VFREQ1Label: '',
    VPANO1: 0,
    VPANO1Label: '',
    ZPLAY1: 0,
    ZPLAY1Label: '',
    LVXF1: 0,
    LVXF1Label: '',
    HVXF1: 0,
    HVXF1Label: '',
    SBADD1: 0,
    SBADD1Label: '',
    SNAME2: sampleNames[1],
    SNAME2Label: '',
    LOVEL2: 0,
    LOVEL2Label: '',
    HIVEL2: 0,
    HIVEL2Label: '',
    VTUNO2: 0,
    VTUNO2Label: '',
    VLOUD2: 0,
    VLOUD2Label: '',
    VFREQ2: 0,
    VFREQ2Label: '',
    VPANO2: 0,
    VPANO2Label: '',
    ZPLAY2: 0,
    ZPLAY2Label: '',
    LVXF2: 0,
    LVXF2Label: '',
    HVXF2: 0,
    HVXF2Label: '',
    SBADD2: 0,
    SBADD2Label: '',
    SNAME3: sampleNames[2],
    SNAME3Label: '',
    LOVEL3: 0,
    LOVEL3Label: '',
    HIVEL3: 0,
    HIVEL3Label: '',
    VTUNO3: 0,
    VTUNO3Label: '',
    VLOUD3: 0,
    VLOUD3Label: '',
    VFREQ3: 0,
    VFREQ3Label: '',
    VPANO3: 0,
    VPANO3Label: '',
    ZPLAY3: 0,
    ZPLAY3Label: '',
    LVXF3: 0,
    LVXF3Label: '',
    HVXF3: 0,
    HVXF3Label: '',
    SBADD3: 0,
    SBADD3Label: '',
    SNAME4: sampleNames[3],
    SNAME4Label: '',
    LOVEL4: 0,
    LOVEL4Label: '',
    HIVEL4: 0,
    HIVEL4Label: '',
    VTUNO4: 0,
    VTUNO4Label: '',
    VLOUD4: 0,
    VLOUD4Label: '',
    VFREQ4: 0,
    VFREQ4Label: '',
    VPANO4: 0,
    VPANO4Label: '',
    ZPLAY4: 0,
    ZPLAY4Label: '',
    LVXF4: 0,
    LVXF4Label: '',
    HVXF4: 0,
    HVXF4Label: '',
    SBADD4: 0,
    SBADD4Label: '',
    KBEAT: 0,
    KBEATLabel: '',
    AHOLD: 0,
    AHOLDLabel: '',
    CP1: 0,
    CP1Label: '',
    CP2: 0,
    CP2Label: '',
    CP3: 0,
    CP3Label: '',
    CP4: 0,
    CP4Label: '',
    VZOUT1: 0,
    VZOUT1Label: '',
    VZOUT2: 0,
    VZOUT2Label: '',
    VZOUT3: 0,
    VZOUT3Label: '',
    VZOUT4: 0,
    VZOUT4Label: '',
    VSS1: 0,
    VSS1Label: '',
    VSS2: 0,
    VSS2Label: '',
    VSS3: 0,
    VSS3Label: '',
    VSS4: 0,
    VSS4Label: '',
    KV_LO: 0,
    KV_LOLabel: '',
    FILQ: 0,
    FILQLabel: '',
    L_PTCH: 0,
    L_PTCHLabel: '',
    MODVFILT1: 0,
    MODVFILT1Label: '',
    MODVFILT2: 0,
    MODVFILT2Label: '',
    MODVFILT3: 0,
    MODVFILT3Label: '',
    MODVPITCH: 0,
    MODVPITCHLabel: '',
    MODVAMP3: 0,
    MODVAMP3Label: '',
    ENV2L1: 0,
    ENV2L1Label: '',
    ENV2R2: 0,
    ENV2R2Label: '',
    ENV2L2: 0,
    ENV2L2Label: '',
    ENV2L4: 0,
    ENV2L4Label: '',
    KGMUTE: 0xFF,
    KGMUTELabel: '',
    PFXCHAN: 0,
    PFXCHANLabel: '',
    PFXSLEV: 0,
    PFXSLEVLabel: '',
    Reserved_1: 0,
    Reserved_1Label: '',
    LSI2_ON: 0,
    LSI2_ONLabel: '',
    FLT2GAIN: 0,
    FLT2GAINLabel: '',
    FLT2MODE: 0,
    FLT2MODELabel: '',
    FLT2Q: 0,
    FLT2QLabel: '',
    TONEFREQ: 0,
    TONEFREQLabel: '',
    TONESLOP: 0,
    TONESLOPLabel: '',
    MODVFLT2_1: 0,
    MODVFLT2_1Label: '',
    MODVFLT2_2: 0,
    MODVFLT2_2Label: '',
    MODVFLT2_3: 0,
    MODVFLT2_3Label: '',
    raw: [0xF0, 0x47, 0x00, 0x2C, 0x48, 0x01, 0x00, 0x00, 0x04, 0x05, 0xF7],
    ...overrides,
  } as KeygroupHeader;
}

describe('serializeProgram', () => {
  it('produces valid YAML with format and version', () => {
    const prog = makeProgramHeader();
    const kgs = [makeKeygroupHeader()];

    const yaml = serializeProgram(prog, kgs);

    expect(yaml).toContain('format: s3000xl-program');
    expect(yaml).toContain('version: 1');
    expect(yaml).toContain('name: TestProg');
  });

  it('extracts sample references from keygroup SNAME fields', () => {
    const prog = makeProgramHeader();
    const kg1 = makeKeygroupHeader(['Kick        ', 'Snare       ', '', '']);
    const kg2 = makeKeygroupHeader(['HiHat       ', 'Kick        ', '', '']);

    const yaml = serializeProgram(prog, [kg1, kg2]);
    const deserialized = deserializeProgram(yaml);

    expect(deserialized.sampleReferences).toEqual(['HiHat', 'Kick', 'Snare']);
  });

  it('excludes raw and Label fields from human-readable sections', () => {
    const prog = makeProgramHeader();
    const kgs = [makeKeygroupHeader()];

    const yaml = serializeProgram(prog, kgs);

    // Raw should not appear in the program/keygroups sections
    // (it IS stored as programRaw/keygroupsRaw base64)
    expect(yaml).toContain('programRaw:');
    expect(yaml).toContain('keygroupsRaw:');

    const deserialized = deserializeProgram(yaml);
    expect(deserialized.program).not.toHaveProperty('raw');
    expect(deserialized.program).not.toHaveProperty('PRNAMELabel');
    expect(deserialized.program).toHaveProperty('PRNAME');
  });
});

describe('deserializeProgram', () => {
  it('round-trips through serialize/deserialize', () => {
    const prog = makeProgramHeader();
    const kgs = [makeKeygroupHeader()];

    const yaml = serializeProgram(prog, kgs);
    const result = deserializeProgram(yaml);

    expect(result.format).toBe('s3000xl-program');
    expect(result.version).toBe(1);
    expect(result.name).toBe('TestProg');
    expect(result.keygroupCount).toBe(1);
  });

  it('rejects invalid format', () => {
    const yaml = 'format: wrong\nversion: 1\nprogramRaw: ""\nkeygroupsRaw: []\n';
    expect(() => deserializeProgram(yaml)).toThrow('Invalid program format');
  });

  it('rejects missing programRaw', () => {
    const yaml = 'format: s3000xl-program\nversion: 1\nkeygroupsRaw: []\n';
    expect(() => deserializeProgram(yaml)).toThrow('Missing programRaw');
  });
});

describe('decodeSerializedRaw', () => {
  it('recovers exact raw bytes through base64 round-trip', () => {
    const progRaw = [0xF0, 0x47, 0x00, 0x28, 0x48, 0x01, 0x02, 0x03, 0xF7];
    const kgRaw = [0xF0, 0x47, 0x00, 0x2C, 0x48, 0x01, 0x00, 0x00, 0x04, 0x05, 0xF7];

    const prog = makeProgramHeader({ raw: progRaw });
    const kgs = [makeKeygroupHeader(['Kick        ', '', '', ''], { raw: kgRaw })];

    const yaml = serializeProgram(prog, kgs);
    const deserialized = deserializeProgram(yaml);
    const decoded = decodeSerializedRaw(deserialized);

    expect(decoded.programRaw).toEqual(progRaw);
    expect(decoded.keygroupsRaw).toHaveLength(1);
    expect(decoded.keygroupsRaw[0]).toEqual(kgRaw);
  });

  it('handles multiple keygroups', () => {
    const prog = makeProgramHeader({ GROUPS: 2 });
    const kg1Raw = [1, 2, 3, 4, 5];
    const kg2Raw = [6, 7, 8, 9, 10];
    const kgs = [
      makeKeygroupHeader(['A           ', '', '', ''], { raw: kg1Raw }),
      makeKeygroupHeader(['B           ', '', '', ''], { raw: kg2Raw }),
    ];

    const yaml = serializeProgram(prog, kgs);
    const deserialized = deserializeProgram(yaml);
    const decoded = decodeSerializedRaw(deserialized);

    expect(decoded.keygroupsRaw).toHaveLength(2);
    expect(decoded.keygroupsRaw[0]).toEqual(kg1Raw);
    expect(decoded.keygroupsRaw[1]).toEqual(kg2Raw);
  });
});
