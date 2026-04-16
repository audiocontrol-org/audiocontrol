/**
 * S3K preview panel for the library browser.
 *
 * Context-aware panel that displays details and actions based on the
 * currently selected item. Supports library samples (with optional
 * slice/drum-kit metadata), common-area programs, S3K programs,
 * device programs, device samples, and directories.
 *
 * Action buttons:
 * - "Send to Device" -- triggers SDS transfer from library to device (samples)
 * - "Save to Library" -- triggers export from device to library (samples, programs)
 * - "Send to Device" -- triggers import from library to device (S3K programs)
 * - "Import as Drum Program" -- imports drum kit slices as program + samples
 * - "Import to Device" -- converts common-area program zones to S3K keygroups
 * - "Open in Loop Editor" -- opens loop point editor for samples
 * - "Open in Editor" -- opens sample editor for destructive editing
 * - "Chop into Drum Kit" -- opens sample chopper for slicing into drum kit
 * - "Edit Kit" -- opens standalone drum kit editor for metadata/pad editing
 */

import type { ItemSelection, PreviewContext } from '@audiocontrol/editor-core';
import type {
  SampleMeta,
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
  onImportInstrument?: (dirName: string, path: string[], fromProgramsDir: boolean) => void;
  /** Callback for "Open in Loop Editor" action (sample) */
  onOpenInLoopEditor?: (name: string, type: string, path?: string[]) => void;
  /** Callback for "Open in Editor" action (sample) */
  onOpenInSampleEditor?: (name: string, type: string, path?: string[]) => void;
  /** Callback for "Chop into Drum Kit" action (sample) */
  onOpenInChopper?: (name: string, type: string, path?: string[]) => void;
  /** Callback for "Edit Kit" action (drum kit or program) */
  onEditDrumKit?: (name: string, nodeType: string, path?: string[]) => void;
  /** Callback for "Delete" action (device program) */
  onDeleteDeviceProgram?: (index: number, name: string) => void;
  /** Callback for "Delete" action (device sample) */
  onDeleteDeviceSample?: (index: number, name: string) => void;
  /** Callback for "Promote to Common Area" action (S3K library program) */
  onPromoteToCommonArea?: (dirName: string) => void;
  /** Whether a promotion operation is currently in progress */
  isPromoting?: boolean;
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
        <h3 className="font-semibold text-gray-200">Preview</h3>
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
      <h3 className="text-lg font-semibold text-gray-200 mb-3">{selection.node.name}</h3>
      <MetaRow label="Type" value="Folder" />
      <MetaRow label="Items" value={childCount} />
    </div>
  );
}

/** Labeled group of action buttons in the preview panel. */
function ActionGroup({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">{label}</h4>
      <div className="flex gap-1.5 flex-wrap">{children}</div>
    </div>
  );
}

/** Primary action button (e.g., Send to Device). */
function PrimaryAction({ label, onClick, testId }: { label: string; onClick: () => void; testId?: string }): JSX.Element {
  return (
    <button
      className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
      onClick={onClick}
      data-testid={testId}
    >
      {label}
    </button>
  );
}

