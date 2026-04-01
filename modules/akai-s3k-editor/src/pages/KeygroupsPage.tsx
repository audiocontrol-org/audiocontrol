import { useEffect, useCallback, useRef } from 'react';
import { KeygroupList, KeygroupEditor } from '@/components/keygroups';
import { useS3000xlClient } from '@/hooks/useS3000xlClient';
import { useKeygroupLoader } from '@/hooks/useKeygroupLoader';
import { useSampleNames } from '@/hooks/useSampleNames';
import { useKeygroupStore } from '@/stores/keygroupStore';
import { useProgramStore } from '@/stores/programStore';
import { useEditorStore } from '@/stores/editorStore';
import { writeKeygroupField } from '@/lib/keygroup-writers';

export function KeygroupsPage(): JSX.Element {
  const { client, isConnected } = useS3000xlClient();
  const { loadKeygroups } = useKeygroupLoader(client);
  const { sampleNames } = useSampleNames(client);

  const selectedProgramIndex = useEditorStore((s) => s.selectedProgramIndex);
  const selectedKeygroupIndex = useEditorStore((s) => s.selectedKeygroupIndex);
  const selectKeygroup = useEditorStore((s) => s.selectKeygroup);
  const isLoading = useEditorStore((s) => s.isLoading);
  const loadingMessage = useEditorStore((s) => s.loadingMessage);
  const loadingProgress = useEditorStore((s) => s.loadingProgress);
  const error = useEditorStore((s) => s.error);
  const setError = useEditorStore((s) => s.setError);

  const programs = useProgramStore((s) => s.programs);
  const setProgram = useProgramStore((s) => s.setProgram);
  const keygroups = useKeygroupStore((s) => s.keygroups);
  const keygroupCount = useKeygroupStore((s) => s.keygroupCount);
  const invalidateCache = useKeygroupStore((s) => s.invalidateCache);

  const lastLoadedProgram = useRef<number | null>(null);

  const selectedProgram =
    selectedProgramIndex !== null ? programs[selectedProgramIndex] : undefined;

  // Load keygroups when selected program changes
  useEffect(() => {
    if (!isConnected || selectedProgramIndex === null || !selectedProgram) return;
    if (lastLoadedProgram.current === selectedProgramIndex) return;

    lastLoadedProgram.current = selectedProgramIndex;
    invalidateCache();
    selectKeygroup(null);
    loadKeygroups(selectedProgramIndex, selectedProgram.GROUPS);
  }, [isConnected, selectedProgramIndex, selectedProgram, invalidateCache, selectKeygroup, loadKeygroups]);

  const handleParameterChange = useCallback(
    async (field: string, value: number | string) => {
      if (selectedKeygroupIndex === null || !client) return;

      const header = keygroups[selectedKeygroupIndex];
      if (!header) return;

      // Update local store optimistically
      const updated = { ...header, [field]: value, raw: [...header.raw] };
      useKeygroupStore.getState().setKeygroup(selectedKeygroupIndex, updated);

      // Encode value into raw SysEx bytes, then write to device
      writeKeygroupField(updated, field, value);
      await client.writeKeygroupHeader(updated);
    },
    [selectedKeygroupIndex, client, keygroups],
  );

  /**
   * Refresh keygroups from device: invalidate caches, re-fetch the program
   * header (to get updated GROUPS count), then reload all keygroups.
   */
  const refreshFromDevice = useCallback(async () => {
    if (selectedProgramIndex === null || !client) return;

    lastLoadedProgram.current = null;
    invalidateCache();
    client.invalidateKeygroupCache();
    client.invalidateProgramCache();
    selectKeygroup(null);

    // Re-fetch program header to get the updated GROUPS count
    const freshProgram = await client.fetchProgramHeader(selectedProgramIndex);
    setProgram(selectedProgramIndex, freshProgram);
    await loadKeygroups(selectedProgramIndex, freshProgram.GROUPS);
  }, [selectedProgramIndex, client, invalidateCache, selectKeygroup, loadKeygroups, setProgram]);

  const handleRefresh = useCallback(() => {
    refreshFromDevice().catch((err) => {
      const message = err instanceof Error ? err.message : 'Failed to refresh keygroups';
      setError(message);
    });
  }, [refreshFromDevice, setError]);

  const handleAddKeygroup = useCallback(async () => {
    if (selectedProgramIndex === null || !client || !selectedProgram) return;

    try {
      await client.createKeygroup(selectedProgramIndex, selectedProgram.GROUPS);
      await refreshFromDevice();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create keygroup';
      setError(message);
    }
  }, [selectedProgramIndex, client, selectedProgram, refreshFromDevice, setError]);

  const handleDeleteKeygroup = useCallback(async () => {
    if (selectedProgramIndex === null || selectedKeygroupIndex === null || !client) return;

    try {
      await client.deleteKeygroup(selectedProgramIndex, selectedKeygroupIndex);
      await refreshFromDevice();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete keygroup';
      setError(message);
    }
  }, [selectedProgramIndex, selectedKeygroupIndex, client, refreshFromDevice, setError]);

  const canDelete =
    selectedKeygroupIndex !== null && keygroupCount > 1 && !isLoading;

  const selectedHeader =
    selectedKeygroupIndex !== null ? keygroups[selectedKeygroupIndex] : undefined;

  if (!isConnected) {
    return (
      <div className="ac-page">
        <div className="ac-page-content">
          <p className="text-gray-400">Connect to your S3000XL first.</p>
        </div>
      </div>
    );
  }

  if (selectedProgramIndex === null || !selectedProgram) {
    return (
      <div className="ac-page">
        <div className="ac-page-content">
          <p className="text-gray-400">Select a program on the Programs page first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page">
      <div className="ac-page-sticky-header">
        <div className="ac-page-header flex items-center justify-between">
          <h2 className="text-xl font-bold">
            Keygroups — {selectedProgram.PRNAME.trim() || '(unnamed)'}
          </h2>
          <div className="flex items-center gap-2">
            {isLoading && (
              <span className="text-sm text-gray-400">
                {loadingMessage}
                {loadingProgress !== null && ` (${loadingProgress}%)`}
              </span>
            )}
            <button
              className="ac-btn ac-btn-sm ac-btn-secondary"
              onClick={handleAddKeygroup}
              disabled={isLoading}
              data-testid="add-keygroup-btn"
            >
              Add Keygroup
            </button>
            <button
              className="ac-btn ac-btn-sm ac-btn-secondary"
              onClick={handleDeleteKeygroup}
              disabled={!canDelete}
              data-testid="delete-keygroup-btn"
            >
              Delete Keygroup
            </button>
            <button
              className="ac-btn ac-btn-sm ac-btn-secondary"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-4 mb-3 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="ac-list-detail-grid">
        <div className="ac-list-column-sticky">
          <KeygroupList
            keygroups={keygroups}
            keygroupCount={keygroupCount}
            selectedIndex={selectedKeygroupIndex}
            onSelect={selectKeygroup}
            isLoading={isLoading}
          />
        </div>

        <div className="p-4">
          {selectedHeader ? (
            <KeygroupEditor
              header={selectedHeader}
              keygroupIndex={selectedKeygroupIndex!}
              sampleNames={sampleNames}
              onParameterChange={handleParameterChange}
            />
          ) : selectedKeygroupIndex !== null ? (
            <p className="text-gray-400">Loading keygroup...</p>
          ) : (
            <p className="text-gray-400">Select a keygroup to edit.</p>
          )}
        </div>
      </div>
    </div>
  );
}
