import type { ProgramHeader } from '@audiocontrol/sampler-devices/s3k';

/**
 * Build a complete ProgramHeader with safe defaults for all fields.
 * Pass overrides for only the fields relevant to your test.
 *
 * Mirrors the shape of `sample-factory.ts` and `keygroup-factory.ts`
 * so test-side header construction stays uniform across the three
 * device-object types. Every field is explicitly enumerated so the
 * return type satisfies `ProgramHeader` structurally — no `as` cast,
 * no `Partial<>` escape hatch, no `any`. If the upstream
 * `ProgramHeader` interface gains a field, this factory fails to
 * compile until it's added here, which is the desired behavior.
 *
 * Promoted from the in-test factory at
 * test/unit/lib/program-serialization.test.ts during the AUDIT-20260525-26
 * follow-on (chrome-contract regression tests for ProgramEditor /
 * KeygroupEditor / SampleEditor). The in-test factory is unchanged in
 * this dispatch — its `as ProgramHeader` cast is preexisting; flipping
 * it to use this factory is a separate cleanup.
 */
export function makeProgramHeader(
  overrides: Partial<ProgramHeader> = {},
): ProgramHeader {
  const defaults: ProgramHeader = {
    KGRP1: 0, KGRP1Label: '',
    PRNAME: 'TestProg    ', PRNAMELabel: 'Program Name',
    PRGNUM: 0, PRGNUMLabel: 'Program Number',
    PMCHAN: 0, PMCHANLabel: '',
    POLYPH: 15, POLYPHLabel: '',
    PRIORT: 1, PRIORTLabel: '',
    PLAYLO: 21, PLAYLOLabel: '',
    PLAYHI: 127, PLAYHILabel: '',
    OSHIFT: 0, OSHIFTLabel: '',
    OUTPUT: 0, OUTPUTLabel: '',
    STEREO: 99, STEREOLabel: '',
    PANPOS: 0, PANPOSLabel: '',
    PRLOUD: 80, PRLOUDLabel: '',
    V_LOUD: 25, V_LOUDLabel: '',
    K_LOUD: 0, K_LOUDLabel: '',
    P_LOUD: 0, P_LOUDLabel: '',
    PANRAT: 0, PANRATLabel: '',
    PANDEP: 0, PANDEPLabel: '',
    PANDEL: 0, PANDELLabel: '',
    K_PANP: 0, K_PANPLabel: '',
    LFORAT: 50, LFORATLabel: '',
    LFODEP: 0, LFODEPLabel: '',
    LFODEL: 0, LFODELLabel: '',
    MWLDEP: 0, MWLDEPLabel: '',
    PRSDEP: 0, PRSDEPLabel: '',
    VELDEP: 0, VELDEPLabel: '',
    B_PTCH: 2, B_PTCHLabel: '',
    P_PTCH: 0, P_PTCHLabel: '',
    KXFADE: 0, KXFADELabel: '',
    GROUPS: 1, GROUPSLabel: '',
    TPNUM: 0, TPNUMLabel: '',
    TEMPER: '0,0,0,0,0,0,0,0,0,0,0,0', TEMPERLabel: '',
    ECHOUT: 0, ECHOUTLabel: '',
    MW_PAN: 0, MW_PANLabel: '',
    COHERE: 0, COHERELabel: '',
    DESYNC: 0, DESYNCLabel: '',
    PLAW: 0, PLAWLabel: '',
    VASSOQ: 0, VASSOQLabel: '',
    SPLOUD: 0, SPLOUDLabel: '',
    SPATT: 0, SPATTLabel: '',
    SPFILT: 0, SPFILTLabel: '',
    PTUNO: 0, PTUNOLabel: '',
    K_LRAT: 0, K_LRATLabel: '',
    K_LDEP: 0, K_LDEPLabel: '',
    K_LDEL: 0, K_LDELLabel: '',
    VOSCL: 0, VOSCLLabel: '',
    VSSCL: 0, VSSCLLabel: '',
    LEGATO: 0, LEGATOLabel: '',
    B_PTCHD: 2, B_PTCHDLabel: '',
    B_MODE: 0, B_MODELabel: '',
    TRANSPOSE: 0, TRANSPOSELabel: '',
    MODSPAN1: 0, MODSPAN1Label: '',
    MODSPAN2: 0, MODSPAN2Label: '',
    MODSPAN3: 0, MODSPAN3Label: '',
    MODSAMP1: 0, MODSAMP1Label: '',
    MODSAMP2: 0, MODSAMP2Label: '',
    MODSLFOT: 0, MODSLFOTLabel: '',
    MODSLFOL: 0, MODSLFOLLabel: '',
    MODSLFOD: 0, MODSLFODLabel: '',
    MODSFILT1: 0, MODSFILT1Label: '',
    MODSFILT2: 0, MODSFILT2Label: '',
    MODSFILT3: 0, MODSFILT3Label: '',
    MODSPITCH: 0, MODSPITCHLabel: '',
    MODSAMP3: 0, MODSAMP3Label: '',
    MODVPAN1: 0, MODVPAN1Label: '',
    MODVPAN2: 0, MODVPAN2Label: '',
    MODVPAN3: 0, MODVPAN3Label: '',
    MODVAMP1: 0, MODVAMP1Label: '',
    MODVAMP2: 0, MODVAMP2Label: '',
    MODVLFOR: 0, MODVLFORLabel: '',
    MODVLVOL: 0, MODVLVOLLabel: '',
    MODVLFOD: 0, MODVLFODLabel: '',
    LFO1WAVE: 0, LFO1WAVELabel: '',
    LFO2WAVE: 0, LFO2WAVELabel: '',
    MODSLFLT2_1: 0, MODSLFLT2_1Label: '',
    MODSLFLT2_2: 0, MODSLFLT2_2Label: '',
    MODSLFLT2_3: 0, MODSLFLT2_3Label: '',
    LFO2TRIG: 0, LFO2TRIGLabel: '',
    RESERVED_1: 0, RESERVED_1Label: '',
    PORTIME: 0, PORTIMELabel: '',
    PORTYPE: 0, PORTYPELabel: '',
    PORTEN: 0, PORTENLabel: '',
    PFXCHAN: 0, PFXCHANLabel: '',
    raw: [0xF0, 0x47, 0x00, 0x28, 0x48, 0x01, 0x02, 0x03, 0xF7],
  };

  return { ...defaults, ...overrides };
}
