/**
 * Device matching and resolution services
 *
 * Integrates lib-device-uuid with audiotools-config to provide:
 * - Device UUID detection and matching
 * - First-time device registration
 * - Device recognition across sessions
 * - Conflict detection and resolution
 */

export * from './device-matcher.js';
export * from './device-resolver.js';
