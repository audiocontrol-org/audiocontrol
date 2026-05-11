#!/usr/bin/env tsx
/**
 * record-fixtures-roland — capture SSeriesMidiAdapter byte-level fixtures.
 *
 * Drives the real Roland S-330 / S-550 via easymidi, records every byte
 * exchanged through the SSeriesMidiAdapter boundary into a NDJSON
 * `FixtureScenario`, and writes it to disk. The captured fixture is then
 * replayable through `SimulatedAdapter` so the editor's UI tests can run
 * in CI without hardware.
 *
 * Usage:
 *   tsx record-fixtures-roland.ts \
 *     --device s550 \
 *     --scenario load-everything \
 *     --output modules/sampler-devices/test/fixtures/s550/load-everything.ndjson \
 *     [--midi-name '828mk3 Hybrid MIDI Port'] \
 *     [--device-id 0]
 *
 * Run via `make record-fixtures-roland-s550` for the standard scenario
 * matrix.
 *
 * @packageDocumentation
 */

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as easymidi from 'easymidi';
import { createS550Client } from '@audiocontrol/sampler-devices/s550';
import { createS330Client } from '@audiocontrol/sampler-devices/s330';
import {
    RecordingProxyAdapter,
    serializeFixture,
    type FixtureDevice,
} from '@audiocontrol/sampler-devices/recording';
import {
    createEasymidiSSeriesAdapter,
    findMidiPort,
} from '#node/lib/easymidi-s-series-adapter.js';

// ---------------------------------------------------------------------------
// Scenario registry
// ---------------------------------------------------------------------------

interface ScenarioContext {
    device: FixtureDevice;
    deviceId: number;
    proxy: RecordingProxyAdapter;
    /**
     * Either an `S550ClientInterface` or `S330ClientInterface`; both
     * structurally implement the same operations the scenarios need. We
     * keep the type as `unknown` here and let scenario implementations
     * narrow with the device-specific client type.
     */
    client: unknown;
}

type ScenarioFn = (ctx: ScenarioContext) => Promise<void>;

interface Scenario {
    name: string;
    description: string;
    run: ScenarioFn;
}

