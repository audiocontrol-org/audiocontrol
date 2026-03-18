/**
 * S-330 tone converter — thin wrapper around shared S-series converter.
 *
 * @packageDocumentation
 */

import type { S330Tone } from '@audiocontrol/sampler-devices/s330';
import type { ToneYaml } from '@/schemas/index.js';
import { createSeriesToneConverter } from '@/converters/s-series/tone-converter.js';

export const s330ToneConverter = createSeriesToneConverter<S330Tone>('s330');
