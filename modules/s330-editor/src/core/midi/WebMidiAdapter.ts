/**
 * Web MIDI API adapter for S-330 SysEx communication
 *
 * Implements the S330MidiIO interface using the Web MIDI API,
 * enabling direct browser-to-hardware communication.
 */

import type { S330MidiIO, SysExCallback, MidiPortInfo, WebMidiAccess } from './types';

/**
 * Check if Web MIDI API is available
 */
export function isWebMidiSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

/**
 * Get browser compatibility information
 */
export function getBrowserCompatibility(): {
  supported: boolean;
  browser: string;
  notes: string;
} {
  const ua = navigator.userAgent;

  if (ua.includes('Chrome') || ua.includes('Chromium')) {
    return { supported: true, browser: 'Chrome', notes: 'Full support with SysEx' };
  }
  if (ua.includes('Edg')) {
    return { supported: true, browser: 'Edge', notes: 'Full support with SysEx' };
  }
  if (ua.includes('Opera')) {
    return { supported: true, browser: 'Opera', notes: 'Full support with SysEx' };
  }
  if (ua.includes('Firefox')) {
    return {
      supported: false,
      browser: 'Firefox',
      notes: 'Web MIDI requires about:config flag (dom.webmidi.enabled)',
    };
  }
  if (ua.includes('Safari') && !ua.includes('Chrome')) {
    return { supported: false, browser: 'Safari', notes: 'Web MIDI not supported' };
  }

  return { supported: isWebMidiSupported(), browser: 'Unknown', notes: '' };
}

/**
 * Request Web MIDI access with SysEx support
 */
export async function requestMidiAccess(): Promise<WebMidiAccess> {
  if (!isWebMidiSupported()) {
    throw new Error('Web MIDI API not available. Please use Chrome, Edge, or Opera.');
  }

  console.log('[WebMIDI] Requesting MIDI access with SysEx...');
  const access = await navigator.requestMIDIAccess({ sysex: true });
  console.log('[WebMIDI] MIDI access granted, sysexEnabled:', access.sysexEnabled);

  const inputs: MidiPortInfo[] = [];
  const outputs: MidiPortInfo[] = [];

  console.log('[WebMIDI] Input ports count:', access.inputs.size);
  access.inputs.forEach((port) => {
    console.log('[WebMIDI] Input port:', port.id, port.name, port.state);
    inputs.push({
      id: port.id,
      name: port.name ?? `Input ${port.id}`,
      manufacturer: port.manufacturer ?? undefined,
      state: port.state,
    });
  });

  console.log('[WebMIDI] Output ports count:', access.outputs.size);
  access.outputs.forEach((port) => {
    console.log('[WebMIDI] Output port:', port.id, port.name, port.state);
    outputs.push({
      id: port.id,
      name: port.name ?? `Output ${port.id}`,
      manufacturer: port.manufacturer ?? undefined,
      state: port.state,
    });
  });

  console.log('[WebMIDI] Parsed inputs:', inputs.length, 'outputs:', outputs.length);

  return {
    inputs,
    outputs,
    sysExEnabled: access.sysexEnabled,
  };
}

/**
 * Create a Web MIDI adapter implementing S330MidiIO interface
 *
 * This adapter handles chunked SysEx messages from the Web MIDI API.
 * Some browsers may deliver large SysEx messages in multiple chunks:
 * - First chunk starts with 0xF0, may not end with 0xF7
 * - Middle chunks don't start with 0xF0, don't end with 0xF7
 * - Last chunk doesn't start with 0xF0, ends with 0xF7
 *
 * @param input - Web MIDI input port
 * @param output - Web MIDI output port
 * @returns S330MidiIO adapter
 */
export function createWebMidiAdapter(
  input: MIDIInput,
  output: MIDIOutput
): S330MidiIO {
  const listeners = new Map<SysExCallback, (e: MIDIMessageEvent) => void>();

  // Buffer for accumulating chunked SysEx messages
  let sysExBuffer: number[] = [];
  let isReceivingSysEx = false;

  return {
    send(message: number[]): void {
      console.log('[WebMIDI] Sending:', message.map(b => b.toString(16).padStart(2, '0')).join(' '));
      output.send(new Uint8Array(message));
    },

    onSysEx(callback: SysExCallback): void {
      const listener = (e: MIDIMessageEvent) => {
        if (!e.data || e.data.length === 0) return;

        const data = Array.from(e.data);
        const firstByte = data[0];
        const lastByte = data[data.length - 1];

        // Log ALL incoming MIDI messages for debugging
        console.log('[WebMIDI] Received MIDI:', {
          length: data.length,
          first: firstByte.toString(16),
          last: lastByte.toString(16),
          isSysExStart: firstByte === 0xF0,
          isSysExEnd: lastByte === 0xF7,
          preview: data.slice(0, 10).map(b => b.toString(16).padStart(2, '0')).join(' '),
        });

        // Case 1: Complete SysEx message (starts with F0, ends with F7)
        if (firstByte === 0xF0 && lastByte === 0xF7) {
          console.log('[WebMIDI] Complete SysEx:', data.length, 'bytes');
          callback(data);
          return;
        }

        // Case 2: Start of chunked SysEx (starts with F0, doesn't end with F7)
        if (firstByte === 0xF0 && lastByte !== 0xF7) {
          console.log('[WebMIDI] SysEx chunk start:', data.length, 'bytes');
          sysExBuffer = data;
          isReceivingSysEx = true;
          return;
        }

        // Case 3: Middle or end of chunked SysEx
        if (isReceivingSysEx) {
          sysExBuffer.push(...data);

          // Check if this is the end chunk
          if (lastByte === 0xF7) {
            console.log('[WebMIDI] SysEx chunk end, total:', sysExBuffer.length, 'bytes');
            callback(sysExBuffer);
            sysExBuffer = [];
            isReceivingSysEx = false;
          } else {
            console.log('[WebMIDI] SysEx chunk middle:', data.length, 'bytes, total:', sysExBuffer.length);
          }
          return;
        }

        // Case 4: Regular MIDI message (not SysEx) - ignore
        // This includes note on/off, CC, etc.
      };
      listeners.set(callback, listener);
      input.addEventListener('midimessage', listener);
    },

    removeSysExListener(callback: SysExCallback): void {
      const listener = listeners.get(callback);
      if (listener) {
        input.removeEventListener('midimessage', listener);
        listeners.delete(callback);
      }
    },
  };
}

/**
 * Open MIDI ports by ID and create adapter
 *
 * @param inputId - Input port ID
 * @param outputId - Output port ID
 * @returns Promise resolving to S330MidiIO adapter
 */
export async function openMidiPorts(
  inputId: string,
  outputId: string
): Promise<{ adapter: S330MidiIO; cleanup: () => Promise<void> }> {
  if (!isWebMidiSupported()) {
    throw new Error('Web MIDI API not available');
  }

  const access = await navigator.requestMIDIAccess({ sysex: true });

  const input = access.inputs.get(inputId);
  const output = access.outputs.get(outputId);

  if (!input) {
    throw new Error(`MIDI input port not found: ${inputId}`);
  }
  if (!output) {
    throw new Error(`MIDI output port not found: ${outputId}`);
  }

  await input.open();
  await output.open();

  const adapter = createWebMidiAdapter(input, output);

  const cleanup = async () => {
    await input.close();
    await output.close();
  };

  return { adapter, cleanup };
}
