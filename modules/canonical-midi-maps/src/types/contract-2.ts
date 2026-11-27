// Map contract 2: control surfaces driven from a host (for example the LUNA Add On).
// Every controller fact (ports, addresses, wire-protocol templates, role bindings) is data.

export const SUPPORTED_CONTRACT = 2;

export type SurfaceControlKind = 'encoder' | 'fader' | 'button';

export interface CcAddress {
  channel: number; // 1-16
  cc: number; // 0-127
}

// `follows`: the device moves the control to a value sent with the profile's `follow` message.
export interface SurfaceControl {
  id: string;
  kind: SurfaceControlKind;
  address: CcAddress;
  follows?: boolean | undefined;
}

// A message template. In a `sysex` string, bytes are hex pairs, and these placeholders are
// filled by the runtime: {cc} and {channel} (the target control's address), {value}
// (round(normalized * 127)), {state} (a feedback value from the layout), and {text} (ASCII
// bytes). The parser rejects any other placeholder.
export type Message =
  | { sysex: string }
  | { cc: { channel: number | '{channel}'; number: number | '{cc}'; value: number | '{value}' | '{state}' } };

export interface SurfaceProtocol {
  claim: Message[]; // sent in order when the surface is claimed
  release: Message[]; // sent in order on release, after indications are cleared
  mode?: { address: CcAddress; ready: number[]; suspended: Array<{ values: number[]; reason: string }> } | undefined;
  follow?: Message | undefined; // keeps a `follows` control at a value
  label?: Message[] | undefined; // names one control
  announce?: Message[] | undefined; // a transient surface-wide message
  indicate?: { message: Message; off: number } | undefined;
}

export interface SurfaceProfile {
  contract: 2;
  surface: string;
  kind: 'surface';
  device: { manufacturer: string; model: string };
  ports: { input: string; output: string }; // LUNA device names, matched exactly
  controls: SurfaceControl[];
  protocol: SurfaceProtocol;
}

export interface Assignment {
  control: string;
  parameter: { id: string; name: string };
  mode?: 'toggle' | 'momentary' | undefined;
}

export interface MapPage {
  name: string;
  assignments: Assignment[];
}

// A button press, optionally while another button is held (`with`). Both are surface control ids.
export interface ButtonBinding {
  control: string;
  with?: string | undefined;
}

// Plugin-independent role bindings for one surface, authored in the layout editor. Active
// whatever plugin is targeted, mapped or not. Role names are strings here; the consuming
// host checks them against the roles it implements.
export interface SurfaceLayout {
  contract: 2;
  version: string;
  surface: string;
  kind: 'layout';
  bindings: Array<{ role: string; press: ButtonBinding }>;
  feedback?: Array<{ role: string; active: number; inactive: number }> | undefined; // values for {state}
}

export interface ControllerMap {
  contract: 2;
  version: string;
  surface: string;
  metadata: { name: string; description?: string | undefined; author?: string | undefined };
  plugin: { manufacturer: string; name: string; luna_plugin_ids: string[] };
  pages: MapPage[];
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };
