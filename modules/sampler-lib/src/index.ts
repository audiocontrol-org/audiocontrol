/**
 * @module sampler-lib
 * @description Browser-safe core library for sampler operations, including utilities,
 * output abstractions, and client configuration.
 *
 * For Node.js-only modules (fs, wavefile, server config, backup paths),
 * import from '@audiocontrol/sampler-lib/server' instead.
 */

export * from "./lib-core"
export * from "./lib-output"
export * from "./lib-config-client"
