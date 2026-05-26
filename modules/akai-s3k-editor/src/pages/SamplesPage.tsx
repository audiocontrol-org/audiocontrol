import { useEffect, useCallback, useRef, useState } from 'react';
import { AcLiveStatusFooter, ConfirmDialog, PageTitleRow, SteppedProgressDrawer, type ProgressStep } from '@audiocontrol/editor-core';
import { LoopEditorDialog } from '@audiocontrol/loop-editor/ui';
import { SampleEditorDialog } from '@audiocontrol/sample-editor/ui';
import { SampleChopperDialog } from '@audiocontrol/sample-chopper/ui';
import { SampleList, SampleEditor } from '@/components/samples';
import { SaveTargetDialog } from '@/components/samples/SaveTargetDialog';
import { useS3000xlClient } from '@/hooks/useS3000xlClient';
import { useEditorDialogs } from '@/hooks/useEditorDialogs';
import { useErrorReporter } from '@audiocontrol/editor-core';
import { useSampleStore } from '@/stores/sampleStore';
import { useEditorStore } from '@/stores/editorStore';
import { useConnectionDrawerStore } from '@/stores/connectionDrawerStore';
import { writeSampleField } from '@/lib/sample-writers';
import { ErrorBanner } from '@/components/ui';
import { CacheAge } from '@/components/ui/CacheAge';
import { S3kKitOutputConfig } from '@/components/library/S3kKitOutputConfig';
import { formatBytes } from '@audiocontrol/editor-core';

