#!/usr/bin/env tsx
/**
 * Chop Sample - Slice contiguous audio into drum kit
 *
 * Slices a single WAV file containing multiple drum hits into individual
 * samples, outputting a drum kit directory ready for import.
 *
 * Usage:
 *   tsx scripts/chop-sample.ts <input.wav> <output-dir> [options]
 *
 * Examples:
 *   # Auto-detect hits using transient detection
 *   tsx scripts/chop-sample.ts drums.wav ./kits/MY-KIT --transient
 *
 *   # Split every 500ms into 4 samples
 *   tsx scripts/chop-sample.ts drums.wav ./kits/MY-KIT --fixed --interval 500 --count 4
 *
 *   # Detect silence gaps
 *   tsx scripts/chop-sample.ts drums.wav ./kits/MY-KIT --silence --threshold-db -35
 *
 * @packageDocumentation
 */

import * as path from 'path';

// Note: Direct imports because CLI scripts run outside the module context
type SliceMethod = 'transient' | 'silence' | 'fixed' | 'manual';

interface TransientConfig {
  method: 'transient';
  threshold: number;
  minGapMs: number;
  prePadMs?: number;
  postPadMs?: number;
}

interface SilenceConfig {
  method: 'silence';
  thresholdDb: number;
  minSilenceMs: number;
  minSampleMs?: number;
}

interface FixedConfig {
  method: 'fixed';
  intervalMs: number;
  count?: number;
}

interface ManualConfig {
  method: 'manual';
  regions: Array<{ start: number; end: number; name?: string }>;
}

type SliceConfig = TransientConfig | SilenceConfig | FixedConfig | ManualConfig;
type S330WaveSampleRate = 15000 | 30000;

interface DrumKitOutputConfig {
  name: string;
  sampleRate: S330WaveSampleRate;
  baseNote?: number;
  drumTypes?: string[];
}

// =============================================================================
// CLI Options
// =============================================================================

interface ChopOptions {
  inputPath: string;
  outputDir: string;
  sliceConfig: SliceConfig | null;
  kitConfig: Partial<DrumKitOutputConfig>;
  analyze: boolean;
  help: boolean;
}

function printUsage(): void {
  console.log(`
Usage: tsx scripts/chop-sample.ts <input.wav> <output-dir> [options]

Slice a contiguous audio sample into individual drum hits and create a drum kit.

Slicing Methods (pick one):
  --transient              Use transient detection (default)
    --threshold <0-1>      Amplitude threshold (default: 0.3)
    --min-gap <ms>         Minimum gap between hits (default: 100)
    --pre-pad <ms>         Include before transient (default: 5)
    --post-pad <ms>        Include after decay (default: 0 = to next hit)

  --silence                Use silence detection
    --threshold-db <dB>    Silence threshold (default: -40)
    --min-silence <ms>     Minimum silence duration (default: 50)
    --min-sample <ms>      Minimum sample length (default: 10)

  --fixed                  Use fixed intervals
    --interval <ms>        Interval between slices
    --count <n>            Expected number of slices (optional validation)

  --manual                 Use manual regions (requires --regions)
    --regions <json>       JSON array of {start, end, name?} objects

Kit Options:
  --name <name>            Kit name (default: from input filename)
  --sample-rate <rate>     Target sample rate: 15000 or 30000 (default: 15000)
  --base-note <midi>       Base MIDI note (default: 36 = C2)
  --labels <list>          Comma-separated labels (e.g., kick,snare,hhc,hho)

Other Options:
  --analyze                Analyze input file and suggest parameters (don't slice)
  --help, -h               Show this help message

Examples:
  # Auto-detect hits using transients with 25% threshold
  tsx scripts/chop-sample.ts drums.wav ./kits/MY-KIT --transient --threshold 0.25

  # Split every 500ms
  tsx scripts/chop-sample.ts drums.wav ./kits/MY-KIT --fixed --interval 500

  # Split at silence gaps below -35dB
  tsx scripts/chop-sample.ts drums.wav ./kits/MY-KIT --silence --threshold-db -35

  # Manual regions with custom labels
  tsx scripts/chop-sample.ts drums.wav ./kits/MY-KIT \\
    --manual --regions '[{"start":0,"end":500},{"start":500,"end":1000}]' \\
    --labels 'kick,snare'

  # Analyze a file first
  tsx scripts/chop-sample.ts drums.wav . --analyze
`);
}

