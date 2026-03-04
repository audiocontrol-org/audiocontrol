/**
 * D-110 Device Scanner
 *
 * Scans all MIDI output ports and device IDs (0x10-0x1F) to find connected D-110 synthesizers.
 * Uses RQ1 probe messages and listens for DT1 responses on ALL inputs simultaneously.
 */

import type { D110ScanResult, D110Scanner, D110ScannerConfig } from '@/core/midi/types';
import {
  ROLAND_ID,
  D110_MODEL_ID,
  D110_COMMANDS,
  SYSEX_START,
  SYSEX_END,
  SYSTEM_PARAMS_SIZE,
} from '@/core/midi/constants';
import { buildRQ1Message, getSystemAddress } from '@/core/midi/sysex';

/** Default scanner configuration */
const DEFAULT_CONFIG: Required<Omit<D110ScannerConfig, 'onProgress'>> = {
  probeTimeoutMs: 100,
  probeDelayMs: 20,
  portDelayMs: 200,
};

/** Port name patterns that are more likely to have synths connected (prioritize these) */
const PRIORITY_PORT_PATTERNS = [
  /timepiece/i,
  /motu/i,
  /mtp/i,
  /midisport/i,
  /um-/i,  // Roland UM-ONE etc
  /roland/i,
  /midi express/i,
  /fastlane/i,
];

/** Patterns to skip for virtual/IAC ports that could cause loops */
const VIRTUAL_PORT_PATTERNS = [
  /iac/i,
  /virtual/i,
  /loop/i,
  /internal/i,
  /midi through/i,
];

/**
 * Check if a port name indicates a virtual/loopback port
 */
function isVirtualPort(portName: string): boolean {
  return VIRTUAL_PORT_PATTERNS.some((pattern) => pattern.test(portName));
}

/**
 * Check if a SysEx message is a valid D-110 DT1 response (any device ID)
 */
function parseD110Response(data: Uint8Array): { isValid: boolean; deviceId: number } {
  if (data.length < 11) return { isValid: false, deviceId: 0 };
  if (data[0] !== SYSEX_START) return { isValid: false, deviceId: 0 };
  if (data[1] !== ROLAND_ID) return { isValid: false, deviceId: 0 };
  if (data[3] !== D110_MODEL_ID) return { isValid: false, deviceId: 0 };
  if (data[4] !== D110_COMMANDS.DATA) return { isValid: false, deviceId: 0 };
  if (data[data.length - 1] !== SYSEX_END) return { isValid: false, deviceId: 0 };
  return { isValid: true, deviceId: data[2] };
}

/**
 * Create a D-110 device scanner
 *
 * @param midiAccess - Web MIDI API access object
 * @param config - Scanner configuration
 * @returns Scanner interface
 */
