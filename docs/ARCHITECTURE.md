# Architecture: Plugin Descriptors, Canonical MIDI Maps, and Ardour MIDI Maps

This document explains the interaction between the three key components in the audio-control system for creating robust MIDI controller mappings.

## Component Overview

```
┌─────────────────────────────┐    ┌─────────────────────────────┐    ┌─────────────────────────────┐
│     Plugin Descriptors      │    │   Canonical MIDI Maps      │    │     Ardour MIDI Maps       │
│                             │    │                             │    │                             │
│ • Parameter extraction      │───▶│ • Device-specific mappings  │───▶│ • DAW-specific format       │
│ • JSON format              │    │ • Real parameter indices    │    │ • XML serialization        │
│ • Parameter categorization  │    │ • Controller-plugin pairs  │    │ • Transport controls        │
│ • Metadata & validation     │    │ • Hardware abstraction     │    │ • Track/plugin automation   │
└─────────────────────────────┘    └─────────────────────────────┘    └─────────────────────────────┘
```

## 1. Plugin Descriptors

### Purpose
Plugin descriptors provide **accurate, comprehensive parameter information** for audio plugins without requiring plugin instantiation during mapping creation.

### Key Features
- **Real parameter indices**: Eliminates fictional parameter names like `"Chorus.Mix"`
- **Performance optimization**: Avoids loading plugins just to discover parameters
- **Parameter categorization**: Groups parameters into logical categories (oscillator, filter, envelope, etc.)
- **Metadata tracking**: Version, creation date, parameter counts, tags

### Structure
```json
{
  "plugin": {
    "manufacturer": "TAL-Togu Audio Line",
    "name": "TAL-J-8",
    "version": "1.0.0",
    "format": "VST3",
    "uid": "-664001267"
  },
  "metadata": {
    "parameter_count": 2234,
    "author": "plughost-batch",
    "tags": ["synthesizer", "analog"]
  },
  "parameters": [
    {
      "index": 105,
      "name": "VCF Cutoff",
      "group": "filter",
      "type": "continuous",
      "automatable": true
    }
  ],
  "groups": {
    "filter": {
      "parameters": [105, 107, 109]
    }
  }
}
```

### Generation Process
```bash
# Batch generation using plughost
pnpm plugin:generate-batch

# Uses plughost --batch-interrogate to:
# 1. Scan all installed plugins
# 2. Extract parameter information
# 3. Generate individual JSON descriptors
# 4. Cache results for reuse
```

## 2. Canonical MIDI Maps

### Purpose
Canonical MIDI maps define **device-specific controller mappings** to audio plugins, using real parameter indices from plugin descriptors.

### Key Features
- **Hardware abstraction**: Maps physical controls (encoders, sliders, buttons) to plugin parameters
- **Parameter accuracy**: References real plugin parameter indices (not fictional names)
- **Device optimization**: Tailored layouts for specific controllers (Launch Control XL 3, etc.)
- **Semantic grouping**: Logical arrangement of controls (ADSR on sliders, oscillators on encoders)

### Structure
```yaml
device:
  manufacturer: Novation
  model: Launch Control XL 3

plugin:
  manufacturer: TAL Software
  name: TAL-J-8
  descriptor: plugin-descriptors/tal-togu-audio-line-tal-j-8.json

controls:
  - id: encoder_1
    name: VCF Cutoff
    type: encoder
    cc: 13
    channel: global
    plugin_parameter: 105  # Real parameter index from descriptor

  - id: slider_1
    name: Attack
    type: slider
    cc: 53
    plugin_parameter: 65   # Real parameter index from descriptor
```

### Relationships
```
Controller Hardware ──┐
                      ├─▶ Canonical MIDI Map ──▶ Plugin Parameters
Audio Plugin      ────┘                           (via descriptor)
```

## 3. Ardour MIDI Maps

### Purpose
Ardour MIDI maps translate canonical mappings into **Ardour DAW-specific XML format** for direct use in the DAW.

