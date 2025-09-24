# @audio-control/canonical-midi-maps

A TypeScript library for defining, parsing, and managing canonical MIDI map configurations that describe controller-to-plugin mappings in a DAW-agnostic format.

## Features

- 📋 **DAW-Agnostic Format** - Define MIDI mappings once, use across multiple DAWs
- 🔍 **Type-Safe Validation** - Zod schema validation with detailed error reporting
- 📝 **Human-Readable** - YAML format that's easy to read, write, and version control
- 🗃️ **Map Registry** - Built-in registry for discovering and managing mapping collections
- 🎛️ **Rich Metadata** - Comprehensive controller and plugin information
- ⚡ **Performance Optimized** - Efficient parsing and validation

## Installation

```bash
npm install @audio-control/canonical-midi-maps
# or
pnpm add @audio-control/canonical-midi-maps
```

## Quick Start

### Parsing a Canonical Map

```typescript
import { CanonicalMapParser } from '@audio-control/canonical-midi-maps';
import { readFileSync } from 'fs';

// Load and parse a YAML map file
const yamlContent = readFileSync('controller-plugin.yaml', 'utf8');
const { map, validation } = CanonicalMapParser.parseFromYAML(yamlContent);

if (validation.valid && map) {
  console.log(`Loaded map: ${map.metadata.name}`);
  console.log(`Controller: ${map.controller.manufacturer} ${map.controller.model}`);
  console.log(`Plugin: ${map.plugin.manufacturer} ${map.plugin.name}`);
  console.log(`Mappings: ${map.mappings.length}`);
} else {
  console.error('Validation errors:', validation.errors);
}
```

### Using the Map Registry

```typescript
import { defaultRegistry } from '@audio-control/canonical-midi-maps';

// Find maps by controller
const novationMaps = defaultRegistry.findByController('Novation');
console.log(`Found ${novationMaps.length} Novation controller maps`);

// Find maps by plugin
const massiveMaps = defaultRegistry.findByPlugin('Native Instruments', 'Massive');
console.log(`Found ${massiveMaps.length} Massive X maps`);

// Search all maps
const synthMaps = defaultRegistry.findByTags(['synthesizer']);
console.log(`Found ${synthMaps.length} synthesizer maps`);

// Get registry statistics
const stats = defaultRegistry.getStats();
console.log('Registry stats:', stats);
```

## Canonical Map Format

Maps are defined in YAML format with the following structure:

```yaml
metadata:
  name: "Controller → Plugin"
  version: "1.0.0"
  description: "Description of the mapping"
  author: "Your Name"
  tags: ["synthesizer", "controller-brand"]

controller:
  manufacturer: "Controller Manufacturer"
  model: "Controller Model"
  version: "1.0"
  midiChannel: 1

plugin:
  manufacturer: "Plugin Manufacturer"
  name: "Plugin Name"
  format: "VST3"

mappings:
  - id: "unique_mapping_id"
    description: "What this mapping does"
    midiInput:
      type: "cc"  # cc, note, pitchbend, aftertouch, program
      channel: 1
      number: 21
      behavior:
        mode: "absolute"  # absolute, relative, toggle, momentary
        curve: "linear"   # linear, exponential, logarithmic
    pluginTarget:
      type: "parameter"   # parameter, bypass, preset, macro
      identifier: "PARAM_ID"
      name: "Parameter Name"
      range:
        min: 0.0
        max: 1.0
        default: 0.5
      units: "Hz"
      category: "Oscillator"
    mapping:
      scaling: "linear"   # linear, exponential, logarithmic
      bipolar: false
      smoothing: 0.1
```

## API Reference

### CanonicalMapParser

Main parser class for loading and validating canonical maps.

#### Static Methods

##### `parseFromYAML(yamlContent: string)`

Parse a YAML string into a canonical map.

**Returns:** `{ map?: CanonicalMidiMapOutput; validation: ValidationResult }`

##### `parseFromJSON(jsonContent: string)`

Parse a JSON string into a canonical map.

