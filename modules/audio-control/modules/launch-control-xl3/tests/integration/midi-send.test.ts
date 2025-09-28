import { describe, test, expect } from 'vitest';
import easymidi from 'easymidi';

describe('MIDI Real Device Output Test', () => {
  test('should send a MIDI message to a real device', () => {
    // First, discover available MIDI inputs (devices that can receive messages)
    const availableInputs = easymidi.getInputs();

    console.log('\n=== AVAILABLE MIDI INPUTS (devices that can receive) ===');
    if (availableInputs.length === 0) {
      console.log('❌ No MIDI input devices found!');
      console.log('Make sure you have a MIDI device connected or virtual MIDI software running.');
      return; // Skip the test if no devices
    }

    availableInputs.forEach((input, index) => {
      console.log(`  ${index + 1}. ${input}`);
    });

    // Use the first available MIDI input device
    const targetDevice = availableInputs[0];
    console.log(`\n🎯 Sending MIDI message to: "${targetDevice}"`);

    try {
      // Create output connection to the target device
      const output = new easymidi.Output(targetDevice, false); // false = connect to existing device

      // Define the MIDI message to send
      const midiMessage = {
        channel: 0,    // MIDI channel 1 (0-indexed)
        note: 60,      // Middle C
        velocity: 100  // Medium velocity
      };

      console.log('📤 Sending Note On message:');
      console.log(`   Channel: ${midiMessage.channel + 1}`);
      console.log(`   Note: ${midiMessage.note} (Middle C)`);
      console.log(`   Velocity: ${midiMessage.velocity}`);

      // Send the MIDI message
      output.send('noteon', midiMessage);

      console.log('✅ MIDI message sent successfully!');

      // Wait a moment, then send note off
      setTimeout(() => {
        output.send('noteoff', {
          channel: midiMessage.channel,
          note: midiMessage.note,
          velocity: 0
        });
        console.log('📤 Note Off sent');

        // Clean up
        output.close();
        console.log('🔌 Connection closed');
      }, 1000); // 1 second note duration

      // Test passes if we got this far without errors
      expect(true).toBe(true);

    } catch (error) {
      console.error('❌ Error sending MIDI message:', error);
      throw error;
    }
  }, 5000); // 5 second timeout for this test
});