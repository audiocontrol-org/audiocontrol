import type { Jv1080Address, Jv1080Command } from "./jv1080-types.js";

/**
 * Roland manufacturer identifier.
 */
export const ROLAND_MANUFACTURER_ID = 0x41;

/**
 * Roland JV-1080 model identifier.
 */
export const JV_1080_MODEL_ID = 0x6a;

/**
 * Default Roland device ID used by many units.
 */
export const JV_1080_DEFAULT_DEVICE_ID = 0x10;

/**
 * Command bytes.
 */
export const JV_1080_COMMANDS: Record<"RQ1" | "DT1", Jv1080Command> = {
    RQ1: 0x11,
    DT1: 0x12,
};

/**
 * Base system parameter address.
 */
export const JV_1080_BASE_SYSTEM: Jv1080Address = [0x00, 0x00, 0x00, 0x00];

/**
 * Base temporary patch parameter address.
 */
export const JV_1080_BASE_TEMP_PATCH: Jv1080Address = [0x03, 0x00, 0x00, 0x00];

/**
 * System parameter offsets.
 */
export const JV_1080_SYSTEM_OFFSETS = {
    PANEL_MODE: [0x00, 0x00, 0x00, 0x00] as Jv1080Address,
    PERFORMANCE_NUMBER: [0x00, 0x00, 0x00, 0x01] as Jv1080Address,
    PATCH_GROUP: [0x00, 0x00, 0x00, 0x02] as Jv1080Address,
    PATCH_GROUP_ID: [0x00, 0x00, 0x00, 0x03] as Jv1080Address,
    PATCH_NUMBER: [0x00, 0x00, 0x00, 0x04] as Jv1080Address,
    INSERT_FX_SWITCH: [0x00, 0x00, 0x00, 0x08] as Jv1080Address,
    CHORUS_FX_SWITCH: [0x00, 0x00, 0x00, 0x09] as Jv1080Address,
    REVERB_FX_SWITCH: [0x00, 0x00, 0x00, 0x0a] as Jv1080Address,
    PATCH_REMAIN: [0x00, 0x00, 0x00, 0x0b] as Jv1080Address,
    CLOCK_SOURCE: [0x00, 0x00, 0x00, 0x0c] as Jv1080Address,
} as const;

/**
 * Temporary patch offsets.
 */
export const JV_1080_TEMP_PATCH_OFFSETS = {
    PATCH_NAME: [0x00, 0x00, 0x00, 0x00] as Jv1080Address,
    FX_TYPE: [0x00, 0x00, 0x00, 0x0c] as Jv1080Address,
    FX_PARAM_1: [0x00, 0x00, 0x00, 0x0d] as Jv1080Address,
} as const;

/**
 * Known FX type labels from the legacy implementation.
 */
export const JV_1080_FX_TYPES = [
    "STEREO-EQ",
    "OVERDRIVE",
    "DISTORTION",
    "PHASER",
    "SPECTRUM",
    "ENHANCER",
    "AUTO-WAH",
    "ROTARY",
    "COMPRESSOR",
    "LIMITER",
    "HEXA-CHORUS",
    "TREMOLO-CHORUS",
    "SPACE-D",
    "STEREO-CHORUS",
    "STEREO-FLANGER",
    "STEP-FLANGER",
    "STEREO-DELAY",
    "MODULATION-DELAY",
    "TRIPLE-TAP-DELAY",
    "QUADRUPLE-TAP-DELAY",
    "TIME-CONTROL-DELAY",
    "VOICE-PITCH-SHIFTER",
    "FBK-PITCH-SHIFTER",
    "REVERB",
    "GATE-REVERB",
    "OVERDRIVE->CHORUS",
    "OVERDRIVE->FLANGER",
    "OVERDRIVE->DELAY",
    "DISTORTION->CHORUS",
    "DISTORTION->FLANGER",
    "DISTORTION->DELAY",
    "ENHANCER->CHORUS",
    "ENHANCER->FLANGER",
    "ENHANCER->DELAY",
    "CHORUS->DELAY",
    "FLANGER->DELAY",
    "CHORUS->FLANGER",
    "CHORUS/DELAY",
    "FLANGER/DELAY",
    "CHORUS/FLANGER",
] as const;

/**
 * Number of FX parameter slots tracked by the legacy implementation.
 */
export const JV_1080_FX_PARAM_COUNT = 12;

/**
 * Add two 4-byte addresses together.
 */
export function addAddress(base: Jv1080Address, offset: Jv1080Address): Jv1080Address {
    return base.map((n, i) => n + offset[i]) as Jv1080Address;
}

/**
 * Resolve a system parameter address.
 */
export function buildSystemAddress(offset: Jv1080Address): Jv1080Address {
    return addAddress(JV_1080_BASE_SYSTEM, offset);
}

/**
 * Resolve a temporary patch parameter address.
 */
export function buildTempPatchAddress(offset: Jv1080Address): Jv1080Address {
    return addAddress(JV_1080_BASE_TEMP_PATCH, offset);
}
