import type { Caption, OutputTier, OverlayMode, ScenarioModule } from '@/types.js';

const VALID_TIER_SET = new Set<string>(['silent', 'captioned', 'scripted']);
const VALID_OVERLAY_SET = new Set<string>(['none', 'burned', 'both']);

const isOutputTier = (value: string): value is OutputTier =>
  VALID_TIER_SET.has(value);

const isOverlayMode = (value: string): value is OverlayMode =>
  VALID_OVERLAY_SET.has(value);

export const parseTierArg = (args: ReadonlyArray<string>): OutputTier | undefined => {
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

export const parseOverlayArg = (args: ReadonlyArray<string>): OverlayMode | undefined => {
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
export const validateScenarioModule = (
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
