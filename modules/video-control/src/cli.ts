import { resolve } from 'node:path';
import { runScenario } from '@/runner.js';
import { parseTierArg, parseOverlayArg, validateScenarioModule } from '@/cli-utils.js';

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
