/**
 * S3K preview panel for the library browser.
 *
 * Context-aware panel that displays details and actions based on the
 * currently selected item. Supports library samples, chopped samples,
 * drum kits, common-area programs, S3K programs, device programs,
 * device samples, and directories.
 *
 * Action buttons:
 * - "Send to Device" — triggers SDS transfer from library to device (samples)
 * - "Save to Library" — triggers export from device to library (samples, programs)
 * - "Send to Device" — triggers import from library to device (S3K programs)
 * - "Import as Drum Program" — imports drum kit slices as program + samples
 * - "Import to Device" — converts common-area program zones to S3K keygroups
 * - "Open in Loop Editor" — opens loop point editor for samples
 * - "Open in Editor" — opens sample editor for destructive editing
 * - "Chop into Drum Kit" — opens sample chopper for slicing into drum kit
 * - "Edit Kit" — opens standalone drum kit editor for metadata/pad editing
 */

import type { ItemSelection, PreviewContext } from '@audiocontrol/editor-core';
import type {
  SampleMeta,
  ChoppedSampleMeta,
  DrumKitSampleMeta,
  ProgramMeta,
} from '@/plugins/item-types';

// =========================================================================
// Types
// =========================================================================

/** Meta for common-area programs detected from the samples tree. */
interface CommonProgramMeta {
  directoryName?: string;
  path?: string[];
  kitCount?: number;
  description?: string;
}

/** Custom state passed through PreviewContext.customState */
export interface S3kPreviewCustomState {
  /** Callback for "Send to Device" action (sample) */
  onSendSampleToDevice?: (name: string, path?: string[]) => void;
  /** Callback for "Send to Device" action (S3K library program) */
  onSendProgramToDevice?: (dirName: string, name: string) => void;
  /** Callback for "Save to Library" action (device sample) */
  onSaveDeviceSampleToLibrary?: (index: number, name: string) => void;
  /** Callback for "Save to Library" action (device program) */
  onSaveDeviceProgramToLibrary?: (index: number, name: string) => void;
  /** Callback for "Import as Drum Program" action (drum kit) */
  onImportDrumKit?: (name: string, path?: string[]) => void;
  /** Callback for "Import to Device" action (common-area program) */
  onImportInstrument?: (dirName: string, path: string[]) => void;
  /** Callback for "Open in Loop Editor" action (sample) */
  onOpenInLoopEditor?: (name: string, type: string, path?: string[]) => void;
  /** Callback for "Open in Editor" action (sample) */
  onOpenInSampleEditor?: (name: string, type: string, path?: string[]) => void;
  /** Callback for "Chop into Drum Kit" action (sample) */
  onOpenInChopper?: (name: string, type: string, path?: string[]) => void;
  /** Callback for "Edit Kit" action (drum kit) */
  onEditDrumKit?: (name: string, path?: string[]) => void;
  /** Callback for "Delete" action (device program) */
  onDeleteDeviceProgram?: (index: number, name: string) => void;
  /** Callback for "Delete" action (device sample) */
  onDeleteDeviceSample?: (index: number, name: string) => void;
}

// =========================================================================
// Subcomponents
// =========================================================================

function MetaRow({ label, value }: { label: string; value: string | number | undefined }): JSX.Element | null {
  if (value === undefined || value === null) return null;
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-200">{String(value)}</span>
    </div>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-700">
        <h3 className="font-bold text-gray-100">Preview</h3>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-gray-400 text-sm">
          <p>Select an item to view details</p>
        </div>
      </div>
    </div>
  );
}

function DirectoryPreview({ selection }: { selection: ItemSelection }): JSX.Element {
  const childCount = selection.node.children?.length ?? 0;
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-3">{selection.node.name}</h3>
      <MetaRow label="Type" value="Folder" />
      <MetaRow label="Items" value={childCount} />
    </div>
  );
}

/** Shared editor action buttons for samples and chopped samples. */
function EditorActions({
  name,
  nodeType,
  path,
  customState,
}: {
  name: string;
  nodeType: string;
  path?: string[];
  customState: S3kPreviewCustomState | undefined;
}): JSX.Element | null {
  const hasActions = customState?.onOpenInLoopEditor
    || customState?.onOpenInSampleEditor
    || customState?.onOpenInChopper;
  if (!hasActions) return null;

  return (
    <div className="mt-3 flex gap-2 flex-wrap">
      {customState.onOpenInLoopEditor && (
        <button
          className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
          onClick={() => customState.onOpenInLoopEditor!(name, nodeType, path)}
          data-testid="preview-open-loop-editor"
        >
          Loop Editor
        </button>
      )}
      {customState.onOpenInSampleEditor && (
        <button
          className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
          onClick={() => customState.onOpenInSampleEditor!(name, nodeType, path)}
          data-testid="preview-open-sample-editor"
        >
          Edit Sample
        </button>
      )}
      {customState.onOpenInChopper && (
        <button
          className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
          onClick={() => customState.onOpenInChopper!(name, nodeType, path)}
          data-testid="preview-open-chopper"
        >
          Chop
        </button>
      )}
    </div>
  );
}

