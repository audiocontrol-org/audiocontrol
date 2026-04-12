import { ParameterSlider, CollapsibleSection, formatPitch } from '@audiocontrol/editor-core';
import { sliderTheme, sectionTheme } from '@/components/program-editor/theme';

interface RangeSectionProps {
  keyRange: [number, number];
  velocityRange: [number, number];
  muteGroup: number;
  onKeyRangeChange: (range: [number, number]) => void;
  onVelocityRangeChange: (range: [number, number]) => void;
  onMuteGroupChange: (group: number) => void;
}

export function RangeSection({
  keyRange,
  velocityRange,
  muteGroup,
  onKeyRangeChange,
  onVelocityRangeChange,
  onMuteGroupChange,
}: RangeSectionProps): JSX.Element {
  return (
    <CollapsibleSection title="Range" defaultOpen theme={sectionTheme}>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <ParameterSlider
          label="Low Key"
          value={keyRange[0]}
          min={0}
          max={127}
          onChange={(v) => onKeyRangeChange([v, Math.max(v, keyRange[1])])}
          formatValue={formatPitch}
          theme={sliderTheme}
        />
        <ParameterSlider
          label="High Key"
          value={keyRange[1]}
          min={0}
          max={127}
          onChange={(v) => onKeyRangeChange([Math.min(keyRange[0], v), v])}
          formatValue={formatPitch}
          theme={sliderTheme}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <ParameterSlider
          label="Low Velocity"
          value={velocityRange[0]}
          min={1}
          max={127}
          onChange={(v) => onVelocityRangeChange([v, Math.max(v, velocityRange[1])])}
          theme={sliderTheme}
        />
        <ParameterSlider
          label="High Velocity"
          value={velocityRange[1]}
          min={1}
          max={127}
          onChange={(v) => onVelocityRangeChange([Math.min(velocityRange[0], v), v])}
          theme={sliderTheme}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <ParameterSlider
          label="Mute Group"
          value={muteGroup}
          min={0}
          max={16}
          onChange={onMuteGroupChange}
          formatValue={(v) => v === 0 ? 'Off' : String(v)}
          theme={sliderTheme}
        />
      </div>
    </CollapsibleSection>
  );
}
