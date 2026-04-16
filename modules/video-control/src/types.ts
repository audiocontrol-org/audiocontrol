import type { Page } from 'playwright';

/** Output tier -- each is a superset of the previous */
export type OutputTier = 'silent' | 'captioned' | 'scripted';

/** Caption overlay mode for burned-in subtitles */
export type OverlayMode = 'none' | 'burned' | 'both';

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

/** Pipeline step identifier for progress tracking */
export type PipelineStep =
  | 'launching-browser'
  | 'recording-scenario'
  | 'finalizing-video'
  | 'converting-mp4'
  | 'converting-gif'
  | 'generating-captions'
  | 'generating-vo-script'
  | 'burning-captions'
  | 'complete';

/** Status of a pipeline step */
export type StepStatus = 'pending' | 'running' | 'done';

/** Progress info for a single pipeline step */
export interface StepProgress {
  step: PipelineStep;
  status: StepStatus;
  startedAt?: number;
  completedAt?: number;
}

/** Callback invoked at each pipeline transition */
export type ProgressCallback = (step: PipelineStep) => void;

/** Result of running a scenario */
export interface ScenarioResult {
  scenarioName: string;
  outputDir: string;
  mp4Path: string;
  gifPath: string;
  captionedMp4Path?: string;
  captionsYamlPath?: string;
  voScriptPath?: string;
  metadata: ScenarioMetadata;
}
