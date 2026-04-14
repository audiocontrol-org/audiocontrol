import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useProgramStore } from '@/stores/programStore';

// Mock hooks that depend on MIDI hardware
vi.mock('@/hooks/useS3000xlClient', () => ({
  useS3000xlClient: vi.fn(() => ({
    client: null,
    isConnected: false,
  })),
}));

vi.mock('@/hooks/useProgramLoader', () => ({
  useProgramLoader: vi.fn(() => ({
    loadProgramNames: vi.fn(),
    loadProgram: vi.fn(),
    loadAllPrograms: vi.fn(),
  })),
}));

vi.mock('@/hooks/usePaneKeygroups', () => ({
  usePaneKeygroups: vi.fn(() => ({
    keygroups: [],
    keygroupCount: 0,
    isLoading: false,
    loadKeygroups: vi.fn(),
    clear: vi.fn(),
  })),
}));

// Must be imported after mocks are declared
// eslint-disable-next-line import/first -- vi.mock is hoisted, but static analysis complains
import { useS3000xlClient } from '@/hooks/useS3000xlClient';
// eslint-disable-next-line import/first
import { useProgramLoader } from '@/hooks/useProgramLoader';
import { MultiProgramPage } from '@/pages/MultiProgramPage';

const mockUseS3000xlClient = vi.mocked(useS3000xlClient);
const mockUseProgramLoader = vi.mocked(useProgramLoader);

function resetStores(): void {
  useProgramStore.setState({
    programs: new Array(128).fill(undefined),
    programNames: [],
    namesLoaded: false,
  });
}

function createMockClient(): ReturnType<typeof useS3000xlClient>['client'] {
  return {
    fetchProgramHeader: vi.fn().mockResolvedValue({
      PRNAME: 'MOCK',
      GROUPS: 1,
      raw: new Array(150).fill(0),
    }),
    fetchKeygroupHeader: vi.fn().mockResolvedValue({}),
    writeProgramHeader: vi.fn().mockResolvedValue(undefined),
    invalidateProgramCache: vi.fn(),
  } as unknown as ReturnType<typeof useS3000xlClient>['client'];
}

describe('MultiProgramPage', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();

    mockUseS3000xlClient.mockReturnValue({
      client: createMockClient(),
      isConnected: true,
    });

    mockUseProgramLoader.mockReturnValue({
      loadProgramNames: vi.fn(),
      loadProgram: vi.fn(),
      loadAllPrograms: vi.fn(),
    });
  });

  it('shows "Connect to your S3000XL first" when not connected', () => {
    mockUseS3000xlClient.mockReturnValue({
      client: null,
      isConnected: false,
    });

    render(<MultiProgramPage />);

    expect(
      screen.getByText('Connect to your S3000XL first.'),
    ).toBeInTheDocument();
  });

  it('renders two compare panes when connected', () => {
    useProgramStore.setState({
      programNames: ['PROG A', 'PROG B'],
      namesLoaded: true,
    });

    render(<MultiProgramPage />);

    // Each ComparePane renders a label; look for both Left and Right labels
    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
  });

  it('renders "Compare Programs" header', () => {
    render(<MultiProgramPage />);

    expect(screen.getByText('Compare Programs')).toBeInTheDocument();
  });

  it('Clear Both button resets both pane selections', async () => {
    useProgramStore.setState({
      programNames: ['PROG A', 'PROG B'],
      namesLoaded: true,
    });

    render(<MultiProgramPage />);

    const selects = screen.getAllByRole('combobox');

    // Select a program in the left pane
    await act(async () => {
      fireEvent.change(selects[0], { target: { value: '0' } });
    });

    // Select a program in the right pane
    await act(async () => {
      fireEvent.change(selects[1], { target: { value: '1' } });
    });

    // Both selects should now have values
    expect(selects[0]).toHaveValue('0');
    expect(selects[1]).toHaveValue('1');

    // Click Clear Both
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear Both' }));
    });

    // Both selects should be reset to the placeholder value
    expect(selects[0]).toHaveValue('');
    expect(selects[1]).toHaveValue('');
  });
});
