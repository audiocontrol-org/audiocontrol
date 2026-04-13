import { useEffect, useCallback, useRef } from 'react';
import { KeygroupList, KeygroupEditor, ZoneOverview } from '@/components/keygroups';
import type { ZoneDragField, NewZoneRange } from '@/components/keygroups';
import { useS3000xlClient } from '@/hooks/useS3000xlClient';
import { useKeygroupLoader } from '@/hooks/useKeygroupLoader';
import { useSampleNames } from '@/hooks/useSampleNames';
import { useKeygroupStore } from '@/stores/keygroupStore';
import { useProgramStore } from '@/stores/programStore';
import { useEditorStore } from '@/stores/editorStore';
import { useConnectionDrawerStore } from '@/stores/connectionDrawerStore';
import { writeKeygroupField } from '@/lib/keygroup-writers';
import { ErrorBanner } from '@/components/ui';
import { computeKeyRange } from '@/components/keygroups/note-coordinate-utils';

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

  // Fetch program header if selection is restored but data isn't cached
  useEffect(() => {
    if (!isConnected || selectedProgramIndex === null || !client) return;
    if (programs[selectedProgramIndex]) return;
    client.fetchProgramHeader(selectedProgramIndex).then(
      (header) => setProgram(selectedProgramIndex, header),
      () => { /* will show error via selectedProgram remaining undefined */ },
    );
  }, [isConnected, selectedProgramIndex, client, programs, setProgram]);

  // Load keygroups when selected program changes
  useEffect(() => {
    if (!isConnected || selectedProgramIndex === null || !selectedProgram) return;
    if (lastLoadedProgram.current === selectedProgramIndex) return;

    lastLoadedProgram.current = selectedProgramIndex;
    invalidateCache();
    selectKeygroup(0);
    loadKeygroups(selectedProgramIndex, selectedProgram.GROUPS);
  }, [isConnected, selectedProgramIndex, selectedProgram, invalidateCache, selectKeygroup, loadKeygroups]);

  const handleParameterChange = useCallback(
    async (field: string, value: number | string) => {
      if (selectedKeygroupIndex === null || !client) return;

      // Read from getState() not the closure — multiple calls in the same
      // tick must each see the previous call's update.
      const header = useKeygroupStore.getState().keygroups[selectedKeygroupIndex];
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

  // --- Zone drag callbacks for ZoneOverview ---

  /** Optimistic local update during drag (no device write). */
  const handleZoneDrag = useCallback(
    (keygroupIndex: number, field: ZoneDragField, value: number) => {
      const header = useKeygroupStore.getState().keygroups[keygroupIndex];
      if (!header) return;
      const updated = { ...header, [field]: value };
      useKeygroupStore.getState().setKeygroup(keygroupIndex, updated);
    },
    [],
  );

  /** Write to device on mouseup after drag. */
  const handleZoneCommit = useCallback(
    async (keygroupIndex: number, field: ZoneDragField, value: number) => {
      if (!client) return;
      const header = useKeygroupStore.getState().keygroups[keygroupIndex];
      if (!header) return;
      const updated = { ...header, [field]: value, raw: [...header.raw] };
      useKeygroupStore.getState().setKeygroup(keygroupIndex, updated);
      writeKeygroupField(updated, field, value);
      await client.writeKeygroupHeader(updated);
    },
    [client],
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

  const handleDeleteKeygroup = useCallback(async (index: number) => {
    if (selectedProgramIndex === null || !client) return;

    try {
      await client.deleteKeygroup(selectedProgramIndex, index);
      await refreshFromDevice();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete keygroup';
      setError(message);
    }
  }, [selectedProgramIndex, client, refreshFromDevice, setError]);

  /** Create a new keygroup from a drag-to-create gesture. */
  const handleCreateZone = useCallback(
    async (range: NewZoneRange) => {
      if (selectedProgramIndex === null || !client || !selectedProgram) return;
      try {
        await client.createKeygroup(selectedProgramIndex, selectedProgram.GROUPS);
        await refreshFromDevice();
        const newIndex = useKeygroupStore.getState().keygroupCount - 1;
        const newHeader = useKeygroupStore.getState().keygroups[newIndex];
        if (newHeader) {
          const updated = {
            ...newHeader,
            LONOTE: range.lowNote,
            HINOTE: range.highNote,
            LOVEL1: range.lowVel,
            HIVEL1: range.highVel,
            raw: [...newHeader.raw],
          };
          useKeygroupStore.getState().setKeygroup(newIndex, updated);
          writeKeygroupField(updated, 'LONOTE', range.lowNote);
          writeKeygroupField(updated, 'HINOTE', range.highNote);
          writeKeygroupField(updated, 'LOVEL1', range.lowVel);
          writeKeygroupField(updated, 'HIVEL1', range.highVel);
          await client.writeKeygroupHeader(updated);
          selectKeygroup(newIndex);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to create keygroup';
        setError(message);
      }
    },
    [selectedProgramIndex, client, selectedProgram, refreshFromDevice, selectKeygroup, setError],
  );

  const selectedHeader =
    selectedKeygroupIndex !== null ? keygroups[selectedKeygroupIndex] : undefined;

  const noteRange = computeKeyRange(keygroups, keygroupCount);

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

  if (selectedProgramIndex === null) {
    return (
      <div className="ac-page ac-page-shell">
        <div className="ac-page-content flex items-center justify-center">
          <div className="card text-center py-12 px-8 max-w-md">
            <p className="text-gray-400">Select a program on the Programs page first.</p>
            <p className="text-sm text-gray-500 mt-2">
              Go to the <a href="/akai/s3000xl/editor/programs" className="text-blue-400 hover:underline">Programs</a> page and select a program to edit its keygroups.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedProgram) {
    return (
      <div className="ac-page ac-page-shell">
        <div className="ac-page-content flex items-center justify-center">
          <p className="text-gray-400">Loading program...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page ac-page-shell">
      <div className="ac-page-sticky-header">
        <div className="ac-page-header flex items-center justify-between">
          <h2 className="text-xl font-bold">
            Keygroups — {selectedProgram.PRNAME.trim() || '(unnamed)'}
          </h2>
          {isLoading && (
            <span className="text-sm text-gray-400">
              {loadingMessage}
              {loadingProgress !== null && ` (${loadingProgress}%)`}
            </span>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <ZoneOverview
        keygroups={keygroups}
        keygroupCount={keygroupCount}
        selectedKeygroupIndex={selectedKeygroupIndex}
        onSelectKeygroup={selectKeygroup}
        noteRange={noteRange}
        onZoneDrag={handleZoneDrag}
        onZoneCommit={handleZoneCommit}
        onCreateZone={handleCreateZone}
      />

      <div className="ac-list-detail-grid">
        <div className="ac-list-column-sticky">
          <KeygroupList
            keygroups={keygroups}
            keygroupCount={keygroupCount}
            selectedIndex={selectedKeygroupIndex}
            onSelect={selectKeygroup}
            onAdd={handleAddKeygroup}
            onDelete={handleDeleteKeygroup}
            onRefresh={handleRefresh}
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
              noteRange={noteRange}
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
