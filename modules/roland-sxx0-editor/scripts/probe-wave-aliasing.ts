#!/usr/bin/env npx tsx
/**
 * Test whether odd-segment writes alias to even segments.
 *
 * 1. Write marker 0xAAA to segment 0
 * 2. Read segment 0 — verify marker 0xAAA
 * 3. Write marker 0xBBB to segment 1
 * 4. Read segment 0 — if marker changed to 0xBBB, segments alias
 *
 * Usage: tsx scripts/probe-wave-aliasing.ts [device-id]
 */

import * as easymidi from 'easymidi';

const ROLAND_ID = 0x41;
const MODEL_ID = 0x1E;
const CMD = { RQD: 0x41, DAT: 0x42, ACK: 0x43, EOD: 0x45, ERR: 0x4E, RJC: 0x4F, WSD: 0x40 };
const EXCLUDED_PORTS = [/^IAC /i, /^Network /i, /^virtual/i];
const TIMEOUT = 5000;
const MAX_CHUNK = 128;

function hex(a: number[]): string { return a.map(b => b.toString(16).padStart(2, '0')).join(' '); }
function cs(bytes: number[]): number { return (128 - (bytes.reduce((a, b) => a + b, 0) & 0x7f)) % 128; }
function sizeBytes(n: number): number[] { return [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f]; }

function buildWaveAddress(bank: number, segment: number): number[] {
  const STRIDE = 24576;
  const BANK_OFFSET = 0x20 << 14;
  const offset = bank * BANK_OFFSET + segment * STRIDE;
  return [0x01, (offset >> 14) & 0x7f, (offset >> 7) & 0x7f, offset & 0x7e];
}

function makeMarkerData(m: number, sampleCount: number): number[] {
  const u12 = m & 0xfff;
  const b0 = (u12 >> 5) & 0x7f, b1 = (u12 << 2) & 0x7c;
  const data: number[] = [];
  for (let i = 0; i < sampleCount; i++) data.push(b0, b1);
  return data;
}

function decodeMarker(data: number[]): number {
  if (data.length < 2) return -1;
  return (data[0] << 5) | (data[1] >> 2);
}

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

