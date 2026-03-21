/**
 * Plugin interfaces for device-specific library behavior.
 *
 * The plugin architecture allows device-specific behavior (custom item types,
 * icons, categories, memory layouts, preview panels) without conditionals in
 * UI components.
 *
 * Key design principles:
 * - Framework is device-agnostic: No Roland, Akai, or vendor concepts here
 * - Plugins define everything device-specific
 * - Composition over inheritance: Plugins provide render functions, not subclasses
 * - Translation required: Plugins must translate between device formats and common formats
 */

import type { ReactNode } from 'react';
import type { TreeNode } from '../TreeView';

// =========================================================================
// Plugin Context Menu Action (without onClick handler)
// =========================================================================

/**
 * A regular context menu action.
 * Unlike ContextMenuAction, this doesn't include onClick - the consuming
 * code will wire up handlers based on the action id.
 */
export interface PluginMenuAction {
  /** Unique action identifier (e.g., 'rename', 'delete', 'move') */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon */
  icon?: ReactNode;
  /** Whether the action is disabled */
  disabled?: boolean;
  /** Whether the action is dangerous (red styling) */
  danger?: boolean;
}

/** A separator in the context menu */
export interface PluginMenuSeparator {
  separator: true;
}

/**
 * Union type for context menu items - either an action or a separator.
 */
export type PluginContextMenuAction = PluginMenuAction | PluginMenuSeparator;

// =========================================================================
// Item Type Plugin
// =========================================================================

/**
 * Defines rendering and behavior for a specific item type.
 *
 * The `typeId` is opaque to the framework — Roland plugins use 'tone'/'patch',
 * Akai plugins might use 'program'/'keygroup', etc.
 *
 * @template TMeta - Type of the item's metadata (stored in node.meta)
 */
export interface ItemTypePlugin<TMeta = unknown> {
  /** Opaque type identifier (e.g., 'tone', 'patch', 'program', 'keygroup', 'sample') */
  typeId: string;

  /** Human-readable display name for this type */
  displayName: string;

  /**
   * Render the icon for this item type.
   * @param meta - Item metadata from node.meta
   * @param isSelected - Whether the item is currently selected
   */
  renderIcon(meta: TMeta, isSelected: boolean): ReactNode;

  /**
   * Render trailing content (metadata badges, action buttons) after the name.
   * @param meta - Item metadata from node.meta
   */
  renderTrailing?(meta: TMeta): ReactNode;

  /**
   * Whether items of this type are draggable.
   * @param meta - Item metadata from node.meta
   */
  isDraggable(meta: TMeta): boolean;

  /** Whether items of this type support inline renaming */
  supportsRename: boolean;

  /**
   * Get context menu actions available for this item type.
   * Actions are descriptive only - click handlers are wired up by consuming code.
   * @param meta - Item metadata from node.meta
   * @param node - The tree node
   */
  getContextMenuActions?(meta: TMeta, node: TreeNode): PluginContextMenuAction[];
}

// =========================================================================
// Category Plugin
// =========================================================================

/** Callbacks passed to category header action renderers */
export interface CategoryCallbacks {
  /** Refresh the category data */
  refresh: () => void;
  /** Create a new folder at the root of this category */
  createFolder: () => void;
}

/**
 * Defines a library section (e.g., samples, programs, tones).
 *
 * Categories are completely plugin-defined — the framework just renders
 * them in the order provided.
 */
export interface CategoryPlugin {
  /** Category identifier (used for data mapping and callbacks) */
  categoryId: string;

  /** Section header title */
  title: string;

  /** Map of item type ID to ItemTypePlugin for items in this category */
  itemTypes: Record<string, ItemTypePlugin>;

  /** Message shown when category has no items */
  emptyMessage: string;

  /** Message shown in drop zone during drag (if category accepts drops) */
  dropMessage?: string;

  /** Whether this category accepts drops from external sources (OS, device) */
  acceptsExternalDrop?: boolean;

  /** MIME types this category accepts for drops */
  acceptedDropMimeTypes?: string[];

  /**
   * Check if a drop can be accepted.
   * @param dragData - The drag data (parsed from dataTransfer)
   * @param targetNode - The target directory node (undefined for root)
   */
  canAcceptDrop?(dragData: unknown, targetNode?: TreeNode): boolean;

  /**
   * Handle a drop on this category.
   * @param dragData - The drag data
   * @param targetPath - Path segments to the target directory
   */
  handleDrop?(dragData: unknown, targetPath: string[]): Promise<void>;

  /**
   * Render header actions (e.g., add folder, import button).
   * @param callbacks - Standard category operations
   */
  renderHeaderActions?(callbacks: CategoryCallbacks): ReactNode;

  /** Whether this category is read-only (no modifications allowed) */
  isReadOnly?: boolean;
}

