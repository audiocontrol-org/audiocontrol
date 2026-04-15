import { interpolate } from "remotion";

export interface FadeConfig {
  frame: number;
  startFrame: number;
  endFrame: number;
  transitionFrames: number;
}

/**
 * Calculate opacity for fade in/out transitions
 */
export function getFadeOpacity(config: FadeConfig): number {
  const { frame, startFrame, endFrame, transitionFrames } = config;

  // Before overlay starts - invisible
  if (frame < startFrame) {
    return 0;
  }

  // After overlay ends - invisible
  if (frame >= endFrame) {
    return 0;
  }

  // Fade in phase
  if (frame < startFrame + transitionFrames) {
    return interpolate(frame, [startFrame, startFrame + transitionFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  // Fade out phase
  if (frame >= endFrame - transitionFrames) {
    return interpolate(frame, [endFrame - transitionFrames, endFrame], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  // Fully visible
  return 1;
}

/**
 * Apply fade only on entry (exit is cut)
 */
export function getFadeInOpacity(config: FadeConfig): number {
  const { frame, startFrame, endFrame, transitionFrames } = config;

  if (frame < startFrame) return 0;
  if (frame >= endFrame) return 0;

  if (frame < startFrame + transitionFrames) {
    return interpolate(frame, [startFrame, startFrame + transitionFrames], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return 1;
}

/**
 * Apply fade only on exit (entry is cut)
 */
export function getFadeOutOpacity(config: FadeConfig): number {
  const { frame, startFrame, endFrame, transitionFrames } = config;

  if (frame < startFrame) return 0;
  if (frame >= endFrame) return 0;

  if (frame >= endFrame - transitionFrames) {
    return interpolate(frame, [endFrame - transitionFrames, endFrame], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return 1;
}
