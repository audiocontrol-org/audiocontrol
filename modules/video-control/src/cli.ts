import { resolve } from 'node:path';
import { runScenario } from '@/runner.js';
import type { Caption, OutputTier, ScenarioModule } from '@/types.js';

const VALID_TIERS: ReadonlyArray<OutputTier> = [
  'silent',
  'captioned',
  'scripted',
];

const isOutputTier = (value: string): value is OutputTier =>
  VALID_TIERS.includes(value as OutputTier);

const parseTierArg = (args: ReadonlyArray<string>): OutputTier | undefined => {
  const tierIndex = args.indexOf('--tier');
  if (tierIndex === -1) {
    return undefined;
  }
  const tierValue = args[tierIndex + 1];
  if (!tierValue || !isOutputTier(tierValue)) {
    throw new Error(
      `Invalid --tier value: "${tierValue ?? '(missing)'}". ` +
        `Must be one of: ${VALID_TIERS.join(', ')}`,
    );
  }
  return tierValue;
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Filter out --tier and its value to get positional args
  const positionalArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--tier') {
      i++; // skip the value too
      continue;
    }
    positionalArgs.push(args[i]);
  }

  const scenarioPath = positionalArgs[0];
  const url = positionalArgs[1] ?? 'about:blank';

  if (!scenarioPath) {
    console.error(
      'Usage: tsx modules/video-control/src/cli.ts <scenario-path> [url] [--tier silent|captioned|scripted]',
    );
    process.exit(1);
  }

  const tier = parseTierArg(args);
  const absolutePath = resolve(scenarioPath);
  const scenarioModule: Record<string, unknown> = await import(absolutePath);

  const metadata = scenarioModule['metadata'];
  const run = scenarioModule['run'];
  const captions = scenarioModule['captions'] as Caption[] | undefined;

  if (
    !metadata ||
    typeof metadata !== 'object' ||
    !run ||
    typeof run !== 'function'
  ) {
    throw new Error(
      `Scenario at "${absolutePath}" must export metadata and run`,
    );
  }

  const scenario: ScenarioModule = {
    metadata: metadata as ScenarioModule['metadata'],
    run: run as ScenarioModule['run'],
    captions,
  };

  const effectiveTier = tier ?? scenario.metadata.outputTier;

  console.log(`Running scenario: ${scenario.metadata.name}`);
  console.log(`Mode: ${scenario.metadata.mode}`);
  console.log(`Output tier: ${effectiveTier}`);

  const result = await runScenario(scenario, { url, tier });

  console.log(`\nDone! Output:`);
  console.log(`  MP4: ${result.mp4Path}`);
  console.log(`  GIF: ${result.gifPath}`);
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
