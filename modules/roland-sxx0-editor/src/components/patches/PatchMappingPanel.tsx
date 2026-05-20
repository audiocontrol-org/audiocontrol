/**
 * PatchEditor — Tone Mapping panel.
 *
 * Renders the Layer 1 + Layer 2 zone editors plus the load-state
 * readout. Extracted from `PatchEditor.tsx` when the editor moved to
 * a tabbed shell.
 */

import type { SamplerKeyMode, SamplerTone } from '@/core/midi/SamplerClient';
import { ToneZoneEditor } from './ToneZoneEditor';

export interface PatchMappingPanelProps {
  keyMode: SamplerKeyMode;
  toneLayer1: number[];
  toneLayer2: number[];
  tones: (SamplerTone | undefined)[];
  onLayer1Update: (data: number[]) => void;
  onLayer2Update: (data: number[]) => void;
}

export function PatchMappingPanel({
  keyMode,
  toneLayer1,
  toneLayer2,
  tones,
  onLayer1Update,
  onLayer2Update,
}: PatchMappingPanelProps) {
  const loadedTonesCount = tones.filter((t) => t !== undefined).length;
  const namedTonesCount = tones.filter(
    (t) => t !== undefined && t.name.trim(),
  ).length;

  return (
    <div className="ac-panel-stack">
      <header className="patches__mapping-head">
        <span>Tone Mapping</span>
        <span className="patches__mapping-meta">
          {loadedTonesCount} tones loaded · {namedTonesCount} named
        </span>
      </header>

      <div className="patches__mapping-stack">
        <ToneZoneEditor
          layer={1}
          toneData={toneLayer1}
          keyMode={keyMode}
          tones={tones}
          onUpdate={onLayer1Update}
        />
        <ToneZoneEditor
          layer={2}
          toneData={toneLayer2}
          keyMode={keyMode}
          tones={tones}
          onUpdate={onLayer2Update}
        />
      </div>
    </div>
  );
}
