/**
 * probeForRolandDevice — handshake-style auto-detect of a Roland
 * sampler/synth across the visible MIDI ports.
 *
 * Algorithm:
 *   1. Filter out obvious loopback ports (macOS IAC Driver,
 *      Windows loopMIDI, generic virtual cables). Probing them
 *      would echo our own Identity Request back as the "reply" and
 *      produce a false positive.
 *   2. For each candidate output port, pair with its same-index
 *      input first (operators with a single interface usually have
 *      matching input/output indices), then fall back to the
 *      cross-product.
 *   3. For each (input, output) candidate, open a temporary
 *      transport connection. Register a SysEx listener, then send
 *      the Universal Non-Realtime Identity Request
 *      `F0 7E 7F 06 01 F7` (device ID 0x7F = broadcast). Wait up
 *      to `timeoutMs` for an Identity Reply whose manufacturer ID
 *      is 0x41 (Roland). Close the connection regardless.
 *   4. Return the first matching pair, or `null` if nothing
 *      replied. The caller surfaces the not-found state to the
 *      operator with a "check EXC SysEx enable" hint.
 *
 * Why no Pi-MIDI / scsi-bridge handling: this probe is only used
 * by the Web MIDI transport path. Other transports (HTTP /
 * simulated) have their own ready-state semantics and don't need
 * the handshake.
 */

import type { MidiPortInfo } from '@audiocontrol/midi-core';
import type { MidiTransport } from './types';

export interface ProbeMatch {
  inputId: string;
  outputId: string;
  inputName: string;
  outputName: string;
}

export interface ProbeOptions {
  /** Per-port timeout for the Identity Reply (ms). Default 350ms —
   *  generous enough for slower interfaces, tight enough that a
   *  full sweep across 4 ports completes well under 2s. */
  timeoutMs?: number;
  /** Optional progress callback fired before each port pair is
   *  tested. Lets the caller show "Probing <port>…" status. */
  onProbe?: (portName: string) => void;
}

/** Universal Non-Realtime Identity Request, broadcast device ID. */
const IDENTITY_REQUEST = [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7];

const LOOPBACK_PATTERNS = /(iac|loopmidi|loopback|virtual)/i;

function isLoopback(port: MidiPortInfo): boolean {
  return LOOPBACK_PATTERNS.test(port.name);
}

/** Identity Reply shape:
 *   F0 7E <devId> 06 02 <mfg> <family-lo> <family-hi> <model-lo>
 *   <model-hi> <ver1> <ver2> <ver3> <ver4> F7
 *
 *   Roland manufacturer ID is 0x41. */
function isRolandIdentityReply(message: number[]): boolean {
  if (message.length < 6) return false;
  if (message[0] !== 0xf0) return false;
  if (message[1] !== 0x7e) return false;
  // message[2] is the device ID (any value)
  if (message[3] !== 0x06) return false;
  if (message[4] !== 0x02) return false;
  return message[5] === 0x41;
}

/** Build the candidate pair list. Pairs same-index ports first
 *  (most common operator setup), then cross-pairs. Filters out
 *  loopback ports at both ends. */
function buildCandidatePairs(
  inputs: MidiPortInfo[],
  outputs: MidiPortInfo[],
): Array<{ input: MidiPortInfo; output: MidiPortInfo }> {
  const realInputs = inputs.filter((p) => !isLoopback(p));
  const realOutputs = outputs.filter((p) => !isLoopback(p));
  const sameIndex: Array<{ input: MidiPortInfo; output: MidiPortInfo }> = [];
  const crossPairs: Array<{ input: MidiPortInfo; output: MidiPortInfo }> = [];
  const sameIndexKeys = new Set<string>();

  const pairCount = Math.min(realInputs.length, realOutputs.length);
  for (let i = 0; i < pairCount; i++) {
    sameIndex.push({ input: realInputs[i], output: realOutputs[i] });
    sameIndexKeys.add(`${realInputs[i].id}::${realOutputs[i].id}`);
  }
  for (const output of realOutputs) {
    for (const input of realInputs) {
      const key = `${input.id}::${output.id}`;
      if (sameIndexKeys.has(key)) continue;
      crossPairs.push({ input, output });
    }
  }
  return [...sameIndex, ...crossPairs];
}

/** Race a SysEx reply against a timeout. Resolves to the matching
 *  Roland reply or `null` on timeout. */
function waitForRolandReply(
  adapter: { onSysEx: (cb: (msg: number[]) => void) => void; removeSysExListener: (cb: (msg: number[]) => void) => void },
  timeoutMs: number,
): Promise<number[] | null> {
  return new Promise((resolve) => {
    let settled = false;
    const cleanup = () => { adapter.removeSysExListener(handler); };
    const handler = (msg: number[]) => {
      if (settled) return;
      if (!isRolandIdentityReply(msg)) return;
      settled = true;
      cleanup();
      resolve(msg);
    };
    adapter.onSysEx(handler);
    setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(null);
    }, timeoutMs);
  });
}

export async function probeForRolandDevice(
  transport: MidiTransport,
  inputs: MidiPortInfo[],
  outputs: MidiPortInfo[],
  options: ProbeOptions = {},
): Promise<ProbeMatch | null> {
  const timeoutMs = options.timeoutMs ?? 350;
  const pairs = buildCandidatePairs(inputs, outputs);

  for (const pair of pairs) {
    options.onProbe?.(pair.output.name);

    let connection: Awaited<ReturnType<MidiTransport['connect']>> | null = null;
    try {
      connection = await transport.connect(pair.input.id, pair.output.id);
    } catch (err) {
      // Common when the OS hands the port to another app; not a
      // device-level failure. Try the next pair.
      console.warn('[probeForRolandDevice] connect failed for', pair.output.name, err);
      continue;
    }

    try {
      const replyPromise = waitForRolandReply(connection.adapter, timeoutMs);
      connection.adapter.send(IDENTITY_REQUEST);
      const reply = await replyPromise;
      if (reply) {
        return {
          inputId: pair.input.id,
          outputId: pair.output.id,
          inputName: pair.input.name,
          outputName: pair.output.name,
        };
      }
    } finally {
      try {
        await connection.disconnect();
      } catch {
        // ignore disconnect failures — best-effort cleanup
      }
    }
  }

  return null;
}
