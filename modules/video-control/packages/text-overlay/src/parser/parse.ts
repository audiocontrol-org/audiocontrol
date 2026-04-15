import * as yaml from "js-yaml";
import { ZodError } from "zod";
import {
  ProjectSchema,
  type Project,
  type TitleOverlay,
  type LowerThirdOverlay,
  type CalloutOverlay,
  type CodeOverlay,
  type ParameterOverlay,
  type TransitionType,
  type Section,
} from "@/parser/schema";
import { parseTimecode, parseDuration, calculateDurationFromOverlays } from "@/utils/timing";

/**
 * Parsed section with frame-based timing
 */
export interface ParsedSection {
  text: string;
  inFrame: number;
  outFrame: number;
  durationInFrames: number;
  transitionInFrames: number;
  transition?: ParsedTransition;
  style?: Record<string, string | number>;
}

/**
 * Base parsed overlay fields
 */
interface ParsedOverlayBase {
  inFrame: number;
  outFrame: number;
  durationInFrames: number;
  transitionInFrames: number;
  sections?: ParsedSection[];
}

/**
 * Parsed title overlay
 */
export type ParsedTitleOverlay = Omit<TitleOverlay, "in" | "out" | "sections"> & ParsedOverlayBase;

/**
 * Parsed lower-third overlay
 */
export type ParsedLowerThirdOverlay = Omit<LowerThirdOverlay, "in" | "out" | "sections"> & ParsedOverlayBase;

/**
 * Parsed callout overlay
 */
export type ParsedCalloutOverlay = Omit<CalloutOverlay, "in" | "out" | "sections"> & ParsedOverlayBase;

/**
 * Parsed code overlay
 */
export type ParsedCodeOverlay = Omit<CodeOverlay, "in" | "out" | "sections"> & ParsedOverlayBase;

/**
 * Parsed parameter overlay
 */
export type ParsedParameterOverlay = Omit<ParameterOverlay, "in" | "out" | "sections"> & ParsedOverlayBase;

/**
 * Union of all parsed overlay types
 */
export type ParsedOverlay =
  | ParsedTitleOverlay
  | ParsedLowerThirdOverlay
  | ParsedCalloutOverlay
  | ParsedCodeOverlay
  | ParsedParameterOverlay;

/**
 * Parsed transition with proper types
 */
export interface ParsedTransition {
  in: TransitionType;
  out: TransitionType;
  duration: number;
}

/**
 * Result of parsing a project file
 */
export interface ParsedProject {
  project: {
    name: string;
    width: number;
    height: number;
    fps: number;
    durationInFrames: number;
  };
  defaults: {
    font: string;
    transition?: ParsedTransition;
    style?: Record<string, string | number>;
  };
  theme: {
    primary: string;
    secondary: string;
    text: string;
    accent: string;
  };
  overlays: ParsedOverlay[];
}

/**
 * Parse error with location information
 */
export class ParseError extends Error {
  constructor(
    message: string,
    public readonly line?: number,
    public readonly column?: number,
    public readonly path?: string[]
  ) {
    super(message);
    this.name = "ParseError";
  }
}

/**
 * Format Zod errors into human-readable messages
 */
function formatZodError(error: ZodError): string {
  const messages = error.errors.map((err) => {
    const path = err.path.join(".");
    let message = err.message;

    // Provide more helpful messages for common error types
    if (err.code === "invalid_union") {
      message = "Expected a timecode string (e.g., \"0:30.000\", \"45.5\") or frame number";
    } else if (err.code === "invalid_type") {
      if (err.expected === "string") {
        message = `Expected a string, got ${err.received}`;
      } else if (err.expected === "number") {
        message = `Expected a number, got ${err.received}`;
      } else if (err.received === "undefined") {
        message = `Required field is missing`;
      } else {
        message = `Expected ${err.expected}, got ${err.received}`;
      }
    } else if (err.code === "invalid_literal") {
      message = `Expected "${err.expected}", got "${err.received}"`;
    } else if (err.code === "invalid_enum_value") {
      const options = (err as { options?: string[] }).options?.join(", ") ?? "unknown";
      message = `Invalid value. Expected one of: ${options}`;
    }

    return `  - ${path}: ${message}`;
  });
  return `Validation errors:\n${messages.join("\n")}`;
}

/**
 * Parse YAML content into a validated Project
 */
export function parseYaml(content: string): Project {
  let parsed: unknown;

  try {
    parsed = yaml.load(content);
  } catch (err) {
    if (err instanceof yaml.YAMLException) {
      throw new ParseError(
        `YAML syntax error: ${err.message}`,
        err.mark?.line,
        err.mark?.column
      );
    }
    throw err;
  }

  const result = ProjectSchema.safeParse(parsed);

  if (!result.success) {
    throw new ParseError(formatZodError(result.error));
  }

  return result.data;
}

