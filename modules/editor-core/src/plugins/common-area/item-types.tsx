/**
 * Shared item type factories for common-area samples and programs.
 *
 * These create ItemTypePlugin instances for items in the common library
 * area shared across all editors. Context menu actions are filtered by
 * the editor's declared transfer capabilities — only actions the editor
 * can handle appear in the menu.
 */

import type { ItemTypePlugin, PluginContextMenuAction } from '@/components/library/plugins/types';
import type { TransferActionId } from '@/hooks/useLibraryOperations';

/**
 * Single-letter mono lead-in tag used in place of a per-kind icon —
 * see roland-sxx0-editor/src/plugins/shared/item-types.tsx for the
 * canonical comment. Items here are common-area (S = sample, K = program-kit).
 */
function KindTag({ children }: { children: string }): JSX.Element {
  return <span className="ac-tree-item-tag" aria-hidden="true">{children}</span>;
}

// =========================================================================
// Metadata types
// =========================================================================

/** Metadata for common-area sample items */
export interface CommonSampleMeta {
  path?: string[];
  description?: string;
  sliceCount?: number;
  hasDrumKit?: boolean;
  /** Number of audio samples in the WAV file */
  sampleCount?: number;
  /** Sample rate in Hz */
  sampleRate?: number;
}

/** Metadata for common-area program items */
export interface CommonProgramMeta {
  path?: string[];
  description?: string;
  /** Number of zones in the program (from kitCount in tree node) */
  kitCount?: number;
}

// =========================================================================
// Sample item type factory
// =========================================================================

/**
 * Create an item type plugin for common-area samples.
 *
 * @param supportedActions - Transfer actions this editor can handle.
 *   Only actions in this set appear in the context menu.
 */
export function createCommonSampleItemType(
  supportedActions: ReadonlySet<TransferActionId>,
): ItemTypePlugin<CommonSampleMeta> {
  return {
    typeId: 'sample',
    displayName: 'Sample',

    renderIcon: () => <KindTag>S</KindTag>,

    renderTrailing: (meta) => {
      if (!meta.sliceCount || meta.sliceCount <= 0) return null;
      const unit = meta.hasDrumKit ? 'pad' : 'slice';
      return (
        <span className="text-xs text-gray-400">
          {meta.sliceCount} {unit}{meta.sliceCount !== 1 ? 's' : ''}
        </span>
      );
    },

    isDraggable: () => true,

    supportsRename: true,

    getContextMenuActions: (meta) => {
      const actions: PluginContextMenuAction[] = [];

      // Transfer actions — batchable (send multiple samples to device)
      if (supportedActions.has('send-sample-to-device')) {
        actions.push({ id: 'send-sample-to-device', label: 'Send to Device', icon: null, batchable: false });
      }
      if (meta.hasDrumKit && supportedActions.has('import-drum-kit')) {
        actions.push({ id: 'import-drum-kit', label: 'Import as Drum Program', icon: null, batchable: false });
      }

      // Editor actions — single-item only (one editor window at a time)
      if (actions.length > 0) actions.push({ separator: true });
      actions.push({ id: 'open-loop-editor', label: 'Open in Loop Editor', icon: null, batchable: false });
      actions.push({ id: 'open-sample-editor', label: 'Open in Sample Editor', icon: null, batchable: false });
      actions.push({ id: 'open-chopper', label: 'Open in Chopper', icon: null, batchable: false });
      if (meta.hasDrumKit && supportedActions.has('edit-drum-kit')) {
        actions.push({ id: 'edit-drum-kit', label: 'Edit Kit', icon: null, batchable: false });
      }

      // File operations
      actions.push({ separator: true });
      actions.push({ id: 'rename', label: 'Rename', icon: null, batchable: false });
      actions.push({ id: 'move', label: 'Move to...', icon: null, batchable: true });
      actions.push({ separator: true });
      actions.push({ id: 'delete', label: 'Delete', icon: null, danger: true, batchable: true });

      return actions;
    },
  };
}

// =========================================================================
// Program item type factory
// =========================================================================

/**
 * Create an item type plugin for common-area programs.
 *
 * @param supportedActions - Transfer actions this editor can handle.
 *   Only actions in this set appear in the context menu.
 */
export function createCommonProgramItemType(
  supportedActions: ReadonlySet<TransferActionId>,
): ItemTypePlugin<CommonProgramMeta> {
  return {
    typeId: 'program',
    displayName: 'Program',

    renderIcon: () => <KindTag>K</KindTag>,

    renderTrailing: (meta) => {
      if (!meta.kitCount || meta.kitCount <= 0) return null;
      return (
        <span className="text-xs text-gray-400">
          {meta.kitCount} zone{meta.kitCount !== 1 ? 's' : ''}
        </span>
      );
    },

    isDraggable: () => true,

    supportsRename: true,

    getContextMenuActions: () => {
      const actions: PluginContextMenuAction[] = [];

      // Transfer actions
      if (supportedActions.has('send-program-to-device')) {
        actions.push({ id: 'send-program-to-device', label: 'Send to Device', icon: null, batchable: false });
      }
      if (supportedActions.has('promote-to-common-area')) {
        actions.push({ id: 'promote-to-common-area', label: 'Promote to Common Area', icon: null, batchable: false });
      }
      if (supportedActions.has('import-instrument')) {
        actions.push({ id: 'import-instrument', label: 'Import to Device', icon: null, batchable: false });
      }

      // File operations
      if (actions.length > 0) actions.push({ separator: true });
      actions.push({ id: 'rename', label: 'Rename', icon: null, batchable: false });
      actions.push({ id: 'move', label: 'Move to...', icon: null, batchable: true });
      actions.push({ separator: true });
      actions.push({ id: 'delete', label: 'Delete', icon: null, danger: true, batchable: true });

      return actions;
    },
  };
}
