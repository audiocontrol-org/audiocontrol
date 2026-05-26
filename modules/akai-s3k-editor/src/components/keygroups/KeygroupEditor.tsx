import { useState } from 'react';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { AcRadioTabs, type AcRadioTabDef } from '@audiocontrol/editor-core';
import { formatMidiNote } from '@/lib/midi-note-parser';
import type { NoteRange } from '@/components/keygroups/note-coordinate-utils';
import { KeygroupZonesPanel } from '@/components/keygroups/panels/KeygroupZonesPanel';
import { KeygroupPitchPanel } from '@/components/keygroups/panels/KeygroupPitchPanel';
import { KeygroupFilterPanel } from '@/components/keygroups/panels/KeygroupFilterPanel';
import { KeygroupAmpPanel } from '@/components/keygroups/panels/KeygroupAmpPanel';
import { KeygroupLfoPanel } from '@/components/keygroups/panels/KeygroupLfoPanel';

interface KeygroupEditorProps {
  header: KeygroupHeader;
  keygroupIndex: number;
  /** Total keygroups in the parent program — drives the "N of M" eyebrow. */
  keygroupCount: number;
  sampleNames: string[];
  onParameterChange: (field: string, value: number | string) => void;
  /** Optimistic-only update during drag (no device write) */
  onDragChange?: (field: string, value: number) => void;
  /** Write current header to device (called on drag end) */
  onCommitHeader?: () => void;
  noteRange: NoteRange;
}

const KEYGROUP_TABS: readonly AcRadioTabDef[] = [
  { id: 'ak-zones', label: 'Zones' },
  { id: 'ak-pitch', label: 'Pitch' },
  { id: 'ak-filter', label: 'Filter' },
  { id: 'ak-amp', label: 'Amp' },
  { id: 'ak-lfo', label: 'LFO' },
];

export function KeygroupEditor({
  header,
  keygroupIndex,
  keygroupCount,
  sampleNames,
  onParameterChange,
  onDragChange,
  onCommitHeader,
  noteRange,
}: KeygroupEditorProps): JSX.Element {
  const num = (field: string) => (value: number) =>
    onParameterChange(field, value);
  const bool = (field: string) => (checked: boolean) =>
    onParameterChange(field, checked ? 1 : 0);

  const rangeLabel = `${formatMidiNote(header.LONOTE)}–${formatMidiNote(header.HINOTE)}`;

  // Default-active tab is Zones (the most-frequently-used surface +
  // the one that carries the VelocityZoneEditor that previously was
  // the sole visible affordance).
  const [activeTab, setActiveTab] = useState<string>('ak-zones');

  return (
    <article
      className="ac-detail-pane"
      aria-label="Keygroup editor"
      data-testid="keygroup-detail"
    >
      {/* Detail head — eyebrow ("Keygroup · Editing · N of M") + slot
          ("KG<N>") + range-as-name input. Mockup contract at
          docs/.../mockups/keygroups.html. Canonical chrome lives in
          editor-core/src/design/detail-pane-primitives.css (promoted
          from roland-sxx0-editor 2026-05-25 per AUDIT-20260525-26).
          The range row is rendered as a read-only input via the same
          .ac-detail-name-input affordance the mockup uses; the
          editable note bounds live in the Note Range section in the
          body, so the head is informational. */}
      <header className="ac-detail-head">
        <div className="ac-detail-eyebrow-row">
          <span>Keygroup</span>
          <span className="ac-detail-eyebrow-sep">·</span>
          <span className="ac-detail-eyebrow-accent">Editing</span>
          <span className="ac-detail-eyebrow-sep">·</span>
          <span>{keygroupIndex + 1} of {keygroupCount}</span>
        </div>
        <h3 id="keygroup-detail-title" className="ac-detail-title">
          <span className="ac-detail-slot">KG{keygroupIndex + 1}</span>
          <input
            type="text"
            value={rangeLabel}
            readOnly
            aria-label="Keygroup note range"
            data-testid="keygroup-range-label"
            className="ac-input ac-detail-name-input"
          />
        </h3>
      </header>

      <div className="ac-detail-body">
        {/* AcRadioTabs partitions the keygroup parameters into the
            five mockup-specified panels: Zones / Pitch / Filter / Amp
            / LFO (per mockups/keygroups.html:78-91). Each panel body
            is a per-tab component under ./panels/ so this file stays
            under the 300-500 line cap. */}
        <AcRadioTabs
          tabs={KEYGROUP_TABS}
          panels={{
            'ak-zones': (
              <KeygroupZonesPanel
                header={header}
                sampleNames={sampleNames}
                onParameterChange={onParameterChange}
                num={num}
                noteRange={noteRange}
              />
            ),
            'ak-pitch': (
              <KeygroupPitchPanel header={header} num={num} bool={bool} />
            ),
            'ak-filter': (
              <KeygroupFilterPanel
                header={header}
                num={num}
                onParameterChange={onParameterChange}
                onDragChange={onDragChange}
                onCommitHeader={onCommitHeader}
              />
            ),
            'ak-amp': (
              <KeygroupAmpPanel
                header={header}
                num={num}
                onParameterChange={onParameterChange}
                onDragChange={onDragChange}
                onCommitHeader={onCommitHeader}
              />
            ),
            'ak-lfo': <KeygroupLfoPanel header={header} num={num} />,
          }}
          activeId={activeTab}
          onActiveIdChange={setActiveTab}
          groupName="keygroup-editor-tabs"
          ariaLabel="Keygroup editor sections"
        />
      </div>
    </article>
  );
}
