import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { getTransitionState } from "@/transitions";
import type { ParsedParameterOverlay, ParsedTransition } from "@/parser/parse";
import type { Theme } from "@/parser/schema";
import { getPositionStyles, defaultFontStyles, monoFontStyles } from "@/templates/shared";

export interface ParameterProps {
  overlay: ParsedParameterOverlay;
  theme: Theme;
  defaultTransition?: ParsedTransition;
  defaultStyle?: Record<string, string | number>;
}

export const Parameter: React.FC<ParameterProps> = ({
  overlay,
  theme,
  defaultTransition,
  defaultStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const transitionIn = overlay.transition?.in ?? defaultTransition?.in ?? "fade";
  const transitionOut = overlay.transition?.out ?? defaultTransition?.out ?? "fade";
  const transitionFrames = overlay.transitionInFrames;

  // Use title as alternative to label
  const displayLabel = overlay.title ?? overlay.label;
  const mainText = `${displayLabel}: ${overlay.value}${overlay.unit ?? ""}`;

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

  const positionStyles = getPositionStyles(overlay.position, "center");

  // Handle the transform from position preset vs transition
  const baseTransform = positionStyles.transform || "";
  const transitionTransform = state.transform !== "none" ? state.transform : "";
  const combinedTransform = [baseTransform, transitionTransform].filter(Boolean).join(" ");

  const containerStyle: React.CSSProperties = {
    ...positionStyles,
    opacity: state.opacity,
    transform: combinedTransform || undefined,
  };

  const wrapperStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    backgroundColor: overlay.backgroundColor ?? theme.secondary,
    borderRadius: 10,
    padding: "16px 24px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
    borderLeft: `4px solid ${theme.accent}`,
  };

  const labelStyle: React.CSSProperties = {
    ...defaultFontStyles,
    fontSize: (overlay.fontSize ?? 24) * 0.7,
    fontWeight: 400,
    color: overlay.color ?? theme.text,
    opacity: 0.7,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 4,
  };

  const valueContainerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
  };

  const valueStyle: React.CSSProperties = {
    ...monoFontStyles,
    fontSize: overlay.fontSize ?? 36,
    fontWeight: 600,
    color: overlay.color ?? theme.text,
    ...(defaultStyle as React.CSSProperties),
    ...(overlay.style as React.CSSProperties),
  };

  const unitStyle: React.CSSProperties = {
    ...defaultFontStyles,
    fontSize: (overlay.fontSize ?? 36) * 0.6,
    fontWeight: 400,
    color: overlay.color ?? theme.text,
    opacity: 0.7,
  };

  return (
    <AbsoluteFill>
      <div style={containerStyle}>
        <div style={wrapperStyle}>
          <div style={labelStyle}>{displayLabel}</div>
          <div style={valueContainerStyle}>
            <div style={valueStyle}>{overlay.value}</div>
            {overlay.unit && <div style={unitStyle}>{overlay.unit}</div>}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