/** Secondary action button (e.g., editor tools). Supports disabled state with spinner. */
function SecondaryAction({ label, onClick, testId, disabled }: {
  label: string;
  onClick: () => void;
  testId?: string;
  disabled?: boolean;
}): JSX.Element {
  return (
    <button
      className={`px-3 py-1.5 text-sm rounded transition-colors inline-flex items-center gap-1.5 ${
        disabled
          ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
          : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
      }`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      data-testid={testId}
    >
      {disabled && <span className="ac-spinner ac-spinner-sm" />}
      {label}
    </button>
  );
}

/** Danger action button (e.g., Delete). */
function DangerAction({ label, onClick, testId }: { label: string; onClick: () => void; testId?: string }): JSX.Element {
  return (
    <button
      className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-gray-700/50 rounded transition-colors"
      onClick={onClick}
      data-testid={testId}
    >
      {label}
    </button>
  );
}

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
    <ActionGroup label="Edit">
      {customState.onOpenInLoopEditor && (
        <SecondaryAction
          label="Loop Editor"
          onClick={() => customState.onOpenInLoopEditor!(name, nodeType, path)}
          testId="preview-open-loop-editor"
        />
      )}
      {customState.onOpenInSampleEditor && (
        <SecondaryAction
          label="Edit Sample"
          onClick={() => customState.onOpenInSampleEditor!(name, nodeType, path)}
          testId="preview-open-sample-editor"
        />
      )}
      {customState.onOpenInChopper && (
        <SecondaryAction
          label="Chop"
          onClick={() => customState.onOpenInChopper!(name, nodeType, path)}
          testId="preview-open-chopper"
        />
      )}
    </ActionGroup>
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

  const hasSlices = meta.sliceCount !== undefined && meta.sliceCount > 0;
  const typeLabel = meta.hasDrumKit
    ? 'Drum Kit'
    : hasSlices
      ? 'Sliced Sample'
      : 'Sample';

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-gray-200 mb-3">{selection.node.name}</h3>
      <MetaRow label="Type" value={typeLabel} />
      {hasSlices && (
        <MetaRow
          label={meta.hasDrumKit ? 'Pads' : 'Slices'}
          value={meta.sliceCount}
        />
      )}
      {meta.sampleCount !== undefined && (
        <MetaRow
          label="Length"
          value={meta.sampleRate
            ? `${meta.sampleCount.toLocaleString()} samples (${(meta.sampleCount / meta.sampleRate).toFixed(2)}s)`
            : `${meta.sampleCount.toLocaleString()} samples`}
        />
      )}
      {meta.sampleRate !== undefined && (
        <MetaRow label="Sample Rate" value={`${meta.sampleRate.toLocaleString()} Hz`} />
      )}
      <MetaRow label="Path" value={pathDisplay} />
      <MetaRow label="Description" value={meta.description} />

      {(customState?.onSendSampleToDevice || (meta.hasDrumKit && customState?.onImportDrumKit)) && (
        <ActionGroup label="Device">
          {customState?.onSendSampleToDevice && (
            <PrimaryAction
              label="Send to Device"
              onClick={() => customState.onSendSampleToDevice!(selection.node.name, meta.path)}
              testId="preview-send-to-device"
            />
          )}
          {meta.hasDrumKit && customState?.onImportDrumKit && (
            <SecondaryAction
              label="Import as Drum Program"
              onClick={() => customState.onImportDrumKit!(selection.node.name, meta.path)}
              testId="preview-import-drum-kit"
            />
          )}
        </ActionGroup>
      )}

      <EditorActions
        name={selection.node.name}
        nodeType={selection.node.type}
        path={meta.path}
        customState={customState}
      />

      {meta.hasDrumKit && customState?.onEditDrumKit && (
        <ActionGroup label="Kit">
          <SecondaryAction
            label="Edit Kit"
            onClick={() => customState.onEditDrumKit!(selection.node.name, selection.node.type, meta.path)}
            testId="preview-edit-drum-kit"
          />
        </ActionGroup>
      )}
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
  const isPromoting = customState?.isPromoting ?? false;

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold text-gray-200 mb-3">{selection.node.name}</h3>
      <MetaRow label="Type" value="S3000XL Program" />
      <MetaRow label="Keygroups" value={meta.keygroupCount} />
      <MetaRow label="Samples" value={meta.sampleReferences?.join(', ')} />

      {meta.dirName && (customState?.onSendProgramToDevice || customState?.onPromoteToCommonArea) && (
        <ActionGroup label="Device">
          {customState?.onSendProgramToDevice && (
            <PrimaryAction
              label="Send to Device"
              onClick={() => customState.onSendProgramToDevice!(meta.dirName!, selection.node.name)}
              testId="preview-send-program-to-device"
            />
          )}
          {customState?.onPromoteToCommonArea && (
            <SecondaryAction
              label={isPromoting ? 'Promoting...' : 'Promote to Common Area'}
              onClick={() => customState.onPromoteToCommonArea!(meta.dirName!)}
              disabled={isPromoting}
              testId="preview-promote-to-common"
            />
          )}
        </ActionGroup>
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
      <h3 className="text-lg font-semibold text-gray-200 mb-3">{selection.node.name}</h3>
      <MetaRow label="Type" value="Program" />
      <MetaRow label="Zones" value={meta.kitCount} />
      <MetaRow label="Path" value={pathDisplay} />
      <MetaRow label="Description" value={meta.description} />

      {customState?.onImportInstrument && meta.directoryName && (
        <ActionGroup label="Device">
          <PrimaryAction
            label="Import to Device"
            onClick={() => {
              // Programs at root of common-programs category live in library/common/programs/
              // Programs inside a samples folder have a non-empty path
              const fromProgramsDir = !meta.path || meta.path.length === 0;
              customState.onImportInstrument!(meta.directoryName!, meta.path ?? [], fromProgramsDir);
            }}
            testId="preview-import-instrument"
          />
        </ActionGroup>
      )}

      {customState?.onOpenInChopper && (
        <ActionGroup label="Edit">
          <SecondaryAction
            label="Re-chop"
            onClick={() => customState.onOpenInChopper!(selection.node.name, selection.node.type)}
            testId="preview-open-chopper"
          />
        </ActionGroup>
      )}

      {customState?.onEditDrumKit && (
        <ActionGroup label="Kit">
          <SecondaryAction
            label="Edit Kit"
            onClick={() => customState.onEditDrumKit!(selection.node.name, selection.node.type)}
            testId="preview-edit-drum-kit"
          />
        </ActionGroup>
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
      <h3 className="text-lg font-semibold text-gray-200 mb-3">{selection.node.name}</h3>
      <MetaRow label="Type" value="Device Sample" />
      <MetaRow label="Slot" value={`#${meta.deviceIndex}`} />

      {customState?.onSaveDeviceSampleToLibrary && (
        <ActionGroup label="Library">
          <PrimaryAction
            label="Save to Library"
            onClick={() => customState.onSaveDeviceSampleToLibrary!(meta.deviceIndex, selection.node.name)}
            testId="preview-save-to-library"
          />
        </ActionGroup>
      )}

      {customState?.onDeleteDeviceSample && (
        <ActionGroup label="Manage">
          <DangerAction
            label="Delete from Device"
            onClick={() => customState.onDeleteDeviceSample!(meta.deviceIndex, selection.node.name)}
            testId="preview-delete-device-sample"
          />
        </ActionGroup>
      )}
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
      <h3 className="text-lg font-semibold text-gray-200 mb-3">{selection.node.name}</h3>
      <MetaRow label="Type" value="Device Program" />
      <MetaRow label="Slot" value={`#${meta.deviceIndex}`} />

      {customState?.onSaveDeviceProgramToLibrary && (
        <ActionGroup label="Library">
          <PrimaryAction
            label="Save to Library"
            onClick={() => customState.onSaveDeviceProgramToLibrary!(meta.deviceIndex, selection.node.name)}
            testId="preview-save-program-to-library"
          />
        </ActionGroup>
      )}

      {customState?.onDeleteDeviceProgram && (
        <ActionGroup label="Manage">
          <DangerAction
            label="Delete from Device"
            onClick={() => customState.onDeleteDeviceProgram!(meta.deviceIndex, selection.node.name)}
            testId="preview-delete-device-program"
          />
        </ActionGroup>
      )}
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
      <h3 className="text-lg font-semibold text-gray-200 mb-3">{selection.node.name}</h3>
      <MetaRow label="Type" value={selection.node.type} />
    </div>
  );
}