const SCENARIOS: Record<string, Scenario> = {
    'connect-only': {
        name: 'connect-only',
        description: 'Open MIDI, request system params, disconnect — minimal fixture',
        run: async ({ client, proxy }) => {
            const c = client as { connect: () => Promise<boolean> };
            proxy.annotate('connect()');
            const ok = await c.connect();
            if (!ok) throw new Error('connect-only: client.connect() returned false');
        },
    },

    'load-everything': {
        name: 'load-everything',
        description: 'Connect + load all patches + load all tones (mirrors editor startup)',
        run: async ({ client, device, proxy }) => {
            const c = client as {
                connect: () => Promise<boolean>;
                loadPatchRange: (start: number, count: number) => Promise<unknown[]>;
                loadToneRange: (start: number, count: number) => Promise<unknown[]>;
            };
            proxy.annotate('connect()');
            await c.connect();

            const patchCount = device === 's550' ? 32 : 64;
            const toneCount = device === 's550' ? 64 : 32;

            proxy.annotate(`loadPatchRange(0, ${patchCount})`);
            await c.loadPatchRange(0, patchCount);

            proxy.annotate(`loadToneRange(0, ${toneCount})`);
            await c.loadToneRange(0, toneCount);
        },
    },

    'fetch-patch-0': {
        name: 'fetch-patch-0',
        description: 'Read a single patch (for unit-scale fixture testing)',
        run: async ({ client, proxy }) => {
            const c = client as {
                connect: () => Promise<boolean>;
                requestPatchData: (idx: number) => Promise<unknown | null>;
            };
            proxy.annotate('connect()');
            await c.connect();
            proxy.annotate('requestPatchData(0)');
            await c.requestPatchData(0);
        },
    },

    'fetch-tone-0': {
        name: 'fetch-tone-0',
        description: 'Read a single tone',
        run: async ({ client, proxy }) => {
            const c = client as {
                connect: () => Promise<boolean>;
                requestToneData: (idx: number) => Promise<unknown | null>;
            };
            proxy.annotate('connect()');
            await c.connect();
            proxy.annotate('requestToneData(0)');
            await c.requestToneData(0);
        },
    },

    // Page-shaped scenarios — capture the SysEx sequence each editor page
    // emits on mount, so the harness can replay it deterministically.
    // See GitHub #404; both S-330 and S-550 use 8 patches/tones per bank.

    'patches-bank-0': {
        name: 'patches-bank-0',
        description: 'PatchesPage.loadPatchBank(0) — connect() + loadPatchRange(0, 8)',
        run: async ({ client, proxy }) => {
            const c = client as {
                connect: () => Promise<boolean>;
                loadPatchRange: (start: number, count: number) => Promise<unknown[]>;
            };
            proxy.annotate('connect()');
            await c.connect();
            proxy.annotate('loadPatchRange(0, 8)');
            await c.loadPatchRange(0, 8);
        },
    },

    'tones-bank-0': {
        name: 'tones-bank-0',
        description: 'TonesPage.loadToneBank(0) — connect() + loadToneRange(0, 8)',
        run: async ({ client, proxy }) => {
            const c = client as {
                connect: () => Promise<boolean>;
                loadToneRange: (start: number, count: number) => Promise<unknown[]>;
            };
            proxy.annotate('connect()');
            await c.connect();
            proxy.annotate('loadToneRange(0, 8)');
            await c.loadToneRange(0, 8);
        },
    },

    'play-init': {
        name: 'play-init',
        description: 'PlayPage initial load — connect() + loadPatchRange(0, 8) + requestFunctionParameters()',
        run: async ({ client, proxy }) => {
            const c = client as {
                connect: () => Promise<boolean>;
                loadPatchRange: (start: number, count: number) => Promise<unknown[]>;
                requestFunctionParameters: () => Promise<unknown[]>;
            };
            proxy.annotate('connect()');
            await c.connect();
            proxy.annotate('loadPatchRange(0, 8)');
            await c.loadPatchRange(0, 8);
            proxy.annotate('requestFunctionParameters()');
            await c.requestFunctionParameters();
        },
    },

    // Multi-mode write scenarios — PlayPage mount sequence plus one setter
    // call each. Driven from the UI in Wave 2b's capability spec to assert
    // each affordance emits the captured outbound byte sequence. See
    // ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md rows D-PLAY-04..07.

    'multi-part-0-channel': {
        name: 'multi-part-0-channel',
        description: 'PlayPage init + setMultiChannel(0, 5) — D-PLAY-04',
        run: async ({ client, proxy }) => {
            const c = client as {
                connect: () => Promise<boolean>;
                loadPatchRange: (start: number, count: number) => Promise<unknown[]>;
                requestFunctionParameters: () => Promise<unknown[]>;
                setMultiChannel: (part: number, channel: number) => Promise<void>;
            };
            proxy.annotate('connect()');
            await c.connect();
            proxy.annotate('loadPatchRange(0, 8)');
            await c.loadPatchRange(0, 8);
            proxy.annotate('requestFunctionParameters()');
            await c.requestFunctionParameters();
            proxy.annotate('setMultiChannel(0, 5)');
            await c.setMultiChannel(0, 5);
        },
    },

    'multi-part-0-patch': {
        name: 'multi-part-0-patch',
        description: 'PlayPage init + setMultiPatch(0, 3) — D-PLAY-05',
        run: async ({ client, proxy }) => {
            const c = client as {
                connect: () => Promise<boolean>;
                loadPatchRange: (start: number, count: number) => Promise<unknown[]>;
                requestFunctionParameters: () => Promise<unknown[]>;
                setMultiPatch: (part: number, patchIndex: number | null) => Promise<void>;
            };
            proxy.annotate('connect()');
            await c.connect();
            proxy.annotate('loadPatchRange(0, 8)');
            await c.loadPatchRange(0, 8);
            proxy.annotate('requestFunctionParameters()');
            await c.requestFunctionParameters();
            proxy.annotate('setMultiPatch(0, 3)');
            await c.setMultiPatch(0, 3);
        },
    },

    'multi-part-0-output': {
        name: 'multi-part-0-output',
        description: 'PlayPage init + setMultiOutput(0, 4) — D-PLAY-06',
        run: async ({ client, proxy }) => {
            const c = client as {
                connect: () => Promise<boolean>;
                loadPatchRange: (start: number, count: number) => Promise<unknown[]>;
                requestFunctionParameters: () => Promise<unknown[]>;
                setMultiOutput: (part: number, output: number) => Promise<void>;
            };
            proxy.annotate('connect()');
            await c.connect();
            proxy.annotate('loadPatchRange(0, 8)');
            await c.loadPatchRange(0, 8);
            proxy.annotate('requestFunctionParameters()');
            await c.requestFunctionParameters();
            proxy.annotate('setMultiOutput(0, 4)');
            await c.setMultiOutput(0, 4);
        },
    },

    'multi-part-0-level': {
        name: 'multi-part-0-level',
        description: 'PlayPage init + setMultiLevel(0, 80) — D-PLAY-07',
        run: async ({ client, proxy }) => {
            const c = client as {
                connect: () => Promise<boolean>;
                loadPatchRange: (start: number, count: number) => Promise<unknown[]>;
                requestFunctionParameters: () => Promise<unknown[]>;
                setMultiLevel: (part: number, level: number) => Promise<void>;
            };
            proxy.annotate('connect()');
            await c.connect();
            proxy.annotate('loadPatchRange(0, 8)');
            await c.loadPatchRange(0, 8);
            proxy.annotate('requestFunctionParameters()');
            await c.requestFunctionParameters();
            proxy.annotate('setMultiLevel(0, 80)');
            await c.setMultiLevel(0, 80);
        },
    },
};

