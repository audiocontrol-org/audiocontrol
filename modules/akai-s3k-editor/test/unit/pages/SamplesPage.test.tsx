import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSampleStore } from '@/stores/sampleStore';
import { useEditorStore } from '@/stores/editorStore';

vi.mock('@/hooks/useS3000xlClient', () => ({
  useS3000xlClient: vi.fn(() => ({
    client: null,
    isConnected: false,
  })),
}));

// useEditorDialogs has a fat shape (kitConfig, saveTargetState,
// sdsLoadingState, multiple handlers); the unit test for the rename
// flow doesn't exercise any of it, so stub it with idle defaults.
vi.mock('@/hooks/useEditorDialogs', () => ({
  useEditorDialogs: vi.fn(() => ({
    loopEditor: null,
    chopper: null,
    sampleEditor: null,
    saveTargetState: { open: false, sampleName: '', pendingSave: null },
    sdsLoadingState: { open: false, sampleName: '', direction: 'download', progress: null, startTime: null },
    kitConfig: {},
    setKitConfig: vi.fn(),
    handleOpenInLoopEditor: vi.fn(),
    handleOpenInSampleEditor: vi.fn(),
    handleOpenInChopper: vi.fn(),
    handleLoopEditorSave: vi.fn(),
    handleChopperSave: vi.fn(),
    handleSampleEditorSave: vi.fn(),
    handleSaveTargetConfirm: vi.fn(),
    handleSaveTargetCancel: vi.fn(),
    handleSdsLoadingCancel: vi.fn(),
    closeLoopEditor: vi.fn(),
    closeChopper: vi.fn(),
    closeSampleEditor: vi.fn(),
  })),
}));

// eslint-disable-next-line import/first
import { useS3000xlClient } from '@/hooks/useS3000xlClient';
// eslint-disable-next-line import/first
import { SamplesPage } from '@/pages/SamplesPage';

const mockUseS3000xlClient = vi.mocked(useS3000xlClient);

function resetStores(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear();
  }
  useSampleStore.setState({
    samples: new Array(512).fill(undefined),
    sampleNames: [],
    namesLoaded: false,
  });
  useEditorStore.setState({
    selectedSampleIndex: null,
    error: null,
  });
}

describe('SamplesPage rename → footer wiring (AUDIT-20260525-17)', () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  it('rename via list-row UI flips AcLiveStatusFooter from READY to LIVE', async () => {
    const renameSample = vi.fn().mockResolvedValue(undefined);
    // Make these never resolve — keeps the page out of the post-load
    // re-render storm so the test focuses solely on the rename flow.
    const fetchSampleHeader = vi.fn().mockImplementation(() => new Promise(() => {}));
    const fetchSampleNames = vi.fn().mockImplementation(() => new Promise(() => {}));

    mockUseS3000xlClient.mockReturnValue({
      client: {
        renameSample,
        fetchSampleHeader,
        fetchSampleNames,
        invalidateSampleCache: vi.fn(),
      } as unknown as ReturnType<typeof useS3000xlClient>['client'],
      isConnected: true,
    });

    useSampleStore.setState({
      sampleNames: ['MY SAMPLE  '],
      namesLoaded: true,
    });

    const { container } = render(<SamplesPage />);

    // Pre-rename: footer in READY state.
    const footerText = container.querySelector('.ac-live-status-footer__text');
    expect(footerText).not.toBeNull();
    expect(footerText!.textContent).toContain('READY');
    expect(footerText!.textContent).not.toContain('LIVE');

    // Trigger rename via the same UI interaction the operator uses:
    // double-click the sample name, type new name, press Enter.
    const sampleItem = screen.getByTestId('sample-item-0');
    fireEvent.doubleClick(sampleItem);

    const renameInput = container.querySelector('input.ac-akai-list-rename') as HTMLInputElement | null;
    expect(renameInput).not.toBeNull();
    fireEvent.change(renameInput!, { target: { value: 'NEW NAME' } });
    await act(async () => {
      fireEvent.keyDown(renameInput!, { key: 'Enter' });
    });

    await waitFor(() => {
      expect(renameSample).toHaveBeenCalledWith(0, 'NEW NAME');
    });

    await waitFor(() => {
      const text = container.querySelector('.ac-live-status-footer__text');
      expect(text!.textContent).toContain('LIVE');
      expect(text!.textContent).not.toContain('READY');
    });

    const announcement = container.querySelector('.ac-live-status-footer__announcement');
    expect(announcement!.textContent).toBe('Edit confirmed.');
  });
});
