import type { MidiIO, MidiPortInfo } from '@audiocontrol/shared-midi';

export interface MidiTransportBrowserInfo {
  supported: boolean;
  browser: string;
  notes: string;
  requiresSecureContext?: boolean;
}

export interface MidiTransportPorts {
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  sysExEnabled: boolean;
}

export interface MidiTransportConnection {
  adapter: MidiIO;
  inputInfo: MidiPortInfo;
  outputInfo: MidiPortInfo;
  nativeInput?: MIDIInput | null;
  nativeOutput?: MIDIOutput | null;
  disconnect: () => Promise<void>;
}

export interface MidiTransport {
  kind: string;
  isSupported: () => boolean;
  getBrowserInfo: () => MidiTransportBrowserInfo;
  initialize: () => Promise<MidiTransportPorts>;
  refresh: () => Promise<MidiTransportPorts>;
  onStateChange: (handler: (() => void) | null) => void;
  connect: (inputId: string, outputId: string) => Promise<MidiTransportConnection>;
  getNativeAccess?: () => MIDIAccess | null;
}