export function listScenarios(): string[] {
    return Object.keys(SCENARIOS);
}

// ---------------------------------------------------------------------------
// CLI driver
// ---------------------------------------------------------------------------

interface CliArgs {
    device: FixtureDevice;
    scenario: string;
    output: string;
    midiName: string;
    deviceId: number;
    listPorts: boolean;
    listScenarios: boolean;
}

function parseArgs(argv: string[]): CliArgs {
    const args: Partial<CliArgs> = {
        midiName: process.env.MIDI_DEVICE_NAME ?? '828mk3 Hybrid MIDI Port',
        deviceId: 0,
        listPorts: false,
        listScenarios: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const flag = argv[i];
        const next = (): string => {
            const v = argv[++i];
            if (v === undefined) throw new Error(`flag ${flag} requires a value`);
            return v;
        };
        switch (flag) {
            case '--device':
                args.device = next() as FixtureDevice;
                break;
            case '--scenario':
                args.scenario = next();
                break;
            case '--output':
                args.output = next();
                break;
            case '--midi-name':
                args.midiName = next();
                break;
            case '--device-id':
                args.deviceId = parseInt(next(), 10);
                break;
            case '--list-ports':
                args.listPorts = true;
                break;
            case '--list-scenarios':
                args.listScenarios = true;
                break;
            case '-h':
            case '--help':
                printUsage();
                process.exit(0);
            default:
                throw new Error(`unknown flag ${flag}`);
        }
    }

    if (args.listPorts || args.listScenarios) {
        return args as CliArgs;
    }

    if (!args.device) throw new Error('missing --device (s330|s550)');
    if (args.device !== 's330' && args.device !== 's550') {
        throw new Error(`--device must be s330 or s550, got ${String(args.device)}`);
    }
    if (!args.scenario) throw new Error('missing --scenario');
    if (!SCENARIOS[args.scenario]) {
        throw new Error(
            `unknown scenario "${args.scenario}". Available: ${listScenarios().join(', ')}`,
        );
    }
    if (!args.output) throw new Error('missing --output');

    return args as CliArgs;
}

