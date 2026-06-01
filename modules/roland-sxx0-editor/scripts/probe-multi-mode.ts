#!/usr/bin/env tsx
/**
 * Minimal probe: connect to the S-330/S-550 via easymidi, call
 * `requestFunctionParameters()`, print the 8 multi-mode part configs
 * (channel / patchIndex / output / level). Exists to verify the
 * Play page's "Out" column matches the device VFD — BUG-006.
 *
 * Mirrors probe-wave-*.ts: discovers the MIDI port via the same
 * scan as validate-device.ts, opens easymidi I/O, builds the
 * device-appropriate S-series client through an inline adapter,
 * and round-trips the function-parameter region.
 *
 * Usage: tsx scripts/probe-multi-mode.ts [device-id] [s330|s550]
 *
 * Default: device-id=0, device-type=s550.
 */

import * as easymidi from 'easymidi';
import { createS330Client } from '@audiocontrol/sampler-devices/s330';
import { createS550Client } from '@audiocontrol/sampler-devices/s550';
import type { SSeriesMidiAdapter } from '@audiocontrol/sampler-devices/roland-s-series';

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

function buildAdapter(input: easymidi.Input, output: easymidi.Output): SSeriesMidiAdapter {
    const callbackMap = new Map<
        (data: number[]) => void,
        (msg: { bytes: number[] }) => void
    >();

    return {
        send(data: number[]): void {
            if (data.length === 0) {
                throw new Error('adapter.send: empty byte array');
            }
            const status = data[0];
            if (status === 0xf0) {
                output.send('sysex' as never, data as never);
                return;
            }
            const statusNibble = status & 0xf0;
            const channel = status & 0x0f;
            if (statusNibble === 0xb0) {
                if (data.length !== 3) {
                    throw new Error(`adapter.send: CC frame must be 3 bytes, got ${data.length}`);
                }
                output.send('cc' as never, {
                    channel,
                    controller: data[1],
                    value: data[2],
                } as never);
                return;
            }
            throw new Error(`adapter.send: unsupported status byte 0x${status.toString(16)}`);
        },
        onSysEx(callback: (data: number[]) => void): void {
            const wrapped = (msg: { bytes: number[] }) => callback(msg.bytes);
            callbackMap.set(callback, wrapped);
            input.on('sysex', wrapped);
        },
        removeSysExListener(callback: (data: number[]) => void): void {
            const wrapped = callbackMap.get(callback);
            if (wrapped) {
                input.removeListener('sysex', wrapped);
                callbackMap.delete(callback);
            }
        },
    };
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
): Promise<number[]> {
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
                if (allNibbles.length > 0) resolve(denibblize(allNibbles));
                else reject(new Error('rawRead timeout — no data'));
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
                resolve(denibblize(allNibbles));
            } else if (cmd === RJC) {
                resetTimer();
            }
        };
        input.on('sysex', handler);
        resetTimer();
        output.send('sysex' as never, rqd as never);
    });
}

function findPattern(bytes: number[], pattern: number[]): number[] {
    const hits: number[] = [];
    for (let i = 0; i + pattern.length <= bytes.length; i++) {
        let match = true;
        for (let j = 0; j < pattern.length; j++) {
            if (bytes[i + j] !== pattern[j]) { match = false; break; }
        }
        if (match) hits.push(i);
    }
    return hits;
}

function hexDump(bytes: number[], baseOffset: number, perRow: number = 16): string {
    const lines: string[] = [];
    for (let i = 0; i < bytes.length; i += perRow) {
        const offset = (baseOffset + i).toString(16).padStart(4, '0');
        const row = bytes.slice(i, i + perRow);
        const hex = row.map(b => b.toString(16).padStart(2, '0')).join(' ');
        lines.push(`  ${offset}: ${hex}`);
    }
    return lines.join('\n');
}

async function main() {
    const deviceId = parseInt(process.argv[2] || '0', 10);
    const deviceType = (process.argv[3] || 's550').toLowerCase();
    const mode = (process.argv[4] || 'client').toLowerCase();
    console.log(`Multi-mode probe (device ID ${deviceId}, type ${deviceType}, mode ${mode})`);

    const pair = await discoverPort(deviceId);
    if (!pair) {
        console.error('No Roland S-series device found');
        process.exit(1);
    }
    console.log(`Device found on ${pair.outputName}`);

    const input = new easymidi.Input(pair.inputName);
    const output = new easymidi.Output(pair.outputName);

    try {
        if (mode === 'raw' || mode === 'scan') {
            const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

            const offsetsToProbe = [0x00, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0, 0xe0];
            const window = 32;
            const collected: { offset: number; bytes: number[] }[] = [];
            for (const off of offsetsToProbe) {
                await sleep(300);
                const addr = [0x00, 0x01, 0x00, off];
                try {
                    const bytes = await rawRead(input, output, deviceId, addr, window);
                    console.log(`  ${addr.map(a => a.toString(16).padStart(2, '0')).join(' ')}  →  ${bytes.length} bytes`);
                    if (bytes.length > 0) {
                        console.log(hexDump(bytes, off));
                        collected.push({ offset: off, bytes });
                    }
                } catch (err) {
                    console.log(`  ${addr.map(a => a.toString(16).padStart(2, '0')).join(' ')}  →  ${err instanceof Error ? err.message : err}`);
                }
            }

            const targetPattern = [1, 1, 3, 3, 3, 1, 1, 1];
            const ascendingPatch = [0, 1, 2, 3, 4, 5, 6, 7];
            console.log('\n=== Pattern search across all collected bytes ===');
            for (const chunk of collected) {
                const tHits = findPattern(chunk.bytes, targetPattern);
                tHits.forEach(o => console.log(`  VFD outputs pattern at 0x${(chunk.offset + o).toString(16).padStart(2, '0')}`));
                const pHits = findPattern(chunk.bytes, ascendingPatch);
                pHits.forEach(o => console.log(`  Patches 0-7 pattern at 0x${(chunk.offset + o).toString(16).padStart(2, '0')}`));
            }
            return;
        }

        const adapter = buildAdapter(input, output);
        const client = deviceType === 's330'
            ? createS330Client(adapter, { deviceId })
            : createS550Client(adapter, { deviceId });

        console.log('Calling requestFunctionParameters()...');
        const parts = await client.requestFunctionParameters();
        console.log('Success — multi-mode part configs:');
        console.log('Part   CH   Patch   Out   Level');
        const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        parts.forEach((p, i) => {
            const ch = String(p.channel + 1).padStart(2, ' ');
            const patch = String(p.patchIndex).padStart(3, ' ');
            const out = String(p.output).padStart(3, ' ');
            const lvl = String(p.level).padStart(3, ' ');
            console.log(`  ${labels[i]}   ${ch}     ${patch}    ${out}    ${lvl}`);
        });
    } catch (err) {
        console.error('FAILED:', err instanceof Error ? err.message : err);
        if (err instanceof Error && err.stack) {
            console.error(err.stack);
        }
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
