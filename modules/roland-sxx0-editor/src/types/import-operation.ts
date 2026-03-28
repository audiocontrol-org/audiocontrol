/**
 * Re-exports operation progress types from editor-core.
 *
 * These types originated here and were promoted to editor-core for
 * portability across all editors. This file re-exports them so that
 * existing imports within sampler-editor continue to work.
 */

export {
  isOperationComplete,
  getOverallPercent,
  formatBytes,
  type OperationProgress,
  type OperationState,
} from '@audiocontrol/editor-core';
