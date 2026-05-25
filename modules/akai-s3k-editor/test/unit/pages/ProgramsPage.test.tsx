import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  // AUDIT-20260525-18 — the prior test queried screen.getByTestId('loading-status')
  // and asserted the message included the "(50%)" suffix. The page no
  // longer renders that test-id; it composes the canonical PageTitleRow
  // which renders the loading message in `.ac-page-title-metric-status`
  // (role=status + aria-live=polite) and shows the percentage via a
  // separate `.ac-page-title-progress` bar's width. Updated test asserts
  // against the actual current contract.
  it('shows loading status via PageTitleRow metric-status span when isLoading with a message (AUDIT-20260525-18)', () => {
    useProgramStore.setState({
      programNames: ['PROGRAM1'],
      namesLoaded: true,
    });
    useEditorStore.setState({
      isLoading: true,
      loadingMessage: 'Loading program names...',
      loadingProgress: 50,
    });

    const { container } = render(<ProgramsPage />);

    // 1. The loading message is rendered in the canonical metric-status
    //    span carried by PageTitleRow (the live-region announcement
    //    surface for the page header — distinct from AcLiveStatusFooter's
    //    announcement span).
    const statusSpan = container.querySelector('.ac-page-title-metric-status');
    expect(statusSpan).not.toBeNull();
    expect(statusSpan?.textContent).toContain('Loading program names...');
    expect(statusSpan?.getAttribute('role')).toBe('status');
    expect(statusSpan?.getAttribute('aria-live')).toBe('polite');

    // 2. The 50% progress is shown via the inline progress bar fill's
    //    style.width (not appended to the message text). This is the
    //    actual visual contract the page renders.
    const progressFill = container.querySelector('.ac-page-title-progress-fill');
    expect(progressFill).not.toBeNull();
    expect((progressFill as HTMLElement).style.width).toBe('50%');
  });

  // AUDIT-20260525-17 — rename is a device write that previously failed
  // to update lastEditAt; the footer stayed READY even after a successful
  // rename. This test triggers a rename through the same UI interaction
  // an operator uses (double-click name => type new name => press Enter)
  // and asserts the AcLiveStatusFooter visible chrome flips from READY
  // to LIVE.
  it('rename via list-row UI flips AcLiveStatusFooter from READY to LIVE (AUDIT-20260525-17)', async () => {
    const renameProgram = vi.fn().mockResolvedValue(undefined);
    const invalidateProgramCache = vi.fn();
    mockUseS3000xlClient.mockReturnValue({
      client: {
        renameProgram,
        invalidateProgramCache,
        invalidateKeygroupCache: vi.fn(),
        fetchProgramHeader: vi.fn().mockResolvedValue(undefined),
      } as unknown as ReturnType<typeof useS3000xlClient>['client'],
      isConnected: true,
    });

    useProgramStore.setState({
      programNames: ['MY PROGRAM '],
      namesLoaded: true,
    });

    const { container } = render(<ProgramsPage />);

    // Pre-rename: footer in READY state (no edits yet).
    const footerText = container.querySelector('.ac-live-status-footer__text');
    expect(footerText).not.toBeNull();
    expect(footerText!.textContent).toContain('READY');
    expect(footerText!.textContent).not.toContain('LIVE');

    // Trigger rename via the same UI interaction the operator uses:
    // double-click the program name to enter edit mode, type a new
    // name, press Enter to commit.
    const programItem = screen.getByTestId('program-item-0');
    fireEvent.doubleClick(programItem);

    const renameInput = container.querySelector('input.ac-akai-list-rename') as HTMLInputElement | null;
    expect(renameInput).not.toBeNull();
    fireEvent.change(renameInput!, { target: { value: 'NEW NAME' } });
    await act(async () => {
      fireEvent.keyDown(renameInput!, { key: 'Enter' });
    });

    // Wait for the async rename callback chain to flush:
    //   commitRename -> onRename(handleRenameProgram) ->
    //   client.renameProgram (resolves) -> setLastEditAt(Date.now())
    await waitFor(() => {
      expect(renameProgram).toHaveBeenCalledWith(0, 'NEW NAME');
    });

    await waitFor(() => {
      const text = container.querySelector('.ac-live-status-footer__text');
      expect(text!.textContent).toContain('LIVE');
      expect(text!.textContent).not.toContain('READY');
    });

    // Discrete announcement also rose on the same edge.
    const announcement = container.querySelector('.ac-live-status-footer__announcement');
    expect(announcement!.textContent).toBe('Edit confirmed.');
  });
});
