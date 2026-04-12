import { useEffect, useCallback, useState } from 'react';
import { useProgramPlayer } from '@audiocontrol/synth-core';
import { useLibraryConnection } from '@audiocontrol/editor-core';
import { useProgramEditorStore } from '@/stores/programEditorStore';
import { useDemoProgram } from '@/hooks/use-demo-program';
import { Keyboard } from '@/components/Keyboard';
import { useWebMidiInput } from '@/hooks/use-web-midi-input';
import { ZoneList } from '@/components/program-editor/ZoneList';
import { ZoneMapOverview } from '@/components/program-editor/ZoneMapOverview';
import { PitchSection } from '@/components/program-editor/PitchSection';
import { AmpEnvelopeSection } from '@/components/program-editor/AmpEnvelopeSection';
import { FilterSection } from '@/components/program-editor/FilterSection';
import { RangeSection } from '@/components/program-editor/RangeSection';
import { saveProgramToLibrary } from '@/lib/save-program';

export function ProgramPage(): JSX.Element {
  const demoProgram = useDemoProgram();
  const store = useProgramEditorStore();
  const program = store.program;
  const selectedIndex = store.selectedZoneIndex;
  const { root } = useLibraryConnection({ pickerId: 'standalone-sampler-library' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load demo program on first visit if nothing loaded
  useEffect(() => {
    if (!program) {
      store.loadProgram(demoProgram);
    }
  }, [program, demoProgram, store]);

  // Wire synth engine to the current program state
  const { noteOn, noteOff, stopAll, activeNotes } = useProgramPlayer({
    program: program,
  });

  const handleNoteOn = useCallback(
    (note: number, velocity: number) => noteOn(note, velocity),
    [noteOn],
  );
  const handleNoteOff = useCallback(
    (note: number) => noteOff(note),
    [noteOff],
  );

  useWebMidiInput({ onNoteOn: handleNoteOn, onNoteOff: handleNoteOff });

  const handleSave = useCallback(async () => {
    if (!program || !root) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveProgramToLibrary(root, program);
      store.loadProgram(program); // clears dirty flag
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [program, root, store]);

  if (!program) {
    return (
      <div className="p-4 text-sampler-muted">
        No program loaded. Go to Library to load a program.
      </div>
    );
  }

  const selectedZone = program.zones[selectedIndex];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-sampler-border">
        <input
          className="text-lg font-semibold bg-transparent border-none outline-none text-sampler-text flex-1"
          value={program.name}
          onChange={(e) => store.updateProgramName(e.target.value)}
        />
        <div className="flex gap-2 text-xs">
          <button
            className={`px-2 py-1 rounded ${program.polyphony === 'poly' ? 'bg-sampler-highlight text-sampler-text' : 'bg-sampler-border text-sampler-muted'}`}
            onClick={() => store.updatePolyphony(program.polyphony === 'poly' ? 'mono' : 'poly')}
          >
            {program.polyphony === 'poly' ? 'Poly' : 'Mono'}
          </button>
          <button
            className={`px-2 py-1 rounded ${program.playbackMode === 'gate' ? 'bg-sampler-highlight text-sampler-text' : 'bg-sampler-border text-sampler-muted'}`}
            onClick={() => store.updatePlaybackMode(program.playbackMode === 'gate' ? 'one-shot' : 'gate')}
          >
            {program.playbackMode === 'gate' ? 'Gate' : 'One-Shot'}
          </button>
          <button
            onClick={stopAll}
            className="px-2 py-1 rounded bg-sampler-border text-sampler-muted hover:text-sampler-text"
          >
            Stop All
          </button>
          {root && store.dirty && (
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="px-2 py-1 rounded bg-sampler-highlight text-sampler-text disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
        {store.dirty && !root && (
          <span className="text-xs text-sampler-muted">Connect library to save</span>
        )}
        {saveError && (
          <span className="text-xs text-red-400">{saveError}</span>
        )}
      </div>

      {/* Main content: zone list + parameter editor */}
      <div className="flex flex-1 min-h-0">
        {/* Zone list sidebar */}
        <div className="w-48 flex-shrink-0 border-r border-sampler-border p-2 overflow-y-auto">
          <ZoneList
            zones={program.zones}
            selectedIndex={selectedIndex}
            onSelect={store.selectZone}
            onRemove={store.removeZone}
            onMoveUp={(i) => store.moveZone(i, i - 1)}
            onMoveDown={(i) => store.moveZone(i, i + 1)}
          />
        </div>

        {/* Parameter editor */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Zone map overview */}
          <div className="mb-4">
            <ZoneMapOverview
              zones={program.zones}
              selectedIndex={selectedIndex}
              onSelect={store.selectZone}
            />
          </div>

          {selectedZone && (
            <div className="flex flex-col gap-3">
              {/* Zone label */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-sampler-muted">Label:</span>
                <input
                  className="text-sm bg-transparent border-b border-sampler-border outline-none text-sampler-text px-1"
                  value={selectedZone.label ?? ''}
                  onChange={(e) => store.updateZoneLabel(selectedIndex, e.target.value)}
                  placeholder={`Zone ${selectedIndex + 1}`}
                />
              </div>

              <RangeSection
                keyRange={selectedZone.keyRange}
                velocityRange={selectedZone.velocityRange}
                muteGroup={selectedZone.muteGroup}
                onKeyRangeChange={(r) => store.updateZoneKeyRange(selectedIndex, r)}
                onVelocityRangeChange={(r) => store.updateZoneVelocityRange(selectedIndex, r)}
                onMuteGroupChange={(g) => store.updateZoneMuteGroup(selectedIndex, g)}
              />

              <PitchSection
                pitch={selectedZone.pitch}
                onChange={(p) => store.updateZonePitch(selectedIndex, p)}
              />

              <AmpEnvelopeSection
                envelope={selectedZone.ampEnvelope}
                onChange={(e) => store.updateZoneAmpEnvelope(selectedIndex, e)}
              />

              <FilterSection
                filter={selectedZone.filter}
                onChange={(f) => store.updateZoneFilter(selectedIndex, f)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Keyboard at bottom */}
      <div className="border-t border-sampler-border px-4 py-2">
        <Keyboard
          lowNote={36}
          highNote={96}
          activeNotes={activeNotes}
          onNoteOn={handleNoteOn}
          onNoteOff={handleNoteOff}
        />
      </div>
    </div>
  );
}
