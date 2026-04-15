import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { getTransitionState, getTypewriterState } from "@/transitions";
import type { ParsedLowerThirdOverlay, ParsedTransition, ParsedSection } from "@/parser/parse";
import type { Theme } from "@/parser/schema";
import { defaultFontStyles, getPositionStyles } from "@/templates/shared";

export interface LowerThirdProps {
  overlay: ParsedLowerThirdOverlay;
  theme: Theme;
  defaultTransition?: ParsedTransition;
  defaultStyle?: Record<string, string | number>;
}

interface SectionRenderProps {
  section: ParsedSection;
  index: number;
  isFirst: boolean;
  frame: number;
  parentOutFrame: number;
  defaultTransition?: ParsedTransition;
  defaultStyle?: Record<string, string | number>;
  overlay: ParsedLowerThirdOverlay;
  theme: Theme;
}

const SectionRenderer: React.FC<SectionRenderProps> = ({
  section,
  isFirst,
  frame,
  parentOutFrame,
  defaultTransition,
  defaultStyle,
  overlay,
  theme,
}) => {
  // Section only handles its IN transition
  // The container handles the OUT transition for all sections together
  const transitionIn = section.transition?.in ?? defaultTransition?.in ?? "fade";
  const transitionDuration = section.transitionInFrames;

  // Calculate section's in transition progress
  const framesSinceStart = frame - section.inFrame;
  let inProgress = 1;
  if (framesSinceStart < transitionDuration) {
    inProgress = Math.max(0, framesSinceStart / transitionDuration);
  }

  // Section space is always reserved, but content is only visible after inFrame
  const hasStarted = frame >= section.inFrame;

  // Calculate opacity based on in transition only
  let opacity = 1;
  if (!hasStarted) {
    // Section hasn't started yet - invisible but space reserved
    opacity = 0;
  } else if (transitionIn === "fade" && inProgress < 1) {
    opacity = inProgress;
  }

  // Calculate transform for slide transitions (in only, after section has started)
  let transform: string | undefined;
  if (hasStarted && inProgress < 1) {
    const slideOffset = (1 - inProgress) * 30;
    switch (transitionIn) {
      case "slide-up":
        transform = `translateY(${slideOffset}px)`;
        break;
      case "slide-down":
        transform = `translateY(${-slideOffset}px)`;
        break;
      case "slide-left":
        transform = `translateX(${slideOffset}px)`;
        break;
      case "slide-right":
        transform = `translateX(${-slideOffset}px)`;
        break;
    }
  }

  // Typewriter effect for in transition (only after section has started)
  let displayText = section.text;
  if (hasStarted && transitionIn === "typewriter" && inProgress < 1) {
    const charCount = Math.floor(section.text.length * inProgress);
    displayText = section.text.slice(0, charCount);
  }

  const textStyle: React.CSSProperties = {
    ...defaultFontStyles,
    display: "block",
    position: "relative",
    fontSize: isFirst ? (overlay.fontSize ?? 32) : (overlay.fontSize ?? 32) * 0.6,
    fontWeight: isFirst ? 600 : 400,
    color: overlay.color ?? theme.text,
    lineHeight: 1.4,
    marginTop: isFirst ? 0 : 4,
    ...(defaultStyle as React.CSSProperties),
    ...(overlay.style as React.CSSProperties),
    ...(section.style as React.CSSProperties),
    // Apply animation properties last so they're not overridden
    opacity,
    transform,
  };

  return <div style={textStyle}>{displayText}</div>;
};

