/**
 * Sampler Translation Library
 *
 * Provides utilities for translating between different sampler formats including:
 * - Akai S3000/S5000/S6000 formats
 * - DecentSampler format
 * - Akai MPC format
 *
 * @public
 * @packageDocumentation
 */

/**
 * Returns a simple greeting message
 * @returns A hello greeting string
 * @public
 * @example
 * ```typescript
 * const greeting = hello();
 * console.log(greeting); // "Hello"
 * ```
 */
export function hello() {
    return "Hello"
}

export * from "@/lib-translate.js"
export * from "@/lib-decent.js"
export * from "@/lib-akai-mpc.js"
export * from "@/lib-translate-s56k.js"
