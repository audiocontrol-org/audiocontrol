/**
 * Akai Sampler Export Tools
 *
 * Provides tools for extracting Akai disk images and converting
 * sampler programs to SFZ and DecentSampler formats.
 *
 * @packageDocumentation
 * @module @oletizi/sampler-export
 *
 * @example
 * ```typescript
 * import { extractAkaiDisk } from '@oletizi/sampler-export';
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
export * from "@/utils/akai-encoding.js";

// Converters
export * from "@/converters/s3k-to-sfz.js";
export * from "@/converters/s3k-to-decentsampler.js";
export * from "@/converters/s5k-to-sfz.js";
export * from "@/converters/s5k-to-decentsampler.js";

// Disk Extractor
export * from "@/extractor/disk-extractor.js";

// Batch Extractor
export * from "@/extractor/batch-extractor.js";
