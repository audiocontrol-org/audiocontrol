import { useState, useCallback } from 'react';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { makeKeygroupHeader } from '@/test-helpers/keygroup-factory';
import { ZoneOverview } from '@/components/keygroups/ZoneOverview';
import { KeyRangeEditor } from '@/components/keygroups/KeyRangeEditor';
import { VelocityRangeBar } from '@/components/keygroups/VelocityRangeBar';
import { computeKeyRange } from '@/components/keygroups/note-coordinate-utils';

const VELOCITY_MAX = 127;

function buildInitialKeygroups(): KeygroupHeader[] {
  return [
    makeKeygroupHeader({
      LONOTE: 36,
      HINOTE: 59,
      LOVEL1: 0,
      HIVEL1: 60,
      SNAME1: 'Bass Soft   ',
      LOVEL2: 61,
      HIVEL2: 127,
      SNAME2: 'Bass Hard   ',
    }),
    makeKeygroupHeader({
      LONOTE: 60,
      HINOTE: 72,
      LOVEL1: 0,
      HIVEL1: 127,
      SNAME1: 'Piano Mid   ',
    }),
    makeKeygroupHeader({
      LONOTE: 48,
      HINOTE: 84,
      LOVEL1: 0,
      HIVEL1: 80,
      SNAME1: 'Strings Lo  ',
      LOVEL2: 81,
      HIVEL2: 127,
      SNAME2: 'Strings Hi  ',
    }),
    makeKeygroupHeader({
      LONOTE: 24,
      HINOTE: 48,
      LOVEL1: 0,
      HIVEL1: 42,
      SNAME1: 'Sub Bass    ',
      LOVEL2: 43,
      HIVEL2: 85,
      SNAME2: 'Mid Layer   ',
      LOVEL3: 86,
      HIVEL3: 127,
      SNAME3: 'Top Layer   ',
    }),
  ];
}

function getVelocityZonesForBar(
  kg: KeygroupHeader,
): { lowVel: number; highVel: number; sampleName: string }[] {
  const zones: { lowVel: number; highVel: number; sampleName: string }[] = [];
  const candidates = [
    { lo: kg.LOVEL1, hi: kg.HIVEL1, name: kg.SNAME1 },
    { lo: kg.LOVEL2, hi: kg.HIVEL2, name: kg.SNAME2 },
    { lo: kg.LOVEL3, hi: kg.HIVEL3, name: kg.SNAME3 },
    { lo: kg.LOVEL4, hi: kg.HIVEL4, name: kg.SNAME4 },
  ];

  for (const c of candidates) {
    if (c.name.trim() !== '' || c.hi > 0) {
      zones.push({ lowVel: c.lo, highVel: c.hi, sampleName: c.name });
    }
  }
  return zones;
}

