/**
 * Tone editor — list/detail right pane.
 *
 * Phase 9 Task 4 polish: detail-head + radio-driven 5-tab shell
 * (Wave · Pitch · Filter · Amp · LFO) + live-edit footer. The tab
 * shell is required by project memory `feedback_tabbed_detail_pane`
 * for parameter editors with 4+ logical sections; strongly-interacting
 * controls (Filter + TVF env; Amp + TVA env) live in the SAME tab.
 *
 * Composition root only — actual section JSX is split into
 * `panels/Tone{Wave,Pitch,Filter,Amp,Lfo}Panel.tsx` so this file
 * stays under the 300–500 line target.
 *
 * data-testid and data-capability contracts are preserved verbatim
 * from the pre-polish revision so legacy specs
 * (test/ui/tones.spec.ts) and capability specs
 * (test/ui/capabilities/tones.spec.ts) keep working unchanged:
 *
 *   - data-testid="tone-detail"
 *   - data-capability="C-TONE-04"
 *   - data-testid="tone-name-input"
 *   - data-testid="tone-original-key", "tone-loop-mode", "tone-output"
 *   - data-testid="tone-tvf-enabled", "tone-tvf-polarity", "tone-tvf-curve"
 *   - data-testid="tone-lfo-sync"
 *   - data-testid="tone-pitch-follow"
 *   - data-testid="tone-tva-curve"
 *   - data-testid="export-tone-button" / "export-sample-button" / "chop-tone-button"
 */

import type { SamplerTone } from '@/core/midi/SamplerClient';
import type { LoopEditorProps } from '@audiocontrol/loop-editor/ui';
import { useDeviceConfig } from '@/context/DeviceConfigContext';
import { ToneEditorHead } from './ToneEditorHead';
import { ToneEditorTabs } from './ToneEditorTabs';
import { ToneWavePanel } from './panels/ToneWavePanel';
import { TonePitchPanel } from './panels/TonePitchPanel';
import { ToneFilterPanel } from './panels/ToneFilterPanel';
import { ToneAmpPanel } from './panels/ToneAmpPanel';
import { ToneLfoPanel } from './panels/ToneLfoPanel';

interface ToneEditorProps {
  tone: SamplerTone;
  index: number;
  onUpdate?: (tone: SamplerTone) => void;
  onCommit?: (updatedTone?: SamplerTone) => void;
  onExportSample?: () => void;
  isExporting?: boolean;
  exportProgress?: number;
  onExportToLibrary?: () => void;
  isExportingToLibrary?: boolean;
  onImportSample?: () => void;
  isImporting?: boolean;
  onChopSample?: () => void;
  isLoadingChopWaveData?: boolean;
  waveData?: Int16Array | null;
  isLoadingWaveData?: boolean;
  waveDataLoadProgress?: number;
  onLoadWaveData?: () => void;
  loopEditorProps?: LoopEditorProps;
}

export function ToneEditor({
  tone,
  index,
  onUpdate,
  onCommit,
  onExportSample,
  isExporting = false,
  exportProgress,
  onExportToLibrary,
  isExportingToLibrary = false,
  onImportSample,
  isImporting = false,
  onChopSample,
  isLoadingChopWaveData = false,
  waveData,
  isLoadingWaveData = false,
  waveDataLoadProgress,
  onLoadWaveData,
  loopEditorProps,
}: ToneEditorProps) {
  const { deviceName } = useDeviceConfig();

  // Radio-group name must be unique per tone selection — otherwise React
  // would reuse the same DOM radios and the tab choice would leak across
  // tones. Key on the slot index so switching tones resets to the first
  // tab (Wave) cleanly.
  const tabGroupName = `tone-tab-${index}`;

  return (
    <article
      className="tones__detail"
      data-testid="tone-detail"
      data-capability="C-TONE-04"
    >
      <ToneEditorHead
        tone={tone}
        index={index}
        deviceName={deviceName}
        onUpdate={onUpdate}
        onCommit={onCommit}
        onExportSample={onExportSample}
        isExporting={isExporting}
        exportProgress={exportProgress}
        onExportToLibrary={onExportToLibrary}
        isExportingToLibrary={isExportingToLibrary}
        onImportSample={onImportSample}
        isImporting={isImporting}
        onChopSample={onChopSample}
        isLoadingChopWaveData={isLoadingChopWaveData}
      />

      <div className="tones__detail-body">
        <ToneEditorTabs
          groupName={tabGroupName}
          panels={{
            'tt-wave': (
              <ToneWavePanel
                tone={tone}
                onUpdate={onUpdate}
                onCommit={onCommit}
                waveData={waveData}
                isLoadingWaveData={isLoadingWaveData}
                waveDataLoadProgress={waveDataLoadProgress}
                onLoadWaveData={onLoadWaveData}
                loopEditorProps={loopEditorProps}
              />
            ),
            'tt-pitch': (
              <TonePitchPanel tone={tone} onUpdate={onUpdate} onCommit={onCommit} />
            ),
            'tt-filter': (
              <ToneFilterPanel tone={tone} onUpdate={onUpdate} onCommit={onCommit} />
            ),
            'tt-amp': (
              <ToneAmpPanel tone={tone} onUpdate={onUpdate} onCommit={onCommit} />
            ),
            'tt-lfo': (
              <ToneLfoPanel tone={tone} onUpdate={onUpdate} onCommit={onCommit} />
            ),
          }}
        />
      </div>

      {/* Live-status footer — replaces save / cancel / undo per project
          memory `feedback_live_editing_no_save`. Edits stream to the
          device in real time. */}
      <footer className="ac-detail-live" role="status" aria-live="polite">
        <span className="ac-detail-live-led" aria-hidden="true" />
        <span>Live edit · changes sent to device on commit</span>
      </footer>
    </article>
  );
}
