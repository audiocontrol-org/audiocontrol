# Arturia Jup-8 V3/V4 Parameter Mapping Status

## Current Situation

The Arturia Jup-8 V3/V4 canonical mapping currently uses **string-based parameter names** instead of numeric indices. This differs from other plugins like TAL-J-8 which use numeric parameter indices.

## Technical Challenges

1. **Architecture Mismatch**: Both the VST3 and AU versions of Arturia Jup-8 V3 are x86_64 architecture, while the system and Carla tools are ARM64 (Apple Silicon), preventing automatic parameter extraction.
   - VST3: `/Library/Audio/Plug-Ins/VST3/Jup-8 V3.vst3` - x86_64
   - AU: `/Library/Audio/Plug-Ins/Components/Jup-8 V3.component` - x86_64

2. **Parameter Discovery**: Without being able to load the plugin through Carla, we cannot automatically extract the parameter list and indices.
   - Attempted extraction from both VST3 and AU formats
   - Both fail due to architecture incompatibility
   - Running under Rosetta 2 not possible with ARM-only Python

## Current Mapping Approach

The canonical YAML file (`arturia-jup8v.yaml`) uses descriptive parameter names:
- `Cutoff` - VCF cutoff frequency
- `HPF` - High-pass filter
- `Glide_Time` - Portamento time
- `Resonance` - VCF resonance
- `LFO_Rate` - LFO frequency
- `ENV1_Attack`, `ENV1_Decay`, etc. - Envelope parameters
- And many more...

## Ardour Compatibility

The generated Ardour map uses these string names directly in the URI format:
```xml
<Binding channel="2" ctl="13" uri="/route/plugin/parameter S1 1 Cutoff" encoder="yes"/>
```

This approach works **IF** Ardour and the plugin support parameter identification by name. However:
- Numeric indices are generally more reliable
- String names may vary between plugin versions
- Some DAWs may not support string-based parameter addressing

## Recommendations

### Option 1: Keep String Names (Current)
**Pros:**
- Human-readable and self-documenting
- May work with plugins that expose parameter names

**Cons:**
- Less reliable than numeric indices
- May not work with all DAW/plugin combinations
- Parameter names might change between plugin versions

### Option 2: Manual Parameter Discovery
1. Load the plugin in a DAW that displays parameter numbers
2. Map each control manually to discover the correct index
3. Update the canonical mapping with numeric indices

### Option 3: Use Rosetta/x86 Environment
1. Run Carla under Rosetta 2 to match the plugin architecture
2. Extract parameters using the existing tools
3. Generate proper plugin descriptor

### Option 4: Find Documentation
Look for official Arturia documentation that lists parameter indices for automation.

## Next Steps

1. **Test Current Mapping**: Verify if the string-based parameter names work in Ardour with Arturia Jup-8
2. **Document Working Parameters**: Keep a list of which parameters actually respond to MIDI CC
3. **Consider Migration**: If string names don't work, plan migration to numeric indices

## Files Affected

- `/modules/canonical-midi-maps/maps/novation-launch-control-xl-3/roland-jupiter-8/arturia-jup8v.yaml` - Canonical mapping with string parameter names
- `/modules/ardour-midi-maps/dist/ardour-maps/novation-launch-control-xl-3.map` - Generated Ardour map using string URIs
- `/modules/canonical-midi-maps/plugin-descriptors/` - Missing Arturia plugin descriptor

## Status

⚠️ **Incomplete**: The Arturia Jup-8 mapping uses string-based parameter names instead of verified numeric indices. This may or may not work depending on the DAW and plugin implementation.