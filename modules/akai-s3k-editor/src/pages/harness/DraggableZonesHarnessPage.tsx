import { useEffect, useMemo, useState } from 'react';
import type { KeygroupHeader } from '@audiocontrol/sampler-devices/s3k';
import { useSearchParams } from 'react-router-dom';
import { KeygroupEditor, ZoneOverview } from '@/components/keygroups';
import { computeVisibleKeyRange } from '@/components/keygroups/note-coordinate';
import {
  buildCreatedKeygroup,
  type KeygroupCreationDraft,
} from '@/components/keygroups/keygroup-creation';
import {
  DRAGGABLE_ZONES_FIXTURES,
  getDraggableZonesFixture,
} from '@/pages/harness/draggable-zone-fixtures';

function cloneKeygroups(keygroups: KeygroupHeader[]): KeygroupHeader[] {
  return keygroups.map((keygroup) => ({
    ...keygroup,
    raw: [...keygroup.raw],
  }));
}

export function DraggableZonesHarnessPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const fixtureId = searchParams.get('fixture');
  const activeFixture = useMemo(
    () => getDraggableZonesFixture(fixtureId),
    [fixtureId],
  );

  const [keygroups, setKeygroups] = useState<KeygroupHeader[]>(() =>
    cloneKeygroups(activeFixture.keygroups),
  );
  const [selectedKeygroupIndex, setSelectedKeygroupIndex] = useState(0);

  useEffect(() => {
    setKeygroups(cloneKeygroups(activeFixture.keygroups));
    setSelectedKeygroupIndex(0);
  }, [activeFixture]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as unknown as Record<string, unknown>).__draggableZonesHarness = {
      fixtureId: activeFixture.id,
      keygroups,
      selectedKeygroupIndex,
    };
  }, [activeFixture.id, keygroups, selectedKeygroupIndex]);

  const selectedHeader = keygroups[selectedKeygroupIndex];
  const visibleRange = computeVisibleKeyRange(keygroups, keygroups.length);

  const handleFixtureChange = (nextFixtureId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('fixture', nextFixtureId);
    setSearchParams(nextParams, { replace: true });
  };

  const handleParameterChange = (field: string, value: number | string) => {
    setKeygroups((current) =>
      current.map((keygroup, index) =>
        index === selectedKeygroupIndex
          ? { ...keygroup, [field]: value, raw: [...keygroup.raw] }
          : keygroup,
      ),
    );
  };

  const handleReset = () => {
    setKeygroups(cloneKeygroups(activeFixture.keygroups));
    setSelectedKeygroupIndex(0);
  };

  const handleCreateKeygroup = (draft: KeygroupCreationDraft) => {
    setKeygroups((current) => {
      const template = current[selectedKeygroupIndex] ?? current[0];
      if (!template) return current;

      const created = buildCreatedKeygroup(template, draft);
      const next = [...current, created];
      setSelectedKeygroupIndex(next.length - 1);
      return next;
    });
  };

  return (
    <div
      className="ac-page ac-page-shell"
      data-testid="draggable-zones-harness"
    >
      <div className="ac-page-sticky-header">
        <div className="ac-page-header flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">Draggable Zones Harness</h2>
            <p className="text-sm text-gray-400 mt-1 max-w-3xl">
              Browser-only feature harness for the Akai keygroup zone surfaces.
              Uses local fixture state instead of device loaders so drag work can
              be developed and automated without hardware.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400" htmlFor="fixture-select">
              Fixture
            </label>
            <select
              id="fixture-select"
              data-testid="draggable-zones-fixture-select"
              value={activeFixture.id}
              onChange={(event) => handleFixtureChange(event.target.value)}
              className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
            >
              {DRAGGABLE_ZONES_FIXTURES.map((fixture) => (
                <option key={fixture.id} value={fixture.id}>
                  {fixture.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleReset}
              className="ac-btn ac-btn-sm"
              data-testid="draggable-zones-reset"
            >
              Reset Fixture
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pb-4">
        <div className="card p-4 mb-4">
          <div className="text-sm font-semibold text-gray-200">
            {activeFixture.label}
          </div>
          <p
            className="text-sm text-gray-400 mt-1"
            data-testid="draggable-zones-fixture-description"
          >
            {activeFixture.description}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Route can be automated directly with
            {' '}
            <code>?midi=mock&amp;fixture={activeFixture.id}</code>
            .
          </p>
        </div>

        <ZoneOverview
          keygroups={keygroups}
          keygroupCount={keygroups.length}
          selectedKeygroupIndex={selectedKeygroupIndex}
          onSelectKeygroup={setSelectedKeygroupIndex}
          onParameterChange={handleParameterChange}
          onCreateKeygroup={handleCreateKeygroup}
          visibleRange={visibleRange}
        />

        <div className="ac-list-detail-grid">
          <div className="ac-list-column-sticky">
            <div className="card p-3">
              <div className="text-sm font-semibold text-gray-200 mb-2">
                Keygroups
              </div>
              <div className="space-y-2">
                {keygroups.map((keygroup, index) => {
                  const isSelected = index === selectedKeygroupIndex;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedKeygroupIndex(index)}
                      data-testid={`harness-keygroup-${index}`}
                      className={`w-full text-left rounded border px-3 py-2 transition-colors ${
                        isSelected
                          ? 'border-blue-400 bg-blue-950/40 text-gray-100'
                          : 'border-gray-700 bg-gray-900 text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <div className="font-medium">KG {index + 1}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {keygroup.LONOTE} - {keygroup.HINOTE}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-4">
            {selectedHeader ? (
              <KeygroupEditor
                header={selectedHeader}
                keygroupIndex={selectedKeygroupIndex}
                sampleNames={activeFixture.sampleNames}
                onParameterChange={handleParameterChange}
                visibleRange={visibleRange}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