// =========================================================================
// Item Translator
// =========================================================================

/**
 * Translates between device-specific item formats and common library formats.
 *
 * Required for all item types that can be stored in or loaded from the
 * common library area. The common formats are:
 * - Sample: A single audio file with intrinsic properties
 * - Program: A collection of zones mapping samples to key/velocity ranges
 *
 * @template TDeviceItem - Device-specific item type (e.g., ToneYaml, PatchYaml)
 * @template TCommonItem - Common library format (SampleYaml or ProgramYaml)
 */
export interface ItemTranslator<TDeviceItem, TCommonItem> {
  /** Device item type this translator handles (e.g., 'tone', 'patch', 'program') */
  deviceType: string;

  /** Common library format this translates to ('sample' or 'program') */
  commonFormat: 'sample' | 'program';

  /**
   * Export: Convert device-specific item to common library format.
   * Called when user exports/demotes from device to common library.
   *
   * @param deviceItem - The device-specific item
   * @returns The common library item
   */
  toCommon(deviceItem: TDeviceItem): Promise<TCommonItem>;

  /**
   * Import: Convert common library item to device-specific format.
   * Called when user imports/promotes from common library to device.
   * May throw if the common item cannot be represented on this device.
   *
   * @param commonItem - The common library item
   * @returns The device-specific item
   */
  fromCommon(commonItem: TCommonItem): Promise<TDeviceItem>;

  /**
   * Check if a common library item can be imported to this device.
   *
   * @param commonItem - The common library item
   * @returns null if compatible, or an error message if not
   */
  canImport?(commonItem: TCommonItem): string | null;
}

// =========================================================================
// Device Memory Configuration
// =========================================================================

/** A group of slots in device memory (e.g., "Tones 1-32", "Patches 1-16") */
export interface SlotGroup {
  /** Group identifier (plugin-defined) */
  groupId: string;
  /** Display label */
  label: string;
  /** Number of slots in this group */
  slotCount: number;
}

/** Props passed to the device memory panel renderer */
export interface DeviceMemoryRenderProps {
  /** Current slot selection */
  selectedSlot: { groupId: string; index: number } | null;
  /** Called when a slot is selected */
  onSelectSlot: (groupId: string, index: number) => void;
  /** Called when drag starts from a slot */
  onDragStart: (groupId: string, index: number, dragData: unknown) => void;
  /** Called when something is dropped on a slot */
  onDrop: (groupId: string, index: number, dragData: unknown) => void;
}

/** Configuration for device memory panel */
export interface DeviceMemoryConfig {
  /** Plugin-defined slot groups (no framework assumptions about structure) */
  slotGroups: SlotGroup[];

  /**
   * Render the entire device memory panel.
   * Full control given to plugin — framework just provides the layout slot.
   */
  renderMemoryPanel(props: DeviceMemoryRenderProps): ReactNode;
}

// =========================================================================
// Preview Panel Configuration
// =========================================================================

/** Selection state passed to preview panel renderer */
export interface ItemSelection {
  /** Category the item belongs to */
  categoryId: string;
  /** The selected tree node */
  node: TreeNode;
  /** Item metadata from node.meta */
  meta: unknown;
}

/** Context for preview panel rendering */
export interface PreviewContext {
  /** Whether the item is currently loading */
  isLoading: boolean;
  /** Error message if loading failed */
  error?: string;
}

/** Configuration for preview panel */
export interface PreviewPanelConfig {
  /**
   * Render the preview panel for the current selection.
   * @param selection - Current selection (null if nothing selected)
   * @param context - Loading and error state
   */
  renderPreview(selection: ItemSelection | null, context: PreviewContext): ReactNode;
}

// =========================================================================
// Device Library Plugin (Top-Level)
// =========================================================================

/**
 * Top-level plugin for a device's library.
 *
 * Combines categories, translators, memory config, and preview panel
 * into a complete device-specific library implementation.
 */
export interface DeviceLibraryPlugin {
  /** Device identifier (e.g., 's330', 's550', 's3000') */
  deviceId: string;

  /** Human-readable device name */
  deviceName: string;

  /** Categories to display (rendered in array order) */
  categories: CategoryPlugin[];

  /**
   * Translators for import/export with common library area.
   * Required for device item types that can be shared.
   */
  translators: ItemTranslator<unknown, unknown>[];

  /** Device memory configuration (optional — some devices have no memory panel) */
  deviceMemory?: DeviceMemoryConfig;

  /** Preview panel configuration */
  previewPanel: PreviewPanelConfig;
}

// =========================================================================
// Device Memory Actions (Opaque to Framework)
// =========================================================================

/**
 * Device memory action — structure is opaque to framework.
 * Plugin defines the action types and payload shapes.
 */
export interface DeviceMemoryAction {
  type: string;
  payload: unknown;
}
