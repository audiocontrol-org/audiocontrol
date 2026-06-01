#!/usr/bin/env tsx
/**
 * Detailed probe: reads multi-mode function parameters (channels, patches)
 * with raw nibble dumps alongside decoded values, then reads OUTPUT ASSIGN
 * from each patch's parameter block at address [0x03, 0x66].
 *
 * BUG-006 investigation tool.
 *
 * Usage: tsx scripts/probe-multi-detail.ts [device-id]
 */

import * as easymidi from 'easymidi';

const TIMEOUT_MS = 2000;
const ROLAND_ID = 0x41;
const MODEL_ID = 0x1e;
const RQD = 0x41;
const DAT = 0x42;
const ACK = 0x43;
const EOD = 0x45;
const RJC = 0x4f;
const EXCLUDED = [/^IAC /i, /^Network /i, /^virtual/i];

interface PortPair { inputName: string; outputName: string }

async function discoverPort(deviceId: number): Promise<PortPair | null> {
    const ins = easymidi.getInputs().filter(p => !EXCLUDED.some(rx => rx.test(p)));
    const outs = easymidi.getOutputs().filter(p => !EXCLUDED.some(rx => rx.test(p)));

    for (const outName of outs) {
        const inName = ins.find(i => i === outName);
        if (!inName) continue;

        const input = new easymidi.Input(inName);
        const output = new easymidi.Output(outName);
        const addr = [0x00, 0x00, 0x00, 0x00];
        const size = [0x00, 0x00, 0x00, 0x02];
        const sum = addr.reduce((a, b) => a + b, 0) + size.reduce((a, b) => a + b, 0);
        const cs = (128 - (sum & 0x7f)) % 128;
        const probe = [0xf0, ROLAND_ID, deviceId, MODEL_ID, RQD, ...addr, ...size, cs, 0xf7];

        const found = await new Promise<boolean>((resolve) => {
            const timer = setTimeout(() => {
                input.removeListener('sysex', handler);
                resolve(false);
            }, TIMEOUT_MS);
            const handler = (msg: { bytes: number[] }) => {
                const b = msg.bytes;
                if (b.length < 5 || b[1] !== ROLAND_ID || b[3] !== MODEL_ID) return;
                const cmd = b[4];
                if (cmd === DAT || cmd === EOD || cmd === RJC) {
                    clearTimeout(timer);
                    input.removeListener('sysex', handler);
                    if (cmd === DAT) {
                        output.send('sysex', [0xf0, ROLAND_ID, deviceId, MODEL_ID, ACK, 0xf7] as never);
                    }
                    resolve(cmd !== RJC);
                }
            };
            input.on('sysex', handler);
            output.send('sysex', probe as never);
        });

        if (found) return { inputName: inName, outputName: outName };
        input.close();
        output.close();
    }
    return null;
}

function denibblize(nibbles: number[]): number[] {
    const bytes: number[] = [];
    for (let i = 0; i + 1 < nibbles.length; i += 2) {
        bytes.push(((nibbles[i] & 0x0f) << 4) | (nibbles[i + 1] & 0x0f));
    }
    return bytes;
}

