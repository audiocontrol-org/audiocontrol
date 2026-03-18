/**
 * Device-agnostic types for the sampler library system.
 *
 * These types define the common interfaces that all device-specific
 * implementations must conform to.
 *
 * @packageDocumentation
 */

/**
 * Supported device types in the library system.
 * New devices should be added here as they are implemented.
 */
export type DeviceType = 's330' | 's550' | 'jv1080' | 'd110';

/**
 * Loop mode options common across devices.
 */
export type LoopMode = 'oneShot' | 'forward' | 'alternating' | 'reverse';

/**
 * Base wave parameters common to all devices.
 */
export interface BaseWaveParams {
  /** Filename of the associated WAV file (relative to tone directory) */
  file: string;
  /** Sample rate in Hz */
  sampleRate: number;
  /** Loop playback mode */
  loopMode: LoopMode;
  /** Loop start point (sample offset) */
  loopPoint?: number;
}

/**
 * Base tone structure common to all devices.
 * Device-specific fields are added via extension.
 */
export interface BaseTone {
  /** Format identifier, always 'sampler-tone' */
  format: 'sampler-tone';
  /** Device type discriminator */
  device: DeviceType;
  /** Schema version for forward compatibility */
  version: number;
  /** Tone name (device-specific length limits apply) */
  name: string;
  /** Wave/sample parameters */
  wave: BaseWaveParams;
}

/**
 * Base patch structure common to all devices.
 */
export interface BasePatch {
  /** Format identifier, always 'sampler-patch' */
  format: 'sampler-patch';
  /** Device type discriminator */
  device: DeviceType;
  /** Schema version */
  version: number;
  /** Patch name */
  name: string;
}

/**
 * Template types for automated patch generation.
 */
export type TemplateType = 'drum-kit' | 'velocity-layer';

/**
 * Base template structure.
 */
export interface BaseTemplate {
  /** Format identifier */
  format: 'sampler-template';
  /** Device type */
  device: DeviceType;
  /** Schema version */
  version: number;
  /** Template type discriminator */
  type: TemplateType;
  /** Template name */
  name: string;
  /** Human-readable description */
  description?: string;
}

/**
 * Drum kit entry in a template.
 */
export interface DrumKitEntry {
  /** Display name for this drum element */
  name: string;
  /** MIDI note name (e.g., 'C2') or number (e.g., 36) */
  key: string | number;
  /** Reference to library tone by name */
  tone: string;
  /** Optional mute group for exclusive playback (e.g., hi-hat choke) */
  muteGroup?: number;
}

/**
 * Velocity layer entry in a template.
 */
export interface VelocityLayerEntry {
  /** Velocity range [min, max] inclusive */
  range: [number, number];
  /** Reference to library tone by name */
  tone: string;
}

/**
 * Drum kit template structure.
 */
export interface DrumKitTemplate extends BaseTemplate {
  type: 'drum-kit';
  /** Kit entries mapping keys to tones */
  kit: DrumKitEntry[];
}

/**
 * Velocity layer template structure.
 */
export interface VelocityLayerTemplate extends BaseTemplate {
  type: 'velocity-layer';
  /** Key range [low, high] for the multi-layer patch */
  keyRange: [number, number];
  /** Velocity layers from soft to loud */
  velocityLayers: VelocityLayerEntry[];
}

/**
 * Union of all template types.
 */
export type Template = DrumKitTemplate | VelocityLayerTemplate;

/**
 * Result of applying a template.
 */
export interface TemplateResult<TPatch, TTone> {
  /** Generated patches */
  patches: TPatch[];
  /** Referenced tones (loaded from library) */
  tones: TTone[];
}

/**
 * Library item metadata for listings.
 */
export interface LibraryItemInfo {
  /** Item name (without extension) */
  name: string;
  /** Device type */
  device: DeviceType;
  /** Full path to the YAML file */
  path: string;
  /** Last modified timestamp */
  modifiedAt?: Date;
}

/**
 * Interface for library storage operations.
 */
export interface LibraryStorage {
  // Tone operations
  saveTone(
    device: DeviceType,
    name: string,
    yaml: BaseTone,
    wavData: Uint8Array,
    sampleRate: number
  ): Promise<void>;
  loadTone(device: DeviceType, name: string): Promise<{ yaml: BaseTone; wavPath: string }>;
  listTones(device: DeviceType): Promise<LibraryItemInfo[]>;
  deleteTone(device: DeviceType, name: string): Promise<void>;

  // Patch operations
  savePatch(device: DeviceType, name: string, yaml: BasePatch): Promise<void>;
  loadPatch(device: DeviceType, name: string): Promise<BasePatch>;
  listPatches(device: DeviceType): Promise<LibraryItemInfo[]>;
  deletePatch(device: DeviceType, name: string): Promise<void>;

  // Template operations
  loadTemplate(device: DeviceType, name: string): Promise<Template>;
  listTemplates(device: DeviceType): Promise<LibraryItemInfo[]>;
}
