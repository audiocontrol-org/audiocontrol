export interface ArdourBinding {
  channel: number;
  ctl?: number;
  note?: number;
  'enc-r'?: number;
  function?: string;
  uri?: string;
  action?: string;
  encoder?: 'yes' | 'no';
  rpn?: number;
  nrpn?: number;
  rpn14?: number;
  nrpn14?: number;
  threshold?: number;
  momentary?: 'yes' | 'no';
}

export interface ArdourBindingGroup {
  comment?: string;
  bindings: ArdourBinding[];
}

export interface ArdourMidiMap {
  name: string;
  version?: string;
  bindings: ArdourBinding[];
  bindingGroups?: ArdourBindingGroup[];
  deviceInfo?: ArdourDeviceInfo;
}

export interface ArdourDeviceInfo {
  'device-name': string;
  'device-info': {
    'bank-size'?: number;
    'motorized'?: 'yes' | 'no';
    'threshold'?: number;
    'has-master-fader'?: 'yes' | 'no';
    'has-lcd'?: 'yes' | 'no';
    'has-timecode'?: 'yes' | 'no';
    'has-meters'?: 'yes' | 'no';
    'uses-logic-control-buttons'?: 'yes' | 'no';
    'uses-mackie-control-buttons'?: 'yes' | 'no';
    'uses-ipmidi'?: 'yes' | 'no';
    'has-touch-sense-faders'?: 'yes' | 'no';
    'has-jog-wheel'?: 'yes' | 'no';
    'has-global-controls'?: 'yes' | 'no';
    'has-segmented-display'?: 'yes' | 'no';
  };
}

export type ArdourFunction = 
  | 'track-set-gain'
  | 'track-set-pan'
  | 'track-set-mute'
  | 'track-set-solo'
  | 'track-set-rec-enable'
  | 'track-set-send-gain'
  | 'track-select'
  | 'track-set-monitor'
  | 'track-set-polarity'
  | 'track-set-trim'
  | 'toggle-rec-enable'
  | 'toggle-track-mute'
  | 'toggle-track-solo'
  | 'transport-start'
  | 'transport-stop'
  | 'transport-roll'
  | 'toggle-roll'
  | 'stop-forget'
  | 'set-transport-speed'
  | 'next-bank'
  | 'prev-bank'
  | 'jump-by-bars'
  | 'jump-by-beats'
  | 'jump-by-seconds';

export interface ArdourControlSurface {
  id: string;
  name: string;
  description?: string;
  manufacturer?: string;
  model?: string;
  deviceInfo?: ArdourDeviceInfo;
  midiMap: ArdourMidiMap;
}