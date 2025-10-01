#!/usr/bin/env npx tsx
/**
 * Backup Current Mode from Physical Slot 1
 *
 * Reads the current mode from physical slot 1 and stores it in both JSON and
 * TypeScript format for later restoration using the library's built-in functions.
 */

import { writeFileSync } from 'fs';
import { LaunchControlXL3 } from '../src';
import { JuceMidiBackend } from '../src/backends/JuceMidiBackend';

/**
 * Check if test environment is ready
 */
async function checkEnvironment(): Promise<boolean> {
  console.log('🔍 Checking test environment...');

  try {
    const response = await fetch('http://localhost:7777/health', { signal: AbortSignal.timeout(2000) });
    const data = await response.json();

    if (data.status === 'ok') {
      console.log('✓ JUCE MIDI server is running');
      return true;
    }
  } catch (error) {
    console.log('✗ JUCE MIDI server not running!');
    console.log();
    console.log('═'.repeat(60));
    console.log('Integration Test Environment Not Ready');
    console.log('═'.repeat(60));
    console.log();
    console.log('Required setup:');
    console.log('  1. Start JUCE MIDI server:');
    console.log('     pnpm env:juce-server');
    console.log();
    console.log('  2. Connect Launch Control XL3 via USB');
    console.log('  3. Power on the device');
    console.log();
    console.log('Quick check environment:');
    console.log('     pnpm env:check');
    console.log();
    console.log('For more help:');
    console.log('     pnpm env:help');
    console.log();
    return false;
  }

  return false;
}

async function backupCurrentMode() {
  console.log('🔧 Backing up current mode from physical slot 1');
  console.log('═══════════════════════════════════════════════');
  console.log();

  // Check environment first
  const envReady = await checkEnvironment();
  if (!envReady) {
    process.exit(1);
  }

  console.log();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const physicalSlot = 1;
  const apiSlot = physicalSlot - 1; // API uses 0-based indexing

  // Create device with JUCE backend
  const backend = new JuceMidiBackend({ host: 'localhost', port: 7777 });
  const device = new LaunchControlXL3({ midiBackend: backend });

  try {
    console.log('🔌 Connecting to device...');
    await device.connect();
    console.log('✓ Connected');

    console.log(`📖 Reading mode from physical slot ${physicalSlot} (API slot ${apiSlot})...`);
    const currentMode = await device.readCustomMode(apiSlot);

    if (!currentMode) {
      console.log(`❌ No mode found in physical slot ${physicalSlot}`);
      console.log('   Slot appears to be empty');
      return;
    }

    console.log(`✓ Successfully read mode: "${currentMode.name}"`);
    console.log(`  Controls: ${Object.keys(currentMode.controls).length}`);

    // Store in JSON format for examination
    const jsonFilename = `backup/slot-${physicalSlot}-${timestamp}.json`;
    const jsonData = {
      metadata: {
        physicalSlot,
        apiSlot,
        timestamp,
        backupDate: new Date().toISOString(),
        deviceInfo: device.isConnected() ? await device.verifyDevice() : null
      },
      mode: {
        name: currentMode.name,
        controls: Object.fromEntries(
          Object.entries(currentMode.controls).map(([id, control]) => [
            id,
            {
              controlType: control.controlType,
              midiChannel: control.midiChannel,
              ccNumber: control.ccNumber,
              behavior: control.behavior,
              // Include any additional properties
              ...control
            }
          ])
        ),
        metadata: currentMode.metadata
      }
    };

    // Create backup directory if it doesn't exist
    const { mkdirSync } = await import('fs');
    try {
      mkdirSync('backup', { recursive: true });
    } catch (e) {
      // Directory might already exist
    }

    writeFileSync(jsonFilename, JSON.stringify(jsonData, null, 2));
    console.log(`💾 JSON backup saved: ${jsonFilename}`);

    // Store in TypeScript format for easy restoration
    const tsFilename = `backup/slot-${physicalSlot}-${timestamp}.restore.ts`;
    const tsContent = `#!/usr/bin/env npx tsx
/**
 * Restore Mode to Physical Slot ${physicalSlot}
 *
 * Auto-generated backup from ${timestamp}
 * Use this script to restore the mode back to the device.
 */

import { LaunchControlXL3, CustomModeBuilder, Color } from '../src';
import { JuceMidiBackend } from '../src/backends/JuceMidiBackend';

export async function restoreMode() {
  const backend = new JuceMidiBackend({ host: 'localhost', port: 7777 });
  const device = new LaunchControlXL3({ midiBackend: backend });

  try {
    await device.connect();
    console.log('🔧 Restoring mode "${currentMode.name}" to physical slot ${physicalSlot}...');

    // Recreate the mode using CustomModeBuilder
    const builder = new CustomModeBuilder().name('${currentMode.name}');

    ${generateBuilderCode(currentMode)}

    const restoredMode = builder.build();
    await device.writeCustomMode(${apiSlot}, restoredMode);

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
`;

    writeFileSync(tsFilename, tsContent);
    console.log(`💾 TypeScript restore script saved: ${tsFilename}`);

    // Show summary
    console.log('');
    console.log('📋 Backup Summary:');
    console.log(`   Mode Name: "${currentMode.name}"`);
    console.log(`   Physical Slot: ${physicalSlot}`);
    console.log(`   Controls: ${Object.keys(currentMode.controls).length}`);
    console.log(`   JSON File: ${jsonFilename}`);
    console.log(`   Restore Script: ${tsFilename}`);
    console.log('');
    console.log('🔍 To examine the data:');
    console.log(`   cat ${jsonFilename}`);
    console.log('');
    console.log('🔄 To restore later:');
    console.log(`   npx tsx ${tsFilename}`);

  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  } finally {
    console.log('🧹 Cleaning up...');
    await device.disconnect();
    await backend.close();
    console.log('✓ Done');
  }
}

function generateBuilderCode(mode: any): string {
  const lines: string[] = [];

  for (const [controlId, control] of Object.entries(mode.controls)) {
    const ctrl = control as any;

    // Determine control type and add appropriate builder call
    if (controlId.includes('encoder') || controlId.includes('knob')) {
      // Extract row and column from control ID or use defaults
      const row = 1; // You might want to extract this from controlId
      const col = 1; // You might want to extract this from controlId

      lines.push(`    builder.addEncoder(${row}, ${col}, {`);
      lines.push(`      cc: ${ctrl.ccNumber},`);
      lines.push(`      channel: ${ctrl.midiChannel}`);
      lines.push(`    });`);
    } else if (controlId.includes('fader')) {
      const faderNum = 1; // Extract from controlId
      lines.push(`    builder.addFader(${faderNum}, {`);
      lines.push(`      cc: ${ctrl.ccNumber},`);
      lines.push(`      channel: ${ctrl.midiChannel}`);
      lines.push(`    });`);
    } else if (controlId.includes('button')) {
      const buttonNum = 1; // Extract from controlId
      lines.push(`    builder.addSideButton(${buttonNum}, {`);
      lines.push(`      cc: ${ctrl.ccNumber},`);
      lines.push(`      channel: ${ctrl.midiChannel}`);
      lines.push(`    });`);
    }
  }

  return lines.join('\\n');
}

// Run the backup
backupCurrentMode().catch(console.error);