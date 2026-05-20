/**
 * probeForRolandDevice — parallel handshake-style auto-detect of
 * a Roland sampler/synth across the visible MIDI ports.
 *
 * Algorithm (per operator guidance 2026-05-20):
 *   1. Filter out loopback ports (macOS IAC Driver, Windows
 *      loopMIDI, generic virtual/network cables). Probing them
 *      would echo our own Identity Request back as the "reply"
 *      and produce a false positive.
 *   2. Open every non-loopback (input, output) pair in PARALLEL.
 *      Connections cover every non-loopback input as a listener
 *      and every non-loopback output as a sender; max(N, K)
 *      connections are opened to guarantee both lists are
 *      fully covered.
 *   3. Attach a SysEx listener on every unique input and fire
 *      the Universal Non-Realtime Identity Request
 *      `F0 7E 7F 06 01 F7` on every unique output simultaneously.
 *   4. Race a single timeout window against all listeners. The
 *      first input to receive a Roland Identity Reply (manufacturer
 *      id 0x41) wins.
 *   5. The matching OUTPUT can't be derived from the reply bytes
 *      themselves (Identity Reply doesn't echo the output port
 *      that elicited it). We narrow it by name-similarity heuristic
 *      against the inputs name — robust because by this point we
 *      already know WHICH input replied, so the candidate set is
 *      just the outputs we actually sent to, and the device's
 *      input/output names usually agree at the host's port label.
 *
 * Why same-index pairing is rejected: Web MIDI / easymidi /
 * CoreMIDI return inputs and outputs as independent lists. The
 * indices CAN diverge — a controller appears only in inputs, a
 * SysEx-only synth only in outputs, multi-port interfaces label
 * ports differently across the two lists. Pairing by name with
 * an on-reply fuzzy scorer survives all of these.
 *
 * Why no Pi-MIDI / scsi-bridge handling: this probe is only used
 * by the Web MIDI / easymidi transport paths. Other transports
 * (HTTP / simulated) have their own ready-state semantics and
 * don't need the handshake.
 */

import type { MidiPortInfo } from '@audiocontrol/midi-core';
import type { MidiTransport, MidiTransportConnection } from './types';

export interface ProbeMatch {
  inputId: string;
  outputId: string;
  inputName: string;
  outputName: string;
}

export interface ProbeOptions {
  /** Per-attempt wait windows (ms). The probe sends an Identity
   *  Request, waits the first value, re-sends + waits the next.
   *
   *  Defaults to [500, 1500] (2000ms ceiling):
   *  - MIDI baud is 31.25 kbps. A 6-byte Identity Request takes
   *    ~2ms wire-time; a 15-byte reply ~5ms. A vintage Roland's
   *    device-side processing is well under 50ms. Healthy round-
   *    trip lands at ~60–150ms. 500ms is generous coverage.
   *  - The second attempt catches USB MIDI port-settle delays
   *    where the first request was eaten by a driver still warming
   *    up. 1500ms is overkill for round-trip but the doubling
   *    signals "we tried harder" in observable logs.
   *  - Total ceiling 2s stays under the ~3s "user wonders if it
   *    hung" UX threshold. A third attempt wouldn't catch any
   *    case the second misses. */
  attempts?: readonly number[];
  /** Optional progress callback fired as each candidate output is
   *  pinged. Lets the caller show "Probing <port>…" status, though
   *  with the parallel shape every output fires near-simultaneously. */
  onProbe?: (portName: string) => void;
}

/**
 * Roland RQ1 (one-shot Data Request) for 2 bytes at address 0.
 *
 *   F0 41 <devId> 1E 11 <addr×4> <size×4> <checksum> F7
 *
 * The S-330 (1988) and S-550 (1989-90) predate the MMA Universal
 * Non-Realtime Identity Request (1991) and don't respond to it.
 * They DO respond to Roland's proprietary RQ1 with a DT1 reply
 * (`F0 41 <devId> 1E 12 ...`) within ~15ms — verified live via
 * `make probe-roland-diag` against a connected device 2026-05-20.
 *
 * Device ID byte is 0x00 — the default front-panel "1" setting.
 * The reply matcher accepts any device-ID in the reply so the
 * probe still succeeds against operators who've changed it.
 *
 * Checksum 0x7C = (0x80 - (0x04 mod 0x80)) & 0x7F for the sum of
 * address (0+0+0+0) + size (0+0+0+4) = 4.
 */
const ROLAND_RQ1_PROBE = [
  0xf0, 0x41, 0x00, 0x1e, 0x11,
  0x00, 0x00, 0x00, 0x00, // address
  0x00, 0x00, 0x00, 0x04, // size (4 nibbles = 2 bytes)
  0x7c, // checksum
  0xf7,
];

const LOOPBACK_PATTERNS = /(iac|loopmidi|loopback|virtual|network|midifire)/i;

function isLoopback(port: MidiPortInfo): boolean {
  return LOOPBACK_PATTERNS.test(port.name);
}

/** Roland S-330/S-550 response shape: `F0 41 <devId> 1E <cmd>`
 *  where cmd is DT1 (0x12, reply to RQ1) or DAT (0x42, reply to
 *  RQD). Either confirms a Roland S-series sampler is alive on
 *  the port. */
function isRolandSSeriesReply(message: number[]): boolean {
  if (message.length < 6) return false;
  if (message[0] !== 0xf0) return false;
  if (message[1] !== 0x41) return false; // Roland mfg id
  // message[2] = device id (any value 0x00-0x7F)
  if (message[3] !== 0x1e) return false; // S-series model id
  const cmd = message[4];
  return cmd === 0x12 || cmd === 0x42;
}

