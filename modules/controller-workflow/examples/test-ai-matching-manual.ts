#!/usr/bin/env tsx
/**
 * Manual test for AI parameter matching with Claude Code CLI
 *
 * This script demonstrates the AI matching workflow with sample control names
 * that would typically come from hardware with custom labels.
 *
 * Usage:
 *   npx tsx examples/test-ai-matching-manual.ts
 */

import { ParameterMatcher, loadPluginDescriptor } from '../src/services/ParameterMatcher.js';

async function main() {
  console.log('\n🧪 Testing AI Parameter Matching\n');

  // Sample control names (as if from hardware with custom labels)
  const controlNames = [
    'VCF Cutoff',
    'VCF Resonance',
    'VCF Envelope',
    'VCA Level',
    'LFO Rate',
    'LFO Depth',
    'Osc 1 Pitch',
    'Osc 2 Pitch',
    'Osc Mix',
    'Attack',
    'Decay',
    'Sustain',
    'Release',
    'Filter Type',
    'Chorus Depth',
    'Delay Time',
  ];

  try {
    console.log('Loading TAL-J-8 plugin descriptor...');
    const descriptor = await loadPluginDescriptor('TAL-J-8');
    console.log(`✓ Loaded: ${descriptor.plugin.name} (${descriptor.parameters.length} parameters)\n`);

    console.log('Control names to match:');
    controlNames.forEach((name, i) => {
      console.log(`  ${(i + 1).toString().padStart(2, ' ')}. ${name}`);
    });
    console.log('');

    console.log('Calling Claude Code CLI for parameter matching...');
    console.log('(This will take ~10-20 seconds)\n');

    const matcher = ParameterMatcher.create({ minConfidence: 0.6 });
    const startTime = Date.now();
    const matches = await matcher.matchParameters(controlNames, descriptor);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`✓ Matching complete in ${duration}s\n`);

    // Display results
    console.log('Results:');
    console.log('──────────────────────────────────────────────────────────');

    let highConfidence = 0;
    let mediumConfidence = 0;
    let lowConfidence = 0;
    let noMatch = 0;

    matches.forEach((match) => {
      const confidence = (match.confidence * 100).toFixed(0);
      let status: string;
      let icon: string;

      if (match.pluginParameter === undefined) {
        status = 'NO MATCH';
        icon = '○';
        noMatch++;
      } else if (match.confidence >= 0.8) {
        status = `HIGH (${confidence}%)`;
        icon = '✓';
        highConfidence++;
      } else if (match.confidence >= 0.6) {
        status = `MED  (${confidence}%)`;
        icon = '~';
        mediumConfidence++;
      } else {
        status = `LOW  (${confidence}%)`;
        icon = '?';
        lowConfidence++;
      }

      const paramName = match.parameterName ? ` → ${match.parameterName}` : '';
      const paramIndex = match.pluginParameter !== undefined ? `[${match.pluginParameter}]` : '[---]';

      console.log(`  ${icon} ${match.controlName.padEnd(20)} ${status.padEnd(12)} ${paramIndex.padStart(7)}${paramName}`);
    });

    console.log('──────────────────────────────────────────────────────────');
    console.log(`\nStatistics:`);
    console.log(`  High confidence (≥80%): ${highConfidence}`);
    console.log(`  Medium confidence (60-79%): ${mediumConfidence}`);
    console.log(`  Low confidence (<60%): ${lowConfidence}`);
    console.log(`  No match: ${noMatch}`);
    console.log(`  Success rate: ${(((highConfidence + mediumConfidence) / controlNames.length) * 100).toFixed(0)}%`);

    // Show low confidence warnings
    const lowMatches = matches.filter((m) => m.pluginParameter !== undefined && m.confidence < 0.7);
    if (lowMatches.length > 0) {
      console.log(`\n⚠️  Low confidence matches (review recommended):`);
      lowMatches.forEach((m) => {
        console.log(`  - "${m.controlName}" → ${m.parameterName} (${(m.confidence * 100).toFixed(0)}%)`);
        if (m.reasoning) {
          console.log(`    Reasoning: ${m.reasoning}`);
        }
      });
    }

    console.log('');
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Error: ${message}\n`);
    process.exit(1);
  }
}

main();
