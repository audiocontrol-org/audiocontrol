import { ParameterSlider, CollapsibleSection, formatPitch, formatSigned } from '@audiocontrol/editor-core';
import type { PitchParams } from '@audiocontrol/synth-core';
import { sliderTheme, sectionTheme } from '@/components/program-editor/theme';

interface PitchSectionProps {
  pitch: PitchParams;
  onChange: (pitch: Partial<PitchParams>) => void;
}

export function PitchSection({ pitch, onChange }: PitchSectionProps): JSX.Element {
  return (
    <CollapsibleSection title="Pitch" defaultOpen theme={sectionTheme}>
      <div className="grid grid-cols-3 gap-3">
        <ParameterSlider
          label="Root Key"
          value={pitch.rootKey}
          min={0}
          max={127}
          onChange={(v) => onChange({ rootKey: v })}
          formatValue={formatPitch}
          theme={sliderTheme}
        />
        <ParameterSlider
          label="Transpose"
          value={pitch.transpose + 64}
          min={0}
          max={127}
          onChange={(v) => onChange({ transpose: v - 64 })}
          formatValue={(v) => formatSigned(v, 64)}
          theme={sliderTheme}
        />
        <ParameterSlider
          label="Fine Tune"
          value={pitch.fineTune + 64}
          min={0}
          max={127}
          onChange={(v) => onChange({ fineTune: v - 64 })}
          formatValue={(v) => `${formatSigned(v, 64)} ct`}
          theme={sliderTheme}
        />
      </div>
    </CollapsibleSection>
  );
}
