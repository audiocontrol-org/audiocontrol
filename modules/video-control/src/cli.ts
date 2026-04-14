import { resolve } from 'node:path';
import { runScenario } from '@/runner.js';
import type { ScenarioModule } from '@/types.js';

async function main(): Promise<void> {
  const scenarioPath = process.argv[2];
  const url = process.argv[3] ?? 'about:blank';

  if (!scenarioPath) {
    console.error(
      'Usage: tsx modules/video-control/src/cli.ts <scenario-path> [url]',
    );
    process.exit(1);
  }

  const absolutePath = resolve(scenarioPath);
  const scenarioModule: Record<string, unknown> = await import(absolutePath);

  const metadata = scenarioModule['metadata'];
  const run = scenarioModule['run'];

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
  };

  console.log(`Running scenario: ${scenario.metadata.name}`);
  console.log(`Mode: ${scenario.metadata.mode}`);
  console.log(`Output tier: ${scenario.metadata.outputTier}`);

  const result = await runScenario(scenario, { url });

  console.log(`\nDone! Output:`);
  console.log(`  MP4: ${result.mp4Path}`);
  console.log(`  GIF: ${result.gifPath}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
