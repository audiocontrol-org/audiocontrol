/**
 * Roland JV-1080 Device Support
 *
 * Re-export for package-level access.
 * @packageDocumentation
 */

export type {
    Jv1080Address,
    Jv1080ClientOptions,
    Jv1080Command,
    Jv1080FxParamEvent,
    Jv1080MidiAdapter,
    Jv1080ParameterEvent,
    Jv1080SysexMessage,
} from "./jv1080-types.js";

export { Jv1080Event } from "./jv1080-types.js";

export {
    JV_1080_BASE_SYSTEM,
    JV_1080_BASE_TEMP_PATCH,
    JV_1080_COMMANDS,
    JV_1080_DEFAULT_DEVICE_ID,
    JV_1080_FX_PARAM_COUNT,
    JV_1080_FX_TYPES,
    JV_1080_MODEL_ID,
    JV_1080_SYSTEM_OFFSETS,
    JV_1080_TEMP_PATCH_OFFSETS,
    ROLAND_MANUFACTURER_ID,
    addAddress,
    buildSystemAddress,
    buildTempPatchAddress,
} from "./jv1080-addresses.js";

export {
    buildDt1WriteMessage,
    buildJv1080SysexMessage,
    buildRq1RequestMessage,
    calculateRolandChecksum,
    parseJv1080Dt1ParameterEvent,
    parseJv1080SysexMessage,
} from "./jv1080-messages.js";

export { Jv1080Client } from "./jv1080-client.js";