// ─── Name-similarity heuristic ───────────────────────────────────
//
// MIDI port names are nominally arbitrary strings — there's no
// canonical "device id" to match input↔output on. After a reply
// lands on a specific input we know its name. Pick the output whose
// normalized form has the longest common subsequence ratio with
// that input's name. Captures exact matches ("Volt 4" → "Volt 4"),
// direction-suffix variants ("XYZ MIDI In" → "XYZ MIDI Out"), and
// numbered-bus variants ("USB MIDI 2" → "USB MIDI 2") without a
// brittle regex pattern.

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function longestCommonSubsequenceLen(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0 || n === 0) return 0;
  // Single-row DP — m × n with O(n) memory.
  const dp = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    let prev = 0;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

function similarity(a: string, b: string): number {
  const aN = normalize(a);
  const bN = normalize(b);
  if (aN === bN) return 1;
  const max = Math.max(aN.length, bN.length);
  return max === 0 ? 0 : longestCommonSubsequenceLen(aN, bN) / max;
}

function bestOutputForInput(
  inputName: string,
  outputs: MidiPortInfo[],
): MidiPortInfo | null {
  if (outputs.length === 0) return null;
  let best = outputs[0];
  let bestScore = similarity(inputName, best.name);
  for (let i = 1; i < outputs.length; i++) {
    const score = similarity(inputName, outputs[i].name);
    if (score > bestScore) {
      best = outputs[i];
      bestScore = score;
    }
  }
  return best;
}

// ─── Parallel probe ──────────────────────────────────────────────

interface OpenSlot {
  inputId: string;
  inputName: string;
  outputId: string;
  outputName: string;
  connection: MidiTransportConnection;
}

/** Open enough connections to cover every input (as listener) and
 *  every output (as sender). `max(N, K)` connections suffice when
 *  pairs cycle the smaller list. Some opens may fail (port held by
 *  another app) — those are silently dropped. */
async function openCoverageSet(
  transport: MidiTransport,
  inputs: MidiPortInfo[],
  outputs: MidiPortInfo[],
): Promise<OpenSlot[]> {
  const count = Math.max(inputs.length, outputs.length);
  const attempts = Array.from({ length: count }, (_, i) => ({
    input: inputs[i % inputs.length],
    output: outputs[i % outputs.length],
  }));

  const results = await Promise.allSettled(
    attempts.map(async ({ input, output }) => {
      const connection = await transport.connect(input.id, output.id);
      return {
        inputId: input.id,
        inputName: input.name,
        outputId: output.id,
        outputName: output.name,
        connection,
      } satisfies OpenSlot;
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<OpenSlot> => r.status === 'fulfilled')
    .map((r) => r.value);
}

const DEFAULT_ATTEMPTS = [500, 1500] as const;

export async function probeForRolandDevice(
  transport: MidiTransport,
  inputs: MidiPortInfo[],
  outputs: MidiPortInfo[],
  options: ProbeOptions = {},
): Promise<ProbeMatch | null> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const realInputs = inputs.filter((p) => !isLoopback(p));
  const realOutputs = outputs.filter((p) => !isLoopback(p));
  if (realInputs.length === 0 || realOutputs.length === 0) return null;

  const slots = await openCoverageSet(transport, realInputs, realOutputs);
  if (slots.length === 0) return null;

  // Pre-build the unique input + output slot maps so each attempt
  // reuses the same listener / sender set. Listeners attach once
  // outside the retry loop; only the SEND fires per attempt.
  const uniqueInputs = dedupeBy(slots, (s) => s.inputId);
  const uniqueOutputs = dedupeBy(slots, (s) => s.outputId);

  let resolved: ProbeMatch | null = null;
  const handlers: Array<{ slot: OpenSlot; handler: (msg: number[]) => void }> = [];

  const cleanup = (): void => {
    for (const { slot, handler } of handlers) {
      slot.connection.adapter.removeSysExListener(handler);
    }
    handlers.length = 0;
  };

  const replyPromise = new Promise<ProbeMatch>((resolveMatch) => {
    for (const slot of uniqueInputs) {
      const handler = (msg: number[]): void => {
        if (resolved) return;
        if (!isRolandSSeriesReply(msg)) return;
        // The reply identifies WHICH input received it; pick the
        // most-similar-named output from the ones we sent to.
        const match = bestOutputForInput(slot.inputName, realOutputs);
        if (!match) return;
        resolved = {
          inputId: slot.inputId,
          outputId: match.id,
          inputName: slot.inputName,
          outputName: match.name,
        };
        resolveMatch(resolved);
      };
      handlers.push({ slot, handler });
      slot.connection.adapter.onSysEx(handler);
    }
  });

  try {
    for (const waitMs of attempts) {
      // Send Identity Request on every unique output simultaneously.
      for (const slot of uniqueOutputs) {
        options.onProbe?.(slot.outputName);
        try {
          slot.connection.adapter.send(ROLAND_RQ1_PROBE);
        } catch (err) {
          console.warn('[probeForRolandDevice] send failed for', slot.outputName, err);
        }
      }
      // Race the listener against this attempt's wait window.
      const settled = await Promise.race([
        replyPromise.then((m) => ({ kind: 'match', match: m }) as const),
        wait(waitMs).then(() => ({ kind: 'timeout' }) as const),
      ]);
      if (settled.kind === 'match') return settled.match;
      // Otherwise loop to next (longer) attempt.
    }
    return null;
  } finally {
    cleanup();
    await Promise.allSettled(slots.map((s) => s.connection.disconnect()));
  }
}

function dedupeBy<T, K>(list: T[], key: (t: T) => K): T[] {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const item of list) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
