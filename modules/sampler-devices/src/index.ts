/**
 * @packageDocumentation
 * Sampler Devices - Akai Sampler Interface Library
 *
 * This package provides comprehensive interfaces and utilities for working with
 * Akai hardware samplers (S3000XL, S5000, S6000).
 *
 * ## Features
 *
 * - **S3000XL Support**: Full disk I/O, program/sample parsing, MIDI SysEx communication
 * - **S5000/S6000 Support**: Binary format parsing, chunk-based program structure
 * - **Disk Operations**: Read/write/format Akai disk images via akaitools
 * - **Remote Operations**: PiSCSI integration for remote disk mounting
 * - **Format Conversion**: Sample and program conversion utilities
 *
 * ## Main Exports
 *
 * ### S3000XL
 * - Device specifications and MIDI parameter definitions
 * - Program/sample data structures (auto-generated from specs)
 * - Akai disk hierarchy (partitions, volumes, programs, samples)
 *
 * ### S5000/S6000
 * - Chunk-based program parser
 * - Type definitions for all program parameters
 * - JSON serialization support
 *
 * ### Utilities
 * - Akaitools wrapper (disk operations, format conversion)
 * - PiSCSI remote mounting
 * - Configuration management
 *
 * @example
 * ```typescript
 * import { newAkaiToolsConfig, Akaitools } from '@audiocontrol/sampler-devices';
 *
 * // Initialize configuration
 * const config = await newAkaiToolsConfig();
 *
 * // Read disk structure
 * const disk = await akaitools.readAkaiDisk();
 * console.log(`Found ${disk.data.partitions.length} partitions`);
 *
 * // Parse S5000 program
 * const buffer = await fs.readFile('program.akp');
 * const state = createParserState();
 * parseProgram(buffer, state);
 * console.log(`Program ${state.program.programNumber} with ${state.keygroups.length} keygroups`);
 * ```
 *
 * @public
 */

export * from "@/devices/s3000xl.js"
export * from "@/devices/specs.js"
export * from "@/model/model-akai-s3000xl.js"
export * from "@/utils/akai-utils.js"
export * from "@/io/akaitools.js"
export * from "@/s5k.js"
