#!/usr/bin/env npx tsx
/**
 * Direct s2p protobuf client for probing SCSI sample data transfer.
 * No bridge, no streaming server — talks raw protobuf to s2p on port 6868.
 *
 * Usage: npx tsx scripts/scsi-sample-probe.ts [s2p-host] [sample-number]
 */

import * as net from 'node:net';

const S2P_HOST = process.argv[2] || 's3k.local';
const S2P_PORT = 6868;
const TARGET_ID = 6;
const SAMPLE_NUM = parseInt(process.argv[3] || '0', 10);

// --- Protobuf encoding (hand-rolled, same as Rust bridge) ---

function encodeVarint(value: number): number[] {
  const buf: number[] = [];
  let v = value >>> 0; // unsigned
  while (v > 0x7f) {
    buf.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  buf.push(v & 0x7f);
  return buf;
}

function buildMidiRequest(targetId: number): number[] {
  return [0x08, ...encodeVarint(targetId)]; // field 1, varint
}

function buildCommand(operation: number, midiReq: number[]): number[] {
  const cmd: number[] = [];
  cmd.push(0x08, ...encodeVarint(operation));     // field 1 (operation)
  cmd.push(0xa2, 0x01);                           // field 20, length-delimited
  cmd.push(...encodeVarint(midiReq.length));
  cmd.push(...midiReq);
  return cmd;
}

function buildMidiSend(targetId: number, sysex: number[]): number[] {
  const req = buildMidiRequest(targetId);
  req.push(0x12, ...encodeVarint(sysex.length), ...sysex); // field 2 (sysex_data)
  return buildCommand(201, req); // MIDI_SEND = 201
}

function buildMidiPoll(targetId: number): number[] {
  return buildCommand(202, buildMidiRequest(targetId)); // MIDI_POLL = 202
}

function buildMidiRead(targetId: number, length: number): number[] {
  const req = buildMidiRequest(targetId);
  req.push(0x18, ...encodeVarint(length)); // field 3 (read_length)
  return buildCommand(203, req); // MIDI_READ = 203
}

function buildMidiInit(targetId: number): number[] {
  return buildCommand(200, buildMidiRequest(targetId)); // MIDI_INIT = 200
}

// --- Protobuf response parsing ---

function decodeVarint(data: Uint8Array, pos: { v: number }): number {
  let val = 0, shift = 0;
  while (pos.v < data.length) {
    const b = data[pos.v++];
    val |= (b & 0x7f) << shift;
    shift += 7;
    if (!(b & 0x80)) break;
  }
  return val;
}

interface Fields {
  varints: Map<number, number>;
  bytes: Map<number, Uint8Array>;
}

function parseFields(data: Uint8Array): Fields {
  const f: Fields = { varints: new Map(), bytes: new Map() };
  const pos = { v: 0 };
  while (pos.v < data.length) {
    const tag = decodeVarint(data, pos);
    const fieldNum = tag >>> 3;
    const wireType = tag & 0x07;
    if (wireType === 0) {
      f.varints.set(fieldNum, decodeVarint(data, pos));
    } else if (wireType === 2) {
      const len = decodeVarint(data, pos);
      f.bytes.set(fieldNum, data.subarray(pos.v, pos.v + len));
      pos.v += len;
    } else if (wireType === 5) { pos.v += 4; }
    else if (wireType === 1) { pos.v += 8; }
    else break;
  }
  return f;
}

// --- TCP client ---

async function sendS2pCommand(payload: number[]): Promise<Fields> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.connect(S2P_PORT, S2P_HOST, () => {
      // Send: "RASCSI" + 4-byte LE length + payload
      const magic = Buffer.from('RASCSI');
      const lenBuf = Buffer.alloc(4);
      lenBuf.writeUInt32LE(payload.length, 0);
      socket.write(magic);
      socket.write(lenBuf);
      socket.write(Buffer.from(payload));
    });

    let buf = Buffer.alloc(0);
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      // Response: 4-byte LE length + payload
      if (buf.length >= 4) {
        const respLen = buf.readUInt32LE(0);
        if (buf.length >= 4 + respLen) {
          socket.destroy();
          resolve(parseFields(new Uint8Array(buf.subarray(4, 4 + respLen))));
        }
      }
    });

    socket.on('error', reject);
    setTimeout(() => { socket.destroy(); reject(new Error('timeout')); }, 10000);
  });
}

function getStatus(fields: Fields): boolean {
  return (fields.varints.get(1) ?? 0) !== 0;
}

function getMidiResponse(fields: Fields): Fields | null {
  const data = fields.bytes.get(101);
  return data ? parseFields(data) : null;
}

// --- High-level MIDI operations ---

async function midiInit(): Promise<boolean> {
  const result = await sendS2pCommand(buildMidiInit(TARGET_ID));
  return getStatus(result);
}

