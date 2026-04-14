import type { Page } from 'playwright';

/** Output tier -- each is a superset of the previous */
export type OutputTier = 'silent' | 'captioned' | 'scripted';

/** Scenario mode */
export type ScenarioMode = 'harness' | 'device';

/** Caption type for text overlays */
export type CaptionType = 'title' | 'callout' | 'step';

/** A timed caption entry */
export interface Caption {
  text: string;
  timestampMs: number;
  durationMs: number;
  type: CaptionType;
}

/** Metadata describing a scenario */
export interface ScenarioMetadata {
  name: string;
  description: string;
  mode: ScenarioMode;
  outputTier: OutputTier;
}

/** A scenario module -- what each scenario file exports */
export interface ScenarioModule {
  metadata: ScenarioMetadata;
  run: (page: Page) => Promise<void>;
  captions?: Caption[];
}

/** Result of running a scenario */
export interface ScenarioResult {
  scenarioName: string;
  outputDir: string;
  mp4Path: string;
  gifPath: string;
  metadata: ScenarioMetadata;
}
