#!/usr/bin/env tsx
/**
 * Convert Drum Kit
 *
 * Converts WAV files from a drum kit directory to S-330 format.
 * This script does NOT require a device connection - it only
 * performs the conversion and reports results.
 *
 * Usage:
 *   tsx scripts/convert-drum-kit.ts <path-to-drum-kit>
 *   tsx scripts/convert-drum-kit.ts <path-to-drum-kit> --verbose
 *   tsx scripts/convert-drum-kit.ts <path-to-drum-kit> --json
 *
 * Example:
 *   tsx scripts/convert-drum-kit.ts ~/Documents/AudioTools/library/s330/drum-kits/KIT\ 01
 *
 * @packageDocumentation
 */

import { convertDrumKit, formatKitConversion, verifyConversion, getEncodedToneBytes } from './lib/drum-kit-converter.js';

function printUsage(): void {
  console.log(`
Usage: tsx scripts/convert-drum-kit.ts <path-to-drum-kit> [options]

Options:
  --verbose, -v        Show detailed verification for each sample
  --json               Output results as JSON
  --dump-bytes         Show the encoded tone bytes (hex dump)
  --original-key <n>   Set originalKey MIDI note (default: 60 = C4)
  --help, -h           Show this help message

Examples:
  tsx scripts/convert-drum-kit.ts ~/Documents/AudioTools/library/s330/drum-kits/KIT\\ 01
  tsx scripts/convert-drum-kit.ts ./my-kit --verbose
  tsx scripts/convert-drum-kit.ts ./my-kit --dump-bytes
  tsx scripts/convert-drum-kit.ts ./my-kit --dump-bytes --original-key 72
`);
}

function main(): void {
  const args = process.argv.slice(2);

  // Parse options
  const options = {
    verbose: false,
    json: false,
    dumpBytes: false,
    originalKey: 60, // Default C4
    help: false,
  };

  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--dump-bytes') {
      options.dumpBytes = true;
    } else if (arg === '--original-key') {
      const value = args[++i];
      if (!value || isNaN(parseInt(value, 10))) {
        console.error('--original-key requires a MIDI note number (0-127)');
        process.exit(1);
      }
      options.originalKey = parseInt(value, 10);
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (!arg.startsWith('-')) {
      positionalArgs.push(arg);
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  if (options.help || positionalArgs.length === 0) {
    printUsage();
    process.exit(options.help ? 0 : 1);
  }

  const kitPath = positionalArgs[0]!;

  try {
    const result = convertDrumKit(kitPath);

    if (options.json) {
      // Output as JSON (without the raw data buffers)
      const jsonResult = {
        ...result,
        samples: result.samples.map((s) => ({
          ...s,
          data: undefined, // Don't include raw bytes in JSON
          dataLength: s.data.length,
        })),
      };
      console.log(JSON.stringify(jsonResult, null, 2));
    } else if (options.dumpBytes) {
      // Dump the encoded tone bytes for each sample
      console.log('Encoded Tone Bytes (Hex Dump)');
      console.log('=============================');
      console.log(`Original Key: ${options.originalKey} (MIDI note)\n`);

      let segmentTop = 0;
      for (const sample of result.samples) {
        const encoded = getEncodedToneBytes(sample, 0, segmentTop, options.originalKey);

        console.log(`${sample.filename} (${sample.drumType} ${sample.kitNumber})`);
        console.log(`  Segment: ${segmentTop}, Length: ${sample.output.segmentsNeeded}`);
        console.log(`  Original key: ${encoded.originalKey} (byte [12]: 0x${encoded.originalKey.toString(16).padStart(2, '0')})`);
        console.log(`  Sample rate byte [${encoded.sampleRateByteIndex}]: 0x${encoded.sampleRateByte.toString(16).padStart(2, '0')} (${encoded.sampleRateByte === 0 ? '30kHz' : '15kHz'})`);
        console.log(`  Full tone bytes (${encoded.bytes.length} bytes):`);

        // Format as hex dump with 16 bytes per line
        for (let i = 0; i < encoded.bytes.length; i += 16) {
          const slice = encoded.bytes.slice(i, i + 16);
          const hex = slice.map((b) => b.toString(16).padStart(2, '0')).join(' ');
          const offset = i.toString(16).padStart(4, '0');
          console.log(`    ${offset}: ${hex}`);
        }
        console.log('');

        segmentTop += sample.output.segmentsNeeded;
      }
    } else {
      console.log(formatKitConversion(result, options.verbose));
    }

    // Exit with error if there are issues
    const hasErrors = result.errors.length > 0;
    const hasVerificationIssues = result.samples.some((s) => !verifyConversion(s).valid);

    if (hasErrors || hasVerificationIssues) {
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
