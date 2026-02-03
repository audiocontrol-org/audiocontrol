/**
 * Manual test script for Linux device detection
 *
 * Usage:
 *   1. Insert a USB drive or SD card
 *   2. Note the mount path (e.g., /media/username/SDCARD or /mnt/usb)
 *   3. Run: pnpm exec tsx test/manual-test-linux.ts /media/username/SDCARD
 *
 * Note: May require sudo for blkid on some systems
 */

import { LinuxDetector } from '../src/detectors/linux.js';

async function main() {
  const mountPath = process.argv[2];

  if (!mountPath) {
    console.error('Usage: tsx test/manual-test-linux.ts <mount-path>');
    console.error('Example: tsx test/manual-test-linux.ts /media/user/SDCARD');
    process.exit(1);
  }

  console.log(`\nTesting Linux device detection for: ${mountPath}\n`);

  const detector = new LinuxDetector();

  if (!detector.isSupported()) {
    console.error('ERROR: Not running on Linux');
    process.exit(1);
  }

  try {
    const info = await detector.detectDevice(mountPath);

    console.log('Device Information:');
    console.log('------------------');
    console.log(`Mount Path:    ${info.mountPath}`);
    console.log(`Device Path:   ${info.devicePath || 'N/A'}`);
    console.log(`Volume UUID:   ${info.volumeUUID || 'N/A'}`);
    console.log(`Volume Label:  ${info.volumeLabel || 'N/A'}`);
    console.log(`Volume Serial: ${info.volumeSerial || 'N/A'}`);
    console.log(`Filesystem:    ${info.filesystem || 'N/A'}`);

    console.log('\n✅ Detection successful!\n');

    if (!info.volumeUUID && !info.volumeSerial) {
      console.warn('⚠️  Warning: No UUID or serial number found for this device');
      console.warn('   Some FAT32 volumes may not have UUIDs');
    }
  } catch (error: any) {
    console.error(`\n❌ Detection failed: ${error.message}\n`);

    if (error.message.includes('blkid')) {
      console.error('Troubleshooting:');
      console.error('  - Try running with sudo if you get permission errors');
      console.error('  - Ensure blkid is installed: sudo apt-get install util-linux');
    }

    if (error.message.includes('findmnt')) {
      console.error('Troubleshooting:');
      console.error('  - Ensure findmnt is installed: sudo apt-get install util-linux');
      console.error('  - Verify the mount path is correct: findmnt | grep ' + mountPath);
    }

    process.exit(1);
  }
}

main();
