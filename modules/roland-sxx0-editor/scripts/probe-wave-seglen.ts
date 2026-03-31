#!/usr/bin/env npx tsx
/**
 * Test whether segmentLength=3 starting at segment 12 persists.
 * The auto-fit import failed with this exact configuration.
 *
 * Tests:
 *  1. segmentLength=1 at segment 12 (should work — probe confirmed)
 *  2. segmentLength=3 at segment 12 (spans 12,13,14 — 13 is odd)
 *  3. segmentLength=2 at segment 12 (spans 12,13)
 *  4. segmentLength=2 at segment 0 (spans 0,1 — known working baseline)
 *
 * For each: write tone params, read back, check if segmentLength persisted.
 *
 * Usage: tsx scripts/probe-wave-seglen.ts [device-id]
 */

import * as easymidi from 'easymidi';

const ROLAND_ID = 0x41;
const MODEL_ID = 0x1E;
const CMD = { RQD: 0x41, DAT: 0x42, ACK: 0x43, EOD: 0x45, ERR: 0x4E, RJC: 0x4F, WSD: 0x40 };
const EXCLUDED_PORTS = [/^IAC /i, /^Network /i, /^virtual/i];
const TIMEOUT = 5000;

function hex(a: number[]): string { return a.map(b => b.toString(16).padStart(2, '0')).join(' '); }
function cs(bytes: number[]): number { return (128 - (bytes.reduce((a, b) => a + b, 0) & 0x7f)) % 128; }
function sizeBytes(n: number): number[] { return [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]; }

interface Transport { input: easymidi.Input; output: easymidi.Output; deviceId: number }

function waitFor(t: Transport, pred: (cmd: number) => boolean, ms: number): Promise<{ cmd: number; bytes: number[] } | null> {
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; t.input.removeListener('sysex', handler); resolve(null); } }, ms);
    const handler = (msg: { bytes: number[] }) => {
      const b = msg.bytes;
      if (b.length < 5 || b[1] !== ROLAND_ID || b[3] !== MODEL_ID) return;
      if (pred(b[4]) && !done) { done = true; clearTimeout(timer); t.input.removeListener('sysex', handler); resolve({ cmd: b[4], bytes: b }); }
    };
    t.input.on('sysex', handler);
  });
}

const delay = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

async function writeToneParams(
  t: Transport, toneIndex: number, bank: number, segTop: number, segLen: number,
): Promise<boolean> {
  const toneAddr = [0x00, 0x03, (toneIndex * 2) & 0x7e, 0x00];
  const toneData = new Array(256).fill(0);
  const name = `SL${segLen}S${String(segTop).padStart(2, '0')} `;
  for (let i = 0; i < 8; i++) toneData[i] = name.charCodeAt(i);
  toneData[12] = 1; // 30kHz
  toneData[13] = bank;
  toneData[14] = segTop;
  toneData[15] = segLen;

  const nibblized: number[] = [];
  for (const b of toneData) { nibblized.push((b >> 4) & 0x0f, b & 0x0f); }

  const toneSize = sizeBytes(nibblized.length);
  const wsdPayload = [...toneAddr, ...toneSize, cs([...toneAddr, ...toneSize])];
  const wsdMsg = [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.WSD, ...wsdPayload, 0xf7];

  t.output.send('sysex', wsdMsg as unknown[]);
  let wr = await waitFor(t, c => c === CMD.ACK || c === CMD.RJC || c === CMD.ERR, TIMEOUT);
  if (wr && wr.cmd === CMD.RJC) {
    t.output.send('sysex', wsdMsg as unknown[]);
    wr = await waitFor(t, c => c === CMD.ACK || c === CMD.RJC || c === CMD.ERR, TIMEOUT);
  }
  if (!wr || wr.cmd !== CMD.ACK) return false;

  const datPayload = [...toneAddr, ...nibblized, cs([...toneAddr, ...nibblized])];
  t.output.send('sysex', [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.DAT, ...datPayload, 0xf7] as unknown[]);
  const dr = await waitFor(t, c => c === CMD.ACK || c === CMD.RJC || c === CMD.ERR, TIMEOUT);
  if (!dr || dr.cmd !== CMD.ACK) return false;

  t.output.send('sysex', [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.EOD, 0xf7] as unknown[]);
  await delay(500);
  return true;
}

async function readToneParams(t: Transport, toneIndex: number): Promise<{ bank: number; segTop: number; segLen: number } | null> {
  const toneAddr = [0x00, 0x03, (toneIndex * 2) & 0x7e, 0x00];
  // Request 32 nibbles (16 bytes) to get wave allocation fields at bytes 13-15
  const size = sizeBytes(32);
  const rqdPayload = [...toneAddr, ...size, cs([...toneAddr, ...size])];
  t.output.send('sysex', [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.RQD, ...rqdPayload, 0xf7] as unknown[]);

  const collected: number[] = [];
  for (;;) {
    const r = await waitFor(t, c => [CMD.DAT, CMD.EOD, CMD.RJC, CMD.ERR].includes(c), TIMEOUT);
    if (!r || r.cmd === CMD.RJC || r.cmd === CMD.ERR) return null;
    if (r.cmd === CMD.EOD) break;
    collected.push(...r.bytes.slice(9, r.bytes.length - 2));
    t.output.send('sysex', [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.ACK, 0xf7] as unknown[]);
  }

  // De-nibblize
  const decoded: number[] = [];
  for (let i = 0; i + 1 < collected.length; i += 2) {
    decoded.push((collected[i] << 4) | collected[i + 1]);
  }

  if (decoded.length < 16) return null;
  return { bank: decoded[13], segTop: decoded[14], segLen: decoded[15] };
}

