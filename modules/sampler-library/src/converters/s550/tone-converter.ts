/**
 * S-550 tone converter — thin wrapper around shared S-series converter.
 *
 * @packageDocumentation
 */

import type { S550Tone } from '@audiocontrol/sampler-devices/s550';
import type { ToneYaml } from '@/schemas/index.js';
import { createSeriesToneConverter } from '@/converters/s-series/tone-converter.js';

export const s550ToneConverter = createSeriesToneConverter<S550Tone>('s550');
