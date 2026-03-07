/**
 * Item Preview Panel
 *
 * Right panel showing details of the selected item (tone, patch, or set)
 * with action buttons for import/export.
 */

import type { S330Tone, S330Patch } from '@/core/midi/S330Client';
import type { ItemSelection } from '@/pages/LibraryPage';

interface ItemPreviewPanelProps {
  selection: ItemSelection | null;
  deviceTones: (S330Tone | undefined)[];
  devicePatches: (S330Patch | undefined)[];
  libraryHandle: FileSystemDirectoryHandle | null;
}

/**
 * Format tone slot number (0-31 -> T11-T48)
 */
function formatToneSlot(index: number): string {
  const bank = Math.floor(index / 8) + 1;
  const slot = (index % 8) + 1;
  return `T${bank}${slot}`;
}

/**
 * Format patch slot number (0-15 -> P01-P16)
 */
function formatPatchSlot(index: number): string {
  return `P${String(index + 1).padStart(2, '0')}`;
}

/**
 * Tone preview component
 */
function TonePreview({ tone, slotIndex }: { tone: S330Tone; slotIndex: number }): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-s330-muted uppercase tracking-wide mb-1">
          {formatToneSlot(slotIndex)}
        </div>
        <h4 className="text-lg font-bold text-s330-text">{tone.name}</h4>
      </div>

      <div className="bg-s330-bg rounded p-3 text-sm space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-s330-muted text-xs">Sample Rate</span>
            <div className="text-s330-text">{tone.sampleRate}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Loop Mode</span>
            <div className="text-s330-text capitalize">{tone.loopMode}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Original Key</span>
            <div className="text-s330-text">{tone.originalKey}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Output</span>
            <div className="text-s330-text">
              {tone.outputAssign === 0 ? 'Mix' : `Out ${tone.outputAssign}`}
            </div>
          </div>
        </div>

        <hr className="border-s330-accent/30" />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-s330-muted text-xs">Wave Bank</span>
            <div className="text-s330-text">{tone.wave.bank === 0 ? 'A' : 'B'}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Segments</span>
            <div className="text-s330-text">
              {tone.wave.segmentTop}-{tone.wave.segmentTop + tone.wave.segmentLength - 1}
              {' '}({tone.wave.segmentLength})
            </div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">TVA Level</span>
            <div className="text-s330-text">{tone.tva?.level ?? '-'}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">TVF</span>
            <div className="text-s330-text">{tone.tvf?.enabled ? 'ON' : 'OFF'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Patch preview component
 */
function PatchPreview({ patch, slotIndex }: { patch: S330Patch; slotIndex: number }): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-s330-muted uppercase tracking-wide mb-1">
          {formatPatchSlot(slotIndex)}
        </div>
        <h4 className="text-lg font-bold text-s330-text">{patch.common.name}</h4>
      </div>

      <div className="bg-s330-bg rounded p-3 text-sm space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-s330-muted text-xs">Key Mode</span>
            <div className="text-s330-text capitalize">{patch.common.keyMode}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Level</span>
            <div className="text-s330-text">{patch.common.level}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Bender Range</span>
            <div className="text-s330-text">{patch.common.benderRange}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Key Assign</span>
            <div className="text-s330-text capitalize">{patch.common.keyAssign}</div>
          </div>
        </div>

        <hr className="border-s330-accent/30" />

        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-s330-muted text-xs">Aftertouch</span>
            <div className="text-s330-text capitalize">{patch.common.aftertouchAssign}</div>
          </div>
          <div>
            <span className="text-s330-muted text-xs">Output</span>
            <div className="text-s330-text">
              {patch.common.outputAssign === 8 ? 'Mix' : `Out ${patch.common.outputAssign}`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Set preview component (for library sets)
 */
function SetPreview({ name }: { name: string }): JSX.Element {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-s330-muted uppercase tracking-wide mb-1">
          Library Set
        </div>
        <h4 className="text-lg font-bold text-s330-text">{name}</h4>
      </div>

      <div className="bg-s330-bg rounded p-3 text-sm">
        <p className="text-s330-muted">
          Click "Load Selected Set" to upload this set to the device.
        </p>
      </div>
    </div>
  );
}

export function ItemPreviewPanel({
  selection,
  deviceTones,
  devicePatches,
}: ItemPreviewPanelProps): JSX.Element {
  // Empty state
  if (!selection) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Preview</h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-s330-muted text-sm">
            <p>Select an item to preview</p>
          </div>
        </div>
      </div>
    );
  }

  // Device tone selected
  if (selection.source === 'device' && selection.type === 'tone' && selection.index !== undefined) {
    const tone = deviceTones[selection.index];
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Device Tone</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {tone ? (
            <TonePreview tone={tone} slotIndex={selection.index} />
          ) : (
            <div className="text-center text-s330-muted text-sm py-8">
              <p>Empty slot</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Device patch selected
  if (selection.source === 'device' && selection.type === 'patch' && selection.index !== undefined) {
    const patch = devicePatches[selection.index];
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Device Patch</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {patch ? (
            <PatchPreview patch={patch} slotIndex={selection.index} />
          ) : (
            <div className="text-center text-s330-muted text-sm py-8">
              <p>Empty slot</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Library set selected
  if (selection.source === 'library' && selection.type === 'set' && selection.name) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b border-s330-accent">
          <h3 className="font-bold text-s330-text">Library Set</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <SetPreview name={selection.name} />
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-s330-accent">
        <h3 className="font-bold text-s330-text">Preview</h3>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-s330-muted text-sm">
          <p>Select an item to preview</p>
        </div>
      </div>
    </div>
  );
}
