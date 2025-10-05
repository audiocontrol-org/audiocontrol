/**
 * @packageDocumentation
 * S3000XL Module - Akai S3000XL Sampler Support
 *
 * This module provides the complete API for working with Akai S3000XL samplers,
 * including disk operations, program/sample manipulation, and device specifications.
 *
 * ## Core Components
 *
 * ### Device Specifications
 * Auto-generated TypeScript interfaces from S3000XL MIDI SysEx specifications.
 * These define the structure of programs, samples, and all parameters.
 *
 * ### Disk Model
 * Complete hierarchy for Akai disk images:
 * - `AkaiDisk`: Top-level disk structure
 * - `AkaiPartition`: Partition container (up to 50 per disk)
 * - `AkaiVolume`: Volume container (up to 99 per partition)
 * - `AkaiRecord`: Base type for programs and samples
 *
 * ### Akaitools Integration
 * Wrapper around the external akaitools utilities for:
 * - Disk I/O (read, write, format, list)
 * - Sample conversion (WAV ↔ Akai format)
 * - Program manipulation
 *
 * ### Utilities
 * Helper functions for common operations:
 * - Nibble/byte conversion
 * - Path utilities
 * - Data validation
 *
 * ## Usage Examples
 *
 * @example Reading a disk structure
 * ```typescript
 * import { newAkaiToolsConfig, newAkaiTools } from '@oletizi/sampler-devices/s3k';
 *
 * const config = await newAkaiToolsConfig();
 * const akaitools = newAkaiTools(config);
 *
 * const diskResult = await akaitools.readAkaiDisk();
 * for (const partition of diskResult.data.partitions) {
 *   console.log(`Partition ${partition.name}: ${partition.volumes.length} volumes`);
 *   for (const volume of partition.volumes) {
 *     console.log(`  Volume ${volume.name}: ${volume.records.length} items`);
 *   }
 * }
 * ```
 *
 * @example Reading and modifying a program
 * ```typescript
 * import { newAkaiTools } from '@oletizi/sampler-devices/s3k';
 *
 * const akaitools = newAkaiTools(config);
 *
 * // Read program from disk
 * const program = await akaitools.readAkaiProgram('myprogram.a3p');
 *
 * // Modify program parameters
 * program.program.NAME = 'MODIFIED';
 * program.program.LOUDNESS = 80;
 *
 * // Modify first keygroup
 * if (program.keygroups.length > 0) {
 *   program.keygroups[0].LOWKEY = 60; // Middle C
 *   program.keygroups[0].HIKEY = 72;  // C one octave up
 * }
 *
 * // Write modified program
 * await akaitools.writeAkaiProgram('modified.a3p', program);
 * ```
 *
 * @example Converting samples
 * ```typescript
 * // Convert WAV to Akai format
 * await akaitools.wav2Akai(
 *   'input.wav',
 *   './output',
 *   'MYSAMPLE'  // Max 12 chars, uppercase
 * );
 *
 * // Convert Akai sample to WAV
 * await akaitools.akai2Wav('sample.a3s');
 * ```
 *
 * @example Remote operations (PiSCSI)
 * ```typescript
 * // List remote volumes
 * const volumes = await akaitools.remoteVolumes();
 * for (const vol of volumes.data) {
 *   console.log(`SCSI ID ${vol.scsiId}: ${vol.image}`);
 * }
 *
 * // Sync and mount
 * await akaitools.remoteSync();
 * ```
 *
 * @public
 */

export * from "@/devices/s3000xl.js"
export * from "@/model/model-akai-s3000xl.js"
export * from "@/utils/akai-utils.js"
export * from "@/io/akaitools-core.js"
export * from "@/io/akaitools.js"
