#!/usr/bin/env tsx

/**
 * Example: Convert Canonical MIDI Map to Ardour Format
 *
 * This script demonstrates how to convert a canonical MIDI map
 * to Ardour-specific XML configuration format.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { CanonicalMapParser } from '../modules/canonical-midi-maps/src/index.js';
import { MidiMapBuilder, ArdourXMLSerializer } from '../modules/ardour-midi-maps/src/index.js';

/**
 * Convert canonical MIDI map to Ardour format
 */
function convertCanonicalToArdour(canonicalMapPath: string): string {
  // 1. Load and parse the canonical map
  console.log(`Loading canonical map: ${canonicalMapPath}`);
  const yamlContent = readFileSync(canonicalMapPath, 'utf8');
  const { map, validation } = CanonicalMapParser.parseFromYAML(yamlContent);

  if (!validation.valid || !map) {
    throw new Error(`Invalid canonical map: ${validation.errors.map(e => e.message).join(', ')}`);\n  }

  console.log(`✓ Loaded map: ${map.metadata.name}`);
  console.log(`✓ Controller: ${map.controller.manufacturer} ${map.controller.model}`);
  console.log(`✓ Plugin: ${map.plugin.manufacturer} ${map.plugin.name}`);
  console.log(`✓ Mappings: ${map.mappings.length}`);\n
  // 2. Create Ardour MIDI map builder
  const ardourBuilder = new MidiMapBuilder({
    name: `${map.controller.manufacturer} ${map.controller.model} → ${map.plugin.name}`,
    version: map.metadata.version,
  });

  // 3. Convert each canonical mapping to Ardour binding
  for (const mapping of map.mappings) {
    const channel = mapping.midiInput.channel || 1;

    // Convert canonical mapping to Ardour function string
    const ardourFunction = convertToArdourFunction(mapping);

    if (mapping.midiInput.type === 'cc') {
      ardourBuilder.addCCBinding({
        channel,
        controller: mapping.midiInput.number || 0,
        function: ardourFunction,
        encoder: mapping.midiInput.behavior?.mode === 'relative',
        momentary: false,
      });
    } else if (mapping.midiInput.type === 'note') {
      ardourBuilder.addNoteBinding({
        channel,
        note: mapping.midiInput.number || 0,
        function: ardourFunction,
        momentary: mapping.midiInput.behavior?.mode === 'momentary',
      });
    }
  }

  // 4. Build and serialize to XML
  const ardourMap = ardourBuilder.build();
  const serializer = new ArdourXMLSerializer();
  const xmlOutput = serializer.serializeMidiMap(ardourMap);

  console.log(`✓ Generated Ardour XML with ${ardourMap.bindings.length} bindings`);
  return xmlOutput;
}

/**
 * Convert canonical mapping to Ardour function string
 */
function convertToArdourFunction(mapping: any): string {
  // Handle bypass controls
  if (mapping.pluginTarget.type === 'bypass') {
    return 'toggle-plugin-bypass';
  }

  // Handle parameter controls - map to generic track controls
  // In a real implementation, you'd have more sophisticated mapping logic
  const category = mapping.pluginTarget.category?.toLowerCase() || '';
  const name = mapping.pluginTarget.name?.toLowerCase() || '';

  // Map to appropriate Ardour functions based on parameter category
  if (category.includes('preamp') || name.includes('gain')) {
    return 'track-set-gain[1]';
  } else if (category.includes('eq') || name.includes('eq')) {
    // Map EQ parameters to send gains (as an example)
    const paramId = mapping.pluginTarget.identifier;
    const sendNumber = Math.min(parseInt(paramId) % 4, 3) + 1; // Map to sends 1-4
    return `track-set-send-gain[1,${sendNumber}]`;
  } else if (category.includes('compressor') || name.includes('comp')) {
    return 'track-set-trim[1]';
  } else if (category.includes('global')) {
    if (name.includes('bypass')) {
      return 'toggle-plugin-bypass';
    }
    return 'track-select[1]';
  } else {
    // Generic parameter control - map to plugin parameter
    return `plugin-parameter[${mapping.pluginTarget.identifier}]`;
  }
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  const canonicalMapPath = join(
    process.cwd(),
    'modules/canonical-midi-maps/maps/novation-launch-control-xl-3-channev.yaml'
  );

  try {
    console.log('🎛️  Converting Canonical MIDI Map to Ardour Format\\n');

    const ardourXML = convertCanonicalToArdour(canonicalMapPath);

    console.log('\\n📄 Generated Ardour XML:\\n');
    console.log(ardourXML);

    // Optionally write to file
    const outputPath = 'novation-launch-control-xl-3-channev.map';
    require('fs').writeFileSync(outputPath, ardourXML);
    console.log(`\\n✅ Ardour map saved to: ${outputPath}`);

  } catch (error) {
    console.error('❌ Conversion failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { convertCanonicalToArdour };