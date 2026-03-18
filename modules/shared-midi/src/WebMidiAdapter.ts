/**
 * Web MIDI API adapter for SysEx communication
 *
 * Implements the MidiIO interface using the Web MIDI API,
 * enabling direct browser-to-hardware communication.
 *
 * Handles chunked SysEx messages that may be split across multiple events.
 */

import type { MidiIO, SysExCallback, MidiPortInfo, WebMidiAccess, BrowserCompatibility } from './types';

/**
 * Check if running in a secure context (HTTPS or localhost)
 */
export function isSecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true;
}

/**
 * Check if Web MIDI API is available
 */
export function isWebMidiSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

/**
 * Get browser compatibility information
 */
export function getBrowserCompatibility(): BrowserCompatibility {
  const ua = navigator.userAgent;

  // Check for secure context first - this affects all browsers
  if (!isSecureContext()) {
    let browser = 'your browser';
    if (ua.includes('Chrome') || ua.includes('Chromium')) browser = 'Chrome';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Opera')) browser = 'Opera';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';

    return {
      supported: false,
      browser,
      notes: 'Web MIDI requires a secure context (HTTPS or localhost)',
      requiresSecureContext: true,
    };
  }

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

  const access = await navigator.requestMIDIAccess({ sysex: true });

  const inputs: MidiPortInfo[] = [];
  const outputs: MidiPortInfo[] = [];

  access.inputs.forEach((port) => {
    const midiPort: MidiPortInfo = {
      id: port.id,
      name: port.name ?? `Input ${port.id}`,
      state: port.state,
    };
    if (port.manufacturer) {
      midiPort.manufacturer = port.manufacturer;
    }
    inputs.push(midiPort);
  });

  access.outputs.forEach((port) => {
    const midiPort: MidiPortInfo = {
      id: port.id,
      name: port.name ?? `Output ${port.id}`,
      state: port.state,
    };
    if (port.manufacturer) {
      midiPort.manufacturer = port.manufacturer;
    }
    outputs.push(midiPort);
  });

  return {
    inputs,
    outputs,
    sysExEnabled: access.sysexEnabled,
  };
}

/**
 * Create a Web MIDI adapter implementing MidiIO interface
 *
 * This adapter handles chunked SysEx messages from the Web MIDI API.
 * Some browsers may deliver large SysEx messages in multiple chunks:
 * - First chunk starts with 0xF0, may not end with 0xF7
 * - Middle chunks don't start with 0xF0, don't end with 0xF7
 * - Last chunk doesn't start with 0xF0, ends with 0xF7
 *
 * @param input - Web MIDI input port
 * @param output - Web MIDI output port
 * @returns MidiIO adapter
 */
export function createWebMidiAdapter(input: MIDIInput, output: MIDIOutput): MidiIO {
  const listeners = new Map<SysExCallback, (e: MIDIMessageEvent) => void>();

  // Buffer for accumulating chunked SysEx messages
  let sysExBuffer: number[] = [];
  let isReceivingSysEx = false;

  return {
    send(message: number[]): void {
      // Wrap in Uint8Array for broader browser compatibility.
      // The Web MIDI spec accepts Uint8Array but TS DOM types only declare number[].
      output.send(new Uint8Array(message) as unknown as number[]);
    },

    onSysEx(callback: SysExCallback): void {
      const listener = (e: MIDIMessageEvent) => {
        if (!e.data || e.data.length === 0) return;

        const data = Array.from(e.data);
        const firstByte = data[0];
        const lastByte = data[data.length - 1];

        // Case 1: Complete SysEx message (starts with F0, ends with F7)
        if (firstByte === 0xf0 && lastByte === 0xf7) {
          callback(data);
          return;
        }

        // Case 2: Start of chunked SysEx (starts with F0, doesn't end with F7)
        if (firstByte === 0xf0 && lastByte !== 0xf7) {
          sysExBuffer = data;
          isReceivingSysEx = true;
          return;
        }

        // Case 3: Middle or end of chunked SysEx
        if (isReceivingSysEx) {
          sysExBuffer.push(...data);

          // Check if this is the end chunk
          if (lastByte === 0xf7) {
            callback(sysExBuffer);
            sysExBuffer = [];
            isReceivingSysEx = false;
          }
          return;
        }

        // Case 4: Regular MIDI message (not SysEx) - ignore
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
 * @returns Promise resolving to MidiIO adapter and cleanup function
 */
export async function openMidiPorts(
  inputId: string,
  outputId: string
): Promise<{ adapter: MidiIO; cleanup: () => Promise<void> }> {
  if (!isWebMidiSupported()) {
    throw new Error('Web MIDI API not available');
  }

  const access = await navigator.requestMIDIAccess({ sysex: true });

  let input: MIDIInput | undefined;
  let output: MIDIOutput | undefined;

  access.inputs.forEach((port) => {
    if (port.id === inputId) {
      input = port;
    }
  });

  access.outputs.forEach((port) => {
    if (port.id === outputId) {
      output = port;
    }
  });

  if (!input) {
    throw new Error(`MIDI input port not found: ${inputId}`);
  }
  if (!output) {
    throw new Error(`MIDI output port not found: ${outputId}`);
  }

  const selectedInput = input;
  const selectedOutput = output;

  await selectedInput.open();
  await selectedOutput.open();

  const adapter = createWebMidiAdapter(selectedInput, selectedOutput);

  const cleanup = async () => {
    await selectedInput.close();
    await selectedOutput.close();
  };

  return { adapter, cleanup };
}