async function rawRead(
    input: easymidi.Input,
    output: easymidi.Output,
    deviceId: number,
    address: number[],
    sizeBytes: number,
): Promise<{ nibbles: number[]; bytes: number[] }> {
    const sizeNibbles = sizeBytes * 2;
    const size = [
        (sizeNibbles >> 21) & 0x7f,
        (sizeNibbles >> 14) & 0x7f,
        (sizeNibbles >> 7) & 0x7f,
        sizeNibbles & 0x7f,
    ];
    const sum = address.reduce((a, b) => a + b, 0) + size.reduce((a, b) => a + b, 0);
    const cs = (128 - (sum & 0x7f)) % 128;
    const rqd = [0xf0, ROLAND_ID, deviceId, MODEL_ID, RQD, ...address, ...size, cs, 0xf7];

    return new Promise((resolve, reject) => {
        const allNibbles: number[] = [];
        let timer: ReturnType<typeof setTimeout>;
        const resetTimer = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                input.removeListener('sysex', handler);
                if (allNibbles.length > 0) {
                    resolve({ nibbles: allNibbles, bytes: denibblize(allNibbles) });
                } else {
                    reject(new Error('rawRead timeout — no data'));
                }
            }, 4000);
        };
        const handler = (msg: { bytes: number[] }) => {
            const b = msg.bytes;
            if (b.length < 5 || b[1] !== ROLAND_ID || b[3] !== MODEL_ID) return;
            const cmd = b[4];
            if (cmd === DAT) {
                resetTimer();
                const payload = b.slice(9, b.length - 2);
                allNibbles.push(...payload);
                output.send('sysex' as never, [0xf0, ROLAND_ID, deviceId, MODEL_ID, ACK, 0xf7] as never);
            } else if (cmd === EOD) {
                clearTimeout(timer);
                input.removeListener('sysex', handler);
                output.send('sysex' as never, [0xf0, ROLAND_ID, deviceId, MODEL_ID, ACK, 0xf7] as never);
                resolve({ nibbles: allNibbles, bytes: denibblize(allNibbles) });
            } else if (cmd === RJC) {
                resetTimer();
                console.log('  [RJC received — stale, resetting timer]');
            }
        };
        input.on('sysex', handler);
        resetTimer();
        output.send('sysex' as never, rqd as never);
    });
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function main() {
    const deviceId = parseInt(process.argv[2] || '0', 10);
    console.log(`Multi-mode detailed probe (device ID ${deviceId})`);

    const pair = await discoverPort(deviceId);
    if (!pair) {
        console.error('No Roland S-series device found');
        process.exit(1);
    }
    console.log(`Device found on ${pair.outputName}\n`);

    const input = new easymidi.Input(pair.inputName);
    const output = new easymidi.Output(pair.outputName);

    try {
        const addrLabel = (a: number[]) => a.map(x => x.toString(16).padStart(2, '0')).join(' ');

        // Read MIDI channels at 0x22 (16 nibbles = 8 bytes = 8 decoded values)
        console.log('=== MULTI MIDI RX-CH (00 01 00 22), 8 bytes ===');
        await sleep(600);
        const chAddr = [0x00, 0x01, 0x00, 0x22];
        const chData = await rawRead(input, output, deviceId, chAddr, 8);
        console.log(`  nibbles (${chData.nibbles.length}): ${chData.nibbles.map(n => n.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`  decoded (${chData.bytes.length}): ${chData.bytes.map(n => n.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`  as CH values: ${chData.bytes.join(', ')}`);

        // Read patches at 0x32 (16 nibbles = 8 bytes = 8 decoded values)
        await sleep(200);
        console.log('\n=== MULTI PATCH NUMBER (00 01 00 32), 8 bytes ===');
        const ptAddr = [0x00, 0x01, 0x00, 0x32];
        const ptData = await rawRead(input, output, deviceId, ptAddr, 8);
        console.log(`  nibbles (${ptData.nibbles.length}): ${ptData.nibbles.map(n => n.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`  decoded (${ptData.bytes.length}): ${ptData.bytes.map(n => n.toString(16).padStart(2, '0')).join(' ')}`);
        console.log(`  as patch indices: ${ptData.bytes.join(', ')}`);

        const patchIndices = ptData.bytes;

        // Read OUTPUT ASSIGN for each assigned patch
        // Patch address: [0x00, 0x00, (patchIndex * 4) & 0x7f, 0x00] = full patch block
        // outputAssign is at byte offset 243 in the decoded block, address [0x03, 0x66]
        // We can read just that parameter: address = [0x00, 0x00, (patchIndex*4 + 0x03) & 0x7f, 0x66], 1 byte
        console.log('\n=== OUTPUT ASSIGN per assigned patch (from patch params at [03,66]) ===');
        console.log('Part  PatchIdx  Addr               nibbles   decoded  OutputAssign');
        const parts = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        for (let i = 0; i < 8; i++) {
            const patchIdx = patchIndices[i] ?? 0;
            const byte2 = (patchIdx * 4 + 0x03) & 0x7f;
            const addr = [0x00, 0x00, byte2, 0x66];
            await sleep(150);
            try {
                const result = await rawRead(input, output, deviceId, addr, 1);
                const outputVal = result.bytes[0] ?? 0xff;
                const nibs = result.nibbles.map(n => n.toString(16).padStart(2,'0')).join(' ');
                console.log(`  ${parts[i]}     ${String(patchIdx).padStart(2)}        [${addrLabel(addr)}]   ${nibs.padEnd(8)}  ${result.bytes.map(b => b.toString(16).padStart(2,'0')).join(' ')}   ${outputVal}`);
            } catch (err) {
                console.log(`  ${parts[i]}     ${String(patchIdx).padStart(2)}        [${addrLabel(addr)}]   FAILED: ${err instanceof Error ? err.message : err}`);
            }
        }

        // Also check MULTI LEVEL address area to confirm it's junk
        await sleep(200);
        console.log('\n=== MULTI LEVEL region (00 01 00 56), 8 bytes — expect junk ===');
        const lvlAddr = [0x00, 0x01, 0x00, 0x56];
        try {
            const lvlData = await rawRead(input, output, deviceId, lvlAddr, 8);
            console.log(`  nibbles: ${lvlData.nibbles.map(n => n.toString(16).padStart(2, '0')).join(' ')}`);
            console.log(`  decoded: ${lvlData.bytes.map(n => n.toString(16).padStart(2, '0')).join(' ')}`);
        } catch (err) {
            console.log(`  FAILED: ${err instanceof Error ? err.message : err}`);
        }

        // Check MULTI OUTPUT region (0x42) to confirm it's junk
        await sleep(200);
        console.log('\n=== MULTI OUTPUT region (00 01 00 42), 8 bytes — expect junk ===');
        const outAddr = [0x00, 0x01, 0x00, 0x42];
        try {
            const outData = await rawRead(input, output, deviceId, outAddr, 8);
            console.log(`  nibbles: ${outData.nibbles.map(n => n.toString(16).padStart(2, '0')).join(' ')}`);
            console.log(`  decoded: ${outData.bytes.map(n => n.toString(16).padStart(2, '0')).join(' ')}`);
        } catch (err) {
            console.log(`  FAILED: ${err instanceof Error ? err.message : err}`);
        }

        // Read level from patch params as well: address [0x03, 0x5a] = OUTPUT LEVEL
        console.log('\n=== OUTPUT LEVEL per assigned patch (from patch params at [03,5a]) ===');
        console.log('Part  PatchIdx  Addr               nibbles   decoded  Level');
        for (let i = 0; i < 8; i++) {
            const patchIdx = patchIndices[i] ?? 0;
            const byte2 = (patchIdx * 4 + 0x03) & 0x7f;
            const addr = [0x00, 0x00, byte2, 0x5a];
            await sleep(150);
            try {
                const result = await rawRead(input, output, deviceId, addr, 1);
                const levelVal = result.bytes[0] ?? 0xff;
                const nibs = result.nibbles.map(n => n.toString(16).padStart(2,'0')).join(' ');
                console.log(`  ${parts[i]}     ${String(patchIdx).padStart(2)}        [${addrLabel(addr)}]   ${nibs.padEnd(8)}  ${result.bytes.map(b => b.toString(16).padStart(2,'0')).join(' ')}   ${levelVal}`);
            } catch (err) {
                console.log(`  ${parts[i]}     ${String(patchIdx).padStart(2)}        [${addrLabel(addr)}]   FAILED: ${err instanceof Error ? err.message : err}`);
            }
        }

    } catch (err) {
        console.error('FAILED:', err instanceof Error ? err.message : err);
        process.exit(2);
    } finally {
        input.close();
        output.close();
    }
}

main().catch((err) => {
    console.error('Top-level error:', err);
    process.exit(99);
});
