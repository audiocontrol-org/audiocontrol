/**
 * SysEx Logging Wrapper
 *
 * Decorates any MidiIO implementation with hex dump logging of all
 * SysEx traffic. Used by the CLI test harness in --verbose mode.
 */

import type { MidiIO, SysExCallback } from '@audiocontrol/midi-core';

function hexDump(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

function timestamp(): string {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

export function createLoggingMidiIO(
  inner: MidiIO,
  logger: (msg: string) => void = console.log,
): MidiIO {
  return {
    send(message: number[]): void {
      logger(`[${timestamp()}] TX ${message.length} bytes: ${hexDump(message)}`);
      inner.send(message);
    },

    onSysEx(callback: SysExCallback): void {
      const wrappedCallback: SysExCallback = (message: number[]) => {
        logger(`[${timestamp()}] RX ${message.length} bytes: ${hexDump(message)}`);
        callback(message);
      };
      inner.onSysEx(wrappedCallback);
    },

    removeSysExListener(callback: SysExCallback): void {
      inner.removeSysExListener(callback);
    },
  };
}
