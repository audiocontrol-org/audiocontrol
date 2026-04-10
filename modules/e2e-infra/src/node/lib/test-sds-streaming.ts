/**
 * Test SDS upload via s2p's streaming MIDI port (6870).
 *
 * Compares SDS packet throughput on the streaming port vs the CDB-based
 * path used by the bridge's HTTP API. The streaming port uses a persistent
 * TCP connection with simple framing, which should eliminate the ~113ms
 * per-command overhead of the CDB path.
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 tsx modules/e2e-infra/src/node/lib/test-sds-streaming.ts
 */

import * as net from 'node:net';

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const TARGET_ID = 6;
const STREAMING_PORT = 6870;
const SDS_CHANNEL = 0;

// -- Streaming protocol -------------------------------------------------------

const MSG_INIT = 0x01;
const MSG_SEND = 0x02;
const MSG_DATA = 0x03;

interface StreamConn {
  send: (type: number, payload: Uint8Array) => void;
  read: () => Promise<{ type: number; payload: Uint8Array }>;
  close: () => void;
}

function connect(host: string, port: number): Promise<StreamConn> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    const pending: Array<{ resolve: (msg: { type: number; payload: Uint8Array }) => void }> = [];

    socket.setNoDelay(true);
    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 4) {
        const msgLen = buffer.readUInt32LE(0);
        if (buffer.length < 4 + msgLen) break;
        const type = buffer[4];
        const payload = new Uint8Array(buffer.subarray(5, 4 + msgLen));
        buffer = buffer.subarray(4 + msgLen);
        if (pending.length > 0) pending.shift()!.resolve({ type, payload });
      }
    });
    socket.on('error', reject);
    socket.connect(port, host, () => {
      resolve({
        send: (type: number, payload: Uint8Array) => {
          const header = Buffer.alloc(5);
          header.writeUInt32LE(1 + payload.length, 0);
          header[4] = type;
          socket.write(header);
          if (payload.length > 0) socket.write(payload);
        },
        read: () => new Promise((res) => {
          if (buffer.length >= 4) {
            const msgLen = buffer.readUInt32LE(0);
            if (buffer.length >= 4 + msgLen) {
              const type = buffer[4];
              const payload = new Uint8Array(buffer.subarray(5, 4 + msgLen));
              buffer = buffer.subarray(4 + msgLen);
              res({ type, payload });
              return;
            }
          }
          pending.push({ resolve: res });
        }),
        close: () => socket.destroy(),
      });
    });
  });
}

// -- SDS helpers ---------------------------------------------------------------

function encodeSdsSample(sample: number): [number, number, number] {
  const raw = sample & 0xFFFF;
  return [
    (raw >> 9) & 0x7F,
    (raw >> 2) & 0x7F,
    (raw << 5) & 0x60,
  ];
}

function buildDumpHeader(sampleNumber: number, sampleRate: number, totalSamples: number): Uint8Array {
  const snLo = sampleNumber & 0x7F;
  const snHi = (sampleNumber >> 7) & 0x7F;
  const periodNs = Math.floor(1_000_000_000 / sampleRate);
  return new Uint8Array([
    0xF0, 0x7E, SDS_CHANNEL, 0x01,
    snLo, snHi,
    16, // bits per sample
    periodNs & 0x7F,
    (periodNs >> 7) & 0x7F,
    (periodNs >> 14) & 0x7F,
    totalSamples & 0x7F,
    (totalSamples >> 7) & 0x7F,
    (totalSamples >> 14) & 0x7F,
    0, 0, 0, // loop start
    0, 0, 0, // loop end
    0,        // loop type = off
    0xF7,
  ]);
}

function buildDataPacket(pktNum: number, samples: Int16Array, offset: number): Uint8Array {
  const SAMPLES_PER_PACKET = 40;
  const data: number[] = [
    0xF0, 0x7E, SDS_CHANNEL, 0x02,
    pktNum & 0x7F,
  ];

  let checksum = 0x7E ^ SDS_CHANNEL ^ 0x02 ^ (pktNum & 0x7F);
  for (let i = 0; i < SAMPLES_PER_PACKET; i++) {
    const s = offset + i < samples.length ? samples[offset + i] : 0;
    const [a, b, c] = encodeSdsSample(s);
    checksum ^= a; checksum ^= b; checksum ^= c;
    data.push(a, b, c);
  }
  data.push(checksum & 0x7F, 0xF7);
  return new Uint8Array(data);
}

function parseHandshake(data: Uint8Array): { type: string; packetNum: number } | null {
  if (data.length < 6 || data[0] !== 0xF0 || data[1] !== 0x7E) return null;
  const code = data[3];
  const packetNum = data[4];
  switch (code) {
    case 0x7F: return { type: 'ACK', packetNum };
    case 0x7E: return { type: 'NAK', packetNum };
    case 0x7D: return { type: 'CANCEL', packetNum };
    case 0x7C: return { type: 'WAIT', packetNum };
    default: return null;
  }
}

// -- CDB-based path for MIDI mode enable/disable ------------------------------

async function scsiExec(cdb: number[], dataOut: number[] = [], expectedIn = 0): Promise<void> {
  const resp = await fetch(`${BRIDGE_URL}/scsi/exec`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target_id: TARGET_ID,
      cdb,
      data_out: dataOut,
      expected_data_in: expectedIn,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`scsi/exec HTTP ${resp.status}: ${text}`);
  }
}