export function TestKeygroupsPage(): JSX.Element {
  const [keygroups, setKeygroups] = useState<KeygroupHeader[]>(
    buildInitialKeygroups,
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(0);
  const [selectedVelocityZones, setSelectedVelocityZones] = useState<
    Record<number, number>
  >({});

  const noteRange = computeKeyRange(keygroups, keygroups.length);

  const handleKeyRangeChange = useCallback(
    (kgIndex: number, field: 'LONOTE' | 'HINOTE', value: number) => {
      setKeygroups((prev) => {
        const next = [...prev];
        next[kgIndex] = { ...next[kgIndex], [field]: value };
        return next;
      });
    },
    [],
  );

  const handleZoneDrag = useCallback(
    (kgIndex: number, field: string, value: number) => {
      setKeygroups((prev) => {
        const next = [...prev];
        next[kgIndex] = { ...next[kgIndex], [field]: value };
        return next;
      });
    },
    [],
  );

  const handleSplitDrag = useCallback(
    (kgIndex: number, splitIndex: number, velocity: number) => {
      setKeygroups((prev) => {
        const next = [...prev];
        const kg = { ...next[kgIndex] };
        // splitIndex 0 = boundary between velocity zone 1 and zone 2
        // Velocity zone fields are 1-indexed (LOVEL1, HIVEL1, etc.)
        const leftZone = splitIndex + 1;
        const rightZone = splitIndex + 2;
        const hivelField = `HIVEL${leftZone}`;
        const lovelField = `LOVEL${rightZone}`;
        // Guideline deviation: using `as unknown as Record` for dynamic field access
        // on KeygroupHeader. The field names are computed at runtime via string
        // concatenation but are valid KeygroupHeader fields (HIVEL1-4, LOVEL1-4).
        // Same pattern as VelocityZoneEditor.tsx. Should not be copied elsewhere.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const record = kg as unknown as Record<string, number>;
        record[hivelField] = velocity;
        record[lovelField] = Math.min(velocity + 1, VELOCITY_MAX);
        next[kgIndex] = kg;
        return next;
      });
    },
    [],
  );

  const handleSelectVelocityZone = useCallback(
    (kgIndex: number, zoneIndex: number) => {
      setSelectedVelocityZones((prev) => ({ ...prev, [kgIndex]: zoneIndex }));
    },
    [],
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#111827',
        color: '#e5e7eb',
        padding: '24px',
      }}
    >
      <h1
        style={{
          fontSize: '20px',
          fontWeight: 600,
          marginBottom: '16px',
          color: '#93c5fd',
        }}
      >
        Keygroup Zone Test Harness
      </h1>

      <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '24px' }}>
        Standalone test page -- no device, no store. Drag the key range handles
        to verify alignment between ZoneOverview and per-keygroup editors.
      </p>

      {/* Zone Overview */}
      <section style={{ marginBottom: '32px' }}>
        <h2
          style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '8px' }}
        >
          ZoneOverview ({keygroups.length} keygroups)
        </h2>
        <ZoneOverview
          keygroups={keygroups}
          keygroupCount={keygroups.length}
          selectedKeygroupIndex={selectedIndex}
          onSelectKeygroup={setSelectedIndex}
          noteRange={noteRange}
          onZoneDrag={handleZoneDrag}
          onZoneCommit={handleZoneDrag}
        />
      </section>

      {/* Per-keygroup detail editors */}
      <section>
        <h2
          style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '12px' }}
        >
          Per-Keygroup Editors
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {keygroups.map((kg, index) => {
            const isSelected = selectedIndex === index;
            const velZones = getVelocityZonesForBar(kg);
            const selectedVelZone = selectedVelocityZones[index] ?? 0;

            return (
              <div
                key={index}
                onClick={() => setSelectedIndex(index)}
                style={{
                  background: isSelected
                    ? 'rgba(59, 130, 246, 0.1)'
                    : 'rgba(31, 41, 55, 0.5)',
                  border: isSelected
                    ? '1px solid #3b82f6'
                    : '1px solid #374151',
                  borderRadius: '8px',
                  padding: '12px',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    marginBottom: '8px',
                    color: isSelected ? '#93c5fd' : '#d1d5db',
                  }}
                >
                  Keygroup {index + 1} -- Notes {kg.LONOTE}-{kg.HINOTE}
                </div>

                <KeyRangeEditor
                  lowNote={kg.LONOTE}
                  highNote={kg.HINOTE}
                  onChange={(field, value) =>
                    handleKeyRangeChange(index, field, value)
                  }
                  noteRange={noteRange}
                />

                {velZones.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div
                      style={{
                        fontSize: '11px',
                        color: '#6b7280',
                        marginBottom: '4px',
                      }}
                    >
                      Velocity Zones
                    </div>
                    <VelocityRangeBar
                      zones={velZones}
                      selectedZone={selectedVelZone}
                      onSelectZone={(zoneIdx) =>
                        handleSelectVelocityZone(index, zoneIdx)
                      }
                      onSplitDrag={(splitIdx, vel) =>
                        handleSplitDrag(index, splitIdx, vel)
                      }
                      onSplitCommit={(splitIdx, vel) =>
                        handleSplitDrag(index, splitIdx, vel)
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
