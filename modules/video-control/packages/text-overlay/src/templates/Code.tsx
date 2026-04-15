import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  continueRender,
  delayRender,
} from "remotion";
import { codeToHtml } from "shiki";
import { getTransitionState } from "@/transitions";
import type { ParsedCodeOverlay, ParsedTransition } from "@/parser/parse";
import type { Theme } from "@/parser/schema";
import { getPositionStyles, monoFontStyles } from "@/templates/shared";

export interface CodeProps {
  overlay: ParsedCodeOverlay;
  theme: Theme;
  defaultTransition?: ParsedTransition;
  defaultStyle?: Record<string, string | number>;
}

export const Code: React.FC<CodeProps> = ({ overlay, theme, defaultTransition, defaultStyle }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [html, setHtml] = useState<string | null>(null);
  const [handle] = useState(() => delayRender("Loading syntax highlighting"));

  const transitionIn = overlay.transition?.in ?? defaultTransition?.in ?? "fade";
  const transitionOut = overlay.transition?.out ?? defaultTransition?.out ?? "fade";
  const transitionFrames = overlay.transitionInFrames;

  const codeText = overlay.title ?? "";

  useEffect(() => {
    const loadHighlighting = async () => {
      try {
        const highlighted = await codeToHtml(codeText, {
          lang: overlay.syntax ?? "typescript",
          theme: overlay.theme ?? "github-dark",
        });
        setHtml(highlighted);
        continueRender(handle);
      } catch (err) {
        console.error("Syntax highlighting error:", err);
        // Fall back to plain text
        setHtml(`<pre><code>${escapeHtml(codeText)}</code></pre>`);
        continueRender(handle);
      }
    };

    loadHighlighting();
  }, [codeText, overlay.syntax, overlay.theme, handle]);

  const state = getTransitionState({
    frame,
    startFrame: overlay.inFrame,
    endFrame: overlay.outFrame,
    transitionFrames,
    transitionIn,
    transitionOut,
    text: codeText,
    fps,
  });

  if (!state.visible || !html) {
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
    maxWidth: "80%",
  };

  const codeContainerStyle: React.CSSProperties = {
    ...monoFontStyles,
    fontSize: overlay.fontSize ?? 18,
    backgroundColor: overlay.backgroundColor ?? "rgba(30, 30, 30, 0.95)",
    borderRadius: 12,
    padding: "24px 32px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
    overflow: "hidden",
    ...(defaultStyle as React.CSSProperties),
    ...(overlay.style as React.CSSProperties),
  };

  return (
    <AbsoluteFill>
      <div style={containerStyle}>
        <div
          style={codeContainerStyle}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </AbsoluteFill>
  );
};

/**
 * Escape HTML entities for fallback rendering
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