##### `serializeToYAML(map: CanonicalMidiMapOutput): string`

Serialize a map back to YAML format.

##### `serializeToJSON(map: CanonicalMidiMapOutput, pretty?: boolean): string`

Serialize a map to JSON format.

##### `validate(map: unknown): ValidationResult`

Validate a map object against the schema.

### CanonicalMapRegistry

Registry for managing collections of canonical maps.

#### Methods

##### `register(entry: MapRegistryEntry): void`

Register a new map in the registry.

##### `findByController(manufacturer: string, model?: string): MapRegistryEntry[]`

Find maps by controller manufacturer and optionally model.

##### `findByPlugin(manufacturer: string, name?: string): MapRegistryEntry[]`

Find maps by plugin manufacturer and optionally name.

##### `findByTags(tags: string[]): MapRegistryEntry[]`

Find maps containing any of the specified tags.

##### `search(query: string): MapRegistryEntry[]`

Full-text search across all map metadata.

##### `getStats()`

Get registry statistics including total maps, manufacturers, etc.

## MIDI Input Types

The canonical format supports various MIDI input types:

### Control Change (CC)
```yaml
midiInput:
  type: "cc"
  channel: 1
  number: 21  # CC number (0-127)
  behavior:
    mode: "absolute"
    curve: "linear"
```

### Note On/Off
```yaml
midiInput:
  type: "note"
  channel: 1
  number: 36  # Note number (0-127)
  behavior:
    mode: "toggle"  # or "momentary"
```

### Pitch Bend
```yaml
midiInput:
  type: "pitchbend"
  channel: 1
  behavior:
    mode: "absolute"
    curve: "linear"
```

## Plugin Target Types

### Parameter Control
```yaml
pluginTarget:
  type: "parameter"
  identifier: "OSC1_PITCH"
  name: "Oscillator 1 Pitch"
  range:
    min: -48.0
    max: 48.0
    default: 0.0
  units: "semitones"
  category: "Oscillator"
```

### Bypass Control
```yaml
pluginTarget:
  type: "bypass"
  identifier: "PLUGIN_BYPASS"
  name: "Plugin Bypass"
```

### Macro Control
```yaml
pluginTarget:
  type: "macro"
  identifier: "MACRO_1"
  name: "Macro Control 1"
  range:
    min: 0.0
    max: 1.0
```

## Mapping Behaviors

### Input Behaviors
- **absolute**: Direct value mapping (0-127 → min-max)
- **relative**: Incremental changes (for encoders)
- **toggle**: On/off switching
- **momentary**: Active only while held

### Scaling Types
- **linear**: Direct proportional mapping
- **exponential**: Exponential curve (good for frequency)
- **logarithmic**: Logarithmic curve (good for gain)

### Advanced Options
- **bipolar**: Center-zero mapping (-1 to +1)
- **smoothing**: Value smoothing (0.0-1.0)
- **quantize**: Quantize to steps

## Example Maps

The library includes sample maps:

- **Novation Launchkey MK3 → Native Instruments Massive X**
- **Akai MPK Mini MK3 → Arturia Pigments**

These demonstrate comprehensive mappings including:
- Oscillator controls
- Filter parameters
- Envelope controls
- Performance controls
- Transport functions

## Converting to DAW Formats

Canonical maps serve as an intermediate format. Use companion libraries to convert to specific DAW formats:

- `@audio-control/ardour-midi-maps` - Convert to Ardour XML format
- Future: Ableton Live, Logic Pro, Cubase converters

## Validation

The library provides comprehensive validation:

- **Schema validation**: Ensures proper structure and types
- **Range validation**: Checks value ranges are valid
- **Duplicate detection**: Warns about duplicate MIDI inputs
- **Completeness checks**: Suggests missing metadata

## Contributing

Canonical maps are version controlled and can be contributed via pull requests. Each map should:

1. Target a specific controller-plugin combination
2. Include comprehensive metadata
3. Follow naming conventions
4. Be validated without errors
5. Include meaningful descriptions

## License

MIT