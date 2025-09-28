import { describe, test } from 'vitest';
import easymidi from 'easymidi';

describe('MIDI Device Discovery', () => {
  test('should print all available MIDI inputs and outputs', () => {
    console.log('\n=== MIDI DEVICE DISCOVERY ===\n');

    // Get all available MIDI inputs
    const inputs = easymidi.getInputs();
    console.log('📥 MIDI INPUTS:');
    if (inputs.length === 0) {
      console.log('  (No MIDI input devices found)');
    } else {
      inputs.forEach((input, index) => {
        console.log(`  ${index + 1}. ${input}`);
      });
    }

    console.log(''); // Empty line for readability

    // Get all available MIDI outputs
    const outputs = easymidi.getOutputs();
    console.log('📤 MIDI OUTPUTS:');
    if (outputs.length === 0) {
      console.log('  (No MIDI output devices found)');
    } else {
      outputs.forEach((output, index) => {
        console.log(`  ${index + 1}. ${output}`);
      });
    }

    console.log('\n=== END DISCOVERY ===\n');

    // Optional: Log the counts
    console.log(`Total inputs: ${inputs.length}`);
    console.log(`Total outputs: ${outputs.length}`);
  });
});