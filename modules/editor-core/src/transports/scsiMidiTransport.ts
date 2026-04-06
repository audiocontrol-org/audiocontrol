/**
 * SCSI MIDI Transport - MIDI communication via Pi SCSI bridge daemon
 *
 * This transport implements the MidiTransport interface by wrapping the
 * lower-level createScsiMidiTransport from midi-core. It enables
 * communication with SCSI-based samplers (e.g., Akai S3000XL) connected
 * via a Raspberry Pi running scsi2pi.
 */

import type { MidiPortInfo } from '@audiocontrol/midi-core';
import {
  createScsiMidiTransport as createScsiMidiCoreTransport,
  type ScsiDevice,
} from '@audiocontrol/midi-core';
import type {
  MidiTransport,
  MidiTransportBrowserInfo,
  MidiTransportConnection,
  MidiTransportPorts,
} from '@/transports/types';

export interface ScsiMidiTransportConfig {
  bridgeUrl: string;
}

function deviceToPortInfo(device: ScsiDevice): MidiPortInfo {
  return {
    id: `scsi-${device.id}`,
    name: `${device.vendor} ${device.product} (SCSI ${device.id})`,
    state: 'connected' as const,
  };
}

export function createScsiMidiTransport(config: ScsiMidiTransportConfig): MidiTransport {
  const scsi = createScsiMidiCoreTransport({ bridgeUrl: config.bridgeUrl });
  let cachedDevices: ScsiDevice[] = [];

  const browserInfo: MidiTransportBrowserInfo = {
    supported: true,
    browser: 'SCSI MIDI',
    notes: 'MIDI via SCSI bridge on Raspberry Pi.',
  };

  async function scanAndMapPorts(): Promise<MidiTransportPorts> {
    cachedDevices = await scsi.scanDevices();
    const ports: MidiPortInfo[] = cachedDevices.map(deviceToPortInfo);

    // SCSI is bidirectional — inputs and outputs are the same
    return {
      inputs: ports,
      outputs: ports,
      sysExEnabled: true,
    };
  }

  return {
    kind: 'scsi-midi',

    isSupported: () => true,

    getBrowserInfo: () => browserInfo,

    initialize: async (): Promise<MidiTransportPorts> => {
      await scsi.connect();
      return scanAndMapPorts();
    },

    refresh: async (): Promise<MidiTransportPorts> => {
      return scanAndMapPorts();
    },

    // SCSI devices don't hot-plug — no state change events
    onStateChange: () => {},

    connect: async (inputId: string, _outputId: string): Promise<MidiTransportConnection> => {
      const device = cachedDevices.find((d) => `scsi-${d.id}` === inputId);
      if (!device) {
        throw new Error(`SCSI device not found for port: ${inputId}`);
      }

      const portInfo = deviceToPortInfo(device);

      return {
        adapter: scsi.adapter,
        inputInfo: portInfo,
        outputInfo: portInfo,
        disconnect: async () => {
          scsi.disconnect();
        },
      };
    },
  };
}
