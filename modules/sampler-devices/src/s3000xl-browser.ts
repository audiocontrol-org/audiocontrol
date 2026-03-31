/**
 * Browser-safe S3000XL exports.
 *
 * This entry point provides only the MIDI client and types needed for browser
 * applications. It does NOT include the generated s3000xl.ts (which imports
 * sampler-lib with Node.js-only dependencies like fs/promises and child_process).
 *
 * For Node.js code that needs the full generated types and disk I/O, use
 * `@audiocontrol/sampler-devices/s3k` instead.
 *
 * @packageDocumentation
 */

export type {
  ProgramHeader,
  KeygroupHeader,
  SampleHeader,
  ProgressCallback,
  S3000xlClientOptions,
  S3000xlClientInterface,
  S3000xlClientDeps,
} from "@/devices/s3000xl/s3000xl-types.js"

export { createS3000xlClient } from "@/devices/s3000xl/s3000xl-client.js"

export {
  AkaiOpcode,
  AKAI_MANUFACTURER_ID,
  S3000XL_DEVICE_ID,
  DEFAULT_TIMING,
  buildAkaiSysEx,
  parseAkaiResponse,
  isErrorResponse,
  parseNameList,
} from "@/devices/s3000xl/s3000xl-protocol.js"
