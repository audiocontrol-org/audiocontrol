import { useEffect, useCallback, useRef } from 'react';
import { ConfirmDialog, SteppedProgressDrawer, type ProgressStep } from '@audiocontrol/editor-core';
import { SampleList, SampleEditor } from '@/components/samples';
import { useS3000xlClient } from '@/hooks/useS3000xlClient';
import { useSampleStore } from '@/stores/sampleStore';
import { useEditorStore } from '@/stores/editorStore';
import { useConnectionDrawerStore } from '@/stores/connectionDrawerStore';
import { writeSampleField } from '@/lib/sample-writers';
import { ErrorBanner } from '@/components/ui';
import { CacheAge } from '@/components/ui/CacheAge';
import { useState } from 'react';

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

  const hasInitiatedLoad = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [cloneSteps, setCloneSteps] = useState<ProgressStep[]>([]);
  const [cloneDrawerOpen, setCloneDrawerOpen] = useState(false);
  const [cloneComplete, setCloneComplete] = useState(false);
  const [cloneError, setCloneError] = useState(false);

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

  if (!isConnected) {
    return (
      <div className="ac-page ac-page-shell">
        <div className="ac-page-content flex items-center justify-center">
          <div className="card text-center py-12 px-8 max-w-md">
            <p className="text-gray-400">Connect to your S3000XL first.</p>
            <p className="text-sm text-gray-500 mt-2">
              <button onClick={() => useConnectionDrawerStore.getState().open()} className="text-blue-400 hover:underline">Connect</button> to set up your MIDI connection.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page ac-page-shell">
      <div className="ac-page-sticky-header">
        <div className="ac-page-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Samples</h2>
            <CacheAge timestamp={lastRefreshed} />
          </div>
          {isLoading && (
            <span className="text-sm text-gray-400">Loading...</span>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="ac-list-detail-grid">
        <div className="ac-list-column-sticky">
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
        </div>

        <div className="p-4">
          {selectedHeader && selectedSampleIndex !== null ? (
            <SampleEditor
              header={selectedHeader}
              sampleIndex={selectedSampleIndex}
              onParameterChange={handleParameterChange}
            />
          ) : selectedSampleIndex !== null ? (
            <p className="text-gray-400">Loading sample...</p>
          ) : (
            <p className="text-gray-400">Select a sample to edit.</p>
          )}
        </div>
      </div>

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
    </div>
  );
}
