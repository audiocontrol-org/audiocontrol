/**
 * S5000/S6000 MIDI SysEx section codes.
 *
 * @remarks
 * These codes identify different sections in Akai S5000/S6000 MIDI SysEx messages.
 * Each section code corresponds to a specific device function or data type.
 *
 * @internal
 */
enum Section {
  SYSEX_CONFIG = 0x00,
  SYSTEM_SETUP = 0x02,
  MIDI_CONFIG = 0x04,
  KEYGROUP_ZONE = 0x06,
  KEYGROUP = 0x08,
  PROGRAM = 0x0A,
  MULTI = 0x0C,
  SAMPLE_TOOLS = 0x0E,
  DISK_TOOLS = 0x10,
  FX = 0x12,
  SCENLIST = 0x14,
  SONGFILE = 0x16,
  FRONT_PANEL = 0x20,
  ALT_PROGRAM = 0x2A,
  ALT_MULTI = 0x2C,
  ALT_SAMPLE = 0x2E,
  ALT_FX = 0x32
}

/**
 * Device specification defining MIDI parameter structure.
 *
 * @remarks
 * Device specs define how to encode/decode MIDI SysEx messages for specific
 * S5000/S6000 parameters. Each spec includes parameter metadata and encoding rules.
 *
 * @public
 */
export interface DeviceSpec {
  /** Unique name identifying this specification */
  specName: string;
  /** Class name for generated code */
  className: string;
  /** MIDI SysEx section code (see Section enum) */
  sectionCode: number;
  /** Array of parameter specifications (name, type, encoding rules) */
  items: unknown[];
}

/**
 * Program output specification for S5000/S6000.
 *
 * @remarks
 * Defines output parameters including loudness, velocity sensitivity, and modulation routing.
 * Parameters use MIDI SysEx encoding with item codes for get/set operations.
 *
 * Format: [paramName, typeSpec, getCode, getParams, getType, getLength, setCode, setParams]
 * - typeSpec: "number|min|max|step" or "string|maxLength"
 * - getCode: MIDI item code for parameter retrieval
 * - setCode: MIDI item code for parameter setting
 * - getType/setParams: Data type encoding (uint8, int8sign+int8abs, etc.)
 *
 * @public
 */
export const programOutputSpec: DeviceSpec = {
  specName: 'programOutputSpec',
  className: "ProgramOutput",
  sectionCode: Section.PROGRAM,
  items: [
    // | general                                 | set request spec. req data length encoded in length of the spec array
    // | method name root, type spec             | item code, req data, response data type, response data length | item code, [req byte 1 (type | value), ..., req byte n (type | value) ]
    // |                   'number|min|max|step" |
    // |                   'string|max'          |
    ["Loudness", "number|0|100|1", 0x28, [], "uint8", 1, 0x20, ["uint8"]],
    ["VelocitySensitivity", "number|-100|100|1", 0x29, [], "uint8", 1, 0x21, ["int8sign", "int8abs"]],
    ["AmpMod1Source", "number|0|14|1", 0x2A, [1], "uint8", 1, 0x22, [1, "uint8"]],
    ["AmpMod2Source", "number|0|14|1", 0x2A, [2], "uint8", 1, 0x22, [2, "uint8"]],
    ["AmpMod1Value", "number|-100|100|1", 0x2B, [1], "int8", 2, 0x23, [1, "int8sign", "int8abs"]],
    ["AmpMod2Value", "number|-100|100|1", 0x2B, [2], "int8", 2, 0x23, [2, "int8sign", "int8abs"]],
    ["PanMod1Source", "number|0|14|1", 0x2C, [1], "uint8", 1, 0x24, [1, "uint8"]],
    ["PanMod2Source", "number|0|14|1", 0x2C, [2], "uint8", 1, 0x24, [2, "uint8"]],
    ["PanMod3source", "number|0|14|1", 0x2C, [3], "uint8", 1, 0x24, [3, "uint8"]],
    ["PanMod1Value", "number|-100|100|1", 0x2D, [1], "int8", 2, 0x25, [1, "int8sign", "int8abs"]],
    ["PanMod2Value", "number|-100|100|1", 0x2D, [2], "int8", 2, 0x25, [2, "int8sign", "int8abs"]],
    ["PanMod3Value", "number|-100|100|1", 0x2D, [3], "int8", 2, 0x25, [3, "int8sign", "int8abs"]],
  ]
};

/**
 * Program MIDI tune specification for S5000/S6000.
 *
 * @remarks
 * Defines tuning parameters including semitone/fine tune, tune templates, and key selection.
 * All parameters use standard MIDI SysEx encoding.
 *
 * @public
 */
