/**
 * MIDI Streaming Server tests.
 *
 * Tests the new low-latency streaming server on port 6870,
 * bypassing the HTTP bridge entirely. Connects directly to
 * s2p's MIDI streaming port via persistent TCP.
 */

import * as net from 'node:net';
import type { TestContext, TestResult } from '@/node/lib/test-types.js';

const MSG_INIT = 0x01;
const MSG_SEND = 0x02;
const MSG_DATA = 0x03;
const MSG_ERROR = 0x04;

interface StreamingConnection {
  socket: net.Socket;
  sendMessage: (type: number, payload: Uint8Array) => void;
  readMessage: () => Promise<{ type: number; payload: Uint8Array }>;
  close: () => void;
}

function connectStreaming(host: string, port: number): Promise<StreamingConnection> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    const pending: Array<{ resolve: (msg: { type: number; payload: Uint8Array }) => void }> = [];

    socket.setNoDelay(true);

    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);

      // Parse framed messages: [4-byte LE length] [1-byte type] [payload]
      while (buffer.length >= 4) {
        const msgLen = buffer.readUInt32LE(0);
        if (buffer.length < 4 + msgLen) break;

        const type = buffer[4];
        const payload = new Uint8Array(buffer.subarray(5, 4 + msgLen));
        buffer = buffer.subarray(4 + msgLen);

        if (pending.length > 0) {
          pending.shift()!.resolve({ type, payload });
        }
      }
    });

    socket.on('error', reject);

    socket.connect(port, host, () => {
      resolve({
        socket,
        sendMessage: (type: number, payload: Uint8Array) => {
          const totalLen = 1 + payload.length;
          const header = Buffer.alloc(5);
          header.writeUInt32LE(totalLen, 0);
          header[4] = type;
          socket.write(header);
          if (payload.length > 0) {
            socket.write(payload);
          }
        },
        readMessage: () => new Promise((res) => {
          // Check if we already have a buffered message
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

export async function runStreamingTests(ctx: TestContext): Promise<TestResult[]> {
  const results: TestResult[] = [];
  results.push(await testStreamingInit(ctx));
  results.push(await testStreamingSendReceive(ctx));
  results.push(await testStreamingLatency(ctx));
  return results;
}

function getStreamingHost(bridgeUrl: string): string {
  const url = new URL(bridgeUrl);
  return url.hostname;
}

async function testStreamingInit(ctx: TestContext): Promise<TestResult> {
  const name = 'streaming-init';
  try {
    const host = getStreamingHost(ctx.bridgeUrl);
    const conn = await connectStreaming(host, 6870);

    conn.sendMessage(MSG_INIT, new Uint8Array([6])); // Target ID 6 = S3000XL
    const response = await conn.readMessage();

    conn.close();

    if (response.type === MSG_INIT && response.payload[0] === 1) {
      return { name, status: 'PASS', detail: 'INIT success on streaming port 6870' };
    } else if (response.type === MSG_ERROR) {
      return { name, status: 'FAIL', detail: `Error: ${Buffer.from(response.payload).toString()}` };
    } else {
      return { name, status: 'ERROR', detail: `Unexpected response type: 0x${response.type.toString(16)}` };
    }
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

async function testStreamingSendReceive(ctx: TestContext): Promise<TestResult> {
  const name = 'streaming-send-receive';
  try {
    const host = getStreamingHost(ctx.bridgeUrl);
    const conn = await connectStreaming(host, 6870);

    // INIT
    conn.sendMessage(MSG_INIT, new Uint8Array([6]));
    await conn.readMessage();

    // Send RPLIST request: F0 47 00 02 48 F7
    const rplist = new Uint8Array([0xF0, 0x47, 0x00, 0x02, 0x48, 0xF7]);
    conn.sendMessage(MSG_SEND, rplist);

    const response = await conn.readMessage();
    conn.close();

    if (response.type === MSG_DATA && response.payload.length > 0) {
      ctx.log(`  RPLIST response: ${response.payload.length} bytes`);
      return { name, status: 'PASS', detail: `${response.payload.length} bytes` };
    } else {
      return { name, status: 'FAIL', detail: `No data: type=0x${response.type.toString(16)}, len=${response.payload.length}` };
    }
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}

async function testStreamingLatency(ctx: TestContext): Promise<TestResult> {
  const name = 'streaming-latency';
  const ITERATIONS = 10;
  try {
    const host = getStreamingHost(ctx.bridgeUrl);
    const conn = await connectStreaming(host, 6870);

    // INIT
    conn.sendMessage(MSG_INIT, new Uint8Array([6]));
    await conn.readMessage();

    // RPDATA request: F0 47 00 06 48 00 00 F7
    const rpdata = new Uint8Array([0xF0, 0x47, 0x00, 0x06, 0x48, 0x00, 0x00, 0xF7]);

    const times: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      conn.sendMessage(MSG_SEND, rpdata);
      await conn.readMessage();
      times.push(Math.round(performance.now() - start));
    }

    conn.close();

    const sorted = [...times].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);

    ctx.log(`  Streaming RPDATA (${ITERATIONS}x): min=${min}ms median=${median}ms avg=${avg}ms max=${max}ms`);
    ctx.log(`    Raw: [${times.join(', ')}]`);

    return { name, status: 'PASS', detail: `min=${min}ms median=${median}ms avg=${avg}ms max=${max}ms` };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}
