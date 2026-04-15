import { z } from "zod";

/**
 * Timecode can be:
 * - "MM:SS.mmm" (e.g., "1:30.500")
 * - "SS.mmm" (e.g., "45.250")
 * - Integer frame number
 */
const TimecodeSchema = z.union([z.string(), z.number()]);

/**
 * Position can be a preset or pixel coordinates
 */
const PositionPresetSchema = z.enum([
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "top-left",
  "top-center",
  "top-right",
  "center",
]);

const PixelPositionSchema = z.tuple([z.number(), z.number()]);

const PositionSchema = z.union([PositionPresetSchema, PixelPositionSchema]);

/**
 * Transition types
 */
const TransitionTypeSchema = z.enum([
  "cut",
  "fade",
  "slide-up",
  "slide-down",
  "slide-left",
  "slide-right",
  "typewriter",
]);

/**
 * Transition configuration
 */
const TransitionSchema = z.object({
  in: TransitionTypeSchema.optional().default("cut"),
  out: TransitionTypeSchema.optional().default("cut"),
  duration: z.number().optional().default(0.25),
});

/**
 * Arbitrary CSS properties (camelCase keys, string/number values)
 */
const StyleSchema = z.record(z.string(), z.union([z.string(), z.number()]));

/**
 * Section within a multi-section overlay
 * Inherits in/out/transition from parent if not specified
 */
const SectionSchema = z.object({
  text: z.string(),
  in: TimecodeSchema.optional(),
  out: TimecodeSchema.optional(),
  transition: TransitionSchema.optional(),
  style: StyleSchema.optional(),
});

/**
 * Base overlay properties shared by all types
 */
const BaseOverlaySchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  in: TimecodeSchema,
  out: TimecodeSchema,
  position: PositionSchema.optional(),
  transition: TransitionSchema.optional(),
  font: z.string().optional(),
  fontSize: z.number().optional(),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  style: StyleSchema.optional(),
  sections: z.array(SectionSchema).optional(),
});

/**
 * Title overlay - centered title text
 */
const TitleOverlaySchema = BaseOverlaySchema.extend({
  type: z.literal("title"),
  subtitle: z.string().optional(),
});

/**
 * Lower-third overlay - name/title bar at bottom
 */
const LowerThirdOverlaySchema = BaseOverlaySchema.extend({
  type: z.literal("lower-third"),
  subtitle: z.string().optional(),
});

/**
 * Callout overlay - positioned label with optional arrow
 */
const CalloutOverlaySchema = BaseOverlaySchema.extend({
  type: z.literal("callout"),
  arrow: z.boolean().optional().default(false),
  arrow_target: PixelPositionSchema.optional(),
});

/**
 * Code overlay - syntax highlighted code block
 */
const CodeOverlaySchema = BaseOverlaySchema.extend({
  type: z.literal("code"),
  syntax: z.string().optional().default("typescript"),
  theme: z.string().optional().default("github-dark"),
  showLineNumbers: z.boolean().optional().default(true),
});

/**
 * Parameter overlay - key-value-unit display
 */
const ParameterOverlaySchema = BaseOverlaySchema.extend({
  type: z.literal("parameter"),
  label: z.string(),
  value: z.string(),
  unit: z.string().optional(),
});

/**
 * Union of all overlay types
 */
export const OverlaySchema = z.discriminatedUnion("type", [
  TitleOverlaySchema,
  LowerThirdOverlaySchema,
  CalloutOverlaySchema,
  CodeOverlaySchema,
  ParameterOverlaySchema,
]);

/**
 * Theme configuration
 */
const ThemeSchema = z.object({
  primary: z.string().optional().default("#3B82F6"),
  secondary: z.string().optional().default("#1E293B"),
  text: z.string().optional().default("#F8FAFC"),
  accent: z.string().optional().default("#F59E0B"),
});

/**
 * Default configuration
 */
const DefaultsSchema = z.object({
  font: z.string().optional().default("Inter"),
  transition: TransitionSchema.optional(),
  style: StyleSchema.optional(),
});

/**
 * Project configuration
 */
const ProjectConfigSchema = z.object({
  name: z.string(),
  resolution: z.tuple([z.number(), z.number()]).default([1920, 1080]),
  framerate: z.number().default(30),
  duration: TimecodeSchema.optional(),
});

/**
 * Complete project schema
 */
export const ProjectSchema = z.object({
  project: ProjectConfigSchema,
  defaults: DefaultsSchema.optional(),
  theme: ThemeSchema.optional(),
  overlays: z.array(OverlaySchema),
});

// Export types derived from schemas
export type Timecode = z.infer<typeof TimecodeSchema>;
export type Position = z.infer<typeof PositionSchema>;
export type PositionPreset = z.infer<typeof PositionPresetSchema>;
export type PixelPosition = z.infer<typeof PixelPositionSchema>;
export type TransitionType = z.infer<typeof TransitionTypeSchema>;
export type Transition = z.infer<typeof TransitionSchema>;
export type Overlay = z.infer<typeof OverlaySchema>;
export type Section = z.infer<typeof SectionSchema>;
export type TitleOverlay = z.infer<typeof TitleOverlaySchema>;
export type LowerThirdOverlay = z.infer<typeof LowerThirdOverlaySchema>;
export type CalloutOverlay = z.infer<typeof CalloutOverlaySchema>;
export type CodeOverlay = z.infer<typeof CodeOverlaySchema>;
export type ParameterOverlay = z.infer<typeof ParameterOverlaySchema>;
export type Theme = z.infer<typeof ThemeSchema>;
export type Defaults = z.infer<typeof DefaultsSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type Project = z.infer<typeof ProjectSchema>;

// Re-export schemas for external validation
export {
  TransitionTypeSchema,
  TransitionSchema,
  PositionPresetSchema,
  PixelPositionSchema,
  PositionSchema,
  ThemeSchema,
  DefaultsSchema,
  ProjectConfigSchema,
};