export function SamplesPage(): JSX.Element {
  const { client, isConnected } = useS3000xlClient();

  const sampleNames = useSampleStore((s) => s.sampleNames);
  const namesLoaded = useSampleStore((s) => s.namesLoaded);
  const setSampleNames = useSampleStore((s) => s.setSampleNames);
  const samples = useSampleStore((s) => s.samples);
  const setSample = useSampleStore((s) => s.setSample);
  const invalidateCache = useSampleStore((s) => s.invalidateCache);
  const lastRefreshed = useSampleStore((s) => s.lastRefreshed);

  const selectedSampleIndex = useEditorStore((s) => s.selectedSampleIndex);
  const selectSample = useEditorStore((s) => s.selectSample);
  const error = useEditorStore((s) => s.error);
  const setError = useEditorStore((s) => s.setError);

  const errorReporter = useErrorReporter(setError);
  // Editor dialogs need a library root for save operations — null means save-to-library is disabled
  // but device sample loading still works via the strategy
  const editorDialogs = useEditorDialogs(null, () => {}, errorReporter, client);

  const hasInitiatedLoad = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [cloneSteps, setCloneSteps] = useState<ProgressStep[]>([]);
  const [cloneDrawerOpen, setCloneDrawerOpen] = useState(false);
  const [cloneComplete, setCloneComplete] = useState(false);
  const [cloneError, setCloneError] = useState(false);

  // Live-status footer timestamp — updated whenever a parameter edit
  // streams to the device. Per harmonization-spec section 2.5 plus the
  // `feedback_live_editing_no_save` operator memory.
  const [lastEditAt, setLastEditAt] = useState<number | null>(null);

  // Load sample names on first connect
  // Load sample names on connect (background refresh if cached)
  useEffect(() => {
    if (isConnected && !hasInitiatedLoad.current && client) {
      hasInitiatedLoad.current = true;
      setIsLoading(!namesLoaded); // Only show loading spinner if no cached data
      client.fetchSampleNames()
        .then((names) => setSampleNames(names))
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load sample names'))
        .finally(() => setIsLoading(false));
    }
  }, [isConnected, namesLoaded, client, setSampleNames, setError]);

  // Auto-select first sample once names are loaded
  useEffect(() => {
    if (namesLoaded && selectedSampleIndex === null && sampleNames.length > 0) {
      selectSample(0);
    }
  }, [namesLoaded, selectedSampleIndex, sampleNames.length, selectSample]);

  // Load selected sample header when selection changes
  useEffect(() => {
    if (selectedSampleIndex === null || !client) return;
    const existing = samples[selectedSampleIndex];
    if (!existing) {
      client.fetchSampleHeader(selectedSampleIndex)
        .then((header) => setSample(selectedSampleIndex, header))
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load sample header'));
    }
  }, [selectedSampleIndex, client, samples, setSample, setError]);

  const selectedHeader =
    selectedSampleIndex !== null ? samples[selectedSampleIndex] : undefined;

  const handleParameterChange = useCallback(
    async (field: string, value: number | string) => {
      if (selectedSampleIndex === null || !client || !selectedHeader) return;

      const updated = { ...selectedHeader, [field]: value, raw: [...selectedHeader.raw] };
      setSample(selectedSampleIndex, updated);
      writeSampleField(updated, field, value);
      try {
        await client.writeSampleHeader(updated);
        setLastEditAt(Date.now());
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to write sample parameter');
      }
    },
    [selectedSampleIndex, client, selectedHeader, setSample, setError],
  );

  const handleRename = useCallback(
    async (index: number, newName: string) => {
      if (!client) return;
      await client.renameSample(index, newName);
      // Rename is a device write — flip the live-status footer from
      // READY to LIVE so the operator gets the same visible/assistive
      // confirmation as for header-field edits (AUDIT-20260525-17).
      setLastEditAt(Date.now());
      // Optimistic update
      const names = [...sampleNames];
      names[index] = newName.padEnd(12);
      setSampleNames(names);
      // Refresh the header if it's cached
      const cached = useSampleStore.getState().samples[index];
      if (cached) {
        const refreshed = await client.fetchSampleHeader(index);
        setSample(index, refreshed);
      }
    },
    [client, sampleNames, setSampleNames, setSample],
  );

  const handleDelete = useCallback(
    (index: number) => setDeletingIndex(index),
    [],
  );

  const confirmDelete = useCallback(async () => {
    if (deletingIndex === null || !client) return;
    setDeleteInProgress(true);
    try {
      await client.deleteSample(deletingIndex);
      invalidateCache();
      hasInitiatedLoad.current = false;
      selectSample(null);
      // Re-fetch names
      const names = await client.fetchSampleNames();
      setSampleNames(names);
      if (names.length > 0) {
        selectSample(0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sample');
    } finally {
      setDeleteInProgress(false);
      setDeletingIndex(null);
    }
  }, [deletingIndex, client, invalidateCache, selectSample, setSampleNames, setError]);

  const handleRefresh = useCallback(
    async (index: number) => {
      if (!client) return;
      client.invalidateSampleCache();
      const header = await client.fetchSampleHeader(index);
      setSample(index, header);
    },
    [client, setSample],
  );

  const handleRefreshAll = useCallback(async () => {
    if (!client) return;
    invalidateCache();
    client.invalidateSampleCache();
    setIsLoading(true);
    try {
      const names = await client.fetchSampleNames();
      setSampleNames(names);
      if (selectedSampleIndex !== null && selectedSampleIndex < names.length) {
        const header = await client.fetchSampleHeader(selectedSampleIndex);
        setSample(selectedSampleIndex, header);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh samples');
    } finally {
      setIsLoading(false);
    }
  }, [client, invalidateCache, setSampleNames, selectedSampleIndex, setSample, setError]);

  const handleClone = useCallback(async (index: number) => {
    if (!client) return;
    const name = sampleNames[index]?.trim() || `Sample ${index}`;
    setCloneSteps([{ id: 'clone', label: `Cloning "${name}"...`, status: 'active' }]);
    setCloneDrawerOpen(true);
    setCloneComplete(false);
    setCloneError(false);

    try {
      await client.cloneSample(index, (step, current, total) => {
        setCloneSteps([{ id: 'clone', label: `${step} (${current}/${total})`, status: 'active' }]);
      });
      setCloneSteps([{ id: 'clone', label: `Cloned "${name}"`, status: 'complete' }]);
      setCloneComplete(true);

      // Refresh sample list
      invalidateCache();
      client.invalidateSampleCache();
      const names = await client.fetchSampleNames();
      setSampleNames(names);
    } catch (err) {
      setCloneSteps([{ id: 'clone', label: err instanceof Error ? err.message : 'Clone failed', status: 'failed' }]);
      setCloneError(true);
    }
  }, [client, sampleNames, invalidateCache, setSampleNames]);

  // Editor open handlers — pass device-sample node type so the strategy loads via SDS
  const handleOpenInLoopEditor = useCallback((index: number) => {
    const name = `device-sample:${index}`;
    editorDialogs.handleOpenInLoopEditor(name, 'device-sample');
  }, [editorDialogs]);

  const handleOpenInSampleEditor = useCallback((index: number) => {
    const name = `device-sample:${index}`;
    editorDialogs.handleOpenInSampleEditor(name, 'device-sample');
  }, [editorDialogs]);

  const handleOpenInChopper = useCallback((index: number) => {
    const name = `device-sample:${index}`;
    editorDialogs.handleOpenInChopper(name, 'device-sample');
  }, [editorDialogs]);

  if (!isConnected) {
    return (
      <div className="ac-page ac-page-shell">
        <div className="ac-page-content flex items-center justify-center">
          <div className="card text-center py-12 px-8 max-w-md">
            <p className="text-gray-400">Connect to your S3000XL first.</p>
            <p className="text-sm text-gray-500 mt-2">
              <button onClick={() => useConnectionDrawerStore.getState().open()} className="ac-link">Connect</button> to set up your MIDI connection.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page ac-page-shell ac-page-shell--fixed-viewport">
      {/* Lean page header + height-bounded shell — see ProgramsPage.tsx
          for the rationale on `--fixed-viewport` + `.ac-app-shell`.
          Promoted during akai-harmonization Phase 2 task 2.2. */}
      <PageTitleRow
        headingId="samples-page-heading"
        headingText="Samples"
        metric={<CacheAge timestamp={lastRefreshed} />}
        loadingMessage={isLoading ? 'Loading...' : null}
        isLoading={isLoading}
      />

      {error && <ErrorBanner message={error} />}

      <div className="ac-app-shell" aria-labelledby="samples-page-heading">
        <SampleList
          sampleNames={sampleNames}
          selectedIndex={selectedSampleIndex}
          onSelect={selectSample}
          onDelete={handleDelete}
          onRename={handleRename}
          onClone={handleClone}
          onRefresh={handleRefresh}
          onRefreshAll={handleRefreshAll}
          isLoading={isLoading}
        />

        <div className="ac-detail-scroll">
          {selectedHeader && selectedSampleIndex !== null ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <button
                  className="ac-btn ac-btn-sm"
                  onClick={() => handleOpenInLoopEditor(selectedSampleIndex)}
                >
                  Loop Editor
                </button>
                <button
                  className="ac-btn ac-btn-sm"
                  onClick={() => handleOpenInSampleEditor(selectedSampleIndex)}
                >
                  Sample Editor
                </button>
                <button
                  className="ac-btn ac-btn-sm"
                  onClick={() => handleOpenInChopper(selectedSampleIndex)}
                >
                  Chopper
                </button>
              </div>
              <SampleEditor
                header={selectedHeader}
                sampleIndex={selectedSampleIndex}
                sampleCount={sampleNames.length}
                onParameterChange={handleParameterChange}
              />
            </>
          ) : selectedSampleIndex !== null ? (
            <p className="text-gray-400">Loading sample...</p>
          ) : (
            <p className="text-gray-400">Select a sample to edit.</p>
          )}
        </div>
      </div>

      {/* Live-editing footer — every parameter edit streams to the
          device, so the rec-LED-tinted footer surfaces the last-edit
          timestamp instead of a save/cancel/undo affordance. Per
          harmonization-spec section 2.5 + project memories
          `feedback_live_editing_no_save` and `feedback_rec_led_accent`. */}
      <AcLiveStatusFooter
        deviceLabel="S3000XL"
        lastEditAt={lastEditAt}
        state={isConnected ? 'live' : 'offline'}
      />

      <ConfirmDialog
        open={deletingIndex !== null}
        title="Delete Sample"
        message={`Delete "${sampleNames[deletingIndex ?? 0]?.trim()}"? This cannot be undone.`}
        confirmLabel={deleteInProgress ? 'Deleting...' : 'Delete'}
        onConfirm={confirmDelete}
        onCancel={() => setDeletingIndex(null)}
        danger
      />

      <SteppedProgressDrawer
        open={cloneDrawerOpen}
        title="Clone Sample"
        onClose={() => setCloneDrawerOpen(false)}
        steps={cloneSteps}
        isComplete={cloneComplete}
        hasError={cloneError}
      />

      {editorDialogs.loopEditor && (
        <LoopEditorDialog
          open={editorDialogs.loopEditor.open}
          onOpenChange={(open) => { if (!open) editorDialogs.closeLoopEditor(); }}
          samples={editorDialogs.loopEditor.samples}
          sampleRate={editorDialogs.loopEditor.sampleRate}
          sampleName={editorDialogs.loopEditor.sampleName}
          loopStart={editorDialogs.loopEditor.loopStart}
          loopEnd={editorDialogs.loopEditor.loopEnd}
          rootKey={editorDialogs.loopEditor.rootKey}
          onSave={editorDialogs.handleLoopEditorSave}
        />
      )}
      {editorDialogs.chopper && (
        <SampleChopperDialog
          open={editorDialogs.chopper.open}
          onOpenChange={(open) => { if (!open) editorDialogs.closeChopper(); }}
          samples={editorDialogs.chopper.samples}
          sampleRate={editorDialogs.chopper.sampleRate}
          sourceName={editorDialogs.chopper.sampleName}
          editMode={!!editorDialogs.chopper.initialSlices}
          initialSlices={editorDialogs.chopper.initialSlices}
          initialLabels={editorDialogs.chopper.initialLabels}
          onConfirm={() => { editorDialogs.closeChopper(); }}
          onSave={editorDialogs.handleChopperSave}
          renderOutputConfig={(state) => (
            <S3kKitOutputConfig
              state={state}
              config={editorDialogs.kitConfig}
              onConfigChange={editorDialogs.setKitConfig}
            />
          )}
        />
      )}
      {editorDialogs.sampleEditor && (
        <SampleEditorDialog
          open={editorDialogs.sampleEditor.open}
          onOpenChange={(open) => { if (!open) editorDialogs.closeSampleEditor(); }}
          samples={editorDialogs.sampleEditor.samples}
          sampleRate={editorDialogs.sampleEditor.sampleRate}
          sampleName={editorDialogs.sampleEditor.sampleName}
          onSave={editorDialogs.handleSampleEditorSave}
        />
      )}

      <SaveTargetDialog
        open={editorDialogs.saveTargetState.open}
        sampleName={editorDialogs.saveTargetState.sampleName}
        hasLibrary={false}
        onConfirm={editorDialogs.handleSaveTargetConfirm}
        onCancel={editorDialogs.handleSaveTargetCancel}
      />

      <SteppedProgressDrawer
        open={editorDialogs.sdsLoadingState.open}
        title={editorDialogs.sdsLoadingState.direction === 'upload'
          ? `Saving "${editorDialogs.sdsLoadingState.sampleName}"`
          : `Loading "${editorDialogs.sdsLoadingState.sampleName}"`}
        onClose={editorDialogs.handleSdsLoadingCancel}
        onCancel={editorDialogs.handleSdsLoadingCancel}
        steps={[{
          id: editorDialogs.sdsLoadingState.direction === 'upload' ? 'upload' : 'download',
          label: editorDialogs.sdsLoadingState.direction === 'upload'
            ? 'Uploading sample to device'
            : 'Downloading sample from device',
          status: editorDialogs.sdsLoadingState.progress ? 'active' : 'pending',
          progress: editorDialogs.sdsLoadingState.progress && editorDialogs.sdsLoadingState.progress.bytesTotal > 0
            ? Math.round((editorDialogs.sdsLoadingState.progress.bytesSent / editorDialogs.sdsLoadingState.progress.bytesTotal) * 100)
            : undefined,
          detail: (() => {
            const { progress, startTime, direction } = editorDialogs.sdsLoadingState;
            if (!progress) return direction === 'upload' ? 'Preparing upload...' : 'Connecting to device...';
            const bytes = `${formatBytes(progress.bytesSent)} / ${formatBytes(progress.bytesTotal)}`;
            const elapsed = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;
            const bytesPerSec = elapsed > 0 ? progress.bytesSent / elapsed : 0;
            const remaining = bytesPerSec > 0 ? Math.round((progress.bytesTotal - progress.bytesSent) / bytesPerSec) : 0;
            const elapsedStr = elapsed > 0 ? `${elapsed}s elapsed` : '';
            const etaStr = remaining > 0 ? `~${remaining}s remaining` : '';
            const timeStr = [elapsedStr, etaStr].filter(Boolean).join(' \u2022 ');
            return timeStr ? `${bytes} \u2022 ${timeStr}` : bytes;
          })(),
        }]}
        isComplete={false}
        hasError={false}
      />
    </div>
  );
}
