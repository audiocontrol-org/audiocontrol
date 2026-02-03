/**
 * Akai Sampler Export Tools
 *
 * Provides tools for extracting Akai disk images and converting
 * sampler programs to SFZ and DecentSampler formats.
 *
 * @packageDocumentation
 * @module @audiocontrol/sampler-export
 *
 * @example
 * ```typescript
 * import { extractAkaiDisk } from '@audiocontrol/sampler-export';
 *
 * const result = await extractAkaiDisk({
 *   diskImage: '/path/to/disk.hds',
 *   outputDir: '/path/to/output',
 *   convertToSFZ: true,
 *   convertToDecentSampler: true
 * });
 * ```
 */

// Utilities
export * from "@/lib/utils/akai-encoding.js";

// Converters
export * from "@/lib/converters/s3k-to-sfz.js";
export * from "@/lib/converters/s3k-to-decentsampler.js";
export * from "@/lib/converters/s5k-to-sfz.js";
export * from "@/lib/converters/s5k-to-decentsampler.js";

// Disk Extractor
export * from "@/lib/extractor/disk-extractor.js";

// Batch Extractor
export * from "@/lib/extractor/batch-extractor.js";
