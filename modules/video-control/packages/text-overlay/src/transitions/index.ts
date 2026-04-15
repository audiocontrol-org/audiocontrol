import type { TransitionType } from "@/parser/schema";
import { getFadeInOpacity, getFadeOutOpacity } from "@/transitions/fade";
import { getSlideInOffset, getSlideOutOffset, type SlideDirection } from "@/transitions/slide";
import { getTypewriterText, getTypewriterProgress } from "@/transitions/typewriter";

export * from "@/transitions/fade";
export * from "@/transitions/slide";
export * from "@/transitions/typewriter";

export interface TransitionState {
  opacity: number;
  transform: string;
  visible: boolean;
}

export interface TransitionConfig {
  frame: number;
  startFrame: number;
  endFrame: number;
  transitionFrames: number;
  transitionIn: TransitionType;
  transitionOut: TransitionType;
  text?: string;
  fps?: number;
}

/**
 * Map transition type to slide direction
 */
function getSlideDirection(type: TransitionType): SlideDirection | null {
  switch (type) {
    case "slide-up":
      return "up";
    case "slide-down":
      return "down";
    case "slide-left":
      return "left";
    case "slide-right":
      return "right";
    default:
      return null;
  }
}

/**
 * Calculate combined transition state for an overlay
 */
export function getTransitionState(config: TransitionConfig): TransitionState {
  const { frame, startFrame, endFrame, transitionFrames, transitionIn, transitionOut } = config;

  // Check if visible at all
  if (frame < startFrame || frame >= endFrame) {
    return {
      opacity: 0,
      transform: "none",
      visible: false,
    };
  }

  let opacity = 1;
  let translateX = 0;
  let translateY = 0;

  // Handle entry transition
  const inSlideDir = getSlideDirection(transitionIn);
  if (frame < startFrame + transitionFrames) {
    if (transitionIn === "fade") {
      opacity = getFadeInOpacity({ frame, startFrame, endFrame, transitionFrames });
    } else if (inSlideDir) {
      const offset = getSlideInOffset({
        frame,
        startFrame,
        endFrame,
        transitionFrames,
        direction: inSlideDir,
      });
      translateX += offset.x;
      translateY += offset.y;
    }
    // "cut" and "typewriter" have no special entry animation for the container
  }

  // Handle exit transition
  const outSlideDir = getSlideDirection(transitionOut);
  if (frame >= endFrame - transitionFrames) {
    if (transitionOut === "fade") {
      opacity *= getFadeOutOpacity({ frame, startFrame, endFrame, transitionFrames });
    } else if (outSlideDir) {
      const offset = getSlideOutOffset({
        frame,
        startFrame,
        endFrame,
        transitionFrames,
        direction: outSlideDir,
      });
      translateX += offset.x;
      translateY += offset.y;
    }
    // "cut" just disappears instantly (opacity stays 1 until end)
  }

  // Build transform string
  const transforms: string[] = [];
  if (translateX !== 0 || translateY !== 0) {
    transforms.push(`translate(${translateX}px, ${translateY}px)`);
  }
  const transform = transforms.length > 0 ? transforms.join(" ") : "none";

  return {
    opacity,
    transform,
    visible: opacity > 0,
  };
}

/**
 * Get typewriter state if applicable
 */
export function getTypewriterState(config: TransitionConfig): {
  text: string;
  progress: number;
} | null {
  const { frame, startFrame, transitionIn, text, fps } = config;

  if (transitionIn !== "typewriter" || !text || !fps) {
    return null;
  }

  return {
    text: getTypewriterText({ frame, startFrame, text, fps }),
    progress: getTypewriterProgress({ frame, startFrame, text, fps }),
  };
}
