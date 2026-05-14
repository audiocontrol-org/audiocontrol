/**
 * synthesize-tone-fixture — regenerate (or initialize) the outbound
 * `sendToneData` byte sequence for a tone-write fixture by replaying an
 * on-disk prelude + applying the canonical encoder.
 *
 * ## Why this script exists
 *
 * The tone-write fixtures under `test/fixtures/{s330,s550}/` capture a
 * full round-trip: a TonesPage mount (RQD + 8 tones loaded back) followed
 * by a single `sendToneData(0, mutate(tone0))` writeback. The prelude is
 * device-dependent (the bytes the device sends back during load); the
 * writeback is pure encoder output (deterministic given the mutated
 * tone). When the codec changes — e.g., the #408 Phase A dedup of
 * `tvaLfoDepth` / `tva.lfoDepth` — the prelude stays valid but the
 * writeback bytes drift, and a literal hardware re-record is overkill.
 *
 * Two modes:
 *
 *   - **regen** (default): rewrite an EXISTING fixture's writeback in
 *     place using the current encoder + scenario mutation. Prelude stays
 *     verbatim. Used when a codec change drifts the writeback bytes.
 *
 *   - **init** (`--init --from-base <suffix>`): create a NEW fixture
 *     under `<fixturesDir>/<device>/tone-0-<scenario>.ndjson` by copying
 *     the prelude from the base fixture (`tone-0-<from-base>.ndjson` in
 *     the same device subdir) and synthesizing the writeback from the
 *     scenario's mutation. Used when adding a new scenario (e.g. #408
 *     Phase B adding 5 new affordance fixtures) without re-recording
 *     against hardware. The base fixture's prelude is reused because all
 *     tone-write fixtures share the same TonesPage mount sequence — only
 *     the writeback bytes differ per scenario.
 *
 * Both modes replay the prelude in-memory, apply the same scenario-
 * specific mutation that a fresh hardware capture would have applied,
 * encode via the canonical S330/S550 `encodeTone`, and write the
 * outbound portions of the writeback block. The result is byte-identical
 * to what a fresh hardware recording would produce because:
 *
 *   1. The prelude (loadToneRange responses) is preserved verbatim from
 *      the base / target fixture.
 *   2. The mutation is shared (`TONE_WRITE_SCENARIOS` is imported, not
 *      duplicated).
 *   3. The encoder is the same `encodeTone` the production client calls.
 *   4. The framing — WSD/DAT/EOD with sized nibbles + DAT chunk-address
 *      stride — mirrors `sendDataAttempt` in s-series-client.ts (which
 *      is the only authoritative implementation).
 *
 * ## When synthesis is appropriate
 *
 *   - The prelude is already on disk (either in the target fixture for
 *     regen, or in a sibling base fixture for init).
 *   - The codec (or the `mutate` function) is the only thing that changed.
 *   - The new scenario's mutation only changes tone-payload bytes (no
 *     device-side state mutation that would alter subsequent prelude
 *     responses on a fresh capture).
 *
 * ## When synthesis is NOT appropriate
 *
 *   - The device's response sequence (prelude) needs to change. The
 *     prelude bytes are not derivable without hardware — capture a fresh
 *     fixture via the recording infra instead.
 *   - The fixture transitions between scenarios that materially change
 *     device state. Synthesis assumes the prelude is for the SAME tone
 *     index and that `mutate(prelude_tone_0)` is what was originally sent.
 *
 * ## Determinism contract
 *
 * Given an unchanged on-disk prelude (either the target fixture's own or
 * the base fixture in `--init` mode) AND an unchanged `TONE_WRITE_SCENARIOS`
 * entry for the scenario AND an unchanged `encodeTone`, this tool produces
 * byte-identical output across runs. If `--check` reports a diff after no
 * source changes, that's a bug in this script, the scenarios array, or the
 * encoder.
 *
 * ## CLI
 *
 *   tsx scripts/synthesize-tone-fixture.ts \
 *     --scenario <suffix>       \   # e.g., 'tva-lfo-depth'
 *     --device   <s330|s550>    \   # subdirectory under <fixtures-dir> for path lookup;
 *                                   #   default: s330. Device-specific limits are derived
 *                                   #   from the fixture header regardless of this flag.
 *     --fixtures-dir <path>     \   # required; root containing s330/ and s550/ scenario
 *                                   #   subdirs (e.g. test/fixtures)
 *     [--init --from-base <suffix>] # create a NEW fixture under <device>/tone-0-<scenario>
 *                                   #   .ndjson by copying the prelude from <device>/
 *                                   #   tone-0-<from-base>.ndjson. The new fixture's header
 *                                   #   inherits device + deviceId from the base; only
 *                                   #   `name`, `description`, and `capturedAt` are
 *                                   #   updated. Required together with --init.
 *     [--check]                     # exit non-zero if regenerated != on-disk
 *                                   #   (not compatible with --init — there is nothing on
 *                                   #   disk to diff against on first creation)
 *
 * Exit codes:
 *   0  — success (file written, or --check found no diff)
 *   1  — diff detected in --check mode, or invocation/runtime error
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';

import {
    parseFixture,
    serializeFixture,
} from '../src/recording/fixture-schema.js';
import type {
    FixtureRecord,
    FixtureScenario,
} from '../src/recording/fixture-schema.js';
import {
    S_SERIES_COMMANDS,
    nibblize,
    denibblize,
    buildWSDMessage,
    buildDATMessage,
    buildEODMessage,
    parseSeriesTone,
    encodeSeriesTone,
    TONE_OFFSETS,
    TONE_BLOCK_SIZE,
    S330_DEVICE_LIMITS,
    S550_DEVICE_LIMITS,
} from '../src/devices/roland-s-series/index.js';
import type {
    SSeriesBaseTone,
    SSeriesDeviceLimits,
} from '../src/devices/roland-s-series/index.js';
import {
    TONE_WRITE_SCENARIOS,
    type ToneWriteScenarioSpec,
} from '../../e2e-infra/src/node/lib/record-fixtures-roland-tone-scenarios.js';

// ---------------------------------------------------------------------------
// Device limits — imported from the canonical s-series-device-limits.ts so
// this script cannot drift from the production encoders. If a limit changes,
// every consumer (script + s330-params + s550-params + tone factories) picks
// up the update in lockstep.
// ---------------------------------------------------------------------------

function limitsForDevice(device: 's330' | 's550'): SSeriesDeviceLimits {
    return device === 's330' ? S330_DEVICE_LIMITS : S550_DEVICE_LIMITS;
}

// ---------------------------------------------------------------------------
// CLI argument parsing — keep simple; no extra dep on commander/yargs.
// ---------------------------------------------------------------------------

interface CliOptions {
    scenario: string;
    device?: 's330' | 's550';
    fixturesDir: string;
    check: boolean;
    init: boolean;
    fromBase?: string;
}

function parseCliArgs(argv: string[]): CliOptions {
    const args = argv.slice(2);
    let scenario: string | undefined;
    let device: 's330' | 's550' | undefined;
    let fixturesDir: string | undefined;
    let check = false;
    let init = false;
    let fromBase: string | undefined;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--check') {
            check = true;
            continue;
        }
        if (arg === '--init') {
            init = true;
            continue;
        }
        if (arg === '--scenario') {
            scenario = args[++i];
            continue;
        }
        if (arg === '--device') {
            const v = args[++i];
            if (v !== 's330' && v !== 's550') {
                throw new Error(`--device must be 's330' or 's550', got: ${v}`);
            }
            device = v;
            continue;
        }
        if (arg === '--fixtures-dir') {
            fixturesDir = args[++i];
            continue;
        }
        if (arg === '--from-base') {
            fromBase = args[++i];
            continue;
        }
        throw new Error(`unknown argument: ${arg}`);
    }
    if (!scenario) throw new Error('--scenario is required (e.g. --scenario tva-lfo-depth)');
    if (!fixturesDir) throw new Error('--fixtures-dir is required (e.g. --fixtures-dir test/fixtures)');
    if (init && !fromBase) {
        throw new Error('--init requires --from-base <suffix> (the existing fixture whose prelude is reused)');
    }
    if (init && check) {
        throw new Error('--init and --check are mutually exclusive (--init creates the fixture; nothing on disk to diff against)');
    }
    if (fromBase && !init) {
        throw new Error('--from-base only makes sense with --init');
    }
    return { scenario, device, fixturesDir, check, init, fromBase };
}

// ---------------------------------------------------------------------------
// Write-block detection
//
// The write block starts at the LAST outbound record whose 5th byte is the
// WSD command (0x40). Everything before is the prelude (loadToneRange
// responses); everything from that WSD onwards belongs to sendToneData.
// ---------------------------------------------------------------------------

const SYSEX_CMD_BYTE_INDEX = 4;
const SYSEX_HEADER_LENGTH = 5;      // F0 41 dev 1E cmd
const SYSEX_ADDRESS_LENGTH = 4;
const NIBBLES_PER_PACKET = 128;     // matches sendDataAttempt

function findWriteBlockStart(records: readonly FixtureRecord[]): number {
    for (let i = records.length - 1; i >= 0; i--) {
        const r = records[i];
        if (r.kind !== 'outbound') continue;
        if (r.bytes[SYSEX_CMD_BYTE_INDEX] === S_SERIES_COMMANDS.WSD) {
            return i;
        }
    }
    throw new Error('no WSD outbound found — fixture does not contain a sendToneData block');
}

// ---------------------------------------------------------------------------
// Prelude tone extraction
//
// The very first RQD outbound is for tone 0 (loadToneRange starts at index 0).
// The device responds with N inbound DATs followed by an EOD inbound. The
// concatenated DAT payloads (after stripping the 4-byte address header from
// each) are the nibblized tone bytes. De-nibblize and parse to get the
// tone-0 baseline the affordance scenario's `mutate` function ran against.
// ---------------------------------------------------------------------------

function extractTone0FromPrelude(records: readonly FixtureRecord[]): SSeriesBaseTone {
    // Find the first RQD outbound.
    let rqdIndex = -1;
    for (let i = 0; i < records.length; i++) {
        const r = records[i];
        if (r.kind === 'outbound' && r.bytes[SYSEX_CMD_BYTE_INDEX] === S_SERIES_COMMANDS.RQD) {
            rqdIndex = i;
            break;
        }
    }
    if (rqdIndex === -1) {
        throw new Error('no RQD outbound found — fixture does not contain a loadToneRange prelude');
    }

    // Walk forward collecting inbound DATs until we hit an inbound EOD or
    // a non-inbound record. The DAT payload format is documented in
    // s-series-client.ts (requestDataWithAddress): bytes 0-4 are the SysEx
    // header, 5-8 are the 4-byte address, last 2 are checksum + F7.
    const nibbles: number[] = [];
    for (let i = rqdIndex + 1; i < records.length; i++) {
        const r = records[i];
        if (r.kind !== 'inbound') continue;
        const cmd = r.bytes[SYSEX_CMD_BYTE_INDEX];
        if (cmd === S_SERIES_COMMANDS.EOD) {
            break;
        }
        if (cmd !== S_SERIES_COMMANDS.DAT) {
            // Stray inbound (e.g., RJC). Skip but keep walking.
            continue;
        }
        const payloadStart = SYSEX_HEADER_LENGTH + SYSEX_ADDRESS_LENGTH;
        const payloadEnd = r.bytes.length - 2; // strip checksum + F7
        nibbles.push(...r.bytes.slice(payloadStart, payloadEnd));
    }
    if (nibbles.length === 0) {
        throw new Error('no inbound DATs followed the first RQD — prelude does not deliver tone 0');
    }

    const bytes = denibblize(nibbles);
    if (bytes.length < TONE_BLOCK_SIZE) {
        throw new Error(
            `prelude tone-0 payload is ${bytes.length} bytes, expected ${TONE_BLOCK_SIZE}`,
        );
    }
    return parseSeriesTone(bytes.slice(0, TONE_BLOCK_SIZE), TONE_OFFSETS);
}

// ---------------------------------------------------------------------------
// Outbound write-block synthesis
//
// Mirrors sendDataAttempt in s-series-client.ts:
//   - WSD with size encoded in NIBBLES (the `buildWSDMessage` parameter is
//     named `sizeBytes` but is passed through `encodeSize` verbatim;
//     sendDataAttempt passes `nibbled.length`, so this script does too).
//   - 4 DAT packets of 128 nibbles each (256-byte tone → 512 nibbles).
//   - Per-packet address: base[2] advances by 1 per packet, overflow into
//     base[1] (7-bit per byte). base[0]/base[3] unchanged.
//   - Final EOD.
// ---------------------------------------------------------------------------

function buildToneWriteOutbounds(
    deviceId: number,
    baseAddress: readonly number[],
    encodedTone: number[],
): number[][] {
    if (baseAddress.length !== 4) {
        throw new Error(`baseAddress must be 4 bytes, got ${baseAddress.length}`);
    }
    const nibbled = nibblize(encodedTone);
    const out: number[][] = [];

    // WSD — `nibbled.length` parameter aligns with sendDataAttempt's
    // sizeInNibbles. The buildWSDMessage parameter name is "sizeBytes"
    // (a generic misnomer); for WSD/DAT/EOD bulk-write flows the size is
    // in nibbles per the S-series protocol.
    out.push(buildWSDMessage(deviceId, [...baseAddress], nibbled.length));

    // 4 DAT packets.
    for (let offset = 0; offset < nibbled.length; offset += NIBBLES_PER_PACKET) {
        const chunk = nibbled.slice(offset, offset + NIBBLES_PER_PACKET);
        const chunkIndex = offset / NIBBLES_PER_PACKET;
        const linearAddr2 = baseAddress[2] + chunkIndex;
        const packetAddress = [
            baseAddress[0],
            (baseAddress[1] + Math.floor(linearAddr2 / 128)) & 0x7f,
            linearAddr2 & 0x7f,
            baseAddress[3],
        ];
        out.push(buildDATMessage(deviceId, packetAddress, chunk));
    }

    // EOD.
    out.push(buildEODMessage(deviceId));

    return out;
}

// ---------------------------------------------------------------------------
// Splice synthesized outbounds back into the fixture records, preserving
// the inbound ACK records (one per outbound) and the original timestamps.
// ---------------------------------------------------------------------------

function regenerateWriteBlock(
    scenario: FixtureScenario,
    spec: ToneWriteScenarioSpec,
    limits: SSeriesDeviceLimits,
): FixtureScenario {
    const writeBlockStart = findWriteBlockStart(scenario.records);
    const preludeTone = extractTone0FromPrelude(scenario.records.slice(0, writeBlockStart));
    const mutated = spec.mutate(preludeTone);
    const encoded = encodeSeriesTone(mutated, TONE_OFFSETS, TONE_BLOCK_SIZE, limits);

    // Extract the WSD base address from the original WSD record. The
    // original capture's `buildToneAddress(0, 0)` is implicit there;
    // re-deriving it from the WSD record keeps the script device-agnostic.
    const wsdRecord = scenario.records[writeBlockStart];
    const baseAddress = wsdRecord.bytes.slice(
        SYSEX_HEADER_LENGTH,
        SYSEX_HEADER_LENGTH + SYSEX_ADDRESS_LENGTH,
    );
    const newOutbounds = buildToneWriteOutbounds(scenario.deviceId, baseAddress, encoded);

    // Walk forward from writeBlockStart, replacing outbound `bytes` arrays
    // in order. Inbound ACKs (and the ACK to EOD) stay verbatim.
    const newRecords: FixtureRecord[] = scenario.records.slice(0, writeBlockStart);
    let outIdx = 0;
    for (let i = writeBlockStart; i < scenario.records.length; i++) {
        const r = scenario.records[i];
        if (r.kind === 'outbound') {
            if (outIdx >= newOutbounds.length) {
                throw new Error(
                    `write block has more outbound records (${i}+) than expected (${newOutbounds.length})`,
                );
            }
            newRecords.push({ ...r, bytes: newOutbounds[outIdx++] });
        } else {
            newRecords.push(r);
        }
    }
    if (outIdx !== newOutbounds.length) {
        throw new Error(
            `write block produced ${outIdx} outbounds but expected ${newOutbounds.length}`,
        );
    }

    return {
        ...scenario,
        records: newRecords,
    };
}

// ---------------------------------------------------------------------------
// Initialize a NEW fixture from a base fixture's prelude.
//
// The base fixture supplies the prelude (loadToneRange responses + their
// outbound RQDs) AND a sample write-block whose timestamps + ACK records
// give us the inbound side of the new write-block. Since the write-block
// outbounds get rewritten by `regenerateWriteBlock` against the new
// scenario's mutation, the base fixture's specific writeback bytes don't
// matter — only the structural shape (1 WSD + 4 DAT + 1 EOD + their ACKs)
// is reused. The scenario header (`name`, `description`, `capturedAt`) is
// updated to reflect the new fixture's identity.
// ---------------------------------------------------------------------------

function initFromBase(
    baseScenario: FixtureScenario,
    spec: ToneWriteScenarioSpec,
    limits: SSeriesDeviceLimits,
): FixtureScenario {
    const initialized: FixtureScenario = {
        ...baseScenario,
        name: `tone-0-${spec.suffix}`,
        description: `TonesPage init + sendToneData(0, tone with ${spec.label}) — ${spec.detail}`,
        capturedAt: new Date().toISOString(),
        // Deep-clone records so the regenerate pass below doesn't mutate
        // the base fixture's in-memory representation by accident.
        records: baseScenario.records.map((r) => ({ ...r, bytes: [...r.bytes] })),
    };
    // The new fixture's write-block outbounds are immediately rewritten
    // against the new scenario's mutation. The inbound ACK records (one
    // per outbound) are preserved verbatim from the base fixture because
    // they're identical across all sendToneData captures sharing the
    // same prelude — the device ACK contents don't depend on the tone
    // payload's value, only on the WSD/DAT/EOD framing being correct.
    return regenerateWriteBlock(initialized, spec, limits);
}

// ---------------------------------------------------------------------------
// Byte-level diff for --check mode
// ---------------------------------------------------------------------------

interface RecordDiff {
    sequence: number;
    kind: string;
    before: number[];
    after: number[];
}

function diffRecords(
    before: readonly FixtureRecord[],
    after: readonly FixtureRecord[],
): RecordDiff[] {
    const diffs: RecordDiff[] = [];
    const len = Math.max(before.length, after.length);
    for (let i = 0; i < len; i++) {
        const b = before[i];
        const a = after[i];
        if (!b || !a) {
            diffs.push({
                sequence: i,
                kind: 'length-mismatch',
                before: b?.bytes ?? [],
                after: a?.bytes ?? [],
            });
            continue;
        }
        if (b.bytes.length !== a.bytes.length || b.bytes.some((byte, j) => byte !== a.bytes[j])) {
            diffs.push({ sequence: b.sequence, kind: b.kind, before: b.bytes, after: a.bytes });
        }
    }
    return diffs;
}

function summarizeDiff(d: RecordDiff): string {
    const beforeStr = `[${d.before.join(',')}]`;
    const afterStr = `[${d.after.join(',')}]`;
    return `  seq=${d.sequence} (${d.kind})\n    before: ${beforeStr}\n    after:  ${afterStr}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): number {
    const opts = parseCliArgs(process.argv);

    const spec = TONE_WRITE_SCENARIOS.find((s) => s.suffix === opts.scenario);
    if (!spec) {
        throw new Error(
            `unknown scenario suffix '${opts.scenario}'. Known suffixes: ${TONE_WRITE_SCENARIOS.map((s) => s.suffix).join(', ')}`,
        );
    }

    // The fixture path is <fixturesDir>/<device>/tone-0-<suffix>.ndjson
    // We need the device subdirectory; if --device is omitted, fall back to
    // reading the header. To know the device before opening, infer from the
    // CLI or scan both subdirs. The brief specifies `--device` as required
    // CLI; here we treat it as optional with a header fallback by trying
    // the explicit subdir first and erroring if absent.
    const deviceHint = opts.device ?? 's330';
    const fixturePath = resolvePath(
        process.cwd(),
        opts.fixturesDir,
        deviceHint,
        `tone-0-${opts.scenario}.ndjson`,
    );

    if (opts.init) {
        if (opts.fromBase === undefined) {
            // Defensive: parseCliArgs already enforced this pairing.
            throw new Error('--init requires --from-base');
        }
        if (existsSync(fixturePath)) {
            throw new Error(
                `--init refusing to overwrite existing fixture ${fixturePath} — drop --init for regen mode, or delete the file first`,
            );
        }
        const basePath = resolvePath(
            process.cwd(),
            opts.fixturesDir,
            deviceHint,
            `tone-0-${opts.fromBase}.ndjson`,
        );
        const baseSrc = readFileSync(basePath, 'utf8');
        const baseScenario = parseFixture(baseSrc);
        const limits = limitsForDevice(baseScenario.device);
        const created = initFromBase(baseScenario, spec, limits);
        writeFileSync(fixturePath, serializeFixture(created), 'utf8');
        console.log(
            `INIT: ${fixturePath} (${created.records.length} records; prelude copied from ${basePath})`,
        );
        return 0;
    }

    const original = readFileSync(fixturePath, 'utf8');
    const scenario = parseFixture(original);

    // Authoritative device from the header (limits live with the device).
    const limits = limitsForDevice(scenario.device);

    const regenerated = regenerateWriteBlock(scenario, spec, limits);

    if (opts.check) {
        const diffs = diffRecords(scenario.records, regenerated.records);
        if (diffs.length === 0) {
            console.log(`OK: ${fixturePath} — no diff (${scenario.records.length} records)`);
            return 0;
        }
        console.error(`DIFF: ${fixturePath} — ${diffs.length} records differ`);
        for (const d of diffs) {
            console.error(summarizeDiff(d));
        }
        return 1;
    }

    const serialized = serializeFixture(regenerated);
    writeFileSync(fixturePath, serialized, 'utf8');
    console.log(`WROTE: ${fixturePath} (${regenerated.records.length} records)`);
    return 0;
}

try {
    process.exit(main());
} catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`synthesize-tone-fixture: ${message}`);
    process.exit(1);
}
