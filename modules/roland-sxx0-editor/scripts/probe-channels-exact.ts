#!/usr/bin/env tsx
/**
 * Focused probe: read MULTI MIDI RX-CH starting at various sub-addresses
 * to understand what the device returns for the channel area.
 *
 * BUG-006 channel decode investigation.
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

async function tryRead(
    input: easymidi.Input,
    output: easymidi.Output,
    deviceId: number,
    address: number[],
    sizeBytes: number,
    label: string,
): Promise<void> {
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
    const addrHex = address.map(x => x.toString(16).padStart(2,'0')).join(' ');

    return new Promise((resolve) => {
        const allNibbles: number[] = [];
        let rjcCount = 0;
        const TIMEOUT = 3000;
        let timer: ReturnType<typeof setTimeout>;

        const cleanup = () => {
            clearTimeout(timer);
            input.removeListener('sysex', handler);
        };
        const finish = () => {
            cleanup();
            const decoded = denibblize(allNibbles);
            const nibHex = allNibbles.map(n => n.toString(16).padStart(2,'0')).join(' ');
            const decHex = decoded.map(b => b.toString(16).padStart(2,'0')).join(' ');
            const decDec = decoded.join(', ');
            console.log(`  [${addrHex}] ${sizeBytes}B  ${label}`);
            if (allNibbles.length > 0) {
                console.log(`    nibbles(${allNibbles.length}): ${nibHex}`);
                console.log(`    decoded(${decoded.length}): hex=[${decHex}]  dec=[${decDec}]`);
            } else {
                console.log(`    (no data, ${rjcCount} RJC)`);
            }
            resolve();
        };

        timer = setTimeout(finish, TIMEOUT);

        const handler = (msg: { bytes: number[] }) => {
            const b = msg.bytes;
            if (b.length < 5 || b[1] !== ROLAND_ID || b[3] !== MODEL_ID) return;
            const cmd = b[4];
            if (cmd === DAT) {
                const payload = b.slice(9, b.length - 2);
                allNibbles.push(...payload);
                output.send('sysex' as never, [0xf0, ROLAND_ID, deviceId, MODEL_ID, ACK, 0xf7] as never);
                clearTimeout(timer);
                timer = setTimeout(finish, TIMEOUT);
            } else if (cmd === EOD) {
                output.send('sysex' as never, [0xf0, ROLAND_ID, deviceId, MODEL_ID, ACK, 0xf7] as never);
                finish();
            } else if (cmd === RJC) {
                rjcCount++;
                console.log(`    [RJC #${rjcCount} for ${label}]`);
                // Stop waiting — RJC means the device rejected this address
                finish();
            }
        };
        input.on('sysex', handler);
        output.send('sysex' as never, rqd as never);
    });
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function main() {
    const deviceId = parseInt(process.argv[2] || '0', 10);
    console.log(`Channel / patch detail probe (device ID ${deviceId})`);

    const pair = await discoverPort(deviceId);
    if (!pair) {
        console.error('No Roland S-series device found');
        process.exit(1);
    }
    console.log(`Device found on ${pair.outputName}\n`);

    const input = new easymidi.Input(pair.inputName);
    const output = new easymidi.Output(pair.outputName);

    try {
        await sleep(300);

        console.log('--- Read CH from 0x20 (2 bytes = includes byte before 0x22) ---');
        await tryRead(input, output, deviceId, [0x00, 0x01, 0x00, 0x20], 2, 'fn-param 0x20, 2B');
        await sleep(300);

        console.log('\n--- Read CH area: 0x22, various sizes ---');
        await tryRead(input, output, deviceId, [0x00, 0x01, 0x00, 0x22], 1, 'fn-param 0x22, 1B');
        await sleep(300);
        await tryRead(input, output, deviceId, [0x00, 0x01, 0x00, 0x22], 2, 'fn-param 0x22, 2B');
        await sleep(300);
        await tryRead(input, output, deviceId, [0x00, 0x01, 0x00, 0x22], 8, 'fn-param 0x22, 8B');
        await sleep(300);

        console.log('\n--- Read PATCH area: 0x32, various sizes ---');
        await tryRead(input, output, deviceId, [0x00, 0x01, 0x00, 0x32], 1, 'fn-param 0x32, 1B');
        await sleep(300);
        await tryRead(input, output, deviceId, [0x00, 0x01, 0x00, 0x32], 8, 'fn-param 0x32, 8B');
        await sleep(300);

        console.log('\n--- Read OUTPUT ASSIGN from Patch 0 params (addr [0x03, 0x66]) ---');
        await tryRead(input, output, deviceId, [0x00, 0x00, 0x03, 0x66], 1, 'patch0 outputAssign');
        await sleep(300);

        console.log('\n--- Read OUTPUT ASSIGN from Patch 2 params (C/D/E expected=3) ---');
        await tryRead(input, output, deviceId, [0x00, 0x00, 0x0b, 0x66], 1, 'patch2 outputAssign (0x00,0x0B=2*4+3=11)');
        await sleep(300);

        console.log('\n--- Read OUTPUT ASSIGN from Patch 3 ---');
        await tryRead(input, output, deviceId, [0x00, 0x00, 0x0f, 0x66], 1, 'patch3 outputAssign (0x00,0x0F=3*4+3=15)');
        await sleep(300);

        console.log('\n--- Read OUTPUT ASSIGN from Patch 4 ---');
        await tryRead(input, output, deviceId, [0x00, 0x00, 0x13, 0x66], 1, 'patch4 outputAssign (0x13=4*4+3=19)');
        await sleep(300);

        console.log('\n--- Read full patch0 end block (03 5a - 03 66, 7 bytes) ---');
        await tryRead(input, output, deviceId, [0x00, 0x00, 0x03, 0x5a], 7, 'patch0 end-params: level(5a),detune(5e),vmix(60),atassign(62),keyassign(64),outputAssign(66)');

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
