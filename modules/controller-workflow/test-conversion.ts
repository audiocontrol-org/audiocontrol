#!/usr/bin/env tsx
/**
 * Test the conversion pipeline with mock data
 * Demonstrates the workflow without requiring hardware connection
 */

import { LaunchControlXL3Converter } from './src/converters/LaunchControlXL3Converter.js';
import type { ControllerConfiguration } from './src/types/controller-adapter.js';
import { CanonicalMapParser } from '@audiocontrol/canonical-midi-maps';

// Create a mock LCXL3 custom mode configuration
const mockConfig: ControllerConfiguration = {
  name: 'TestMode',
  controls: [
    // Encoders (row 1)
    { id: 'SEND_A1', type: 'encoder', cc: 13, channel: 0, range: [0, 127], name: 'Send A1' },
    { id: 'SEND_A2', type: 'encoder', cc: 14, channel: 0, range: [0, 127], name: 'Send A2' },
    // Sliders
    { id: 'FADER1', type: 'slider', cc: 77, channel: 0, range: [0, 127], name: 'Volume 1' },
    { id: 'FADER2', type: 'slider', cc: 78, channel: 0, range: [0, 127], name: 'Volume 2' },
    // Buttons
    { id: 'FOCUS1', type: 'button', cc: 41, channel: 0, range: [0, 127], name: 'Mute 1' },
    { id: 'FOCUS2', type: 'button', cc: 42, channel: 0, range: [0, 127], name: 'Mute 2' },
  ],
  metadata: {
    slot: 0,
    createdAt: new Date().toISOString(),
  }
};

async function testConversion() {
  console.log('🧪 Testing Controller Workflow Conversion Pipeline\n');

  // Step 1: Create converter
  console.log('[1/3] Creating LaunchControlXL3Converter...');
  const converter = new LaunchControlXL3Converter();
  console.log('     ✓ Converter created\n');

  // Step 2: Convert to canonical format
  console.log('[2/3] Converting mock LCXL3 config to canonical format...');
  const canonicalMap = converter.convert(mockConfig, {
    preserveLabels: true,
    midiChannel: 0,
  });

  console.log(`     ✓ Converted ${canonicalMap.controls.length} controls`);
  console.log(`     ✓ Map name: "${canonicalMap.metadata.name}"`);
  console.log(`     ✓ Device: ${canonicalMap.device.manufacturer} ${canonicalMap.device.model}\n`);

  // Step 3: Serialize to YAML
  console.log('[3/3] Serializing to YAML...');
  const yaml = CanonicalMapParser.serializeToYAML(canonicalMap);

  console.log('     ✓ YAML generated\n');
  console.log('📄 Generated Canonical YAML:');
  console.log('─'.repeat(60));
  console.log(yaml);
  console.log('─'.repeat(60));

  console.log('\n✅ Conversion pipeline test successful!\n');
  console.log('Next steps:');
  console.log('  1. Fix LCXL3 handshake timeout to enable hardware read');
  console.log('  2. Test with real device: npx controller-deploy list');
  console.log('  3. Deploy to Ardour: npx controller-deploy deploy --daw ardour\n');
}

testConversion().catch((error) => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
