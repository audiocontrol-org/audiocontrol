import type { ArdourBinding, ArdourMidiMap, ArdourFunction, ArdourDeviceInfo, ArdourBindingGroup } from '../types/ardour.js';

export interface MidiMapBuilderOptions {
  name: string;
  version?: string;
  deviceInfo?: ArdourDeviceInfo;
}

export interface BindingOptions {
  channel: number;
  function?: string;
  uri?: string;
  action?: string;
  encoder?: boolean;
  momentary?: boolean;
  threshold?: number;
}

export interface CCBindingOptions extends BindingOptions {
  controller: number;
}

export interface NoteBindingOptions extends BindingOptions {
  note: number;
}

export interface EncoderRelativeBindingOptions extends BindingOptions {
  controller: number;
}

export class MidiMapBuilder {
  private bindings: ArdourBinding[] = [];
  private bindingGroups: ArdourBindingGroup[] = [];
  private currentGroup: ArdourBindingGroup | null = null;
  private readonly name: string;
  private readonly version: string | undefined;
  private readonly deviceInfo: ArdourDeviceInfo | undefined;

  constructor(options: MidiMapBuilderOptions) {
    this.name = options.name;
    this.version = options.version;
    this.deviceInfo = options.deviceInfo;
  }

  addChannelComment(channel: number, pluginName: string): this {
    // Finalize current group if exists
    if (this.currentGroup && this.currentGroup.bindings.length > 0) {
      this.bindingGroups.push(this.currentGroup);
    }

    // Start new group with comment
    this.currentGroup = {
      comment: `MIDI Channel ${channel}: ${pluginName}`,
      bindings: []
    };

    return this;
  }

  addCCBinding(options: CCBindingOptions): this {
    const binding: ArdourBinding = {
      channel: options.channel,
      ctl: options.controller,
    };

    if (options.function !== undefined) binding.function = options.function;
    if (options.uri !== undefined) binding.uri = options.uri;
    if (options.action !== undefined) binding.action = options.action;
    if (options.encoder) binding.encoder = 'yes';
    if (options.momentary) binding.momentary = 'yes';
    if (options.threshold !== undefined) binding.threshold = options.threshold;

    // Add to current group if exists, otherwise add to general bindings
    if (this.currentGroup) {
      this.currentGroup.bindings.push(binding);
    } else {
      this.bindings.push(binding);
    }

    return this;
  }

  addNoteBinding(options: NoteBindingOptions): this {
    const binding: ArdourBinding = {
      channel: options.channel,
      note: options.note,
    };

    if (options.function !== undefined) binding.function = options.function;
    if (options.uri !== undefined) binding.uri = options.uri;
    if (options.action !== undefined) binding.action = options.action;
    if (options.momentary) binding.momentary = 'yes';
    if (options.threshold !== undefined) binding.threshold = options.threshold;

    // Add to current group if exists, otherwise add to general bindings
    if (this.currentGroup) {
      this.currentGroup.bindings.push(binding);
    } else {
      this.bindings.push(binding);
    }

    return this;
  }

  addEncoderRelativeBinding(options: EncoderRelativeBindingOptions): this {
    const binding: ArdourBinding = {
      channel: options.channel,
      'enc-r': options.controller,
    };

    if (options.function !== undefined) binding.function = options.function;
    if (options.uri !== undefined) binding.uri = options.uri;
    if (options.action !== undefined) binding.action = options.action;
    if (options.threshold !== undefined) binding.threshold = options.threshold;

    // Add to current group if exists, otherwise add to general bindings
    if (this.currentGroup) {
      this.currentGroup.bindings.push(binding);
    } else {
      this.bindings.push(binding);
    }

    return this;
  }

  addTransportControls(channel: number, startNote: number): this {
    const transportFunctions: ArdourFunction[] = [
      'transport-stop',
      'transport-roll',
      'toggle-rec-enable',
      'toggle-roll',
      'stop-forget',
    ];

    transportFunctions.forEach((func, index) => {
      this.addNoteBinding({
        channel,
        note: startNote + index,
        function: func,
        momentary: true,
      });
    });

    return this;
  }

  addChannelStripControls(channel: number, stripNumber: number, baseCC: number): this {
    const stripControls = [
      { cc: baseCC, func: 'track-set-gain' as ArdourFunction },
      { cc: baseCC + 1, func: 'track-set-pan' as ArdourFunction },
      { cc: baseCC + 2, func: 'track-set-send-gain' as ArdourFunction },
    ];

    stripControls.forEach(({ cc, func }) => {
      this.addCCBinding({
        channel,
        controller: cc,
        function: `${func}[${stripNumber}]`,
      });
    });

    const buttonControls = [
      { note: baseCC, func: 'toggle-track-mute' as ArdourFunction },
      { note: baseCC + 1, func: 'toggle-track-solo' as ArdourFunction },
      { note: baseCC + 2, func: 'toggle-rec-enable' as ArdourFunction },
      { note: baseCC + 3, func: 'track-select' as ArdourFunction },
    ];

    buttonControls.forEach(({ note, func }) => {
      this.addNoteBinding({
        channel,
        note,
        function: `${func}[${stripNumber}]`,
        momentary: func === 'track-select',
      });
    });

    return this;
  }

  build(): ArdourMidiMap {
    // Finalize current group if exists
    if (this.currentGroup && this.currentGroup.bindings.length > 0) {
      this.bindingGroups.push(this.currentGroup);
    }

    // Flatten all bindings for the final map
    const allBindings = [
      ...this.bindings,
      ...this.bindingGroups.flatMap(group => group.bindings)
    ];

    const map: ArdourMidiMap = {
      name: this.name,
      bindings: allBindings,
    };

    if (this.bindingGroups.length > 0) {
      map.bindingGroups = [...this.bindingGroups];
    }

    if (this.version !== undefined) {
      map.version = this.version;
    }

    if (this.deviceInfo !== undefined) {
      map.deviceInfo = this.deviceInfo;
    }

    return map;
  }

  clear(): this {
    this.bindings = [];
    this.bindingGroups = [];
    this.currentGroup = null;
    return this;
  }

  getBindingCount(): number {
    return this.bindings.length + this.bindingGroups.reduce((total, group) => total + group.bindings.length, 0);
  }
}