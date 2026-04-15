import type { SampleHeader } from '@audiocontrol/sampler-devices/s3k';

/**
 * Build a complete SampleHeader with safe defaults for all fields.
 * Pass overrides for only the fields relevant to your test.
 */
export function makeSampleHeader(
  overrides: Partial<SampleHeader> = {},
): SampleHeader {
  const defaults: SampleHeader = {
    SHIDENT: 3, SHIDENTLabel: '',
    SBANDW: 1, SBANDWLabel: '',
    SPITCH: 60, SPITCHLabel: '',
    SHNAME: 'TEST SAMPLE ', SHNAMELabel: '',
    SSRVLD: 128, SSRVLDLabel: '',
    SLOOPS: 1, SLOOPSLabel: '',
    SALOOP: 0, SALOOPLabel: '',
    SHLOOP: 0, SHLOOPLabel: '',
    SPTYPE: 0, SPTYPELabel: '',
    STUNO: 0, STUNOLabel: '',
    SLOCAT: 0, SLOCATLabel: '',
    SLNGTH: 44100, SLNGTHLabel: '',
    SSTART: 0, SSTARTLabel: '',
    SMPEND: 44100, SMPENDLabel: '',
    LOOPAT1: 0, LOOPAT1Label: '',
    LLNGTH1: 44100, LLNGTH1Label: '',
    LDWELL1: 9999, LDWELL1Label: '',
    LOOPAT2: 0, LOOPAT2Label: '',
    LLNGTH2: 0, LLNGTH2Label: '',
    LDWELL2: 0, LDWELL2Label: '',
    LOOPAT3: 0, LOOPAT3Label: '',
    LLNGTH3: 0, LLNGTH3Label: '',
    LDWELL3: 0, LDWELL3Label: '',
    LOOPAT4: 0, LOOPAT4Label: '',
    LLNGTH4: 0, LLNGTH4Label: '',
    LDWELL4: 0, LDWELL4Label: '',
    SLXY1: 0, SLXY1Label: '',
    SLXY2: 0, SLXY2Label: '',
    SLXY3: 0, SLXY3Label: '',
    SLXY4: 0, SLXY4Label: '',
    SSPARE: 0, SSPARELabel: '',
    SWCOMM: 0, SWCOMMLabel: '',
    SSPAIR: 0, SSPAIRLabel: '',
    SSRATE: 44100, SSRATELabel: '',
    SHLTO: 0, SHLTOLabel: '',
    raw: [],
  };

  return { ...defaults, ...overrides };
}
