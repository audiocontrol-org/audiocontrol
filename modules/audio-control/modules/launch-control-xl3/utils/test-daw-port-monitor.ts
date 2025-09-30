#!/usr/bin/env tsx
/**
 * Monitor both MIDI and DAW ports to see if there's out-of-band communication
 * that controls which slot is active for writing
 */

import easymidi from 'easymidi';

async function monitorDAWPort() {
  console.log('DAW Port Monitor - Looking for Out-of-Band Slot Control');
  console.log('========================================================\n');

  let midiInput: any = null;
  let dawInput: any = null;

  try {
    // List available MIDI devices
    console.log('Available MIDI inputs:', easymidi.getInputs());
    console.log();

    // Find Launch Control XL3 ports
    const midiPortName = easymidi.getInputs().find((name: string) =>
      name.includes('LCXL3') && name.includes('MIDI Out'));
    const dawPortName = easymidi.getInputs().find((name: string) =>
      name.includes('LCXL3') && name.includes('DAW Out'));

    if (!midiPortName || !dawPortName) {
      throw new Error('Launch Control XL3 ports not found');
    }

    console.log(`📡 Monitoring MIDI Port: ${midiPortName}`);
    console.log(`📡 Monitoring DAW Port: ${dawPortName}`);
    console.log('\n⚠️  Please use the web editor to change slots and write data');
    console.log('   Watch for any messages that might indicate slot selection\n');
    console.log('=' .repeat(60) + '\n');

    // Monitor MIDI port
    midiInput = new easymidi.Input(midiPortName);

    midiInput.on('noteon', (msg: any) => {
      console.log(`[MIDI] Note On: note=${msg.note}, velocity=${msg.velocity}, channel=${msg.channel}`);
    });

    midiInput.on('noteoff', (msg: any) => {
      console.log(`[MIDI] Note Off: note=${msg.note}, velocity=${msg.velocity}, channel=${msg.channel}`);
    });

    midiInput.on('cc', (msg: any) => {
      const hex = `0x${msg.controller.toString(16).padStart(2, '0').toUpperCase()}`;
      console.log(`[MIDI] CC: controller=${msg.controller} (${hex}), value=${msg.value}, channel=${msg.channel}`);
    });

    midiInput.on('program', (msg: any) => {
      console.log(`[MIDI] Program Change: number=${msg.number}, channel=${msg.channel}`);
      console.log(`   🎯 This could be slot selection! Program ${msg.number} might = Slot ${msg.number + 1}`);
    });

    midiInput.on('sysex', (msg: any) => {
      const preview = msg.bytes.slice(0, 12).map((b: number) =>
        '0x' + b.toString(16).padStart(2, '0').toUpperCase()
      ).join(' ');
      console.log(`[MIDI] SysEx: ${msg.bytes.length} bytes - ${preview}...`);
    });

    // Monitor DAW port
    dawInput = new easymidi.Input(dawPortName);

    dawInput.on('noteon', (msg: any) => {
      console.log(`[DAW] Note On: note=${msg.note}, velocity=${msg.velocity}, channel=${msg.channel}`);
      console.log(`   💡 Note ${msg.note} might indicate slot or mode`);
    });

    dawInput.on('noteoff', (msg: any) => {
      console.log(`[DAW] Note Off: note=${msg.note}, velocity=${msg.velocity}, channel=${msg.channel}`);
    });

    dawInput.on('cc', (msg: any) => {
      const hex = `0x${msg.controller.toString(16).padStart(2, '0').toUpperCase()}`;
      console.log(`[DAW] CC: controller=${msg.controller} (${hex}), value=${msg.value}, channel=${msg.channel}`);

      // Check for special CC messages that might control slots
      if (msg.controller >= 0x60 && msg.controller <= 0x6F) {
        console.log(`   🎯 Possible slot control CC in range 0x60-0x6F!`);
      }
    });

    dawInput.on('program', (msg: any) => {
      console.log(`[DAW] Program Change: number=${msg.number}, channel=${msg.channel}`);
      console.log(`   🎯 This could be slot selection! Program ${msg.number} might = Slot ${msg.number + 1}`);
    });

    dawInput.on('sysex', (msg: any) => {
      const preview = msg.bytes.slice(0, 12).map((b: number) =>
        '0x' + b.toString(16).padStart(2, '0').toUpperCase()
      ).join(' ');
      console.log(`[DAW] SysEx: ${msg.bytes.length} bytes - ${preview}...`);

      // Check for specific commands
      if (msg.bytes.length > 8) {
        const cmd = msg.bytes[8];
        if (cmd === 0x77) {
          console.log(`   💡 Command 0x77 detected - might be mode/slot related`);
        }
      }
    });

    // Also monitor any other message types
    midiInput.on('select', (msg: any) => {
      console.log(`[MIDI] Song Select: song=${msg.song}`);
    });

    dawInput.on('select', (msg: any) => {
      console.log(`[DAW] Song Select: song=${msg.song}`);
    });

    console.log('Monitoring... Press Ctrl+C to stop\n');

    // Keep running
    await new Promise(() => {}); // Never resolves

  } catch (error) {
    console.error('\n✗ Monitor failed:', error instanceof Error ? error.message : String(error));
  } finally {
    if (midiInput) midiInput.close();
    if (dawInput) dawInput.close();
    console.log('\n✓ Monitoring stopped');
  }
}

// Run the monitor
monitorDAWPort().catch(console.error);