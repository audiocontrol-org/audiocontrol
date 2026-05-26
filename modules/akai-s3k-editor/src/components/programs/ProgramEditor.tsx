import { useState } from 'react';
import type { ProgramHeader } from '@audiocontrol/sampler-devices/s3k';
import { AcRadioTabs, type AcRadioTabDef } from '@audiocontrol/editor-core';
import { ProgramCommonPanel } from '@/components/programs/panels/ProgramCommonPanel';
import { ProgramMidiPanel } from '@/components/programs/panels/ProgramMidiPanel';
import { ProgramEffectsPanel } from '@/components/programs/panels/ProgramEffectsPanel';
import { ProgramOutputPanel } from '@/components/programs/panels/ProgramOutputPanel';

interface ProgramEditorProps {
  header: ProgramHeader;
  programIndex: number;
  onParameterChange: (field: string, value: number | string) => void;
  children?: React.ReactNode;
}

const PROGRAM_TABS: readonly AcRadioTabDef[] = [
  { id: 'ap-common', label: 'Common' },
  { id: 'ap-midi', label: 'MIDI' },
  { id: 'ap-effects', label: 'Effects' },
  { id: 'ap-output', label: 'Output' },
];

/**
 * Format a program slot index as a 2-digit decimal string ("01", "12",
 * "128"). Akai S3000XL programs are numbered 1..N starting from index 0;
 * the slot reads as "01" for index 0 to match the operator's mental
 * model (front-panel display + list-row numbering).
 */
function formatProgramSlot(index: number): string {
  return String(index + 1).padStart(2, '0');
}

export function ProgramEditor({
  header,
  programIndex,
  onParameterChange,
  children,
}: ProgramEditorProps): JSX.Element {
  const num = (field: string) => (value: number) => onParameterChange(field, value);
  const bool = (field: string) => (checked: boolean) => onParameterChange(field, checked ? 1 : 0);

  // Tabs are CONTROLLED so the test harness + sub-components can read
  // the active id (e.g., for tab-aware spotlight in a future pass).
  // Matches the canonical pattern established by VelocityZoneEditor
  // 2026-05-24 (controlled-mode AcRadioTabs consumers don't register
  // per-tab-ID CSS selectors).
  const [activeTab, setActiveTab] = useState<string>('ap-common');

  return (
    <article
      className="ac-detail-pane"
      aria-label="Program editor"
      data-testid="program-detail"
    >
      {/* Detail head — same shape as the roland PatchEditor head (eyebrow
          row above a slot + always-editable name input). The canonical
          chrome lives in editor-core/src/design/detail-pane-primitives.css
          (promoted from roland-sxx0-editor 2026-05-25 per
          AUDIT-20260525-26). Eyebrow contents mirror the mockup at
          docs/.../mockups/programs.html:80-86 (Program · Editing ·
          Source · S3000XL). */}
      <header className="ac-detail-head">
        <div className="ac-detail-eyebrow-row">
          <span>Program</span>
          <span className="ac-detail-eyebrow-sep">·</span>
          <span className="ac-detail-eyebrow-accent">Editing</span>
          <span className="ac-detail-eyebrow-sep">·</span>
          <span>Source · S3000XL</span>
        </div>
        <h3 id="program-detail-title" className="ac-detail-title">
          <span className="ac-detail-slot">{formatProgramSlot(programIndex)}</span>
          <input
            type="text"
            value={header.PRNAME}
            maxLength={12}
            size={12}
            onChange={(e) => onParameterChange('PRNAME', e.target.value)}
            placeholder="(unnamed)"
            data-testid="program-name-input"
            className="ac-input ac-detail-name-input"
          />
        </h3>
      </header>

      <div className="ac-detail-body">
        {children}

        {/* AcRadioTabs partitions the program parameters into four
            mockup-specified panels: Common / MIDI / Effects / Output
            (per mockups/programs.html:94-105). Each panel body is a
            per-tab component under ./panels/ so this file stays under
            the 300-500 line cap and the panel-by-panel structure stays
            obvious. Controlled mode (activeId + onActiveIdChange) means
            only the active panel renders — no per-tab-ID CSS selectors
            need registering in any consumer stylesheet. */}
        <AcRadioTabs
          tabs={PROGRAM_TABS}
          panels={{
            'ap-common': (
              <ProgramCommonPanel
                header={header}
                num={num}
                bool={bool}
                programIndex={programIndex}
              />
            ),
            'ap-midi': (
              <ProgramMidiPanel header={header} num={num} bool={bool} />
            ),
            'ap-effects': (
              <ProgramEffectsPanel header={header} num={num} bool={bool} />
            ),
            'ap-output': (
              <ProgramOutputPanel header={header} num={num} />
            ),
          }}
          activeId={activeTab}
          onActiveIdChange={setActiveTab}
          groupName="program-editor-tabs"
          ariaLabel="Program editor sections"
        />
      </div>
    </article>
  );
}
