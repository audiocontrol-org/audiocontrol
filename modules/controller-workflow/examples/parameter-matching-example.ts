/**
 * Parameter Matching Example
 *
 * Demonstrates using the ParameterMatcher service to intelligently map
 * hardware controller names to plugin parameters using Claude AI.
 */

import { ParameterMatcher, loadPluginDescriptor } from '../dist/services/index.js';

async function runExample() {
  console.log('Parameter Matching Example\n');

  // Example 1: Load a plugin descriptor
  console.log('1. Loading TAL-J-8 plugin descriptor...');
  try {
    const descriptor = await loadPluginDescriptor('tal-j-8');
    console.log(`   Loaded: ${descriptor.plugin.manufacturer} - ${descriptor.plugin.name}`);
    console.log(`   Parameters: ${descriptor.parameters.length}\n`);

    // Example 2: Match controller names to plugin parameters
    console.log('2. Matching hardware control names to plugin parameters...');

    const hardwareControls = [
      'Cutoff',
      'Resonance',
      'Attack',
      'Release',
      'LFO Speed',
      'Master Volume',
      'Chorus Depth',
      'VCF Freq',
    ];

    console.log(`   Hardware controls: ${hardwareControls.join(', ')}\n`);

    const matcher = ParameterMatcher.create({
      minConfidence: 0.6, // Only accept matches with 60%+ confidence
      timeout: 60000,     // 60 second timeout
    });

    const results = await matcher.matchParameters(hardwareControls, descriptor, {
      minConfidence: 0.6,
    });

    console.log('   Matching results:');
    console.log('   ────────────────────────────────────────────────────────');

    for (const result of results) {
      if (result.pluginParameter !== undefined) {
        console.log(`   ✓ "${result.controlName}" → Parameter ${result.pluginParameter}: ${result.parameterName}`);
        console.log(`     Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        if (result.reasoning) {
          console.log(`     Reasoning: ${result.reasoning}`);
        }
      } else {
        console.log(`   ✗ "${result.controlName}" → No match found`);
        console.log(`     Confidence: ${(result.confidence * 100).toFixed(1)}%`);
      }
      console.log('');
    }

    // Example 3: Using results to create MIDI mappings
    console.log('3. Creating canonical MIDI mappings from results...\n');

    const midiMappings = results
      .filter(r => r.pluginParameter !== undefined)
      .map((r, index) => ({
        control: r.controlName,
        cc: index + 1, // Assign CC numbers starting from 1
        pluginParameter: r.pluginParameter,
        parameterName: r.parameterName,
        confidence: r.confidence,
      }));

    console.log('   Generated MIDI mappings:');
    for (const mapping of midiMappings) {
      console.log(`   CC ${mapping.cc.toString().padStart(2, '0')}: ${mapping.control} → ${mapping.parameterName}`);
    }
    console.log('');

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);

    if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) {
      console.log('\nNote: This example requires either:');
      console.log('  1. ANTHROPIC_API_KEY environment variable set, or');
      console.log('  2. Claude CLI installed and configured');
      console.log('\nSet up Claude API: https://docs.anthropic.com/claude/reference/getting-started-with-the-api');
    }
  }
}

// Run the example
runExample().catch(console.error);
