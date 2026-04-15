import { resolve } from 'node:path';
import { runScenario } from '@/runner.js';
import type { Caption, OutputTier, OverlayMode, ScenarioModule } from '@/types.js';

const VALID_TIER_SET = new Set<string>(['silent', 'captioned', 'scripted']);
const VALID_OVERLAY_SET = new Set<string>(['none', 'burned', 'both']);

const isOutputTier = (value: string): value is OutputTier =>
  VALID_TIER_SET.has(value);

const isOverlayMode = (value: string): value is OverlayMode =>
  VALID_OVERLAY_SET.has(value);

const parseTierArg = (args: ReadonlyArray<string>): OutputTier | undefined => {
  const tierIndex = args.indexOf('--tier');
  if (tierIndex === -1) {
    return undefined;
  }
  const tierValue = args[tierIndex + 1];
  if (!tierValue || !isOutputTier(tierValue)) {
    throw new Error(
      `Invalid --tier value: "${tierValue ?? '(missing)'}". ` +
        `Must be one of: ${[...VALID_TIER_SET].join(', ')}`,
    );
  }
  return tierValue;
};

const parseOverlayArg = (args: ReadonlyArray<string>): OverlayMode | undefined => {
  const overlayIndex = args.indexOf('--overlay');
  if (overlayIndex === -1) {
    return undefined;
  }
  const overlayValue = args[overlayIndex + 1];
  if (!overlayValue || !isOverlayMode(overlayValue)) {
    throw new Error(
      `Invalid --overlay value: "${overlayValue ?? '(missing)'}". ` +
        `Must be one of: ${[...VALID_OVERLAY_SET].join(', ')}`,
    );
  }
  return overlayValue;
};

/**
 * Validate a dynamically imported module conforms to the ScenarioModule shape.
 * Dynamic imports return unknown structure, so we validate each field at runtime
 * rather than using `as Type` casts.
 */
const validateScenarioModule = (
  mod: Record<string, unknown>,
  path: string,
): ScenarioModule => {
  const metadata = mod['metadata'];
  const run = mod['run'];
  const captions = mod['captions'];

  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !run ||
    typeof run !== 'function'
  ) {
    throw new Error(`Scenario at "${path}" must export metadata and run`);
  }

  const m = metadata as Record<string, unknown>;
  if (
    typeof m['name'] !== 'string' ||
    typeof m['description'] !== 'string' ||
    typeof m['mode'] !== 'string' ||
    typeof m['outputTier'] !== 'string'
  ) {
    throw new Error(
      `Scenario at "${path}" metadata must have name, description, mode, and outputTier`,
    );
  }

  const result: ScenarioModule = {
    // metadata fields are validated as strings above; the type narrowing
    // from runtime checks is sufficient for the ScenarioMetadata shape.
    metadata: metadata as ScenarioModule['metadata'],
    run: run as ScenarioModule['run'],
  };

  if (Array.isArray(captions)) {
    result.captions = captions as Caption[];
  }

  return result;
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Filter out --tier/--overlay and their values to get positional args
  const positionalArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tier' || args[i] === '--overlay') {
      i++; // skip the value too
      continue;
    }
    positionalArgs.push(args[i]);
  }

  const scenarioPath = positionalArgs[0];
  const url = positionalArgs[1] ?? 'about:blank';

  if (!scenarioPath) {
    console.error(
      'Usage: tsx modules/video-control/src/cli.ts <scenario-path> [url] [--tier silent|captioned|scripted] [--overlay none|burned|both]',
    );
    process.exit(1);
  }

  const tier = parseTierArg(args);
  const overlay = parseOverlayArg(args);
  const absolutePath = resolve(scenarioPath);
  const scenarioModule: Record<string, unknown> = await import(absolutePath);

  const scenario = validateScenarioModule(scenarioModule, absolutePath);

  const effectiveTier = tier ?? scenario.metadata.outputTier;
  const effectiveOverlay = overlay ?? 'none';

  console.log(`Running scenario: ${scenario.metadata.name}`);
  console.log(`Mode: ${scenario.metadata.mode}`);
  console.log(`Output tier: ${effectiveTier}`);
  console.log(`Overlay: ${effectiveOverlay}`);

  const result = await runScenario(scenario, { url, tier, overlay });

  console.log(`\nDone! Output:`);
  console.log(`  MP4: ${result.mp4Path}`);
  console.log(`  GIF: ${result.gifPath}`);
  if (result.captionedMp4Path) {
    console.log(`  Captioned MP4: ${result.captionedMp4Path}`);
  }
  if (result.captionsYamlPath) {
    console.log(`  Captions YAML: ${result.captionsYamlPath}`);
  }
  if (result.voScriptPath) {
    console.log(`  VO Script: ${result.voScriptPath}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