function parseArgs(args: string[]): ChopOptions {
  const options: ChopOptions = {
    inputPath: '',
    outputDir: '',
    sliceConfig: null,
    kitConfig: {},
    analyze: false,
    help: false,
  };

  // Temporary holders for building slice config
  let method: 'transient' | 'silence' | 'fixed' | 'manual' | null = null;
  let transientThreshold = 0.3;
  let transientMinGapMs = 100;
  let transientPrePadMs = 5;
  let transientPostPadMs = 0;
  let silenceThresholdDb = -40;
  let silenceMinSilenceMs = 50;
  let silenceMinSampleMs: number | undefined;
  let fixedIntervalMs = 500;
  let fixedCount: number | undefined;
  let manualRegions: Array<{ start: number; end: number; name?: string }> = [];

  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--analyze') {
      options.analyze = true;
    } else if (arg === '--transient') {
      method = 'transient';
    } else if (arg === '--silence') {
      method = 'silence';
    } else if (arg === '--fixed') {
      method = 'fixed';
    } else if (arg === '--manual') {
      method = 'manual';
    } else if (arg === '--threshold') {
      const value = args[++i];
      if (!value || isNaN(parseFloat(value))) {
        console.error('--threshold requires a number 0-1');
        process.exit(1);
      }
      transientThreshold = parseFloat(value);
    } else if (arg === '--min-gap') {
      const value = args[++i];
      if (!value || isNaN(parseFloat(value))) {
        console.error('--min-gap requires milliseconds');
        process.exit(1);
      }
      transientMinGapMs = parseFloat(value);
    } else if (arg === '--pre-pad') {
      const value = args[++i];
      if (!value || isNaN(parseFloat(value))) {
        console.error('--pre-pad requires milliseconds');
        process.exit(1);
      }
      transientPrePadMs = parseFloat(value);
    } else if (arg === '--post-pad') {
      const value = args[++i];
      if (!value || isNaN(parseFloat(value))) {
        console.error('--post-pad requires milliseconds');
        process.exit(1);
      }
      transientPostPadMs = parseFloat(value);
    } else if (arg === '--threshold-db') {
      const value = args[++i];
      if (!value || isNaN(parseFloat(value))) {
        console.error('--threshold-db requires dB value (e.g., -40)');
        process.exit(1);
      }
      silenceThresholdDb = parseFloat(value);
    } else if (arg === '--min-silence') {
      const value = args[++i];
      if (!value || isNaN(parseFloat(value))) {
        console.error('--min-silence requires milliseconds');
        process.exit(1);
      }
      silenceMinSilenceMs = parseFloat(value);
    } else if (arg === '--min-sample') {
      const value = args[++i];
      if (!value || isNaN(parseFloat(value))) {
        console.error('--min-sample requires milliseconds');
        process.exit(1);
      }
      silenceMinSampleMs = parseFloat(value);
    } else if (arg === '--interval') {
      const value = args[++i];
      if (!value || isNaN(parseFloat(value))) {
        console.error('--interval requires milliseconds');
        process.exit(1);
      }
      fixedIntervalMs = parseFloat(value);
    } else if (arg === '--count') {
      const value = args[++i];
      if (!value || isNaN(parseInt(value, 10))) {
        console.error('--count requires a number');
        process.exit(1);
      }
      fixedCount = parseInt(value, 10);
    } else if (arg === '--regions') {
      const value = args[++i];
      if (!value) {
        console.error('--regions requires a JSON array');
        process.exit(1);
      }
      try {
        manualRegions = JSON.parse(value);
        if (!Array.isArray(manualRegions)) {
          throw new Error('Expected array');
        }
      } catch {
        console.error('--regions must be valid JSON array of {start, end, name?} objects');
        process.exit(1);
      }
    } else if (arg === '--name') {
      const value = args[++i];
      if (!value) {
        console.error('--name requires a kit name');
        process.exit(1);
      }
      options.kitConfig.name = value;
    } else if (arg === '--sample-rate') {
      const value = args[++i];
      if (!value || !['15000', '30000'].includes(value)) {
        console.error('--sample-rate must be 15000 or 30000');
        process.exit(1);
      }
      options.kitConfig.sampleRate = parseInt(value, 10) as S330WaveSampleRate;
    } else if (arg === '--base-note') {
      const value = args[++i];
      if (!value || isNaN(parseInt(value, 10))) {
        console.error('--base-note requires a MIDI note number (0-127)');
        process.exit(1);
      }
      options.kitConfig.baseNote = parseInt(value, 10);
    } else if (arg === '--labels') {
      const value = args[++i];
      if (!value) {
        console.error('--labels requires comma-separated drum types');
        process.exit(1);
      }
      options.kitConfig.drumTypes = value.split(',').map(s => s.trim());
    } else if (!arg.startsWith('-')) {
      positionalArgs.push(arg);
    } else {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    }
  }

  // Assign positional args
  if (positionalArgs.length >= 1) {
    options.inputPath = positionalArgs[0]!;
  }
  if (positionalArgs.length >= 2) {
    options.outputDir = positionalArgs[1]!;
  }

  // Build slice config based on selected method
  if (!options.analyze && !options.help) {
    // Default to transient if no method specified
    method = method ?? 'transient';

    switch (method) {
      case 'transient':
        options.sliceConfig = {
          method: 'transient',
          threshold: transientThreshold,
          minGapMs: transientMinGapMs,
          prePadMs: transientPrePadMs,
          postPadMs: transientPostPadMs > 0 ? transientPostPadMs : undefined,
        };
        break;
      case 'silence':
        options.sliceConfig = {
          method: 'silence',
          thresholdDb: silenceThresholdDb,
          minSilenceMs: silenceMinSilenceMs,
          minSampleMs: silenceMinSampleMs,
        };
        break;
      case 'fixed':
        options.sliceConfig = {
          method: 'fixed',
          intervalMs: fixedIntervalMs,
          count: fixedCount,
        };
        break;
      case 'manual':
        if (manualRegions.length === 0) {
          console.error('--manual requires --regions with at least one region');
          process.exit(1);
        }
        options.sliceConfig = {
          method: 'manual',
          regions: manualRegions,
        };
        break;
    }
  }

  return options;
}

