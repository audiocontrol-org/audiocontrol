#!/usr/bin/env npx tsx
/**
 * Empirical probe of S-550 wave memory layout.
 *
 * Writes unique identifiable data to every segment on every bank,
 * then reads it all back to map the actual memory layout.
 *
 * WARNING: This overwrites all wave data and tone params on the device.
 *
 * Usage: tsx scripts/probe-wave-memory.ts [device-id]
 */

import * as easymidi from 'easymidi';

const ROLAND_ID = 0x41;
const MODEL_ID = 0x1E;
const CMD = { RQD: 0x41, DAT: 0x42, ACK: 0x43, EOD: 0x45, ERR: 0x4E, RJC: 0x4F, WSD: 0x40 };
const EXCLUDED_PORTS = [/^IAC /i, /^Network /i, /^virtual/i];

const TIMEOUT = 5000;
const MAX_CHUNK = 128;
const SAMPLES_PER_SEGMENT = 12000;
const BYTES_PER_SEGMENT = SAMPLES_PER_SEGMENT * 2; // 24000
const SEGMENTS_PER_BANK = 18;
const MAX_TONES = 64; // S-550 has 64 tone slots
const BANKS_TO_PROBE = [0, 1, 2, 3]; // A, B, C, D

function hex(a: number[]): string {
  return a.map(b => b.toString(16).padStart(2, '0')).join(' ');
}

function cs(bytes: number[]): number {
  return (128 - (bytes.reduce((a, b) => a + b, 0) & 0x7f)) % 128;
}

function sizeBytes(n: number): number[] {
  return [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
}

function buildWaveAddress(bank: number, segment: number): number[] {
  const STRIDE = 24576;
  const BANK_OFFSET = 0x20 << 14; // 524288
  const bankBase = bank * BANK_OFFSET;
  const offset = bankBase + segment * STRIDE;
  return [0x01, (offset >> 14) & 0x7f, (offset >> 7) & 0x7f, offset & 0x7e];
}

// Unique non-zero marker per (bank, segment). Range 1-472, fits in 12 bits.
function marker(bank: number, segment: number): number {
  return bank * 100 + segment + 1;
}

function makeMarkerData(m: number): number[] {
  const u12 = m & 0xfff;
  const b0 = (u12 >> 5) & 0x7f;
  const b1 = (u12 << 2) & 0x7c;
  const data: number[] = [];
  for (let i = 0; i < SAMPLES_PER_SEGMENT; i++) { data.push(b0, b1); }
  return data;
}

function decodeMarker(data: number[]): number {
  if (data.length < 2) return -1;
  return (data[0] << 5) | (data[1] >> 2);
}

interface Transport { input: easymidi.Input; output: easymidi.Output; deviceId: number }

function waitFor(
  t: Transport, pred: (cmd: number) => boolean, ms: number,
): Promise<{ cmd: number; bytes: number[] } | null> {
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) { done = true; t.input.removeListener('sysex', handler); resolve(null); }
    }, ms);
    const handler = (msg: { bytes: number[] }) => {
      const b = msg.bytes;
      if (b.length < 5 || b[1] !== ROLAND_ID || b[3] !== MODEL_ID) return;
      if (pred(b[4]) && !done) {
        done = true; clearTimeout(timer); t.input.removeListener('sysex', handler);
        resolve({ cmd: b[4], bytes: b });
      }
    };
    t.input.on('sysex', handler);
  });
}

const delay = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

// ---- Reusable operations (extracted from working probe-wave-single.ts) ----

async function writeToneParams(
  t: Transport, toneIndex: number, bank: number, segment: number, segmentLength: number,
): Promise<boolean> {
  const toneAddr = [0x00, 0x03, (toneIndex * 2) & 0x7e, 0x00];
  const toneData = new Array(256).fill(0);
  // Name: P{bank}S{seg}
  const name = `P${bank}S${String(segment).padStart(2, '0')}  `;
  for (let i = 0; i < 8; i++) toneData[i] = name.charCodeAt(i);
  toneData[12] = 1; // 30kHz
  toneData[13] = bank;
  toneData[14] = segment;
  toneData[15] = segmentLength;

  const nibblized: number[] = [];
  for (const b of toneData) { nibblized.push((b >> 4) & 0x0f, b & 0x0f); }

  const toneSize = sizeBytes(nibblized.length);
  const wsdPayload = [...toneAddr, ...toneSize, cs([...toneAddr, ...toneSize])];
  const wsdMsg = [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.WSD, ...wsdPayload, 0xf7];

  // Send WSD with stale RJC retry
  t.output.send('sysex', wsdMsg as unknown[]);
  let wr = await waitFor(t, c => c === CMD.ACK || c === CMD.RJC || c === CMD.ERR, TIMEOUT);
  if (wr && wr.cmd === CMD.RJC) {
    // Retry once (stale RJC workaround)
    t.output.send('sysex', wsdMsg as unknown[]);
    wr = await waitFor(t, c => c === CMD.ACK || c === CMD.RJC || c === CMD.ERR, TIMEOUT);
  }
  if (!wr || wr.cmd !== CMD.ACK) return false;

  // Send DAT
  const datPayload = [...toneAddr, ...nibblized, cs([...toneAddr, ...nibblized])];
  const datMsg = [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.DAT, ...datPayload, 0xf7];
  t.output.send('sysex', datMsg as unknown[]);
  const dr = await waitFor(t, c => c === CMD.ACK || c === CMD.RJC || c === CMD.ERR, TIMEOUT);
  if (!dr || dr.cmd !== CMD.ACK) return false;

  // Send EOD
  t.output.send('sysex', [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.EOD, 0xf7] as unknown[]);
  await delay(500);
  return true;
}

