import { interpolate } from "remotion";

export interface TypewriterConfig {
  frame: number;
  startFrame: number;
  text: string;
  fps: number;
  charsPerSecond?: number;
}

/**
 * Calculate how much of the text should be visible for typewriter effect
 * Returns the number of characters to show
 */
export function getTypewriterCharCount(config: TypewriterConfig): number {
  const { frame, startFrame, text, fps, charsPerSecond = 20 } = config;

  if (frame < startFrame) {
    return 0;
  }

  const framesPerChar = fps / charsPerSecond;
  const elapsedFrames = frame - startFrame;
  const chars = Math.floor(elapsedFrames / framesPerChar);

  return Math.min(chars, text.length);
}

/**
 * Get the visible portion of text for typewriter effect
 */
export function getTypewriterText(config: TypewriterConfig): string {
  const charCount = getTypewriterCharCount(config);
  return config.text.slice(0, charCount);
}

/**
 * Calculate typewriter progress (0 to 1)
 */
export function getTypewriterProgress(config: TypewriterConfig): number {
  const { frame, startFrame, text, fps, charsPerSecond = 20 } = config;

  if (frame < startFrame) {
    return 0;
  }

  const totalDuration = (text.length / charsPerSecond) * fps;
  const progress = (frame - startFrame) / totalDuration;

  return Math.min(1, Math.max(0, progress));
}

/**
 * Calculate cursor blink state for typewriter effect
 */
export function getCursorVisible(config: TypewriterConfig & { blinkRate?: number }): boolean {
  const { frame, fps, blinkRate = 2 } = config;
  const framesPerBlink = fps / blinkRate;
  return Math.floor(frame / framesPerBlink) % 2 === 0;
}

/**
 * Calculate total frames needed for typewriter animation
 */
export function getTypewriterDuration(
  text: string,
  fps: number,
  charsPerSecond: number = 20
): number {
  return Math.ceil((text.length / charsPerSecond) * fps);
}

/**
 * Get opacity for typewriter fade-out (characters revealed stay visible)
 */
export function getTypewriterFadeOut(config: TypewriterConfig & {
  endFrame: number;
  transitionFrames: number;
}): number {
  const { frame, endFrame, transitionFrames } = config;

  if (frame >= endFrame - transitionFrames) {
    return interpolate(
      frame,
      [endFrame - transitionFrames, endFrame],
      [1, 0],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }
    );
  }

  return 1;
}