export function createD110Scanner(
  midiAccess: MIDIAccess,
  config: D110ScannerConfig = {}
): D110Scanner {
  const probeTimeoutMs = config.probeTimeoutMs ?? DEFAULT_CONFIG.probeTimeoutMs;
  const probeDelayMs = config.probeDelayMs ?? DEFAULT_CONFIG.probeDelayMs;
  const portDelayMs = config.portDelayMs ?? DEFAULT_CONFIG.portDelayMs;
  const onProgress = config.onProgress;
  const stopOnFirstDevice = config.stopOnFirstDevice ?? true; // Default to stopping on first device
  const onDeviceFound = config.onDeviceFound;

  let cancelled = false;
  let scanning = false;

  /**
   * Run the full scan
   */
  async function scan(): Promise<D110ScanResult[]> {
    if (scanning) {
      throw new Error('Scan already in progress');
    }

    cancelled = false;
    scanning = true;
    const results: D110ScanResult[] = [];
    const listeners: Array<{ input: MIDIInput; handler: EventListener }> = [];

    try {
      // Get all available ports
      const inputs = Array.from(midiAccess.inputs.values());
      const outputs = Array.from(midiAccess.outputs.values());

      console.log('[D110Scanner] Available inputs:', inputs.map((p) => p.name));
      console.log('[D110Scanner] Available outputs:', outputs.map((p) => p.name));

      // Filter out virtual/IAC ports
      const realInputs = inputs.filter((p) => !isVirtualPort(p.name ?? ''));
      const realOutputs = outputs.filter((p) => !isVirtualPort(p.name ?? ''));

      // Sort outputs to prioritize likely synth ports (Timepiece, MOTU, etc.)
      const sortedOutputs = [...realOutputs].sort((a, b) => {
        const aName = a.name ?? '';
        const bName = b.name ?? '';
        const aPriority = PRIORITY_PORT_PATTERNS.some((p) => p.test(aName));
        const bPriority = PRIORITY_PORT_PATTERNS.some((p) => p.test(bName));
        if (aPriority && !bPriority) return -1;
        if (!aPriority && bPriority) return 1;
        return 0;
      });

      console.log('[D110Scanner] After filtering - inputs:', realInputs.map((p) => p.name));
      console.log('[D110Scanner] Sorted outputs (priority first):', sortedOutputs.map((p) => p.name));

      if (realInputs.length === 0 || sortedOutputs.length === 0) {
        onProgress?.('No MIDI ports available');
        return [];
      }

      // Track found devices to avoid duplicates
      const foundDevices = new Map<string, D110ScanResult>();
      let currentOutput: MIDIOutput | null = null;
      let deviceFoundEarly = false;

      // Open all inputs and set up listeners
      console.log('[D110Scanner] Opening all input ports...');
      for (const input of realInputs) {
        try {
          if (input.state === 'disconnected') {
            await input.open();
          }

          const handler = ((event: MIDIMessageEvent): void => {
            const data = event.data;
            if (!data || data[0] !== SYSEX_START) return;

            console.log(
              `[D110Scanner] SysEx on ${input.name}:`,
              Array.from(data).map((b) => b.toString(16).padStart(2, '0')).join(' ')
            );

            const parsed = parseD110Response(data);
            if (parsed.isValid && currentOutput) {
              const key = `${currentOutput.id}:${input.id}:${parsed.deviceId}`;
              if (!foundDevices.has(key)) {
                const result: D110ScanResult = {
                  inputPortId: input.id,
                  outputPortId: currentOutput.id,
                  inputPortName: input.name ?? `Input ${input.id}`,
                  outputPortName: currentOutput.name ?? `Output ${currentOutput.id}`,
                  deviceId: parsed.deviceId,
                  userDeviceId: parsed.deviceId + 1,
                };
                foundDevices.set(key, result);
                console.log(
                  `[D110Scanner] FOUND D-110! Output: ${result.outputPortName}, Input: ${result.inputPortName}, Device ID: ${result.userDeviceId}`
                );

                // Notify immediately and optionally stop scanning
                onDeviceFound?.(result);
                if (stopOnFirstDevice) {
                  deviceFoundEarly = true;
                  cancelled = true; // Stop the scan loop
                }
              }
            }
          }) as EventListener;

          input.addEventListener('midimessage', handler);
          listeners.push({ input, handler });
        } catch (err) {
          console.warn(`[D110Scanner] Could not open input ${input.name}:`, err);
        }
      }

      console.log(`[D110Scanner] Listening on ${listeners.length} inputs`);

      // Scan each output port
      const totalOutputs = sortedOutputs.length;
      let outputIndex = 0;

      for (const output of sortedOutputs) {
        if (cancelled) break;

        outputIndex++;
        const portName = output.name ?? output.id;
        onProgress?.(`Scanning ${portName} (${outputIndex}/${totalOutputs})...`);
        console.log(`[D110Scanner] Scanning output: ${portName}`);

        try {
          if (output.state === 'disconnected') {
            await output.open();
          }

          currentOutput = output;

          // Scan D-110 device ID range: 0x10-0x1F (user IDs 17-32)
          for (let deviceId = 0x10; deviceId <= 0x1f; deviceId++) {
            if (cancelled) break;

            // Build and send RQ1 probe for system parameters
            const probe = buildRQ1Message(getSystemAddress(), SYSTEM_PARAMS_SIZE, deviceId);
            output.send(probe);

            // Wait for response
            await delay(probeTimeoutMs);

            // Small delay between probes
            if (deviceId < 0x1f) {
              await delay(probeDelayMs);
            }
          }

          // Delay between output ports
          if (outputIndex < totalOutputs) {
            await delay(portDelayMs);
          }
        } catch (err) {
          console.warn(`[D110Scanner] Error scanning output ${portName}:`, err);
        }
      }

      // Collect results
      results.push(...foundDevices.values());

      if (results.length > 0) {
        onProgress?.(`Found ${results.length} D-110 device(s)`);
      }

      return results;
    } finally {
      // Clean up listeners
      for (const { input, handler } of listeners) {
        try {
          input.removeEventListener('midimessage', handler);
        } catch {
          // Ignore cleanup errors
        }
      }
      scanning = false;
    }
  }

  return {
    scan,
    cancel: () => {
      cancelled = true;
    },
    isScanning: () => scanning,
  };
}

/**
 * Delay helper
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
