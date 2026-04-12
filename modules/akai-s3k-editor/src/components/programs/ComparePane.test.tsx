import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useProgramStore } from '@/stores/programStore';
import type { ProgramHeader } from '@audiocontrol/sampler-devices/s3k';

vi.mock('@/hooks/usePaneKeygroups', () => ({
  usePaneKeygroups: vi.fn(() => ({
    keygroups: [],
    keygroupCount: 0,
    isLoading: false,
    loadKeygroups: vi.fn(),
    clear: vi.fn(),
  })),
}));

import { ComparePane } from '@/components/programs/ComparePane';

function makeProgramHeader(overrides: Partial<ProgramHeader> = {}): ProgramHeader {
  return {
    PRNAME: 'TEST PROG',
    GROUPS: 1,
    MIDI_CHANNEL: 0,
    POLYPHONY: 15,
    PRIORITY: 0,
    PLAY_RANGE_LOW: 21,
    PLAY_RANGE_HIGH: 108,
    OUTPUT_NUMBER: 0,
    STEREO_WIDTH: 0,
    VOLUME: 80,
    TUNE_CENTS: 0,
    TUNE_SEMITONES: 0,
    TEMPERAMENT: 0,
    PITCHBEND_UP: 2,
    PITCHBEND_DOWN: 2,
    AFTERTOUCH_VALUE: 0,
    MODWHEEL_VALUE: 0,
    raw: new Array(150).fill(0),
    ...overrides,
  } as ProgramHeader;
}

const defaultProps = {
  label: 'Left',
  programNames: ['PROG A', 'PROG B'],
  selectedIndex: null as number | null,
  onSelectIndex: vi.fn(),
  client: null,
};

describe('ComparePane', () => {
  beforeEach(() => {
    useProgramStore.setState({
      programs: new Array(128).fill(undefined),
      programNames: [],
      namesLoaded: false,
    });
    vi.clearAllMocks();
  });

  it('shows placeholder when no program selected', () => {
    render(<ComparePane {...defaultProps} />);

    expect(screen.getByText('Select a program to view.')).toBeInTheDocument();
  });

  it('renders ProgramEditor when a program is selected and loaded', () => {
    const header = makeProgramHeader({ PRNAME: 'MY PROG' });

    const programs = new Array(128).fill(undefined);
    programs[0] = header;
    useProgramStore.setState({ programs });

    render(
      <ComparePane
        {...defaultProps}
        selectedIndex={0}
        client={
          {
            fetchProgramHeader: vi.fn(),
            fetchKeygroupHeader: vi.fn(),
            writeProgramHeader: vi.fn(),
            invalidateProgramCache: vi.fn(),
          } as unknown as typeof defaultProps.client
        }
      />,
    );

    // ProgramEditor renders the program name field. Look for it.
    expect(screen.getByDisplayValue('MY PROG')).toBeInTheDocument();
  });

  it('shows loading message when program is selected but not yet loaded', () => {
    render(
      <ComparePane
        {...defaultProps}
        selectedIndex={0}
        client={
          {
            fetchProgramHeader: vi.fn().mockResolvedValue(makeProgramHeader()),
            fetchKeygroupHeader: vi.fn(),
            writeProgramHeader: vi.fn(),
            invalidateProgramCache: vi.fn(),
          } as unknown as typeof defaultProps.client
        }
      />,
    );

    expect(screen.getByText('Loading program...')).toBeInTheDocument();
  });
});
