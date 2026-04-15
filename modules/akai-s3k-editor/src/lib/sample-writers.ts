/**
 * Sample header field writers.
 *
 * Wraps the generated SampleHeader_write* functions into a dispatch map
 * so SamplesPage can encode a field value into header.raw by name.
 */

import type { SampleHeader } from '@audiocontrol/sampler-devices/s3k';
import * as s3k from '@audiocontrol/sampler-devices/s3k';

type WriterFn = (header: SampleHeader, value: number | string) => void;

const writers: Record<string, WriterFn> = {};

for (const [key, fn] of Object.entries(s3k)) {
  if (key.startsWith('SampleHeader_write') && typeof fn === 'function') {
    const field = key.replace('SampleHeader_write', '');
    writers[field] = fn as WriterFn;
  }
}

/**
 * Encode a field value into header.raw using the generated writer.
 *
 * @returns true if a writer was found and applied, false if no writer exists for the field.
 */
export function writeSampleField(
  header: SampleHeader,
  field: string,
  value: number | string,
): boolean {
  const writer = writers[field];
  if (!writer) return false;
  writer(header, value);
  return true;
}
