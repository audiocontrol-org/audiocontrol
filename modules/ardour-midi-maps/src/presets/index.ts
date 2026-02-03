import { MidiMapBuilder } from '../builders/midi-map-builder.js';
import type { ArdourMidiMap } from '../types/ardour.js';

export function createGeneric8ChannelMap(): ArdourMidiMap {
  const builder = new MidiMapBuilder({
    name: 'Generic 8 Channel Controller',
    version: '1.0.0',
  });

  // Add transport controls
  builder.addTransportControls(1, 0x60);

  // Add 8 channel strips
  for (let i = 0; i < 8; i++) {
    builder.addChannelStripControls(1, i + 1, 0x10 + (i * 0x10));
  }

  // Add bank navigation
  builder
    .addNoteBinding({
      channel: 1,
      note: 0x70,
      function: 'prev-bank',
      momentary: true,
    })
    .addNoteBinding({
      channel: 1,
      note: 0x71,
      function: 'next-bank',
      momentary: true,
    });

  return builder.build();
}

export function createPluginControlMap(pluginName: string, parameters: number): ArdourMidiMap {
  const builder = new MidiMapBuilder({
    name: `${pluginName} Plugin Control`,
    version: '1.0.0',
  });

  // Map CC controllers to plugin parameters
  for (let i = 0; i < parameters && i < 127; i++) {
    builder.addCCBinding({
      channel: 1,
      controller: i,
      function: `plugin-parameter`,
      action: `${pluginName}/param/${i}`,
    });
  }

  return builder.build();
}

export const presets = {
  generic8Channel: createGeneric8ChannelMap,
  pluginControl: createPluginControlMap,
};