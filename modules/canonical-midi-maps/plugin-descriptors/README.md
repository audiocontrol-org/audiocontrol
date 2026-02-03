# Plugin Descriptors

This directory contains canonical plugin descriptor files that provide comprehensive parameter information for VST/AU plugins. These descriptors eliminate the need to interrogate plugin instances during mapping creation and ensure parameter references use correct indices instead of fictional names.

## Purpose

Plugin descriptors solve several problems:

1. **Accurate Parameter Mapping**: Use real parameter indices instead of fictional names like `"Chorus.Mix"` or `"OSC1.Range"`
2. **Performance**: Avoid loading plugins just to discover parameter information
3. **Consistency**: Standardized parameter information across different mapping files
4. **Documentation**: Human-readable parameter descriptions with proper categorization

## File Format

Plugin descriptors use JSON format with the following structure:

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
    "version": "1.0.0",
    "created": "2025-09-23T19:49:10.124153",
    "updated": "2025-09-23T19:49:10.124153",
    "author": "Audio Control VST Parameter Extractor",
    "description": "Auto-generated parameter descriptor for TAL-J-8",
    "tags": ["synthesizer", "analog"]
  },
  "parameters": [
    {
      "index": 0,
      "name": "Master Volume",
      "min": 0.0,
      "max": 1.0,
      "default": 0.0,
      "group": "master",
      "type": "continuous",
      "automatable": true
    }
  ],
  "groups": {
    "master": {
      "name": "Master",
      "parameters": [0, 1, 2]
    }
  }
}
```

## Generating Plugin Descriptors

Use the provided tool to generate descriptors:

```bash
# Generate JSON descriptor
python3 tools/generate_plugin_descriptor.py "Plugin Name" json

# Generate YAML descriptor (requires PyYAML)
python3 tools/generate_plugin_descriptor.py "Plugin Name" yaml
```

## Using Plugin Descriptors in Mappings

Reference the descriptor in your mapping file:

```yaml
plugin:
  manufacturer: TAL Software
  name: TAL-J-8
  type: VST/AU
  version: ">=1.0"
  descriptor: plugin-descriptors/tal-togu-audio-line-tal-j-8.json

controls:
  - id: encoder_1
    name: VCF Cutoff
    type: encoder
    cc: 13
    channel: global
    range: [0, 127]
    description: VCF cutoff frequency
    plugin_parameter: 104  # Real parameter index, not fictional name
```

## Parameter Groups

Parameters are automatically categorized into logical groups:

- **master**: Global controls (volume, tune, octave)
- **voice**: Voice/polyphony controls
- **oscillator**: VCO/oscillator parameters
- **filter**: Filter parameters
- **envelope**: ADSR and envelope parameters
- **lfo**: LFO parameters
- **modulation**: Modulation routing and amounts
- **effects**: Built-in effects (chorus, delay, etc.)
- **arpeggiator**: Arpeggiator parameters
- **amplifier**: VCA and velocity parameters
- **midi**: MIDI CC mappings
- **misc**: Uncategorized parameters

## Available Descriptors

- `tal-togu-audio-line-tal-j-8.json` - TAL-J-8 Jupiter-8 synthesizer (2234 parameters)

## Best Practices

1. **Always use real parameter indices**: Reference parameters by their actual index number (e.g., `104`) not fictional names (e.g., `"VCF.Cutoff"`)

2. **Reference the descriptor**: Include the descriptor path in your mapping file's plugin section

3. **Validate mappings**: Use the parameter information to ensure your MIDI CC mappings make sense (appropriate ranges, parameter types)

4. **Update when needed**: Regenerate descriptors if plugin versions change significantly

5. **Document special cases**: Some plugins have split modes (UPPER/LOWER) - choose the appropriate parameter set for your use case