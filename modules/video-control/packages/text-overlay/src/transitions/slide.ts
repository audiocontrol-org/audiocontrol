import { interpolate, Easing } from "remotion";

export type SlideDirection = "up" | "down" | "left" | "right";

export interface SlideConfig {
  frame: number;
  startFrame: number;
  endFrame: number;
  transitionFrames: number;
  direction: SlideDirection;
  distance?: number; // pixels to slide, defaults based on direction
}

/**
 * Get the offset for a slide animation (entry)
 * Returns { x, y } offset in pixels
 */
export function getSlideInOffset(config: SlideConfig): { x: number; y: number } {
  const { frame, startFrame, transitionFrames, direction, distance = 100 } = config;

  // Before animation starts
  if (frame < startFrame) {
    return getInitialOffset(direction, distance);
  }

  // After transition completes
  if (frame >= startFrame + transitionFrames) {
    return { x: 0, y: 0 };
  }

  // During transition
  const progress = interpolate(
    frame,
    [startFrame, startFrame + transitionFrames],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    }
  );

  const initial = getInitialOffset(direction, distance);
  return {
    x: initial.x * (1 - progress),
    y: initial.y * (1 - progress),
  };
}

/**
 * Get the offset for a slide animation (exit)
 */
export function getSlideOutOffset(config: SlideConfig): { x: number; y: number } {
  const { frame, endFrame, transitionFrames, direction, distance = 100 } = config;

  // Before exit animation
  if (frame < endFrame - transitionFrames) {
    return { x: 0, y: 0 };
  }

  // After overlay ends
  if (frame >= endFrame) {
    return getExitOffset(direction, distance);
  }

  // During exit transition
  const progress = interpolate(
    frame,
    [endFrame - transitionFrames, endFrame],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.in(Easing.cubic),
    }
  );

  const exit = getExitOffset(direction, distance);
  return {
    x: exit.x * progress,
    y: exit.y * progress,
  };
}

/**
 * Get initial offset based on slide direction (where element comes FROM)
 */
function getInitialOffset(direction: SlideDirection, distance: number): { x: number; y: number } {
  switch (direction) {
    case "up":
      return { x: 0, y: distance }; // comes from below
    case "down":
      return { x: 0, y: -distance }; // comes from above
    case "left":
      return { x: distance, y: 0 }; // comes from right
    case "right":
      return { x: -distance, y: 0 }; // comes from left
  }
}

/**
 * Get exit offset based on slide direction (where element goes TO)
 */
function getExitOffset(direction: SlideDirection, distance: number): { x: number; y: number } {
  switch (direction) {
    case "up":
      return { x: 0, y: -distance }; // exits to above
    case "down":
      return { x: 0, y: distance }; // exits to below
    case "left":
      return { x: -distance, y: 0 }; // exits to left
    case "right":
      return { x: distance, y: 0 }; // exits to right
  }
}

/**
 * Combined slide in and out
 */
export function getSlideOffset(config: SlideConfig): { x: number; y: number } {
  const { frame, startFrame, endFrame, transitionFrames } = config;

  // Entry phase
  if (frame < startFrame + transitionFrames) {
    return getSlideInOffset(config);
  }

  // Exit phase
  if (frame >= endFrame - transitionFrames) {
    return getSlideOutOffset(config);
  }

  // Stable phase
  return { x: 0, y: 0 };
}
