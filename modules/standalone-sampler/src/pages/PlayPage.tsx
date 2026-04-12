import { useCallback } from 'react';
import { useProgramPlayer } from '@audiocontrol/synth-core';
import { Keyboard } from '@/components/Keyboard';
import { EffectsPanel } from '@/components/EffectsPanel';
import { useWebMidiInput } from '@/hooks/use-web-midi-input';
import { useDemoProgram } from '@/hooks/use-demo-program';
import { useEffectsStore } from '@/stores/effectsStore';
import { useMidiLearnStore } from '@/stores/midiLearnStore';

export function PlayPage(): JSX.Element {
  const program = useDemoProgram();
  const effects = useEffectsStore((s) => s.effects);
  const { noteOn, noteOff, stopAll, activeNotes } = useProgramPlayer({ program, effects });

  const handleNoteOn = useCallback(
    (note: number, velocity: number) => {
      noteOn(note, velocity);
    },
    [noteOn],
  );

  const handleNoteOff = useCallback(
    (note: number) => {
      noteOff(note);
    },
    [noteOff],
  );

  const handleCc = useMidiLearnStore((s) => s.handleCc);

  useWebMidiInput({
    onNoteOn: handleNoteOn,
    onNoteOff: handleNoteOff,
    onCc: handleCc,
  });

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{program.name}</h1>
          <p className="text-sm text-sampler-muted">
            {program.zones.length} zone{program.zones.length !== 1 ? 's' : ''} &middot;{' '}
            {program.polyphony} &middot; {program.playbackMode}
          </p>
        </div>
        <button
          onClick={stopAll}
          className="px-3 py-1 text-sm rounded bg-sampler-accent hover:bg-sampler-highlight text-sampler-text"
        >
          Stop All
        </button>
      </div>

      <EffectsPanel />

      <div className="mt-auto">
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