### Key Features
- **DAW integration**: Native Ardour XML format
- **Transport controls**: Play, stop, record, navigation
- **Track automation**: Gain, pan, mute, solo controls
- **Plugin parameter mapping**: Direct plugin automation
- **Control surface definition**: Device information and capabilities

### Structure
```xml
<ArdourMIDIBindings version="1.0.0" name="Launch Control XL 3 - TAL J-8">
  <DeviceInfo bank-size="8"/>
  <Binding channel="1" ctl="13" function="plugin-parameter" uri="TAL-J-8/param/105"/>
  <Binding channel="1" ctl="53" function="plugin-parameter" uri="TAL-J-8/param/65"/>
</ArdourMIDIBindings>
```

### Generation Process
```typescript
import { MidiMapBuilder, ArdourXMLSerializer } from '@audio-control/ardour-midi-maps';

// Build from canonical mapping
const builder = new MidiMapBuilder({ name: 'TAL-J-8 Controller' });
builder.addCCBinding({
  channel: 1,
  controller: 13,
  function: 'plugin-parameter',
  action: 'TAL-J-8/param/105'
});

// Serialize to XML
const serializer = new ArdourXMLSerializer();
const xml = serializer.serializeMidiMap(builder.build());
```

## Data Flow Architecture

### 1. Plugin Analysis Phase
```
Audio Plugins → plughost → Plugin Descriptors (JSON)
                ↓
            [Real parameter indices, metadata, categorization]
```

### 2. Mapping Design Phase
```
Hardware Controller + Plugin Descriptor → Canonical MIDI Map (YAML)
                                           ↓
                                    [Device-specific mappings with real parameter indices]
```

### 3. DAW Integration Phase
```
Canonical MIDI Map → Ardour MIDI Map Generator → Ardour XML Map
                     ↓
                  [DAW-specific format for direct use]
```

## Benefits of This Architecture

### 1. **Accuracy**
- No fictional parameter names
- Real parameter indices ensure mappings actually work
- Validation against actual plugin capabilities

### 2. **Performance**
- Plugin descriptors cached and reused
- No plugin loading during mapping creation
- Batch processing for efficiency

### 3. **Maintainability**
- Separation of concerns: parameter extraction, mapping design, DAW formatting
- Version tracking and metadata
- Consistent file formats and naming

### 4. **Flexibility**
- Same canonical mapping can generate multiple DAW formats
- Easy to add new controllers or plugins
- Parameter grouping enables semantic control layouts

### 5. **Validation**
- Plugin descriptors provide ground truth for parameter validation
- Type checking and range validation
- Automation capability verification

## Usage Example

### Complete Workflow
```bash
# 1. Extract plugin parameters
pnpm plugin:generate-batch

# 2. Create canonical mapping (manual YAML editing)
# Edit: maps/novation-launch-control-xl-3/roland-jupiter-8/tal-j8.yaml

# 3. Generate Ardour mapping
npm run generate-ardour-maps

# 4. Install in Ardour
cp output/tal-j8-launch-control-xl3.map ~/.config/ardour8/midi_maps/
```

### Validation Chain
1. **Plugin Descriptor**: Validates parameter exists and is automatable
2. **Canonical Map**: Validates CC assignments and hardware constraints
3. **Ardour Map**: Validates DAW function compatibility

## File Organization

```
canonical-midi-maps/
├── plugin-descriptors/           # Generated plugin parameter data
│   ├── tal-togu-audio-line-tal-j-8.json
│   └── plugins-catalog-batch.json
├── maps/                         # Canonical MIDI mappings
│   └── novation-launch-control-xl-3/
│       └── roland-jupiter-8/
│           └── tal-j8.yaml       # Uses plugin_parameter: 105
└── src/tools/
    └── batch-plugin-generator.ts # Generates plugin descriptors

ardour-midi-maps/
├── src/
│   ├── builder/                  # Programmatic map creation
│   ├── serializer/              # XML generation
│   └── types/                   # TypeScript definitions
└── dist/                        # Generated Ardour XML maps
```

This architecture ensures robust, accurate MIDI mappings by maintaining a clear separation between plugin parameter extraction, device-specific mapping design, and DAW-specific formatting.