function SamplePreview({
  selection,
  customState,
}: {
  selection: ItemSelection;
  customState: S3kPreviewCustomState | undefined;
}): JSX.Element {
  const meta = selection.meta as SampleMeta;
  const pathDisplay = meta.path?.join('/') || '/';

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-3">{selection.node.name}</h3>
      <MetaRow label="Type" value="Sample" />
      <MetaRow label="Path" value={pathDisplay} />
      <MetaRow label="Description" value={meta.description} />

      {customState?.onSendSampleToDevice && (
        <div className="mt-4">
          <button
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            onClick={() => customState.onSendSampleToDevice!(
              selection.node.name,
              meta.path,
            )}
            data-testid="preview-send-to-device"
          >
            Send to Device
          </button>
        </div>
      )}

      <EditorActions
        name={selection.node.name}
        nodeType={selection.node.type}
        path={meta.path}
        customState={customState}
      />
    </div>
  );
}

function ChoppedSamplePreview({
  selection,
  customState,
}: {
  selection: ItemSelection;
  customState: S3kPreviewCustomState | undefined;
}): JSX.Element {
  const meta = selection.meta as ChoppedSampleMeta;
  const pathDisplay = meta.path?.join('/') || '/';

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-3">{selection.node.name}</h3>
      <MetaRow label="Type" value="Chopped Sample" />
      <MetaRow label="Slices" value={meta.sliceCount} />
      <MetaRow label="Path" value={pathDisplay} />
      <MetaRow label="Description" value={meta.description} />

      {customState?.onSendSampleToDevice && (
        <div className="mt-4">
          <button
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            onClick={() => customState.onSendSampleToDevice!(
              selection.node.name,
              meta.path,
            )}
            data-testid="preview-send-to-device"
          >
            Send to Device
          </button>
        </div>
      )}

      <EditorActions
        name={selection.node.name}
        nodeType={selection.node.type}
        path={meta.path}
        customState={customState}
      />
    </div>
  );
}

