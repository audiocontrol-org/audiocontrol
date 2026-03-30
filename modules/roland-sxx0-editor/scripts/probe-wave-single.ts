#!/usr/bin/env npx tsx
/**
 * Minimal probe: write one full segment of wave data to bank 0, segment 0,
 * then read it back. Uses the exact same WSD format as the working client.
 *
 * Usage: tsx scripts/probe-wave-single.ts [device-id]
 */

import * as easymidi from 'easymidi';

const ROLAND_ID = 0x41;
const MODEL_ID = 0x1E;
const CMD = { RQD: 0x41, DAT: 0x42, ACK: 0x43, EOD: 0x45, ERR: 0x4E, RJC: 0x4F, WSD: 0x40 };
const EXCLUDED_PORTS = [/^IAC /i, /^Network /i, /^virtual/i];

const TIMEOUT = 5000;
const MAX_CHUNK = 128;

function hex(a: number[]): string {
  return a.map(b => b.toString(16).padStart(2, '0')).join(' ');
}

function cs(bytes: number[]): number {
  return (128 - (bytes.reduce((a, b) => a + b, 0) & 0x7f)) % 128;
}

function sizeBytes(n: number): number[] {
  return [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
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

async function main() {
  const deviceId = parseInt(process.argv[2] || '0', 10);
  console.log(`Single-segment wave probe (device ID ${deviceId})`);

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

    // Ping
    const addr = [0x00, 0x00, 0x00, 0x00];
    const size = sizeBytes(2);
    const payload = [...addr, ...size, cs([...addr, ...size])];
    output.send('sysex', [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.RQD, ...payload, 0xf7] as unknown[]);
    const resp = await waitFor(transport, c => c === CMD.DAT || c === CMD.EOD || c === CMD.RJC, TIMEOUT);
    if (resp && resp.cmd !== CMD.RJC) {
      console.log(`Device found on ${outName}`);
      // Drain any remaining packets
      if (resp.cmd === CMD.DAT) {
        // Send ACK and wait for EOD
        output.send('sysex', [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.ACK, 0xf7] as unknown[]);
        await waitFor(transport, c => c === CMD.EOD, 2000);
      }
      t = transport;
      break;
    }
    input.close();
    output.close();
  }

  if (!t) {
    console.error('No device found');
    process.exit(1);
  }

  await delay(500);

  // Step 0: Write tone 0 parameters first — the S-550 may require tone
  // allocation to be configured before accepting wave WSD.
  // Tone 0 address: [0x00, 0x03, 0x00, 0x00], 256 bytes (512 nibbles).
  // We need to set byte 13=bank(0), 14=segTop(0), 15=segLen(3).
  console.log('Step 0: Writing tone 0 parameters (bank=0, segTop=0, segLen=3)...');
  {
    const toneAddr = [0x00, 0x03, 0x00, 0x00];
    // Build a minimal 256-byte tone parameter block
    // Most bytes are 0 (defaults). Set wave allocation at offsets 13-15.
    const toneData = new Array(256).fill(0);
    toneData[13] = 0; // wave bank = A
    toneData[14] = 0; // segment top = 0
    toneData[15] = 3; // segment length = 3
    // Set sample rate to 30kHz (byte 12, value 1 = 30kHz)
    toneData[12] = 1;
    // Set name "PROBE" at bytes 0-7
    const name = 'PROBE   ';
    for (let i = 0; i < 8; i++) toneData[i] = name.charCodeAt(i);

    // Nibblize the data (each byte → 2 nibbles)
    const nibblized: number[] = [];
    for (const b of toneData) {
      nibblized.push((b >> 4) & 0x0f, b & 0x0f);
    }

    // Send tone WSD (nibblized size)
    const toneSize = sizeBytes(nibblized.length);
    const toneWsdPayload = [...toneAddr, ...toneSize, cs([...toneAddr, ...toneSize])];
    const toneWsd = [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.WSD, ...toneWsdPayload, 0xf7];
    console.log(`  Tone WSD: ${hex(toneWsd)}`);
    t.output.send('sysex', toneWsd as unknown[]);

    const wr = await waitFor(t, c => c === CMD.ACK || c === CMD.RJC || c === CMD.ERR, TIMEOUT);
    if (!wr || wr.cmd !== CMD.ACK) {
      console.log(`  Tone WSD: ${!wr ? 'TIMEOUT' : wr.cmd === CMD.RJC ? 'RJC' : 'ERR'}`);
      // Try anyway — the stale RJC workaround
      if (wr && wr.cmd === CMD.RJC) {
        console.log('  Retrying tone WSD (stale RJC workaround)...');
        t.output.send('sysex', toneWsd as unknown[]);
        const wr2 = await waitFor(t, c => c === CMD.ACK || c === CMD.RJC || c === CMD.ERR, TIMEOUT);
        if (!wr2 || wr2.cmd !== CMD.ACK) {
          console.log(`  Retry: ${!wr2 ? 'TIMEOUT' : wr2.cmd === CMD.RJC ? 'RJC' : 'ERR'}`);
          console.log('  Cannot write tone params. Exiting.');
          t.input.close(); t.output.close(); process.exit(1);
        }
      } else {
        t.input.close(); t.output.close(); process.exit(1);
      }
    }
    console.log('  Tone WSD: ACK');

    // Send tone DAT (all nibblized data in one chunk since it's 512 nibbles < typical limit)
    // Actually, the S-330 client sends 512 nibbles as one DAT packet
    const toneDatPayload = [...toneAddr, ...nibblized, cs([...toneAddr, ...nibblized])];
    const toneDat = [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.DAT, ...toneDatPayload, 0xf7];
    console.log(`  Tone DAT: ${toneDat.length} bytes`);
    t.output.send('sysex', toneDat as unknown[]);

    const dr = await waitFor(t, c => c === CMD.ACK || c === CMD.RJC || c === CMD.ERR, TIMEOUT);
    console.log(`  Tone DAT: ${!dr ? 'TIMEOUT' : dr.cmd === CMD.ACK ? 'ACK' : dr.cmd === CMD.RJC ? 'RJC' : 'ERR'}`);

    // Send EOD
    t.output.send('sysex', [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.EOD, 0xf7] as unknown[]);
    await delay(500);
    console.log('  Tone params written.\n');
  }

  // Create 60000 bytes of identifiable wave data (same size as working import)
  // Pattern: all samples = 0x0042 (arbitrary identifiable 12-bit value)
  const TOTAL_BYTES = 60000;
  const data = new Array(TOTAL_BYTES).fill(0);
  for (let i = 0; i < TOTAL_BYTES; i += 2) {
    // 12-bit value 0x042 = 66 decimal
    // byte0 = (0x042 >> 5) & 0x7f = 2
    // byte1 = (0x042 << 2) & 0x7c = 8
    data[i] = 0x02;
    data[i + 1] = 0x08;
  }

  const addr = [0x01, 0x00, 0x00, 0x00]; // Bank A, segment 0
  const size = sizeBytes(TOTAL_BYTES);

  // Step 1: Send WSD
  const wsdPayload = [...addr, ...size, cs([...addr, ...size])];
  const wsdMsg = [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.WSD, ...wsdPayload, 0xf7];
  console.log(`\nSending WSD: ${hex(wsdMsg)}`);
  t.output.send('sysex', wsdMsg as unknown[]);

  const wsdResp = await waitFor(t, c => c === CMD.ACK || c === CMD.RJC || c === CMD.ERR, TIMEOUT);
  if (!wsdResp) {
    console.log('WSD: TIMEOUT');
    process.exit(1);
  }
  console.log(`WSD response: 0x${wsdResp.cmd.toString(16)} (${wsdResp.cmd === CMD.ACK ? 'ACK' : wsdResp.cmd === CMD.RJC ? 'RJC' : 'ERR'})`);

  if (wsdResp.cmd !== CMD.ACK) {
    console.log('WSD rejected. Exiting.');
    t.input.close();
    t.output.close();
    process.exit(1);
  }

  // Step 2: Send DAT chunks
  let bytesSent = 0;
  let chunkNum = 0;
  while (bytesSent < TOTAL_BYTES) {
    const chunkEnd = Math.min(bytesSent + MAX_CHUNK, TOTAL_BYTES);
    const chunkData = data.slice(bytesSent, chunkEnd);

    // Calculate chunk address (same as s330-client.ts sendWaveDataChunked)
    const baseOffset = (addr[1] << 14) | (addr[2] << 7) | addr[3];
    const chunkAddr = baseOffset + bytesSent;
    const chunkAddress = [
      addr[0],
      (chunkAddr >> 14) & 0x7f,
      (chunkAddr >> 7) & 0x7f,
      chunkAddr & 0x7f,
    ];

    const datPayload = [...chunkAddress, ...chunkData, cs([...chunkAddress, ...chunkData])];
    const datMsg = [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.DAT, ...datPayload, 0xf7];

    if (chunkNum < 3 || chunkNum % 100 === 0) {
      console.log(`DAT chunk ${chunkNum}: ${chunkData.length} bytes at addr ${hex(chunkAddress)}`);
    }

    t.output.send('sysex', datMsg as unknown[]);

    const datResp = await waitFor(t, c => c === CMD.ACK || c === CMD.RJC || c === CMD.ERR, TIMEOUT);
    if (!datResp) {
      console.log(`DAT chunk ${chunkNum}: TIMEOUT`);
      break;
    }
    if (datResp.cmd !== CMD.ACK) {
      console.log(`DAT chunk ${chunkNum}: ${datResp.cmd === CMD.RJC ? 'RJC' : 'ERR'}`);
      break;
    }

    bytesSent = chunkEnd;
    chunkNum++;
  }

  console.log(`Sent ${bytesSent}/${TOTAL_BYTES} bytes in ${chunkNum} chunks`);

  // Step 3: Send EOD
  const eodMsg = [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.EOD, 0xf7];
  t.output.send('sysex', eodMsg as unknown[]);
  await delay(1000); // Grace period

  console.log('\nWave write complete. Now reading back...\n');

  // Step 4: Read back
  const rqdSize = sizeBytes(200); // Just read 200 bytes to verify
  const rqdPayload = [...addr, ...rqdSize, cs([...addr, ...rqdSize])];
  const rqdMsg = [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.RQD, ...rqdPayload, 0xf7];
  console.log(`Sending RQD: ${hex(rqdMsg)}`);
  t.output.send('sysex', rqdMsg as unknown[]);

  const collected: number[] = [];
  for (;;) {
    const r = await waitFor(t, c => [CMD.DAT, CMD.EOD, CMD.RJC, CMD.ERR].includes(c), TIMEOUT);
    if (!r) { console.log('RQD: TIMEOUT'); break; }
    if (r.cmd === CMD.RJC) { console.log('RQD: RJC'); break; }
    if (r.cmd === CMD.ERR) { console.log('RQD: ERR'); break; }
    if (r.cmd === CMD.EOD) { console.log('RQD: EOD (complete)'); break; }
    // DAT
    collected.push(...r.bytes.slice(9, r.bytes.length - 2));
    t.output.send('sysex', [0xf0, ROLAND_ID, deviceId, MODEL_ID, CMD.ACK, 0xf7] as unknown[]);
  }

  console.log(`Read ${collected.length} bytes`);
  if (collected.length >= 2) {
    console.log(`First bytes: ${hex(collected.slice(0, 10))}`);
    const match = collected[0] === 0x02 && collected[1] === 0x08;
    console.log(`Pattern match: ${match ? 'YES ✓' : 'NO ✗'} (expected 02 08, got ${hex(collected.slice(0, 2))})`);
  }

  t.input.close();
  t.output.close();
}

main().catch(e => { console.error(e); process.exit(1); });
