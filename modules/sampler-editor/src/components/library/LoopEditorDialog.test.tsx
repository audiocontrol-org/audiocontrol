/**
 * Component integration tests for LoopEditorDialog.
 *
 * Tests the dialog chrome around the shared useLoopEditor hook:
 * MIDI voice count indicator, save button, header display, and
 * dialog open/close behavior.
 *
 * The LoopEditor component and useLoopEditor hook are mocked.
 * synth-core's createWebMidiNoteInput is mocked to prevent
 * browser MIDI access requests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoopEditorDialog } from '@/components/library/LoopEditorDialog';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Track useLoopEditor return values for assertions
let mockLoopEditorReturn = {
  loopPoint: 1000,
  endPoint: 4000,
  setLoopPoint: vi.fn(),
  setEndPoint: vi.fn(),
  isSearching: false,
  searchProgress: 0,
  candidates: [],
  selectedCandidateIndex: undefined as number | undefined,
  setSelectedCandidateIndex: vi.fn(),
  handleAutoDetect: vi.fn(),
  handleApplyCandidate: vi.fn(),
  audio: {
    play: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    getState: () => ({ playing: false, currentTime: 0, duration: 0 }),
    onStateChange: vi.fn(),
    createBuffer: vi.fn(),
  },
  activeNotes: new Set<number>(),
  resetForNewSamples: vi.fn(),
};

let lastUseLoopEditorParams: Record<string, unknown> = {};

vi.mock('@audiocontrol/loop-editor/ui', () => ({
  LoopEditor: (props: {
    loopPoint: number;
    endPoint: number;
    onLoopPointChange?: (v: number) => void;
    onEndPointChange?: (v: number) => void;
  }) => (
    <div data-testid="loop-editor-stub">
      <span data-testid="loop-point">{props.loopPoint}</span>
      <span data-testid="end-point">{props.endPoint}</span>
      <button
        data-testid="change-loop-point"
        onClick={() => props.onLoopPointChange?.(5000)}
      >
        Change Loop Point
      </button>
      <button
        data-testid="change-end-point"
        onClick={() => props.onEndPointChange?.(20000)}
      >
        Change End Point
      </button>
    </div>
  ),
  useLoopEditor: (params: Record<string, unknown>) => {
    lastUseLoopEditorParams = params;
    return mockLoopEditorReturn;
  },
}));

vi.mock('@audiocontrol/synth-core', () => ({
  createWebMidiNoteInput: () => Promise.resolve({
    onNoteOn: vi.fn(),
    onNoteOff: vi.fn(),
    dispose: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_SAMPLES = new Int16Array([0, 1000, -1000, 500, -500]);
const TEST_SAMPLE_RATE = 44100;

function renderDialog(props: Partial<React.ComponentProps<typeof LoopEditorDialog>> = {}) {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    samples: TEST_SAMPLES,
    sampleRate: TEST_SAMPLE_RATE,
    sampleName: 'test-tone',
    ...props,
  };
  return render(<LoopEditorDialog {...defaultProps} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoopEditorDialog — synth-core integration', () => {
  beforeEach(() => {
    lastUseLoopEditorParams = {};
    mockLoopEditorReturn = {
      loopPoint: 1000,
      endPoint: 4000,
      setLoopPoint: vi.fn(),
      setEndPoint: vi.fn(),
      isSearching: false,
      searchProgress: 0,
      candidates: [],
      selectedCandidateIndex: undefined,
      setSelectedCandidateIndex: vi.fn(),
      handleAutoDetect: vi.fn(),
      handleApplyCandidate: vi.fn(),
      audio: {
        play: vi.fn(),
        stop: vi.fn(),
        seek: vi.fn(),
        getState: () => ({ playing: false, currentTime: 0, duration: 0 }),
        onStateChange: vi.fn(),
        createBuffer: vi.fn(),
      },
      activeNotes: new Set(),
      resetForNewSamples: vi.fn(),
    };
  });

  describe('useLoopEditor wiring', () => {
    it('passes samples and sampleRate to useLoopEditor', () => {
      renderDialog();

      expect(lastUseLoopEditorParams.samples).toBe(TEST_SAMPLES);
      expect(lastUseLoopEditorParams.sampleRate).toBe(TEST_SAMPLE_RATE);
    });

    it('passes rootKey to useLoopEditor (default 60)', () => {
      renderDialog();

      expect(lastUseLoopEditorParams.rootKey).toBe(60);
    });

    it('passes custom rootKey to useLoopEditor', () => {
      renderDialog({ rootKey: 48 });

      expect(lastUseLoopEditorParams.rootKey).toBe(48);
    });

    it('passes initial loop points', () => {
      renderDialog({ loopStart: 1000, loopEnd: 3000 });

      expect(lastUseLoopEditorParams.initialLoopStart).toBe(1000);
      expect(lastUseLoopEditorParams.initialLoopEnd).toBe(3000);
    });
  });

  describe('LoopEditor component receives hook state', () => {
    it('passes loopPoint and endPoint from hook to LoopEditor', () => {
      mockLoopEditorReturn.loopPoint = 2000;
      mockLoopEditorReturn.endPoint = 8000;
      renderDialog();

      expect(screen.getByTestId('loop-point').textContent).toBe('2000');
      expect(screen.getByTestId('end-point').textContent).toBe('8000');
    });
  });

  describe('MIDI voice count indicator', () => {
    it('does not show indicator when no notes are active', () => {
      mockLoopEditorReturn.activeNotes = new Set();
      renderDialog();

      expect(screen.queryByText(/MIDI:/)).toBeNull();
    });

    it('shows voice count when notes are active', () => {
      mockLoopEditorReturn.activeNotes = new Set([60, 64, 67]);
      renderDialog();

      expect(screen.getByText('MIDI: 3 voices')).toBeTruthy();
    });

    it('uses singular "voice" for single note', () => {
      mockLoopEditorReturn.activeNotes = new Set([60]);
      renderDialog();

      expect(screen.getByText('MIDI: 1 voice')).toBeTruthy();
    });
  });

  describe('dialog header', () => {
    it('displays sample name and sample rate', () => {
      renderDialog({ sampleName: 'My Tone', sampleRate: 30000 });

      expect(screen.getByText('My Tone — 30000 Hz')).toBeTruthy();
    });

    it('shows save button when onSave is provided', () => {
      renderDialog({ onSave: vi.fn() });

      expect(screen.getByText('Save Loop Points')).toBeTruthy();
    });

    it('calls onSave with current loop points from hook', async () => {
      const onSave = vi.fn();
      mockLoopEditorReturn.loopPoint = 1000;
      mockLoopEditorReturn.endPoint = 4000;
      renderDialog({ onSave });

      await userEvent.click(screen.getByText('Save Loop Points'));

      expect(onSave).toHaveBeenCalledWith(1000, 4000);
    });
  });

  describe('null samples handling', () => {
    it('passes null samples to useLoopEditor', () => {
      renderDialog({ samples: null });

      expect(lastUseLoopEditorParams.samples).toBeNull();
    });
  });
});
