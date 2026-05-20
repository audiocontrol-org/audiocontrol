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
 * Scenario definitions live in `record-fixtures-roland-scenarios.ts`
 * (sister file) so each side stays under the 300-500 line file cap as
 * Wave 2a / Wave 2c add patch + tone setter scenarios.
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
import {
    SCENARIOS,
    listScenarios,
    type ScenarioContext,
} from '#node/lib/record-fixtures-roland-scenarios.js';

export { listScenarios };

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
    .map((s) => `  ${s.name.padEnd(24)} ${s.description}`)
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