async function writeToneParams(t: Transport, toneIndex: number, bank: number, segment: number): Promise<boolean> {
  const toneAddr = [0x00, 0x03, (toneIndex * 2) & 0x7e, 0x00];
  const toneData = new Array(256).fill(0);
  const name = `ALIAS   `;
  for (let i = 0; i < 8; i++) toneData[i] = name.charCodeAt(i);
  toneData[12] = 1; toneData[13] = bank; toneData[14] = segment; toneData[15] = 1;
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

async function writeWaveData(t: Transport, addr: number[], data: number[]): Promise<boolean> {
  const size = sizeBytes(data.length);
  const wsdPayload = [...addr, ...size, cs([...addr, ...size])];
  t.output.send('sysex', [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.WSD, ...wsdPayload, 0xf7] as unknown[]);
  const wr = await waitFor(t, c => c === CMD.ACK || c === CMD.RJC || c === CMD.ERR, TIMEOUT);
  if (!wr || wr.cmd !== CMD.ACK) return false;
  const baseOffset = (addr[1] << 14) | (addr[2] << 7) | addr[3];
  let sent = 0;
  while (sent < data.length) {
    const end = Math.min(sent + MAX_CHUNK, data.length);
    const chunk = data.slice(sent, end);
    const co = baseOffset + sent;
    const ca = [addr[0], (co >> 14) & 0x7f, (co >> 7) & 0x7f, co & 0x7f];
    t.output.send('sysex', [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.DAT, ...ca, ...chunk, cs([...ca, ...chunk]), 0xf7] as unknown[]);
    const dr = await waitFor(t, c => c === CMD.ACK || c === CMD.RJC || c === CMD.ERR, TIMEOUT);
    if (!dr || dr.cmd !== CMD.ACK) return false;
    sent = end;
  }
  t.output.send('sysex', [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.EOD, 0xf7] as unknown[]);
  await delay(1000);
  return true;
}

async function readWaveData(t: Transport, addr: number[], byteCount: number): Promise<number[] | null> {
  const size = sizeBytes(byteCount);
  t.output.send('sysex', [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.RQD, ...addr, ...size, cs([...addr, ...size]), 0xf7] as unknown[]);
  const collected: number[] = [];
  for (;;) {
    const r = await waitFor(t, c => [CMD.DAT, CMD.EOD, CMD.RJC, CMD.ERR].includes(c), TIMEOUT);
    if (!r || r.cmd === CMD.RJC || r.cmd === CMD.ERR) return null;
    if (r.cmd === CMD.EOD) break;
    collected.push(...r.bytes.slice(9, r.bytes.length - 2));
    t.output.send('sysex', [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.ACK, 0xf7] as unknown[]);
  }
  return collected;
}

async function main() {
  const deviceId = parseInt(process.argv[2] || '0', 10);
  console.log(`Aliasing test (device ID ${deviceId})\n`);

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

  const MARKER_A = 0xAAA; // 2730
  const MARKER_B = 0xBBB; // 3003
  const SAMPLES = 12000; // one full segment

  // Step 1: Write tone 0 → bank 0, segment 0
  console.log('1. Writing tone 0 params (bank=0 seg=0)...');
  if (!await writeToneParams(t, 0, 0, 0)) { console.log('   FAILED'); process.exit(1); }
  console.log('   ok');

  // Step 2: Write marker 0xAAA to segment 0
  console.log(`2. Writing marker 0x${MARKER_A.toString(16)} to segment 0...`);
  const addr0 = buildWaveAddress(0, 0);
  if (!await writeWaveData(t, addr0, makeMarkerData(MARKER_A, SAMPLES))) { console.log('   FAILED'); process.exit(1); }
  console.log('   ok');

  // Step 3: Read segment 0 — should be 0xAAA
  console.log('3. Reading segment 0...');
  const read1 = await readWaveData(t, addr0, 200);
  if (!read1) { console.log('   READ FAILED'); process.exit(1); }
  const m1 = decodeMarker(read1);
  console.log(`   marker = 0x${m1.toString(16)} (expected 0x${MARKER_A.toString(16)}) ${m1 === MARKER_A ? '✓' : '✗'}`);

  // Step 4: Write tone 1 → bank 0, segment 1
  console.log('4. Writing tone 1 params (bank=0 seg=1)...');
  if (!await writeToneParams(t, 1, 0, 1)) { console.log('   FAILED'); process.exit(1); }
  console.log('   ok');

  // Step 5: Write marker 0xBBB to segment 1
  console.log(`5. Writing marker 0x${MARKER_B.toString(16)} to segment 1...`);
  const addr1 = buildWaveAddress(0, 1);
  console.log(`   addr: ${hex(addr1)}`);
  if (!await writeWaveData(t, addr1, makeMarkerData(MARKER_B, SAMPLES))) { console.log('   FAILED'); process.exit(1); }
  console.log('   ok');

  // Step 6: Read segment 0 again — check if overwritten
  console.log('6. Reading segment 0 again...');
  const read2 = await readWaveData(t, addr0, 200);
  if (!read2) { console.log('   READ FAILED'); process.exit(1); }
  const m2 = decodeMarker(read2);
  console.log(`   marker = 0x${m2.toString(16)}`);

  if (m2 === MARKER_A) {
    console.log('\n   RESULT: Segment 0 UNCHANGED — no aliasing. Odd segments are distinct memory.');
  } else if (m2 === MARKER_B) {
    console.log('\n   RESULT: Segment 0 OVERWRITTEN by segment 1 write — ALIASING confirmed.');
    console.log('   Odd and even segments map to the same physical memory.');
  } else {
    console.log(`\n   RESULT: Segment 0 has unexpected marker 0x${m2.toString(16)} — corrupted or other issue.`);
  }

  // Step 7: Try reading segment 1 directly
  console.log('\n7. Attempting to read segment 1 directly...');
  const read3 = await readWaveData(t, addr1, 200);
  if (read3) {
    const m3 = decodeMarker(read3);
    console.log(`   marker = 0x${m3.toString(16)} (expected 0x${MARKER_B.toString(16)}) ${m3 === MARKER_B ? '✓' : '✗'}`);
  } else {
    console.log('   RJC/timeout (odd segments not readable, as expected)');
  }

  t.input.close();
  t.output.close();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