function DrumKitPreview({
  selection,
  customState,
}: {
  selection: ItemSelection;
  customState: S3kPreviewCustomState | undefined;
}): JSX.Element {
  const meta = selection.meta as DrumKitSampleMeta;
  const pathDisplay = meta.path?.join('/') || '/';

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-3">{selection.node.name}</h3>
      <MetaRow label="Type" value="Drum Kit" />
      <MetaRow label="Pads" value={meta.sliceCount} />
      <MetaRow label="Path" value={pathDisplay} />
      <MetaRow label="Description" value={meta.description} />

      <div className="mt-4 flex gap-2 flex-wrap">
        {customState?.onEditDrumKit && (
          <button
            className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded transition-colors"
            onClick={() => customState.onEditDrumKit!(
              selection.node.name,
              meta.path,
            )}
            data-testid="preview-edit-drum-kit"
          >
            Edit Kit
          </button>
        )}

        {customState?.onSendSampleToDevice && (
          <button
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            onClick={() => customState.onSendSampleToDevice!(
              selection.node.name,
              meta.path,
            )}
            data-testid="preview-send-to-device"
          >
            Send to Device
          </button>
        )}

        {customState?.onImportDrumKit && (
          <button
            className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
            onClick={() => customState.onImportDrumKit!(
              selection.node.name,
              meta.path,
            )}
            data-testid="preview-import-drum-kit"
          >
            Import as Drum Program
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Preview for S3K-specific programs (from the programs category,
 * stored as program.s3k.yaml with raw SysEx data).
 */
function S3kProgramPreview({
  selection,
  customState,
}: {
  selection: ItemSelection;
  customState: S3kPreviewCustomState | undefined;
}): JSX.Element {
  const meta = selection.meta as ProgramMeta;

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-3">{selection.node.name}</h3>
      <MetaRow label="Type" value="S3000XL Program" />
      <MetaRow label="Keygroups" value={meta.keygroupCount} />
      <MetaRow label="Samples" value={meta.sampleReferences?.join(', ')} />

      {customState?.onSendProgramToDevice && meta.dirName && (
        <div className="mt-4">
          <button
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
            onClick={() => customState.onSendProgramToDevice!(
              meta.dirName!,
              selection.node.name,
            )}
            data-testid="preview-send-program-to-device"
          >
            Send to Device
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Preview for common-area programs (from the samples category,
 * stored as program.yaml with device-agnostic zones).
 */
function CommonProgramPreview({
  selection,
  customState,
}: {
  selection: ItemSelection;
  customState: S3kPreviewCustomState | undefined;
}): JSX.Element {
  const meta = selection.meta as CommonProgramMeta;
  const pathDisplay = meta.path?.join('/') || '/';

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-3">{selection.node.name}</h3>
      <MetaRow label="Type" value="Instrument" />
      <MetaRow label="Zones" value={meta.kitCount} />
      <MetaRow label="Path" value={pathDisplay} />
      <MetaRow label="Description" value={meta.description} />

      {customState?.onImportInstrument && meta.directoryName && (
        <div className="mt-4">
          <button
            className="px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-500 text-white rounded transition-colors"
            onClick={() => customState.onImportInstrument!(
              meta.directoryName!,
              meta.path ?? [],
            )}
            data-testid="preview-import-instrument"
          >
            Import to Device
          </button>
        </div>
      )}
    </div>
  );
}

/** Preview for a device-side sample (selected from DeviceMemoryPanel). */
function DeviceSamplePreview({
  selection,
  customState,
}: {
  selection: ItemSelection;
  customState: S3kPreviewCustomState | undefined;
}): JSX.Element {
  const meta = selection.meta as { deviceIndex: number };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-3">{selection.node.name}</h3>
      <MetaRow label="Type" value="Device Sample" />
      <MetaRow label="Slot" value={`#${meta.deviceIndex}`} />

      <div className="mt-4 flex gap-2 flex-wrap">
        {customState?.onSaveDeviceSampleToLibrary && (
          <button
            className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
            onClick={() => customState.onSaveDeviceSampleToLibrary!(
              meta.deviceIndex,
              selection.node.name,
            )}
            data-testid="preview-save-to-library"
          >
            Save to Library
          </button>
        )}
        {customState?.onDeleteDeviceSample && (
          <button
            className="px-3 py-1.5 text-sm bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
            onClick={() => customState.onDeleteDeviceSample!(
              meta.deviceIndex,
              selection.node.name,
            )}
            data-testid="preview-delete-device-sample"
          >
            Delete from Device
          </button>
        )}
      </div>
    </div>
  );
}

/** Preview for a device-side program (selected from DeviceMemoryPanel). */
function DeviceProgramPreview({
  selection,
  customState,
}: {
  selection: ItemSelection;
  customState: S3kPreviewCustomState | undefined;
}): JSX.Element {
  const meta = selection.meta as { deviceIndex: number };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-3">{selection.node.name}</h3>
      <MetaRow label="Type" value="Device Program" />
      <MetaRow label="Slot" value={`#${meta.deviceIndex}`} />

      <div className="mt-4 flex gap-2 flex-wrap">
        {customState?.onSaveDeviceProgramToLibrary && (
          <button
            className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
            onClick={() => customState.onSaveDeviceProgramToLibrary!(
              meta.deviceIndex,
              selection.node.name,
            )}
            data-testid="preview-save-program-to-library"
          >
            Save to Library
          </button>
        )}
        {customState?.onDeleteDeviceProgram && (
          <button
            className="px-3 py-1.5 text-sm bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
            onClick={() => customState.onDeleteDeviceProgram!(
              meta.deviceIndex,
              selection.node.name,
            )}
            data-testid="preview-delete-device-program"
          >
            Delete from Device
          </button>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// Helpers
// =========================================================================

/**
 * Distinguish common-area programs from S3K-specific programs.
 *
 * Common-area programs come from the samples tree and have
 * `directoryName` + `path` in their meta. S3K programs come from the
 * programs category and have `dirName` + `keygroupCount`.
 */
function isCommonAreaProgram(meta: Record<string, unknown>): boolean {
  return 'directoryName' in meta && !('dirName' in meta);
}

// =========================================================================
// Main preview panel adapter
// =========================================================================

export function S3kPreviewPanelAdapter({
  selection,
  context,
}: {
  selection: ItemSelection | null;
  context: PreviewContext;
}): JSX.Element {
  if (context.isLoading) {
    return (
      <div className="p-4 text-sm text-gray-400 italic">Loading...</div>
    );
  }

  if (context.error) {
    return (
      <div className="p-4 text-sm text-red-400">{context.error}</div>
    );
  }

  if (!selection) {
    return <EmptyState />;
  }

  const customState = context.customState as S3kPreviewCustomState | undefined;

  if (selection.node.type === 'directory') {
    return <DirectoryPreview selection={selection} />;
  }

  if (selection.node.type === 'device-sample') {
    return <DeviceSamplePreview selection={selection} customState={customState} />;
  }

  if (selection.node.type === 'device-program') {
    return <DeviceProgramPreview selection={selection} customState={customState} />;
  }

  if (selection.node.type === 'sample') {
    return <SamplePreview selection={selection} customState={customState} />;
  }

  if (selection.node.type === 'chopped-sample') {
    return <ChoppedSamplePreview selection={selection} customState={customState} />;
  }

  if (selection.node.type === 'drum-kit') {
    return <DrumKitPreview selection={selection} customState={customState} />;
  }

  if (selection.node.type === 'program') {
    const meta = (selection.meta ?? {}) as Record<string, unknown>;
    if (isCommonAreaProgram(meta)) {
      return <CommonProgramPreview selection={selection} customState={customState} />;
    }
    return <S3kProgramPreview selection={selection} customState={customState} />;
  }

  // Fallback for unknown types
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-gray-100 mb-3">{selection.node.name}</h3>
      <MetaRow label="Type" value={selection.node.type} />
    </div>
  );
}
