/**
 * Sample chopper module for slicing contiguous audio into drum kits.
 *
 * Re-exports from @audiocontrol/sample-chopper plus device-specific
 * Node.js functions.
 *
 * @packageDocumentation
 */

// Re-export everything from browser entry
export * from './browser.js';

// Node.js-only functions (requires filesystem)
export { chopSampleToDrumKit } from './chopper-node.js';