export const LowerThird: React.FC<LowerThirdProps> = ({
  overlay,
  theme,
  defaultTransition,
  defaultStyle,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Determine if we should use sections or legacy text/subtitle
  const useSections = overlay.sections && overlay.sections.length > 0;

  // Get parent overlay's transition settings
  const parentTransitionIn = overlay.transition?.in ?? defaultTransition?.in ?? (useSections ? "fade" : "slide-up");
  const parentTransitionOut = overlay.transition?.out ?? defaultTransition?.out ?? (useSections ? "fade" : "slide-down");
  const transitionFrames = overlay.transitionInFrames;

  // Container visibility and transition state based on parent overlay timing
  const containerState = getTransitionState({
    frame,
    startFrame: overlay.inFrame,
    endFrame: overlay.outFrame,
    transitionFrames,
    transitionIn: parentTransitionIn,
    transitionOut: parentTransitionOut,
    text: overlay.title ?? "",
    fps,
  });

  if (!containerState.visible) {
    return null;
  }

  const positionStyles = getPositionStyles(overlay.position, "bottom-left");

  // Apply container transitions (opacity and transform from parent overlay)
  const baseTransform = positionStyles.transform || "";
  const transitionTransform = containerState.transform !== "none" ? containerState.transform : "";
  const combinedTransform = [baseTransform, transitionTransform].filter(Boolean).join(" ");

  const containerStyle: React.CSSProperties = {
    ...positionStyles,
    opacity: containerState.opacity,
    transform: combinedTransform || undefined,
  };

  const wrapperStyle: React.CSSProperties = {
    display: "inline-flex",
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "flex-start",
    borderRadius: 8,
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
  };

  const accentBarStyle: React.CSSProperties = {
    width: 6,
    backgroundColor: theme.accent,
    borderRadius: "8px 0 0 8px",
  };

  const contentStyle: React.CSSProperties = {
    backgroundColor: overlay.backgroundColor ?? theme.secondary,
    padding: "16px 24px",
    borderRadius: "0 8px 8px 0",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-start",
  };

  const titleStyle: React.CSSProperties = {
    ...defaultFontStyles,
    fontSize: overlay.fontSize ?? 32,
    fontWeight: 600,
    color: overlay.color ?? theme.text,
    lineHeight: 1.2,
    marginBottom: overlay.sections?.length ? 8 : 0,
    ...(defaultStyle as React.CSSProperties),
    ...(overlay.style as React.CSSProperties),
  };

  // Render sections mode
  if (useSections) {
    return (
      <AbsoluteFill>
        <div style={containerStyle}>
          <div style={wrapperStyle}>
            <div style={accentBarStyle} />
            <div style={contentStyle}>
              {overlay.title && <div style={titleStyle}>{overlay.title}</div>}
              {overlay.sections!.map((section, index) => (
                <SectionRenderer
                  key={index}
                  section={section}
                  index={index}
                  isFirst={index === 0 && !overlay.title}
                  frame={frame}
                  parentOutFrame={overlay.outFrame}
                  defaultTransition={defaultTransition}
                  defaultStyle={defaultStyle}
                  overlay={overlay}
                  theme={theme}
                />
              ))}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  // Legacy mode: title + optional subtitle
  const typewriter = getTypewriterState({
    frame,
    startFrame: overlay.inFrame,
    endFrame: overlay.outFrame,
    transitionFrames,
    transitionIn: parentTransitionIn,
    transitionOut: parentTransitionOut,
    text: overlay.title ?? "",
    fps,
  });

  const displayText = typewriter ? typewriter.text : (overlay.title ?? "");
  const displaySubtitle = overlay.subtitle;

  const nameStyle: React.CSSProperties = {
    ...defaultFontStyles,
    fontSize: overlay.fontSize ?? 32,
    fontWeight: 600,
    color: overlay.color ?? theme.text,
    lineHeight: 1.2,
    ...(defaultStyle as React.CSSProperties),
    ...(overlay.style as React.CSSProperties),
  };

  const subtitleStyle: React.CSSProperties = {
    ...defaultFontStyles,
    fontSize: (overlay.fontSize ?? 32) * 0.6,
    fontWeight: 400,
    color: overlay.color ?? theme.text,
    opacity: 0.7,
    marginTop: 4,
  };

  return (
    <AbsoluteFill>
      <div style={containerStyle}>
        <div style={wrapperStyle}>
          <div style={accentBarStyle} />
          <div style={contentStyle}>
            <div style={nameStyle}>{displayText}</div>
            {displaySubtitle && <div style={subtitleStyle}>{displaySubtitle}</div>}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
