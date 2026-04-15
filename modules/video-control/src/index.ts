export type {
  ScenarioModule,
  ScenarioMetadata,
  Caption,
  CaptionType,
  OutputTier,
  OverlayMode,
  ScenarioMode,
  ScenarioResult,
} from '@/types.js';
export { runScenario } from '@/runner.js';
export type { RunScenarioOptions } from '@/runner.js';
export { generateCaptionsYaml, generateVoScript } from '@/captions.js';
export { burnCaptions } from '@/ffmpeg.js';