async function midiSend(sysex: number[]): Promise<boolean> {
  const result = await sendS2pCommand(buildMidiSend(TARGET_ID, sysex));
  return getStatus(result);
}

async function midiPoll(): Promise<number> {
  const result = await sendS2pCommand(buildMidiPoll(TARGET_ID));
  if (!getStatus(result)) return -1;
  const midi = getMidiResponse(result);
  return midi ? (midi.varints.get(2) ?? 0) : 0;
}

async function midiRead(length: number): Promise<number[]> {
  const result = await sendS2pCommand(buildMidiRead(TARGET_ID, length));
  if (!getStatus(result)) return [];
  const midi = getMidiResponse(result);
  return midi?.bytes.get(1) ? Array.from(midi.bytes.get(1)!) : [];
}

async function sendAndReceive(sysex: number[]): Promise<number[]> {
  await midiSend(sysex);
  // Poll until data arrives
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 100));
    const pending = await midiPoll();
    if (pending > 0) {
      const data = await midiRead(pending);
      // Check if more data follows
      let result = [...data];
      for (let j = 0; j < 5; j++) {
        await new Promise(r => setTimeout(r, 100));
        const more = await midiPoll();
        if (more > 0) {
          result.push(...await midiRead(more));
        } else break;
      }
      return result;
    }
  }
  return [];
}

// --- Main ---

async function main() {
  console.log(`Probing s2p at ${S2P_HOST}:${S2P_PORT}, target ID ${TARGET_ID}, sample ${SAMPLE_NUM}`);

  // Init
  const initOk = await midiInit();
  console.log('MIDI_INIT:', initOk ? 'OK' : 'FAIL');
  if (!initOk) process.exit(1);

  // Test: fetch sample names
  const namesResp = await sendAndReceive([0xF0, 0x47, 0x00, 0x04, 0x48, 0xF7]);
  console.log('RSLIST:', namesResp.length, 'bytes —', namesResp.length > 0 ? 'OK' : 'FAIL');

  // Send RSPACK with 7-bit encoding
  console.log('\nSending RSPACK for sample', SAMPLE_NUM, '(256 samples)...');
  const rspack = [
    0xF0, 0x47, 0x00, 0x0C, 0x48,
    SAMPLE_NUM & 0x7F, (SAMPLE_NUM >> 7) & 0x7F,
    0x00, 0x00, 0x00, 0x00,  // offset 0
    0x00, 0x02, 0x00, 0x00,  // count 256
    0x01, 0x00, 0xF7,
  ];

  const rspackOk = await midiSend(rspack);
  console.log('RSPACK sent:', rspackOk ? 'OK' : 'FAIL');

  // Now poll for responses — the device may send Akai SysEx header first, then SDS packets
  console.log('Polling for responses...');
  const allData: number[] = [];
  let packetCount = 0;

  for (let attempt = 0; attempt < 100; attempt++) {
    await new Promise(r => setTimeout(r, 100));
    const pending = await midiPoll();

    if (pending > 0) {
      const data = await midiRead(pending);
      console.log(`  [${attempt}] ${pending} pending → ${data.length} bytes read`);

      // Parse what we got
      if (data[0] === 0xF0 && data[1] === 0x7E && data[3] === 0x02) {
        // SDS Data Packet
        const pktNum = data[4];
        packetCount++;
        allData.push(...data);
        console.log(`    SDS Data Packet #${pktNum}`);

        // Send ACK: F0 7E 00 7F pp F7
        const ack = [0xF0, 0x7E, 0x00, 0x7F, pktNum & 0x7F, 0xF7];
        const ackOk = await midiSend(ack);
        console.log(`    ACK sent: ${ackOk ? 'OK' : 'FAIL'}`);

      } else if (data[0] === 0xF0 && data[1] === 0x7E && data[3] === 0x01) {
        // SDS Dump Header
        console.log('    SDS Dump Header received!');
        allData.push(...data);
        // ACK it
        const ack = [0xF0, 0x7E, 0x00, 0x7F, 0x00, 0xF7];
        await midiSend(ack);
        console.log('    ACK sent');

      } else if (data[0] === 0xF0 && data[1] === 0x47) {
        // Akai SysEx
        console.log(`    Akai SysEx opcode=0x${data[3].toString(16)}, ${data.length} bytes`);
        allData.push(...data);

      } else {
        const hex = data.slice(0, 20).map(b => b.toString(16).padStart(2, '0')).join(' ');
        console.log(`    Unknown: ${hex}...`);
        allData.push(...data);
      }
    } else if (packetCount > 0) {
      // Had packets, now empty — done
      console.log(`  [${attempt}] 0 pending after ${packetCount} packets — done`);
      break;
    }
  }

  console.log(`\nTotal: ${packetCount} SDS packets, ${allData.length} bytes raw data`);
}

main().catch(e => { console.error(e); process.exit(1); });