async function writeWaveData(
  t: Transport, addr: number[], data: number[],
): Promise<boolean> {
  const size = sizeBytes(data.length);
  const wsdPayload = [...addr, ...size, cs([...addr, ...size])];
  const wsdMsg = [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.WSD, ...wsdPayload, 0xf7];
  t.output.send('sysex', wsdMsg as unknown[]);

  const wr = await waitFor(t, c => c === CMD.ACK || c === CMD.RJC || c === CMD.ERR, TIMEOUT);
  if (!wr || wr.cmd !== CMD.ACK) return false;

  const baseOffset = (addr[1] << 14) | (addr[2] << 7) | addr[3];
  let bytesSent = 0;
  while (bytesSent < data.length) {
    const chunkEnd = Math.min(bytesSent + MAX_CHUNK, data.length);
    const chunk = data.slice(bytesSent, chunkEnd);
    const chunkAddr = baseOffset + bytesSent;
    const chunkAddress = [addr[0], (chunkAddr >> 14) & 0x7f, (chunkAddr >> 7) & 0x7f, chunkAddr & 0x7f];
    const datPayload = [...chunkAddress, ...chunk, cs([...chunkAddress, ...chunk])];
    t.output.send('sysex', [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.DAT, ...datPayload, 0xf7] as unknown[]);

    const dr = await waitFor(t, c => c === CMD.ACK || c === CMD.RJC || c === CMD.ERR, TIMEOUT);
    if (!dr || dr.cmd !== CMD.ACK) return false;
    bytesSent = chunkEnd;
  }

  t.output.send('sysex', [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.EOD, 0xf7] as unknown[]);
  await delay(1000);
  return true;
}

async function readWaveData(t: Transport, addr: number[], byteCount: number): Promise<number[] | null> {
  const size = sizeBytes(byteCount);
  const rqdPayload = [...addr, ...size, cs([...addr, ...size])];
  t.output.send('sysex', [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.RQD, ...rqdPayload, 0xf7] as unknown[]);

  const collected: number[] = [];
  for (;;) {
    const r = await waitFor(t, c => [CMD.DAT, CMD.EOD, CMD.RJC, CMD.ERR].includes(c), TIMEOUT);
    if (!r) return null;
    if (r.cmd === CMD.RJC || r.cmd === CMD.ERR) return null;
    if (r.cmd === CMD.EOD) break;
    collected.push(...r.bytes.slice(9, r.bytes.length - 2));
    t.output.send('sysex', [0xf0, ROLAND_ID, t.deviceId, MODEL_ID, CMD.ACK, 0xf7] as unknown[]);
  }
  return collected;
}

// ---- Main ----

