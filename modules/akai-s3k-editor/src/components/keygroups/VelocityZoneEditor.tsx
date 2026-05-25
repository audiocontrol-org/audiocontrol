import { useState, useCallback, useEffect, useRef } from 'react';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { AcRadioTabs, type AcRadioTabDef } from '@audiocontrol/editor-core';
import { S3kParamRow } from '@/components/ui/S3kParamRow';
import { S3kParamSelectRow } from '@/components/ui/S3kParamSelectRow';
import { VelocityRangeBar } from '@/components/keygroups/VelocityRangeBar';

interface VelocityZoneEditorProps {
  header: KeygroupHeader;
  sampleNames: string[];
  onParameterChange: (field: string, value: number | string) => void;
}

const ZONE_INDICES = [1, 2, 3, 4] as const;
type ZoneIndex = (typeof ZONE_INDICES)[number];

const PLAYBACK_MODE_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'As Sample' },
  { value: 1, label: 'Loop In Release' },
  { value: 2, label: 'Loop Til Release' },
  { value: 3, label: 'No Loops' },
  { value: 4, label: 'Play To End' },
];

function zoneField(base: string, zone: ZoneIndex): string {
  return `${base}${zone}`;
}

// Dynamic field access requires casting through unknown because KeygroupHeader
// has no index signature. The field names (e.g. LOVEL1, HIVEL2) are known at
// the call site but computed at runtime via string concatenation.
function getZoneValue(header: KeygroupHeader, base: string, zone: ZoneIndex): number {
  return (header as unknown as Record<string, unknown>)[zoneField(base, zone)] as number;
}

function getZoneString(header: KeygroupHeader, base: string, zone: ZoneIndex): string {
  return (header as unknown as Record<string, unknown>)[zoneField(base, zone)] as string;
}

function SampleList({
  value,
  sampleNames,
  onChange,
}: {
  value: string;
  sampleNames: string[];
  onChange: (name: string) => void;
}): JSX.Element {
  const trimmed = value.trim();
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [trimmed]);

  return (
    <div className="s3k-sample-list">
      <button
        type="button"
        ref={trimmed === '' ? selectedRef : undefined}
        onClick={() => onChange('')}
        className={`s3k-sample-list-item ${trimmed === '' ? 's3k-sample-list-item--selected' : ''}`}
      >
        (none)
      </button>
      {sampleNames.map((name) => {
        const t = name.trim();
        const isSelected = t === trimmed;
        return (
          <button
            key={name}
            type="button"
            ref={isSelected ? selectedRef : undefined}
            onClick={() => onChange(t)}
            className={`s3k-sample-list-item ${isSelected ? 's3k-sample-list-item--selected' : ''}`}
          >
            {t || '(unnamed)'}
          </button>
        );
      })}
    </div>
  );
}

function SingleZoneEditor({
  zone,
  header,
  sampleNames,
  onParameterChange,
}: {
  zone: ZoneIndex;
  header: KeygroupHeader;
  sampleNames: string[];
  onParameterChange: (field: string, value: number | string) => void;
}): JSX.Element {
  const num = (base: string) => (v: number) =>
    onParameterChange(zoneField(base, zone), v);

  const sampleName = getZoneString(header, 'SNAME', zone);

  return (
    <div className="s3k-zone-editor">
      {/* Left: sample list */}
      <div className="s3k-zone-sample-panel">
        <div className="s3k-section-title">Sample</div>
        <SampleList
          value={sampleName}
          sampleNames={sampleNames}
          onChange={(name) => onParameterChange(zoneField('SNAME', zone), name)}
        />
      </div>

      {/* Right: zone parameters in dense grid */}
      <div className="s3k-zone-params">
        <div className="s3k-section-grid">
          <S3kParamRow label="Lo Vel" value={getZoneValue(header, 'LOVEL', zone)} min={0} max={127} onChange={num('LOVEL')} />
          <S3kParamRow label="Hi Vel" value={getZoneValue(header, 'HIVEL', zone)} min={0} max={127} onChange={num('HIVEL')} />
          <S3kParamRow label="Tune" value={getZoneValue(header, 'VTUNO', zone)} min={-50} max={50} onChange={num('VTUNO')} bipolar />
          <S3kParamRow label="Loudness" value={getZoneValue(header, 'VLOUD', zone)} min={-50} max={50} onChange={num('VLOUD')} bipolar />
          <S3kParamRow label="Filter" value={getZoneValue(header, 'VFREQ', zone)} min={-50} max={50} onChange={num('VFREQ')} bipolar />
          <S3kParamRow label="Pan" value={getZoneValue(header, 'VPANO', zone)} min={-50} max={50} onChange={num('VPANO')} bipolar />
          <S3kParamSelectRow label="Playback" value={getZoneValue(header, 'ZPLAY', zone)} options={PLAYBACK_MODE_OPTIONS} onChange={num('ZPLAY')} />
        </div>
      </div>
    </div>
  );
}