function printUsage(): void {
    process.stdout.write(`record-fixtures-roland — capture S-series byte fixtures

Usage:
  tsx record-fixtures-roland.ts --device <s330|s550> --scenario <name> --output <path>
                                [--midi-name <name>] [--device-id <0-15>]
  tsx record-fixtures-roland.ts --list-ports
  tsx record-fixtures-roland.ts --list-scenarios

Scenarios:
${Object.values(SCENARIOS)
    .map((s) => `  ${s.name.padEnd(20)} ${s.description}`)
    .join('\n')}

Environment:
  MIDI_DEVICE_NAME    Default MIDI port name (used if --midi-name omitted)
`);
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));

    if (args.listPorts) {
        printPorts();
        return;
    }

    if (args.listScenarios) {
        for (const s of Object.values(SCENARIOS)) {
            process.stdout.write(`${s.name}: ${s.description}\n`);
        }
        return;
    }

    await runScenario(args);
}

function printPorts(): void {
    const inputs = easymidi.getInputs();
    const outputs = easymidi.getOutputs();
    process.stdout.write('Inputs:\n');
    for (const p of inputs) process.stdout.write(`  ${p}\n`);
    process.stdout.write('Outputs:\n');
    for (const p of outputs) process.stdout.write(`  ${p}\n`);
}

async function runScenario(args: CliArgs): Promise<void> {
    const inputName = findMidiPort(easymidi.getInputs(), args.midiName);
    const outputName = findMidiPort(easymidi.getOutputs(), args.midiName);

    if (!inputName || !outputName) {
        throw new Error(
            `MIDI port matching "${args.midiName}" not found. Run --list-ports for available ports.`,
        );
    }

    process.stdout.write(`MIDI input  : ${inputName}\n`);
    process.stdout.write(`MIDI output : ${outputName}\n`);
    process.stdout.write(`Device      : ${args.device} (id ${args.deviceId})\n`);
    process.stdout.write(`Scenario    : ${args.scenario}\n`);
    process.stdout.write(`Output      : ${args.output}\n\n`);

    const input = new easymidi.Input(inputName);
    const output = new easymidi.Output(outputName);

    try {
        const realAdapter = createEasymidiSSeriesAdapter(input, output);
        const proxy = new RecordingProxyAdapter(realAdapter, {
            scenarioName: args.scenario,
            device: args.device,
            deviceId: args.deviceId,
            description: SCENARIOS[args.scenario].description,
        });

        const client =
            args.device === 's550'
                ? createS550Client(proxy, { deviceId: args.deviceId })
                : createS330Client(proxy, { deviceId: args.deviceId });

        const ctx: ScenarioContext = {
            device: args.device,
            deviceId: args.deviceId,
            proxy,
            client,
        };

        const startedAt = Date.now();
        await SCENARIOS[args.scenario].run(ctx);
        const durationMs = Date.now() - startedAt;

        const scenario = proxy.getScenario();
        process.stdout.write(
            `Captured ${scenario.records.length} records in ${durationMs}ms.\n`,
        );

        const outDir = path.dirname(args.output);
        await fs.mkdir(outDir, { recursive: true });
        await fs.writeFile(args.output, serializeFixture(scenario), 'utf8');
        process.stdout.write(`Wrote ${args.output}\n`);

        proxy.detach();
    } finally {
        try {
            input.close();
        } catch {
            /* ignore */
        }
        try {
            output.close();
        } catch {
            /* ignore */
        }
    }
}

// Only run when executed directly (allow import for tests).
if (process.argv[1] && process.argv[1].endsWith('record-fixtures-roland.ts')) {
    main().catch((err) => {
        process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
    });
}
