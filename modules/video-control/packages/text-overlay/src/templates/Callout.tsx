import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { getTransitionState, getTypewriterState } from "@/transitions";
import type { ParsedCalloutOverlay, ParsedTransition } from "@/parser/parse";
import type { Theme } from "@/parser/schema";
import { defaultFontStyles } from "@/templates/shared";

export interface CalloutProps {
  overlay: ParsedCalloutOverlay;
  theme: Theme;
  defaultTransition?: ParsedTransition;
  defaultStyle?: Record<string, string | number>;
}

export const Callout: React.FC<CalloutProps> = ({ overlay, theme, defaultTransition, defaultStyle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const transitionIn = overlay.transition?.in ?? defaultTransition?.in ?? "fade";
  const transitionOut = overlay.transition?.out ?? defaultTransition?.out ?? "fade";
  const transitionFrames = overlay.transitionInFrames;

  const mainText = overlay.title ?? "";

  const state = getTransitionState({
    frame,
    startFrame: overlay.inFrame,
    endFrame: overlay.outFrame,
    transitionFrames,
    transitionIn,
    transitionOut,
    text: mainText,
    fps,
  });

  if (!state.visible) {
    return null;
  }

  // Check for typewriter effect
  const typewriter = getTypewriterState({
    frame,
    startFrame: overlay.inFrame,
    endFrame: overlay.outFrame,
    transitionFrames,
    transitionIn,
    transitionOut,
    text: mainText,
    fps,
  });

  const displayText = typewriter ? typewriter.text : mainText;

  // Get position (must be pixel coordinates for callout)
  const position = overlay.position;
  let x = 100;
  let y = 100;

  if (Array.isArray(position)) {
    [x, y] = position;
  }

  // Arrow configuration
  const showArrow = overlay.arrow && overlay.arrow_target;
  const arrowTarget = overlay.arrow_target;

  const containerStyle: React.CSSProperties = {
    position: "absolute",
    left: x,
    top: y,
    opacity: state.opacity,
    transform: state.transform !== "none" ? state.transform : undefined,
  };

  const labelStyle: React.CSSProperties = {
    ...defaultFontStyles,
    display: "inline-block",
    fontSize: overlay.fontSize ?? 24,
    fontWeight: 500,
    color: overlay.color ?? theme.text,
    backgroundColor: overlay.backgroundColor ?? theme.secondary,
    padding: "8px 16px",
    borderRadius: 6,
    boxShadow: "0 2px 10px rgba(0, 0, 0, 0.3)",
    whiteSpace: "nowrap",
    ...(defaultStyle as React.CSSProperties),
    ...(overlay.style as React.CSSProperties),
  };

  // Calculate arrow path if needed
  let arrowPath: string | null = null;
  if (showArrow && arrowTarget) {
    const [targetX, targetY] = arrowTarget;
    // Arrow starts from the label position and goes to the target
    // We'll offset the start to account for the label size
    const startX = x + 30; // Approximate center of label
    const startY = y + 20;
    arrowPath = `M ${startX} ${startY} L ${targetX} ${targetY}`;
  }

  return (
    <AbsoluteFill>
      {/* Arrow SVG layer */}
      {arrowPath && arrowTarget && (
        <svg
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            opacity: state.opacity,
          }}
        >
          <defs>
            <marker
              id={`arrowhead-${overlay.id ?? "default"}`}
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill={theme.accent}
              />
            </marker>
          </defs>
          <path
            d={arrowPath}
            stroke={theme.accent}
            strokeWidth="3"
            fill="none"
            markerEnd={`url(#arrowhead-${overlay.id ?? "default"})`}
            strokeLinecap="round"
          />
        </svg>
      )}

      {/* Label */}
      <div style={containerStyle}>
        <div style={labelStyle}>{displayText}</div>
      </div>
    </AbsoluteFill>
  );
};
