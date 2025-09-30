#!/usr/bin/env npx tsx
/**
 * Restore Mode to Physical Slot 1
 *
 * Auto-generated backup from 2025-09-30T05-09-17-954Z
 * Use this script to restore the mode back to the device.
 */

import { LaunchControlXL3, CustomModeBuilder, Color } from '../src';
import { JuceMidiBackend } from '../src/backends/JuceMidiBackend';

export async function restoreMode() {
  const backend = new JuceMidiBackend({ host: 'localhost', port: 7777 });
  const device = new LaunchControlXL3({ midiBackend: backend });

  try {
    await device.connect();
    console.log('🔧 Restoring mode "C" to physical slot 1...');

    // Recreate the mode using CustomModeBuilder
    const builder = new CustomModeBuilder().name('C');

    

    const restoredMode = builder.build();
    await device.writeCustomMode(0, restoredMode);

    console.log('✅ Mode restored successfully!');
  } catch (error) {
    console.error('❌ Restore failed:', error);
  } finally {
    await device.disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  restoreMode().catch(console.error);
}
