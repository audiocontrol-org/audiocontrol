/**
 * Recording layer for SSeriesMidiAdapter byte-level event capture.
 *
 * See `phase-0-decoupling.md` in the s550-support feature docs for design.
 */

export {
    SCHEMA_VERSION,
    createScenario,
    appendRecord,
    serializeFixture,
    parseFixture,
} from './fixture-schema.js';

export type {
    FixtureEventKind,
    FixtureDevice,
    FixtureRecord,
    FixtureScenario,
} from './fixture-schema.js';

export { RecordingProxyAdapter } from './recording-proxy.js';

export type {
    ClockFn,
    RecordingProxyAdapterOptions,
} from './recording-proxy.js';

export {
    SimulatedAdapter,
    SimulatedAdapterUnexpectedSendError,
    SimulatedAdapterRecordsExhaustedError,
} from '../simulation/simulated-adapter.js';

export type {
    LatencyMode,
    SimulatedAdapterOptions,
    SimulatedAdapterIntrospection,
} from '../simulation/simulated-adapter.js';
