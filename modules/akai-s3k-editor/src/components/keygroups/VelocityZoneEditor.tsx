import { useState, useCallback } from 'react';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { ParameterRow, NumberInput, SelectInput } from '@/components/ui';
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

function SampleNameSelect({
  value,
  sampleNames,
  onChange,
}: {
  value: string;
  sampleNames: string[];
  onChange: (name: string) => void;
}): JSX.Element {
  const trimmed = value.trim();
  return (
    <select
      value={trimmed}
      onChange={(e) => onChange(e.target.value)}
      className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 max-w-xs"
    >
      <option value="">(none)</option>
      {sampleNames.map((name) => (
        <option key={name} value={name.trim()}>
          {name.trim() || '(unnamed)'}
        </option>
      ))}
    </select>
  );
}

/** Typed accessor for zone-suffixed keygroup header fields */
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
  const changeNum = (base: string) => (v: number) =>
    onParameterChange(zoneField(base, zone), v);

  const sampleName = getZoneString(header, 'SNAME', zone);

  return (
    <div className="divide-y divide-gray-800">
      <ParameterRow label="Sample">
        <SampleNameSelect
          value={sampleName}
          sampleNames={sampleNames}
          onChange={(name) => onParameterChange(zoneField('SNAME', zone), name)}
        />
      </ParameterRow>
      <ParameterRow label="Low Velocity">
        <NumberInput
          value={getZoneValue(header, 'LOVEL', zone)}
          min={0}
          max={127}
          onChange={changeNum('LOVEL')}
        />
      </ParameterRow>
      <ParameterRow label="High Velocity">
        <NumberInput
          value={getZoneValue(header, 'HIVEL', zone)}
          min={0}
          max={127}
          onChange={changeNum('HIVEL')}
        />
      </ParameterRow>
      <ParameterRow label="Tuning Offset">
        <NumberInput
          value={getZoneValue(header, 'VTUNO', zone)}
          min={-50}
          max={50}
          onChange={changeNum('VTUNO')}
        />
      </ParameterRow>
      <ParameterRow label="Loudness Offset">
        <NumberInput
          value={getZoneValue(header, 'VLOUD', zone)}
          min={-50}
          max={50}
          onChange={changeNum('VLOUD')}
        />
      </ParameterRow>
      <ParameterRow label="Filter Freq Offset">
        <NumberInput
          value={getZoneValue(header, 'VFREQ', zone)}
          min={-50}
          max={50}
          onChange={changeNum('VFREQ')}
        />
      </ParameterRow>
      <ParameterRow label="Pan Offset">
        <NumberInput
          value={getZoneValue(header, 'VPANO', zone)}
          min={-50}
          max={50}
          onChange={changeNum('VPANO')}
        />
      </ParameterRow>
      <ParameterRow label="Playback Mode">
        <SelectInput
          value={getZoneValue(header, 'ZPLAY', zone)}
          options={PLAYBACK_MODE_OPTIONS}
          onChange={changeNum('ZPLAY')}
        />
      </ParameterRow>
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
      // splitIndex 0 = boundary between zone 1 and zone 2
      const leftZone = ZONE_INDICES[splitIndex];
      const rightZone = ZONE_INDICES[splitIndex + 1];
      if (leftZone !== undefined && rightZone !== undefined) {
        onParameterChange(zoneField('HIVEL', leftZone), velocity);
        onParameterChange(zoneField('LOVEL', rightZone), velocity + 1);
      }
    },
    [onParameterChange],
  );

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden mb-3">
      <div className="bg-gray-800 px-3 py-2 text-sm font-medium">Velocity Zones</div>

      <VelocityRangeBar
        zones={velocityZones}
        selectedZone={activeZone - 1}
        onSelectZone={(index) => setActiveZone(ZONE_INDICES[index])}
        onSplitDrag={handleSplitDrag}
        onSplitCommit={handleSplitDrag}
      />

      <div className="flex border-b border-gray-700">
        {ZONE_INDICES.map((zone) => {
          const sname = getZoneString(header, 'SNAME', zone).trim();
          const isActive = activeZone === zone;
          return (
            <button
              key={zone}
              type="button"
              onClick={() => setActiveZone(zone)}
              className={`flex-1 px-3 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-gray-700 text-gray-100 font-medium'
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-gray-300'
              }`}
            >
              <div>Zone {zone}</div>
              {sname && (
                <div className="text-xs truncate mt-0.5 opacity-75">{sname}</div>
              )}
            </button>
          );
        })}
      </div>

      <SingleZoneEditor
        zone={activeZone}
        header={header}
        sampleNames={sampleNames}
        onParameterChange={onParameterChange}
      />
    </div>
  );
}