async function main() {
  const deviceId = parseInt(process.argv[2] || '0', 10);
  console.log(`S-550 wave memory probe (device ID ${deviceId})`);
  console.log('WARNING: This overwrites all wave data and tone params.\n');

  // Find device (same as probe-wave-single.ts)
  const ins = easymidi.getInputs().filter(p => !EXCLUDED_PORTS.some(rx => rx.test(p)));
  const outs = easymidi.getOutputs().filter(p => !EXCLUDED_PORTS.some(rx => rx.test(p)));

  let t: Transport | null = null;
  for (const outName of outs) {
    const inName = ins.find(i => i === outName || i.split(' ')[0] === outName.split(' ')[0]);
    if (!inName) continue;
    const input = new easymidi.Input(inName);
    const output = new easymidi.Output(outName);
    const transport: Transport = { input, output, deviceId };

    const addr = [0x00, 0x00, 0x00, 0x00];
    const size = sizeBytes(2);
    const payload = [...addr, ...size, cs([...addr, ...size])];
    output.send('sysex', [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.RQD, ...payload, 0xf7] as unknown[]);
    const resp = await waitFor(transport, c => c === CMD.DAT || c === CMD.EOD || c === CMD.RJC, TIMEOUT);
    if (resp && resp.cmd !== CMD.RJC) {
      console.log(`Device found on ${outName}`);
      if (resp.cmd === CMD.DAT) {
        output.send('sysex', [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.ACK, 0xf7] as unknown[]);
        await waitFor(transport, c => c === CMD.EOD, 2000);
      }
      t = transport;
      break;
    }
    // Retry once for stale RJC
    if (resp && resp.cmd === CMD.RJC) {
      output.send('sysex', [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.RQD, ...payload, 0xf7] as unknown[]);
      const resp2 = await waitFor(transport, c => c === CMD.DAT || c === CMD.EOD || c === CMD.RJC, TIMEOUT);
      if (resp2 && resp2.cmd !== CMD.RJC) {
        console.log(`Device found on ${outName} (after stale RJC)`);
        if (resp2.cmd === CMD.DAT) {
          output.send('sysex', [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.ACK, 0xf7] as unknown[]);
          await waitFor(transport, c => c === CMD.EOD, 2000);
        }
        t = transport;
        break;
      }
    }
    input.close();
    output.close();
  }

  if (!t) { console.error('No device found'); process.exit(1); }
  await delay(500);

  // Track results
  interface Result { bank: number; seg: number; toneOk: boolean; writeOk: boolean; readOk: boolean; markerMatch: boolean; got: number }
  const results: Result[] = [];

  // Phase 1: Write
  console.log('\n=== PHASE 1: Write tone params + wave data ===\n');
  for (const bank of BANKS_TO_PROBE) {
    for (let seg = 0; seg < SEGMENTS_PER_BANK; seg++) {
      const toneIndex = bank * SEGMENTS_PER_BANK + seg;
      if (toneIndex >= MAX_TONES) {
        console.log(`  [${toneIndex}] bank=${bank} seg=${seg} SKIP (tone index >= ${MAX_TONES})`);
        results.push({ bank, seg, toneOk: false, writeOk: false, readOk: false, markerMatch: false, got: -1 });
        continue;
      }

      process.stdout.write(`  [${toneIndex}] bank=${bank} seg=${seg} tone...`);
      const toneOk = await writeToneParams(t, toneIndex, bank, seg, 1);
      process.stdout.write(toneOk ? 'ok' : 'FAIL');

      let writeOk = false;
      if (toneOk) {
        process.stdout.write(' wave...');
        const addr = buildWaveAddress(bank, seg);
        const data = makeMarkerData(marker(bank, seg));
        writeOk = await writeWaveData(t, addr, data);
        process.stdout.write(writeOk ? 'ok' : 'FAIL');
      }

      console.log();
      results.push({ bank, seg, toneOk, writeOk, readOk: false, markerMatch: false, got: -1 });
    }
  }

  // Phase 2: Read back
  console.log('\n=== PHASE 2: Read back and verify ===\n');
  for (const r of results) {
    if (!r.writeOk) continue;
    const addr = buildWaveAddress(r.bank, r.seg);
    process.stdout.write(`  bank=${r.bank} seg=${r.seg} reading...`);
    const data = await readWaveData(t, addr, 200);
    if (data && data.length >= 2) {
      r.readOk = true;
      r.got = decodeMarker(data);
      r.markerMatch = r.got === marker(r.bank, r.seg);
      console.log(r.markerMatch ? `ok marker=${r.got} ✓` : `MISMATCH expected=${marker(r.bank, r.seg)} got=${r.got}`);
    } else {
      console.log(data === null ? 'RJC/timeout' : 'no data');
    }
  }

  // Phase 3: Report
  console.log('\n================================================================================');
  console.log('WAVE MEMORY PROBE RESULTS');
  console.log('================================================================================\n');
  console.log('bank  seg  tone  addr             tone  wave  read  match  marker');
  console.log('------------------------------------------------------------------------');
  for (const r of results) {
    const toneIdx = r.bank * SEGMENTS_PER_BANK + r.seg;
    const addr = hex(buildWaveAddress(r.bank, r.seg));
    const t_ = r.toneOk ? 'ok' : '--';
    const w_ = r.writeOk ? 'ok' : '--';
    const rd = r.readOk ? 'ok' : '--';
    const m_ = r.markerMatch ? '✓' : r.readOk ? '✗' : '--';
    const got = r.readOk ? String(r.got) : '--';
    console.log(`   ${r.bank}   ${String(r.seg).padStart(2)}    ${String(toneIdx).padStart(2)}  ${addr}  ${t_.padEnd(4)}  ${w_.padEnd(4)}  ${rd.padEnd(4)}  ${m_.padEnd(5)}  ${got}`);
  }

  const written = results.filter(r => r.writeOk).length;
  const readable = results.filter(r => r.readOk).length;
  const matched = results.filter(r => r.markerMatch).length;
  console.log(`\nSummary: ${written} written, ${readable} readable, ${matched} matched`);

  t.input.close();
  t.output.close();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
