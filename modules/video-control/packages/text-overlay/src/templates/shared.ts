import type { PositionPreset, PixelPosition, Position } from "@/parser/schema";

/**
 * Convert position preset or pixel coordinates to CSS positioning
 */
export function getPositionStyles(
  position: Position | undefined,
  defaultPosition: PositionPreset = "center"
): React.CSSProperties {
  const pos = position ?? defaultPosition;

  // If it's a tuple (pixel coordinates)
  if (Array.isArray(pos)) {
    const [x, y] = pos as PixelPosition;
    return {
      position: "absolute",
      left: x,
      top: y,
    };
  }

  // Position presets
  switch (pos as PositionPreset) {
    case "bottom-left":
      return {
        position: "absolute",
        left: 80,
        bottom: 80,
      };
    case "bottom-center":
      return {
        position: "absolute",
        left: "50%",
        bottom: 80,
        transform: "translateX(-50%)",
      };
    case "bottom-right":
      return {
        position: "absolute",
        right: 80,
        bottom: 80,
      };
    case "top-left":
      return {
        position: "absolute",
        left: 80,
        top: 80,
      };
    case "top-center":
      return {
        position: "absolute",
        left: "50%",
        top: 80,
        transform: "translateX(-50%)",
      };
    case "top-right":
      return {
        position: "absolute",
        right: 80,
        top: 80,
      };
    case "center":
    default:
      return {
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };
  }
}

/**
 * Default font styles
 */
export const defaultFontStyles: React.CSSProperties = {
  fontFamily: "Inter, system-ui, -apple-system, sans-serif",
  fontWeight: 500,
  letterSpacing: "-0.02em",
};

/**
 * Monospace font styles for code
 */
export const monoFontStyles: React.CSSProperties = {
  fontFamily: "JetBrains Mono, Menlo, Monaco, Consolas, monospace",
  fontWeight: 400,
  letterSpacing: "0",
};