// =============================================================================
// Analysis Mode
// =============================================================================

async function analyzeFile(inputPath: string): Promise<void> {
  const { promises: fs } = await import('node:fs');
  const { parseWav } = await import('@audiocontrol/sampler-devices/s330');
  const { analyzeForSlicing } = await import('@audiocontrol/sampler-library');

  console.log(`Analyzing: ${inputPath}\n`);

  const wavBytes = await fs.readFile(inputPath);
  const wavData = parseWav(wavBytes.buffer);

  console.log('File Info:');
  console.log(`  Sample rate: ${wavData.sampleRate} Hz`);
  console.log(`  Bit depth: ${wavData.bitsPerSample}-bit`);
  console.log(`  Channels: ${wavData.channels}`);
  console.log(`  Duration: ${(wavData.samples.length / wavData.sampleRate * 1000).toFixed(1)} ms`);
  console.log(`  Samples: ${wavData.samples.length}`);
  console.log();

  const analysis = analyzeForSlicing(wavData.samples, wavData.sampleRate);

  console.log('Analysis:');
  console.log(`  Peak amplitude: ${(analysis.peakAmplitude * 100).toFixed(1)}%`);
  console.log();

  console.log('Suggested Parameters:');
  console.log();
  console.log('  For transient detection:');
  console.log(`    --transient --threshold ${analysis.suggestedTransientThreshold.toFixed(2)}`);
  console.log();
  console.log('  For silence detection:');
  console.log(`    --silence --threshold-db ${analysis.suggestedSilenceThresholdDb}`);
  console.log();

  // Estimate beats if duration is reasonable
  if (analysis.duration.ms >= 1000) {
    const commonIntervals = [500, 250, 125]; // 120, 240, 480 BPM
    console.log('  For fixed intervals (common tempos):');
    for (const interval of commonIntervals) {
      const beats = Math.floor(analysis.duration.ms / interval);
      const bpm = Math.round(60000 / interval);
      if (beats >= 2 && beats <= 16) {
        console.log(`    --fixed --interval ${interval} --count ${beats}  # ${bpm} BPM, ${beats} hits`);
      }
    }
  }
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    printUsage();
    process.exit(0);
  }

  if (!options.inputPath) {
    console.error('Error: Input WAV file is required');
    printUsage();
    process.exit(1);
  }

  if (options.analyze) {
    await analyzeFile(options.inputPath);
    process.exit(0);
  }

  if (!options.outputDir) {
    console.error('Error: Output directory is required');
    printUsage();
    process.exit(1);
  }

  if (!options.sliceConfig) {
    console.error('Error: No slice configuration');
    process.exit(1);
  }

  // Default kit name from input filename
  const inputBasename = path.basename(options.inputPath, path.extname(options.inputPath));
  const kitConfig: DrumKitOutputConfig = {
    name: options.kitConfig.name ?? inputBasename,
    sampleRate: options.kitConfig.sampleRate ?? 15000,
    baseNote: options.kitConfig.baseNote ?? 36,
    drumTypes: options.kitConfig.drumTypes,
  };

  console.log('='.repeat(60));
  console.log('Sample Chopper');
  console.log('='.repeat(60));
  console.log();

  console.log(`Input: ${options.inputPath}`);
  console.log(`Output: ${options.outputDir}`);
  console.log(`Method: ${options.sliceConfig.method}`);
  console.log(`Kit name: ${kitConfig.name}`);
  console.log(`Sample rate: ${kitConfig.sampleRate} Hz`);
  console.log(`Base note: ${kitConfig.baseNote}`);
  if (kitConfig.drumTypes) {
    console.log(`Labels: ${kitConfig.drumTypes.join(', ')}`);
  }
  console.log();

  try {
    const { chopSampleToDrumKit } = await import('@audiocontrol/sampler-library');
    await chopSampleToDrumKit(
      options.inputPath,
      options.outputDir,
      options.sliceConfig as Parameters<typeof chopSampleToDrumKit>[2],
      kitConfig
    );

    console.log();
    console.log('='.repeat(60));
    console.log('Done!');
    console.log('='.repeat(60));
    console.log();
    console.log('Next steps:');
    console.log(`  1. Review the output at: ${options.outputDir}`);
    console.log(`  2. Import to S-330: tsx scripts/import-drum-kit.ts ${options.outputDir}`);

  } catch (err) {
    console.error(`\nError: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
