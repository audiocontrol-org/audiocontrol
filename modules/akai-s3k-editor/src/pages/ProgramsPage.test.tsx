import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useProgramStore } from '@/stores/programStore';
import { useEditorStore } from '@/stores/editorStore';
import { useKeygroupStore } from '@/stores/keygroupStore';

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

vi.mock('@/hooks/useKeygroupLoader', () => ({
  useKeygroupLoader: vi.fn(() => ({
    loadKeygroups: vi.fn(),
  })),
}));

// Must be imported after mocks are declared
// eslint-disable-next-line import/first -- vi.mock is hoisted, but static analysis complains
import { useS3000xlClient } from '@/hooks/useS3000xlClient';
// eslint-disable-next-line import/first
import { useProgramLoader } from '@/hooks/useProgramLoader';
import { ProgramsPage } from '@/pages/ProgramsPage';

const mockUseS3000xlClient = vi.mocked(useS3000xlClient);
const mockUseProgramLoader = vi.mocked(useProgramLoader);

function resetStores(): void {
  useProgramStore.setState({
    programs: new Array(128).fill(undefined),
    programNames: [],
    namesLoaded: false,
  });
  useEditorStore.setState({
    selectedProgramIndex: null,
    selectedKeygroupIndex: null,
    isLoading: false,
    loadingMessage: null,
    loadingProgress: null,
    error: null,
  });
  useKeygroupStore.setState({
    keygroups: [],
    keygroupCount: 0,
  });
}

describe('ProgramsPage delete flow', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();

    // Default: connected with a mock client
    mockUseS3000xlClient.mockReturnValue({
      client: {
        invalidateProgramCache: vi.fn(),
        deleteProgram: vi.fn(),
      } as unknown as ReturnType<typeof useS3000xlClient>['client'],
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

    render(<ProgramsPage />);

    expect(screen.getByText('Connect to your S3000XL first.')).toBeInTheDocument();
  });

  it('delete button appears on non-empty program list items', () => {
    useProgramStore.setState({
      programNames: ['PROGRAM1', ''],
      namesLoaded: true,
    });

    render(<ProgramsPage />);

    // Non-empty program has a delete button
    const deleteButtons = screen.getAllByTitle('Delete program');
    expect(deleteButtons).toHaveLength(1);
  });

  it('clicking list item delete shows ConfirmDialog with program name', () => {
    useProgramStore.setState({
      programNames: ['MY PROGRAM'],
      namesLoaded: true,
    });

    render(<ProgramsPage />);

    const deleteButton = screen.getByTitle('Delete program');
    fireEvent.click(deleteButton);

    expect(screen.getByText('Delete Program')).toBeInTheDocument();
    expect(
      screen.getByText(/Delete program 'MY PROGRAM'\?/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('clicking Cancel in ConfirmDialog hides it', () => {
    useProgramStore.setState({
      programNames: ['TEST PROG'],
      namesLoaded: true,
    });

    render(<ProgramsPage />);

    fireEvent.click(screen.getByTitle('Delete program'));
    expect(screen.getByText('Delete Program')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Delete Program')).not.toBeInTheDocument();
  });

  it('shows loading status when isLoading with a message', () => {
    useProgramStore.setState({
      programNames: ['PROGRAM1'],
      namesLoaded: true,
    });
    useEditorStore.setState({
      isLoading: true,
      loadingMessage: 'Loading program names...',
      loadingProgress: 50,
    });

    render(<ProgramsPage />);

    const status = screen.getByTestId('loading-status');
    expect(status).toHaveTextContent('Loading program names... (50%)');
  });
});
