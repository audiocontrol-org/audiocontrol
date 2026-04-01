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
}