/**
 * Parse and process a project file into render-ready format
 */
export function parseProject(content: string): ParsedProject {
  const project = parseYaml(content);

  const fps = project.project.framerate;
  const [width, height] = project.project.resolution;

  // Apply defaults
  const defaultTransition = project.defaults?.transition
    ? {
        in: project.defaults.transition.in as TransitionType,
        out: project.defaults.transition.out as TransitionType,
        duration: project.defaults.transition.duration,
      }
    : undefined;

  const defaults = {
    font: project.defaults?.font ?? "Inter",
    transition: defaultTransition,
    style: project.defaults?.style,
  };

  const theme = {
    primary: project.theme?.primary ?? "#3B82F6",
    secondary: project.theme?.secondary ?? "#1E293B",
    text: project.theme?.text ?? "#F8FAFC",
    accent: project.theme?.accent ?? "#F59E0B",
  };

  // Process overlays with frame-based timing
  const overlays: ParsedOverlay[] = project.overlays.map((overlay, index) => {
    const inFrame = parseTimecode(overlay.in, fps);
    const outFrame = parseTimecode(overlay.out, fps);
    const overlayDuration = outFrame - inFrame;

    // Get transition duration in frames
    const transitionDuration =
      overlay.transition?.duration ?? defaults.transition?.duration ?? 0.25;
    const transitionInFrames = Math.round(transitionDuration * fps);

    // Validate timing
    if (inFrame < 0) {
      throw new ParseError(
        `Overlay ${overlay.id ?? index}: "in" time cannot be negative`
      );
    }
    if (outFrame <= inFrame) {
      throw new ParseError(
        `Overlay ${overlay.id ?? index}: "out" time must be after "in" time`
      );
    }

    // Process sections with inheritance from parent
    const parsedSections: ParsedSection[] | undefined = overlay.sections?.map(
      (section: Section) => {
        // Inherit in/out from parent if not specified
        const sectionInFrame = section.in !== undefined
          ? parseTimecode(section.in, fps)
          : inFrame;
        const sectionOutFrame = section.out !== undefined
          ? parseTimecode(section.out, fps)
          : outFrame;
        const sectionDuration = sectionOutFrame - sectionInFrame;

        // Inherit transition from parent if not specified
        const sectionTransition = section.transition ?? overlay.transition;
        const sectionTransitionDuration =
          sectionTransition?.duration ?? defaults.transition?.duration ?? 0.25;
        const sectionTransitionInFrames = Math.round(sectionTransitionDuration * fps);

        const parsedTransition: ParsedTransition | undefined = sectionTransition
          ? {
              in: sectionTransition.in as TransitionType,
              out: sectionTransition.out as TransitionType,
              duration: sectionTransition.duration,
            }
          : undefined;

        return {
          text: section.text,
          inFrame: sectionInFrame,
          outFrame: sectionOutFrame,
          durationInFrames: sectionDuration,
          transitionInFrames: sectionTransitionInFrames,
          transition: parsedTransition,
          style: section.style,
        };
      }
    );

    // Destructure to remove in/out and add frame-based timing
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { in: _in, out: _out, sections: _sections, ...rest } = overlay;

    return {
      ...rest,
      inFrame,
      outFrame,
      durationInFrames: overlayDuration,
      transitionInFrames,
      sections: parsedSections,
    } as ParsedOverlay;
  });

  // Calculate duration: use explicit duration if provided, otherwise derive from overlays
  let durationInFrames: number;
  if (project.project.duration !== undefined) {
    durationInFrames = parseDuration(project.project.duration, fps);
  } else if (overlays.length > 0) {
    durationInFrames = calculateDurationFromOverlays(overlays);
  } else {
    throw new ParseError("Project has no overlays and no explicit duration");
  }

  return {
    project: {
      name: project.project.name,
      width,
      height,
      fps,
      durationInFrames,
    },
    defaults,
    theme,
    overlays,
  };
}

/**
 * Validate a YAML file without full parsing
 * Returns list of validation errors, or empty array if valid
 */
export function validateYaml(content: string): string[] {
  const errors: string[] = [];

  try {
    parseProject(content);
  } catch (err) {
    if (err instanceof ParseError) {
      errors.push(err.message);
    } else if (err instanceof Error) {
      errors.push(`Unexpected error: ${err.message}`);
    } else {
      errors.push(`Unknown error: ${String(err)}`);
    }
  }

  return errors;
}