async function enableMidiMode(): Promise<void> {
  await scsiExec([0x09, 0x00, 0x01, 0x00, 0x00, 0x00]);
}

async function disableMidiMode(): Promise<void> {
  await scsiExec([0x09, 0x00, 0x00, 0x00, 0x00, 0x00]);
}

// -- Main test ----------------------------------------------------------------

async function main() {
  const host = new URL(BRIDGE_URL).hostname;
  const SAMPLE_COUNT = 1000; // Short test sample
  const SAMPLE_RATE = 44100;
  const SAMPLES_PER_PACKET = 40;
  const totalPackets = Math.ceil(SAMPLE_COUNT / SAMPLES_PER_PACKET);

  // Generate a simple sine wave
  const samples = new Int16Array(SAMPLE_COUNT);
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / SAMPLE_RATE) * 16000);
  }

  console.log(`\n=== SDS Streaming Port Test ===`);
  console.log(`Host: ${host}:${STREAMING_PORT}`);
  console.log(`Sample: ${SAMPLE_COUNT} samples, ${totalPackets} packets`);
  console.log(`Expected data: ${SAMPLE_COUNT * 2} bytes\n`);

  // Step 1: Connect to streaming port
  console.log('Step 1: Connecting to streaming port...');
  const conn = connect(host, STREAMING_PORT);
  const stream = await conn;

  // Step 2: INIT handshake
  console.log('Step 2: INIT handshake...');
  stream.send(MSG_INIT, new Uint8Array([TARGET_ID]));
  const initResp = await stream.read();
  if (initResp.type !== MSG_INIT || initResp.payload[0] !== 1) {
    console.error('INIT failed:', initResp);
    stream.close();
    process.exit(1);
  }
  console.log('  INIT OK');

  // Step 3: Enable MIDI mode via CDB (bridge HTTP API)
  console.log('Step 3: Enabling MIDI mode via CDB...');
  await enableMidiMode();
  console.log('  MIDI mode enabled');

  // Step 4: Send SDS dump header via streaming port
  console.log('Step 4: Sending SDS dump header...');
  const header = buildDumpHeader(99, SAMPLE_RATE, SAMPLE_COUNT); // Sample number 99 to avoid conflicts
  stream.send(MSG_SEND, header);

  const headerResp = await stream.read();
  if (headerResp.type !== MSG_DATA) {
    console.error('Expected MSG_DATA for header ACK, got type:', headerResp.type);
    stream.close();
    await disableMidiMode();
    process.exit(1);
  }
  const headerAck = parseHandshake(headerResp.payload);
  console.log('  Header response:', headerAck);

  if (!headerAck || headerAck.type !== 'ACK') {
    // Try waiting a bit and reading again (device may send WAIT then ACK)
    if (headerAck?.type === 'WAIT') {
      console.log('  Got WAIT, reading again...');
      const retry = await stream.read();
      const retryAck = parseHandshake(retry.payload);
      console.log('  Retry response:', retryAck);
      if (!retryAck || retryAck.type !== 'ACK') {
        console.error('Header not ACKed');
        stream.close();
        await disableMidiMode();
        process.exit(1);
      }
    } else {
      console.error('Header not ACKed');
      stream.close();
      await disableMidiMode();
      process.exit(1);
    }
  }

  // Step 5: Send data packets and measure timing
  console.log(`Step 5: Sending ${totalPackets} data packets...`);
  const packetTimes: number[] = [];
  let offset = 0;
  let pktNum = 0;

  const totalStart = performance.now();

  for (let i = 0; i < totalPackets; i++) {
    const pkt = buildDataPacket(pktNum, samples, offset);
    const t0 = performance.now();

    stream.send(MSG_SEND, pkt);
    const ackResp = await stream.read();
    const elapsed = performance.now() - t0;
    packetTimes.push(elapsed);

    const ack = parseHandshake(ackResp.payload);
    if (!ack || ack.type !== 'ACK') {
      console.error(`Packet ${pktNum} not ACKed:`, ack, 'raw:', ackResp.payload);
      break;
    }

    offset += SAMPLES_PER_PACKET;
    pktNum = (pktNum + 1) & 0x7F;
  }

  const totalElapsed = performance.now() - totalStart;

  // Step 6: Cleanup
  stream.close();
  await disableMidiMode();

  // Step 7: Report
  const sorted = [...packetTimes].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];
  const avg = packetTimes.reduce((a, b) => a + b, 0) / packetTimes.length;
  const bytesTransferred = SAMPLE_COUNT * 2;
  const throughput = bytesTransferred / (totalElapsed / 1000);

  console.log(`\n=== Results ===`);
  console.log(`Packets sent: ${packetTimes.length} / ${totalPackets}`);
  console.log(`Total time: ${Math.round(totalElapsed)}ms`);
  console.log(`Per-packet: min=${min.toFixed(1)}ms median=${median.toFixed(1)}ms avg=${avg.toFixed(1)}ms max=${max.toFixed(1)}ms`);
  console.log(`Throughput: ${(throughput / 1024).toFixed(1)} KB/s (${Math.round(throughput)} bytes/s)`);
  console.log(`\nBaseline (CDB path): 227ms/packet, ~350 bytes/s`);
  console.log(`Speedup: ${(227 / avg).toFixed(1)}x`);

  if (packetTimes.length > 5) {
    console.log(`\nFirst 5 packet times: [${packetTimes.slice(0, 5).map(t => t.toFixed(1)).join(', ')}]ms`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
