/**
 * Manual test script for macOS device detection
 *
 * Usage:
 *   1. Insert a USB drive or SD card
 *   2. Note the mount path (e.g., /Volumes/SDCARD)
 *   3. Run: pnpm exec tsx test/manual-test-macos.ts /Volumes/SDCARD
 *
 * This script is intended for manual testing and verification only.
 * It is not run as part of the automated test suite.
 */

import { MacOSDetector } from '../src/detectors/macos.js';

async function main() {
  const mountPath = process.argv[2];

  if (!mountPath) {
    console.error('Usage: tsx test/manual-test-macos.ts <mount-path>');
    console.error('Example: tsx test/manual-test-macos.ts /Volumes/SDCARD');
    console.error('');
    console.error('Common mount paths to test:');
    console.error('  /                    - Root volume');
    console.error('  /Volumes/<name>      - External drives');
    console.error('  /System/Volumes/Data - macOS data volume');
    process.exit(1);
  }

  console.log(`\nTesting macOS device detection for: ${mountPath}\n`);

  const detector = new MacOSDetector();

  if (!detector.isSupported()) {
    console.error('ERROR: Not running on macOS');
    console.error('This test script only works on macOS (darwin platform)');
    process.exit(1);
  }

  try {
    const info = await detector.detectDevice(mountPath);

    console.log('Device Information:');
    console.log('------------------');
    console.log(`Mount Path:    ${info.mountPath}`);
    console.log(`Volume UUID:   ${info.volumeUUID || 'N/A'}`);
    console.log(`Volume Label:  ${info.volumeLabel || 'N/A'}`);
    console.log(`Device Path:   ${info.devicePath || 'N/A'}`);
    console.log(`Filesystem:    ${info.filesystem || 'N/A'}`);

    console.log('\n✅ Detection successful!\n');

    // Provide interpretation of results
    if (!info.volumeUUID) {
      console.log('Note: No Volume UUID detected. This is normal for some FAT32 volumes.');
      console.log('      Consider using devicePath or volumeLabel for device identification.');
    }

    if (!info.volumeLabel) {
      console.log('Note: No Volume Label detected. The volume may be unlabeled.');
    }
  } catch (error: any) {
    console.error(`\n❌ Detection failed: ${error.message}\n`);

    // Provide troubleshooting hints
    console.error('Troubleshooting:');
    console.error('  1. Verify the mount path exists: ls -la ' + mountPath);
    console.error('  2. Try: diskutil info "' + mountPath + '"');
    console.error('  3. List all volumes: diskutil list');
    console.error('');

    process.exit(1);
  }
}

main();
