declare module '@audiocontrol/midi-core' {
  export interface MidiPortInfo {
    id: string;
    name: string;
    manufacturer?: string;
    state: 'connected' | 'disconnected';
  }

  export type SysExCallback = (message: number[]) => void;

  export interface MidiIO {
    send(message: number[]): void;
    onSysEx(callback: SysExCallback): void;
    removeSysExListener(callback: SysExCallback): void;
  }

  export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

  export interface WebMidiAccess {
    inputs: MidiPortInfo[];
    outputs: MidiPortInfo[];
    sysExEnabled: boolean;
  }

  export interface BrowserCompatibility {
    supported: boolean;
    browser: string;
    notes: string;
  }

  export function isWebMidiSupported(): boolean;
  export function getBrowserCompatibility(): BrowserCompatibility;
  export function requestMidiAccess(): Promise<WebMidiAccess>;
  export function createWebMidiAdapter(input: MIDIInput, output: MIDIOutput): MidiIO;

  // SDS channel types
  export interface SdsTransferProgress {
    packetsSent: number;
    packetsTotal: number;
    bytesSent: number;
    bytesTotal: number;
  }

  export interface SdsDumpHeader {
    sampleNumber: number;
    sampleFormat: number;
    samplePeriodNs: number;
    sampleLength: number;
    loopStart: number;
    loopEnd: number;
    loopType: number;
  }

  export interface SdsChannel {
    uploadSample(
      sampleNumber: number,
      channel: number,
      sampleRate: number,
      samples: Int16Array,
      onProgress?: (progress: SdsTransferProgress) => void,
    ): Promise<void>;

    downloadSample(
      sampleNumber: number,
      channel: number,
      onProgress?: (progress: SdsTransferProgress) => void,
    ): Promise<{ header: SdsDumpHeader; samples: Int16Array }>;
  }

  // SCSI MIDI transport types
  export interface ScsiMidiBridgeStatus {
    version: string;
    scsi2piVersion: string;
    boardId: number;
    samplerReachable: boolean;
  }

  export interface ScsiDevice {
    id: number;
    vendor: string;
    product: string;
    revision: string;
  }

  export interface ScsiMidiTransportOptions {
    bridgeUrl: string;
  }

  export function createScsiMidiTransport(options: ScsiMidiTransportOptions): {
    adapter: MidiIO;
    sdsChannel: SdsChannel;
    connect: () => Promise<ScsiMidiBridgeStatus>;
    disconnect: () => void;
    scanDevices: () => Promise<ScsiDevice[]>;
  };
}
