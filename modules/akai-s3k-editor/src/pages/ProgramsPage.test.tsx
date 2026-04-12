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

  it('Delete button is disabled when no program is selected', () => {
    useProgramStore.setState({
      programNames: ['PROGRAM1', 'PROGRAM2'],
      namesLoaded: true,
    });

    render(<ProgramsPage />);

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(deleteButton).toBeDisabled();
  });

  it('Delete button is disabled when loading', () => {
    useProgramStore.setState({
      programNames: ['PROGRAM1'],
      namesLoaded: true,
    });
    useEditorStore.setState({
      selectedProgramIndex: 0,
      isLoading: true,
      loadingMessage: 'Loading...',
    });

    render(<ProgramsPage />);

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(deleteButton).toBeDisabled();
  });

  it('Delete button is enabled when a program is selected and not loading', () => {
    useProgramStore.setState({
      programNames: ['PROGRAM1'],
      namesLoaded: true,
    });
    useEditorStore.setState({
      selectedProgramIndex: 0,
      isLoading: false,
    });

    render(<ProgramsPage />);

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    expect(deleteButton).toBeEnabled();
  });

  it('clicking Delete shows the ConfirmDialog', () => {
    useProgramStore.setState({
      programNames: ['MY PROGRAM'],
      namesLoaded: true,
    });
    useEditorStore.setState({
      selectedProgramIndex: 0,
      isLoading: false,
    });

    render(<ProgramsPage />);

    const deleteButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButton);

    // ConfirmDialog should now be visible with the program name
    expect(screen.getByText('Delete Program')).toBeInTheDocument();
    expect(
      screen.getByText(/Delete program 'MY PROGRAM'\?/),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    // The confirm button inside the dialog also says "Delete"
    const dialogRegion = screen.getByRole('alertdialog');
    expect(dialogRegion).toBeInTheDocument();
  });

  it('clicking Cancel in ConfirmDialog hides it', () => {
    useProgramStore.setState({
      programNames: ['TEST PROG'],
      namesLoaded: true,
    });
    useEditorStore.setState({
      selectedProgramIndex: 0,
      isLoading: false,
    });

    render(<ProgramsPage />);

    // Open the confirm dialog
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Delete Program')).toBeInTheDocument();

    // Cancel it
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
