/**
 * Program header field writers.
 *
 * Wraps the generated ProgramHeader_write* functions into a dispatch map
 * so ProgramsPage can encode a field value into header.raw by name.
 *
 * Each writer modifies header.raw in place, encoding the value at the
 * correct byte offset using Akai's nibble format.
 */

import type { ProgramHeader } from '@audiocontrol/sampler-devices/s3k';
import * as s3k from '@audiocontrol/sampler-devices/s3k';

type WriterFn = (header: ProgramHeader, value: number | string) => void;

// Build lookup from the generated ProgramHeader_write* exports
const writers: Record<string, WriterFn> = {};

for (const [key, fn] of Object.entries(s3k)) {
  if (key.startsWith('ProgramHeader_write') && typeof fn === 'function') {
    const field = key.replace('ProgramHeader_write', '');
    writers[field] = fn as WriterFn;
  }
}

/**
 * Encode a field value into header.raw using the generated writer.
 *
 * @returns true if a writer was found and applied, false if no writer exists for the field.
 */
export function writeProgramField(
  header: ProgramHeader,
  field: string,
  value: number | string,
): boolean {
  const writer = writers[field];
  if (!writer) return false;
  writer(header, value);
  return true;
}