async function main() {
  const deviceId = parseInt(process.argv[2] || '0', 10);
  console.log(`segmentLength persistence test (device ID ${deviceId})\n`);

  // Find device
  const ins = easymidi.getInputs().filter(p => !EXCLUDED_PORTS.some(rx => rx.test(p)));
  const outs = easymidi.getOutputs().filter(p => !EXCLUDED_PORTS.some(rx => rx.test(p)));
  let t: Transport | null = null;
  for (const outName of outs) {
    const inName = ins.find(i => i === outName || i.split(' ')[0] === outName.split(' ')[0]);
    if (!inName) continue;
    const input = new easymidi.Input(inName);
    const output = new easymidi.Output(outName);
    const transport: Transport = { input, output, deviceId };
    const addr = [0x00, 0x00, 0x00, 0x00]; const size = sizeBytes(2);
    const payload = [...addr, ...size, cs([...addr, ...size])];
    output.send('sysex', [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.RQD, ...payload, 0xf7] as unknown[]);
    const resp = await waitFor(transport, c => c === CMD.DAT || c === CMD.EOD || c === CMD.RJC, TIMEOUT);
    if (resp && resp.cmd !== CMD.RJC) {
      if (resp.cmd === CMD.DAT) { output.send('sysex', [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.ACK, 0xf7] as unknown[]); await waitFor(transport, c => c === CMD.EOD, 2000); }
      t = transport; break;
    }
    if (resp?.cmd === CMD.RJC) {
      output.send('sysex', [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.RQD, ...payload, 0xf7] as unknown[]);
      const r2 = await waitFor(transport, c => c === CMD.DAT || c === CMD.EOD || c === CMD.RJC, TIMEOUT);
      if (r2 && r2.cmd !== CMD.RJC) {
        if (r2.cmd === CMD.DAT) { output.send('sysex', [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.ACK, 0xf7] as unknown[]); await waitFor(transport, c => c === CMD.EOD, 2000); }
        t = transport; break;
      }
    }
    input.close(); output.close();
  }
  if (!t) { console.error('No device found'); process.exit(1); }
  console.log('Device found.\n');
  await delay(500);

  const tests = [
    { label: 'seg=0 len=3 (baseline, known working)', toneIdx: 0, bank: 0, segTop: 0, segLen: 3 },
    { label: 'seg=0 len=2 (spans 0,1)', toneIdx: 1, bank: 0, segTop: 0, segLen: 2 },
    { label: 'seg=0 len=1', toneIdx: 2, bank: 0, segTop: 0, segLen: 1 },
    { label: 'seg=12 len=1', toneIdx: 3, bank: 0, segTop: 12, segLen: 1 },
    { label: 'seg=12 len=2 (spans 12,13)', toneIdx: 4, bank: 0, segTop: 12, segLen: 2 },
    { label: 'seg=12 len=3 (spans 12,13,14)', toneIdx: 5, bank: 0, segTop: 12, segLen: 3 },
    { label: 'seg=2 len=1', toneIdx: 6, bank: 0, segTop: 2, segLen: 1 },
    { label: 'seg=2 len=3 (spans 2,3,4)', toneIdx: 7, bank: 0, segTop: 2, segLen: 3 },
    { label: 'seg=1 len=1 (odd segment)', toneIdx: 8, bank: 0, segTop: 1, segLen: 1 },
    { label: 'seg=1 len=2 (odd, spans 1,2)', toneIdx: 9, bank: 0, segTop: 1, segLen: 2 },
  ];

  console.log('Test                                    Write  ReadBack        Persisted?');
  console.log('------------------------------------------------------------------------');

  for (const test of tests) {
    process.stdout.write(`${test.label.padEnd(40)}`);

    const writeOk = await writeToneParams(t, test.toneIdx, test.bank, test.segTop, test.segLen);
    process.stdout.write(writeOk ? 'ok     ' : 'FAIL   ');

    if (writeOk) {
      const readBack = await readToneParams(t, test.toneIdx);
      if (readBack) {
        const match = readBack.segLen === test.segLen && readBack.segTop === test.segTop && readBack.bank === test.bank;
        console.log(`bank=${readBack.bank} seg=${readBack.segTop} len=${readBack.segLen}  ${match ? '✓' : `✗ (expected len=${test.segLen})`}`);
      } else {
        console.log('READ FAIL');
      }
    } else {
      console.log('--');
    }
  }

  t.input.close();
  t.output.close();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
