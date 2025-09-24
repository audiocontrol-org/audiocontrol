# @audio-control/ardour-midi-maps

A TypeScript library for programmatically creating and managing MIDI map configuration files for the [Ardour DAW](https://ardour.org/).

## Features

- 🎹 **Type-safe MIDI mapping** - Complete TypeScript interfaces for Ardour MIDI bindings
- 🏗️ **Fluent builder API** - Programmatically create complex MIDI mappings with ease
- 📄 **XML serialization** - Generate Ardour-compatible XML configuration files
- 🎛️ **Control surface presets** - Pre-built configurations for common controller types
- 🔧 **Plugin parameter mapping** - Map MIDI controllers to audio plugin parameters

## Installation

```bash
npm install @audio-control/ardour-midi-maps
# or
pnpm add @audio-control/ardour-midi-maps
# or
yarn add @audio-control/ardour-midi-maps
```

## Quick Start

### Basic MIDI Map Creation

```typescript
import { MidiMapBuilder, ArdourXMLSerializer } from '@audio-control/ardour-midi-maps';

// Create a new MIDI map
const builder = new MidiMapBuilder({
  name: 'My Controller',
  version: '1.0.0'
});

// Add transport controls
builder.addTransportControls(1, 0x60); // Channel 1, starting at note 96

// Add a channel strip (fader, pan, mute, solo, etc.)
builder.addChannelStripControls(1, 1, 0x10); // Channel 1, Strip 1, base CC 16

// Build the map
const midiMap = builder.build();

// Serialize to XML
const serializer = new ArdourXMLSerializer();
const xmlOutput = serializer.serializeMidiMap(midiMap);

console.log(xmlOutput);
```

### Using Presets

```typescript
import { presets, ArdourXMLSerializer } from '@audio-control/ardour-midi-maps';

// Generate a generic 8-channel controller map
const genericMap = presets.generic8Channel();

// Generate a plugin control map
const pluginMap = presets.pluginControl('My Synth', 32); // 32 parameters

// Serialize to XML files
const serializer = new ArdourXMLSerializer();
console.log(serializer.serializeMidiMap(genericMap));
```

## API Reference

### MidiMapBuilder

The main class for building MIDI maps programmatically.

#### Constructor

```typescript
new MidiMapBuilder(options: MidiMapBuilderOptions)
```

- `options.name: string` - Name of the MIDI map
- `options.version?: string` - Optional version string

#### Methods

##### `addCCBinding(options: CCBindingOptions): this`

Add a Control Change (CC) binding.

```typescript
builder.addCCBinding({
  channel: 1,
  controller: 7,
  function: 'track-set-gain[1]',
  encoder: false,
  momentary: false
});
```

##### `addNoteBinding(options: NoteBindingOptions): this`

Add a Note On/Off binding.

```typescript
builder.addNoteBinding({
  channel: 1,
  note: 36,
  function: 'toggle-track-mute[1]',
  momentary: true
});
```

##### `addTransportControls(channel: number, startNote: number): this`

Add a complete set of transport controls (stop, play, record, etc.).

```typescript
builder.addTransportControls(1, 0x60); // Channel 1, starting at note 96
```

##### `addChannelStripControls(channel: number, stripNumber: number, baseCC: number): this`

Add a complete channel strip with fader, pan, send, and button controls.

```typescript
builder.addChannelStripControls(1, 1, 0x10); // Channel 1, Strip 1, base CC 16
```

### ArdourXMLSerializer

Handles serialization of MIDI maps to Ardour's XML format.

#### Methods

##### `serializeMidiMap(midiMap: ArdourMidiMap): string`

Convert a MIDI map to Ardour XML format.

##### `serializeDeviceInfo(deviceInfo: ArdourDeviceInfo): string`

Convert device information to Ardour XML format.

### Ardour Functions

Common Ardour function strings you can use in bindings:

- **Track Control**: `track-set-gain`, `track-set-pan`, `track-set-mute`, `track-set-solo`
- **Transport**: `transport-start`, `transport-stop`, `transport-roll`, `toggle-roll`
- **Recording**: `toggle-rec-enable`, `track-set-rec-enable`
- **Navigation**: `next-bank`, `prev-bank`
- **Selection**: `track-select`

### Advanced Usage

#### Custom Binding with Actions

```typescript
builder.addCCBinding({
  channel: 1,
  controller: 20,
  function: 'plugin-parameter',
  action: 'MyPlugin/param/0', // Custom action for plugin control
});
```

#### Encoder Support

```typescript
builder.addCCBinding({
  channel: 1,
  controller: 16,
  function: 'track-set-pan[1]',
  encoder: true, // Enable encoder mode for relative control
});
```

#### Threshold Control

```typescript
builder.addNoteBinding({
  channel: 1,
  note: 36,
  function: 'toggle-track-mute[1]',
  threshold: 64, // Only trigger when velocity > 64
});
```

## Example: Complete 8-Channel Controller

```typescript
import { MidiMapBuilder, ArdourXMLSerializer } from '@audio-control/ardour-midi-maps';

const builder = new MidiMapBuilder({
  name: 'My 8-Channel Controller',
  version: '1.0.0'
});

// Add transport controls
builder.addTransportControls(1, 0x60);

// Add 8 channel strips
for (let i = 0; i < 8; i++) {
  builder.addChannelStripControls(1, i + 1, 0x10 + (i * 0x08));
}

// Add bank navigation
builder
  .addNoteBinding({
    channel: 1,
    note: 0x70,
    function: 'prev-bank',
    momentary: true
  })
  .addNoteBinding({
    channel: 1,
    note: 0x71,
    function: 'next-bank',
    momentary: true
  });

// Generate XML
const serializer = new ArdourXMLSerializer();
const xml = serializer.serializeMidiMap(builder.build());

// Save to file (Node.js)
import { writeFileSync } from 'fs';
writeFileSync('my-controller.map', xml);
```

## TypeScript Support

This library is written in TypeScript and provides complete type definitions. All interfaces and types are exported for use in your applications.

```typescript
import type {
  ArdourMidiMap,
  ArdourBinding,
  ArdourFunction,
  MidiEventType
} from '@audio-control/ardour-midi-maps';
```

## Contributing

This library is part of the audio-control monorepo. Contributions are welcome!

## License

MIT