export const programMidTuneSpec: DeviceSpec = {
  specName: 'programMidTuneSpec',
  className: "ProgramMidiTune",
  sectionCode: Section.PROGRAM,
  items: [
    ["SemitoneTune", "number|-36|36|1", 0x38, [], "int8", 2, 0x30, ["int8sign", "int8abs"]],
    ["FineTune", "number|-50|50|1", 0x39, [], "int8", 2, 0x31, ["int8sign", "int8abs"]],
    ["TuneTemplate", "number|0|7|1", 0x3A, [], 'uint8', 1, 0x32, ["uint8"]],
    ["Key", "number|0|11|1", 0x3C, [], 'uint8', 1, 0x34, ["uint8"]],
  ]
};

/**
 * Program pitch bend specification for S5000/S6000.
 *
 * @remarks
 * Defines pitch bend parameters including bend range, aftertouch, legato, and portamento settings.
 *
 * @public
 */
export const programPitchBendSpec: DeviceSpec = {
  specName: 'programPitchBendSpec',
  className: "ProgramPitchBend",
  sectionCode: Section.PROGRAM,
  items: [
    ["PitchBendUp", "number|0|24|1", 0x48, [], "uint8", 1, 0x40, ["uint8"]],
    ["PitchBendDown", "number|0|24|1", 0x49, [], "uint8", 1, 0x41, ["uint8"]],
    ["BendMode", "number|0|1|1", 0x4A, [], "uint8", 1, 0x42, ["uint8"]],
    ["AftertouchValue", "number|-12|12|1", 0x4B, [], "int8", 2, 0x43, ["int8sign", "int8abs"]],
    ["LegatoEnable", "number|0|1|1", 0x4C, [], "uint8", 1, 0x44, ["uint8"]],
    ["PortamentoEnable", "number|0|1|1", 0x4D, [], "uint8", 1, 0x45, ["uint8"]],
    ["PortamentoMode", "number|0|1|1", 0x4E, [], "uint8", 1, 0x46, ["uint8"]],
    ["PortamentoTime", "number|0|100|1", 0x4F, [], "uint8", 1, 0x47, ["uint8"]],
  ]
};

/**
 * Program LFO specification for S5000/S6000.
 *
 * @remarks
 * Defines LFO1 and LFO2 parameters including rate, delay, depth, waveform, and modulation routing.
 * Each LFO has independent settings with shared parameter structure.
 *
 * @public
 */
export const programLfosSpec: DeviceSpec = {
  specName: 'programLfosSpec',
  className: "ProgramLfos",
  sectionCode: Section.PROGRAM,
  items: [
    ["Lfo1Rate", "number|0|100|1", 0x60, [1], "uint8", 1, 0x50, [1, "uint8"]],
    ["Lfo2Rate", "number|0|100|1", 0x60, [2], "uint8", 1, 0x50, [2, "uint8"]],
    ["Lfo1Delay", "number|0|100|1", 0x61, [1], "uint8", 1, 0x51, [1, "uint8"]],
    ["Lfo2Delay", "number|0|100|1", 0x61, [2], "uint8", 1, 0x51, [2, "uint8"]],
    ["Lfo1Depth", "number|0|100|1", 0x62, [1], "uint8", 1, 0x52, [1, "uint8"]],
    ["Lfo2Depth", "number|0|100|1", 0x62, [2], "uint8", 1, 0x52, [2, "uint8"]],
    ["Lfo1Waveform", "number|0|8|1", 0x63, [1], "uint8", 1, 0x53, [1, "uint8"]],
    ["Lfo2Waveform", "number|0|8|1", 0x63, [2], "uint8", 1, 0x53, [2, "uint8"]],
    ["Lfo1Sync", "number|0|1|1", 0x64, [1], "uint8", 1, 0x54, [1, "uint8"]],
    ["Lfo2Retrigger", "number|0|1|1", 0x65, [2], "uint8", 2, 0x55, [2, "uint8"]],
    ["Lfo1RateModSource", "number|0|14|1", 0x66, [1], "uint8", 1, 0x56, [1, "uint8"]]
  ]
};

/**
 * Get all device specifications.
 *
 * @remarks
 * Returns array of all defined device specs for S5000/S6000 MIDI parameter handling.
 * Used for code generation and MIDI message encoding/decoding.
 *
 * @returns Array of all device specifications
 *
 * @public
 */
export function getDeviceSpecs(): DeviceSpec[] {
  return [
    programOutputSpec,
    programMidTuneSpec,
    programPitchBendSpec,
    programLfosSpec
  ];
}
