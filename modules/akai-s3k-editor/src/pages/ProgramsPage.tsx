import { useEffect, useCallback, useRef, useState } from 'react';
import { ConfirmDialog } from '@audiocontrol/editor-core';
import { ProgramList, ProgramEditor, KeygroupSummary } from '@/components/programs';
import { useS3000xlClient } from '@/hooks/useS3000xlClient';
import { useProgramLoader } from '@/hooks/useProgramLoader';
import { useKeygroupLoader } from '@/hooks/useKeygroupLoader';
import { useProgramStore } from '@/stores/programStore';
import { useKeygroupStore } from '@/stores/keygroupStore';
import { useEditorStore } from '@/stores/editorStore';
import { writeProgramField } from '@/lib/program-writers';
import { ErrorBanner } from '@/components/ui/ErrorBanner';

export function ProgramsPage(): JSX.Element {
  const { client, isConnected } = useS3000xlClient();
  const { loadProgramNames, loadProgram, loadAllPrograms } = useProgramLoader(client);
  const { loadKeygroups } = useKeygroupLoader(client);

  const programNames = useProgramStore((s) => s.programNames);
  const namesLoaded = useProgramStore((s) => s.namesLoaded);
  const programs = useProgramStore((s) => s.programs);

  const selectedProgramIndex = useEditorStore((s) => s.selectedProgramIndex);
  const selectProgram = useEditorStore((s) => s.selectProgram);
  const isLoading = useEditorStore((s) => s.isLoading);
  const loadingMessage = useEditorStore((s) => s.loadingMessage);
  const loadingProgress = useEditorStore((s) => s.loadingProgress);
  const error = useEditorStore((s) => s.error);

  const keygroups = useKeygroupStore((s) => s.keygroups);
  const keygroupCount = useKeygroupStore((s) => s.keygroupCount);
  const invalidateKeygroupCache = useKeygroupStore((s) => s.invalidateCache);

  const hasInitiatedLoad = useRef(false);
  const lastLoadedKeygroupProgram = useRef<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load program names on first connect
  useEffect(() => {
    if (isConnected && !namesLoaded && !hasInitiatedLoad.current) {
      hasInitiatedLoad.current = true;
      loadProgramNames();
    }
  }, [isConnected, namesLoaded, loadProgramNames]);

  // Load selected program header when selection changes
  useEffect(() => {
    if (selectedProgramIndex === null || !client) return;
    const existing = programs[selectedProgramIndex];
    if (!existing) {
      loadProgram(selectedProgramIndex);
    }
  }, [selectedProgramIndex, client, programs, loadProgram]);

  const selectedHeader =
    selectedProgramIndex !== null ? programs[selectedProgramIndex] : undefined;

  // Load keygroups when program header becomes available
  useEffect(() => {
    if (!isConnected || selectedProgramIndex === null || !selectedHeader) return;
    if (lastLoadedKeygroupProgram.current === selectedProgramIndex) return;

    lastLoadedKeygroupProgram.current = selectedProgramIndex;
    invalidateKeygroupCache();
    loadKeygroups(selectedProgramIndex, selectedHeader.GROUPS);
  }, [isConnected, selectedProgramIndex, selectedHeader, invalidateKeygroupCache, loadKeygroups]);

  const handleParameterChange = useCallback(
    async (field: string, value: number | string) => {
      if (selectedProgramIndex === null || !client) return;

      const header = programs[selectedProgramIndex];
      if (!header) return;

      // Update local store optimistically
      const updated = { ...header, [field]: value, raw: [...header.raw] };
      useProgramStore.getState().setProgram(selectedProgramIndex, updated);

      // Keep program names list in sync when name changes
      if (field === 'PRNAME' && typeof value === 'string') {
        const names = [...useProgramStore.getState().programNames];
        names[selectedProgramIndex] = value;
        useProgramStore.getState().setProgramNames(names);
        client.invalidateProgramCache();
      }

      // Encode value into raw SysEx bytes, then write to device
      writeProgramField(updated, field, value);
      await client.writeProgramHeader(updated);
    },
    [selectedProgramIndex, client, programs],
  );

  /**
   * Refresh keygroups from device after add/delete: invalidate caches,
   * re-fetch program header for updated GROUPS count, then reload keygroups.
   */
  const refreshKeygroupsFromDevice = useCallback(async () => {
    if (selectedProgramIndex === null || !client) return;

    lastLoadedKeygroupProgram.current = null;
    invalidateKeygroupCache();
    client.invalidateKeygroupCache();
    client.invalidateProgramCache();

    const freshProgram = await client.fetchProgramHeader(selectedProgramIndex);
    useProgramStore.getState().setProgram(selectedProgramIndex, freshProgram);
    await loadKeygroups(selectedProgramIndex, freshProgram.GROUPS);
  }, [selectedProgramIndex, client, invalidateKeygroupCache, loadKeygroups]);

  const handleAddKeygroup = useCallback(async () => {
    if (selectedProgramIndex === null || !client || !selectedHeader) return;

    try {
      await client.createKeygroup(selectedProgramIndex, selectedHeader.GROUPS);
      await refreshKeygroupsFromDevice();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create keygroup';
      useEditorStore.getState().setError(message);
    }
  }, [selectedProgramIndex, client, selectedHeader, refreshKeygroupsFromDevice]);

  const handleDeleteKeygroup = useCallback(async (index: number) => {
    if (selectedProgramIndex === null || !client) return;

    try {
      await client.deleteKeygroup(selectedProgramIndex, index);
      await refreshKeygroupsFromDevice();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete keygroup';
      useEditorStore.getState().setError(message);
    }
  }, [selectedProgramIndex, client, refreshKeygroupsFromDevice]);

  const handleDeleteProgram = useCallback(async () => {
    if (selectedProgramIndex === null || !client) return;
    setShowDeleteConfirm(false);
    await client.deleteProgram(selectedProgramIndex);
    client.invalidateProgramCache();
    useProgramStore.getState().invalidateCache();
    lastLoadedKeygroupProgram.current = null;
    invalidateKeygroupCache();
    await loadProgramNames();
    selectProgram(null);
  }, [selectedProgramIndex, client, loadProgramNames, selectProgram, invalidateKeygroupCache]);

  const selectedProgramName =
    selectedProgramIndex !== null ? programNames[selectedProgramIndex] : undefined;

  if (!isConnected) {
    return (
      <div className="ac-page ac-page-shell">
        <div className="ac-page-content flex items-center justify-center">
          <div className="card text-center py-12 px-8 max-w-md">
            <p className="text-gray-400">Connect to your S3000XL first.</p>
            <p className="text-sm text-gray-500 mt-2">
              Go to the <a href="/akai/s3000xl/editor" className="text-blue-400 hover:underline">Connect</a> page to set up your MIDI connection.
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
          <h2 className="text-xl font-bold">Programs</h2>
          <div className="flex items-center gap-2">
            {isLoading && (
              <span className="text-sm text-gray-400" data-testid="loading-status">
                {loadingMessage}
                {loadingProgress !== null && ` (${loadingProgress}%)`}
              </span>
            )}
            <button
              className="ac-btn ac-btn-sm ac-btn-secondary"
              onClick={() => {
                useProgramStore.getState().invalidateCache();
                if (client) client.invalidateProgramCache();
                lastLoadedKeygroupProgram.current = null;
                invalidateKeygroupCache();
                loadProgramNames();
              }}
              disabled={isLoading}
            >
              Refresh
            </button>
            <button
              className="ac-btn ac-btn-sm ac-btn-primary"
              onClick={loadAllPrograms}
              disabled={isLoading || programNames.length === 0}
            >
              Load All
            </button>
            <button
              className="ac-btn ac-btn-sm ac-btn-danger"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={isLoading || selectedProgramIndex === null}
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      <div className="ac-list-detail-grid">
        <div className="ac-list-column-sticky">
          <ProgramList
            programNames={programNames}
            selectedIndex={selectedProgramIndex}
            onSelect={selectProgram}
            isLoading={isLoading && !namesLoaded}
          />
        </div>

        <div className="p-4">
          {selectedHeader ? (
            <>
              <ProgramEditor
                header={selectedHeader}
                programIndex={selectedProgramIndex!}
                onParameterChange={handleParameterChange}
              />
              <KeygroupSummary
                keygroups={keygroups}
                keygroupCount={keygroupCount}
                isLoading={isLoading}
                onAddKeygroup={() => void handleAddKeygroup()}
                onDeleteKeygroup={(index) => void handleDeleteKeygroup(index)}
              />
            </>
          ) : selectedProgramIndex !== null ? (
            <p className="text-gray-400">Loading program...</p>
          ) : (
            <div>
              <p className="text-gray-400">Select a program to edit.</p>
              <p className="text-gray-500 text-sm mt-2">
                Programs are created on the device front panel. Use the Library to import programs.
              </p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Program"
        message={`Delete program '${selectedProgramName ?? ''}'? This will remove the program and all its keygroups from the device.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => void handleDeleteProgram()}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