export function VelocityZoneEditor({
  header,
  sampleNames,
  onParameterChange,
}: VelocityZoneEditorProps): JSX.Element {
  const [activeZone, setActiveZone] = useState<ZoneIndex>(1);

  const velocityZones = ZONE_INDICES.map((zone) => ({
    lowVel: getZoneValue(header, 'LOVEL', zone),
    highVel: getZoneValue(header, 'HIVEL', zone),
    sampleName: getZoneString(header, 'SNAME', zone),
  }));

  const handleSplitDrag = useCallback(
    (splitIndex: number, velocity: number) => {
      const leftZone = ZONE_INDICES[splitIndex];
      const rightZone = ZONE_INDICES[splitIndex + 1];
      if (leftZone !== undefined && rightZone !== undefined) {
        onParameterChange(zoneField('HIVEL', leftZone), velocity);
        onParameterChange(zoneField('LOVEL', rightZone), velocity + 1);
      }
    },
    [onParameterChange],
  );

  // Build the AcRadioTabs tabs[] + panels{} from the four zone indices.
  // Tab label inlines the sample name when present so the operator sees
  // which zone holds which sample without needing a per-tab secondary
  // slot. If a future design needs a dedicated secondary-text slot per
  // tab, the right move is to extend AcRadioTabDef with an optional
  // `secondaryLabel?:` field rather than re-introducing a parallel
  // chrome primitive here.
  const tabs: readonly AcRadioTabDef[] = ZONE_INDICES.map((zone) => {
    const sname = getZoneString(header, 'SNAME', zone).trim();
    return {
      id: `vz-zone-${zone}`,
      label: sname ? `Zone ${zone} — ${sname}` : `Zone ${zone}`,
    };
  });

  const panels: Record<string, JSX.Element> = Object.fromEntries(
    ZONE_INDICES.map((zone) => [
      `vz-zone-${zone}`,
      <SingleZoneEditor
        key={zone}
        zone={zone}
        header={header}
        sampleNames={sampleNames}
        onParameterChange={onParameterChange}
      />,
    ]),
  );

  return (
    <div>
      <VelocityRangeBar
        zones={velocityZones}
        selectedZone={activeZone - 1}
        onSelectZone={(index) => setActiveZone(ZONE_INDICES[index])}
        onSplitDrag={handleSplitDrag}
        onSplitCommit={handleSplitDrag}
      />

      <AcRadioTabs
        tabs={tabs}
        panels={panels}
        activeId={`vz-zone-${activeZone}`}
        onActiveIdChange={(id) => {
          const zoneNum = Number(id.replace('vz-zone-', ''));
          if (zoneNum >= 1 && zoneNum <= 4) {
            setActiveZone(zoneNum as ZoneIndex);
          }
        }}
        groupName="velocity-zone-tabs"
        ariaLabel="Velocity zone selector"
      />
    </div>
  );
}
