import { useEffect, useCallback, useRef, useState } from 'react';
import { ConfirmDialog, SteppedProgressDrawer, type ProgressStep } from '@audiocontrol/editor-core';
import { ProgramList, ProgramEditor, KeygroupSummary } from '@/components/programs';
import { useS3000xlClient } from '@/hooks/useS3000xlClient';
import { useProgramLoader } from '@/hooks/useProgramLoader';
import { useKeygroupLoader } from '@/hooks/useKeygroupLoader';
import { useProgramStore } from '@/stores/programStore';
import { useKeygroupStore } from '@/stores/keygroupStore';
import { useEditorStore } from '@/stores/editorStore';
import { useConnectionDrawerStore } from '@/stores/connectionDrawerStore';
import { writeProgramField } from '@/lib/program-writers';
import { ErrorBanner } from '@/components/ui';

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
  const [deletingProgramIndex, setDeletingProgramIndex] = useState<number | null>(null);
  const [deleteInProgress, setDeleteInProgress] = useState(false);
  const [cloneSteps, setCloneSteps] = useState<ProgressStep[]>([]);
  const [cloneDrawerOpen, setCloneDrawerOpen] = useState(false);
  const [cloneComplete, setCloneComplete] = useState(false);
  const [cloneError, setCloneError] = useState(false);

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
    if (deletingProgramIndex === null || !client) return;
    const indexToDelete = deletingProgramIndex;
    setDeleteInProgress(true);
    try {
      await client.deleteProgram(indexToDelete);
      client.invalidateProgramCache();
      useProgramStore.getState().invalidateCache();
      lastLoadedKeygroupProgram.current = null;
      invalidateKeygroupCache();
      await loadProgramNames();
      if (selectedProgramIndex === indexToDelete) {
        selectProgram(null);
      }
      setDeletingProgramIndex(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete program';
      useEditorStore.getState().setError(message);
      setDeletingProgramIndex(null);
    } finally {
      setDeleteInProgress(false);
    }
  }, [deletingProgramIndex, selectedProgramIndex, client, loadProgramNames, selectProgram, invalidateKeygroupCache]);

  const handleRenameProgram = useCallback(async (index: number, newName: string) => {
    if (!client) return;
    try {
      await client.renameProgram(index, newName);
      client.invalidateProgramCache();
      useProgramStore.getState().invalidateCache();
      await loadProgramNames();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename program';
      useEditorStore.getState().setError(message);
    }
  }, [client, loadProgramNames]);


  const handleCloneProgram = useCallback(async (sourceIndex: number) => {
    if (!client) return;
    const sourceName = programNames[sourceIndex]?.trim() ?? '';
    const cloneName = `${sourceName.substring(0, 8)} CPY`.padEnd(12);

    setCloneComplete(false);
    setCloneError(false);
    setCloneSteps([
      { id: 'read', label: 'Reading source program', status: 'active' },
      { id: 'create', label: 'Creating program', status: 'pending' },
      { id: 'keygroups', label: 'Cloning keygroups', status: 'pending' },
    ]);
    setCloneDrawerOpen(true);

    const updateStep = (id: string, update: Partial<ProgressStep>) => {
      setCloneSteps((prev) => prev.map((s) => s.id === id ? { ...s, ...update } : s));
    };

    try {
      const newIndex = await client.cloneProgram(sourceIndex, cloneName, (step, current) => {
        if (current === 1) {
          updateStep('read', { status: 'active' });
        } else if (current === 2) {
          updateStep('read', { status: 'complete' });
          updateStep('create', { status: 'active' });
        } else if (current === 3) {
          updateStep('create', { status: 'complete' });
          updateStep('keygroups', { status: 'active', detail: step });
        }
      });
      updateStep('keygroups', { status: 'complete' });
      setCloneComplete(true);
      useProgramStore.getState().invalidateCache();
      await loadProgramNames();
      selectProgram(newIndex);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clone program';
      setCloneSteps((prev) => prev.map((s) =>
        s.status === 'active' ? { ...s, status: 'failed', error: message } : s,
      ));
      setCloneError(true);
    }
  }, [client, programNames, loadProgramNames, selectProgram]);

  const handleRefreshProgram = useCallback(async (index: number) => {
    if (!client) return;
    try {
      client.invalidateProgramCache();
      const fresh = await client.fetchProgramHeader(index);
      useProgramStore.getState().setProgram(index, fresh);
      if (index === selectedProgramIndex) {
        lastLoadedKeygroupProgram.current = null;
        invalidateKeygroupCache();
        client.invalidateKeygroupCache();
        await loadKeygroups(index, fresh.GROUPS);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh program';
      useEditorStore.getState().setError(message);
    }
  }, [client, selectedProgramIndex, invalidateKeygroupCache, loadKeygroups]);

  const deletingProgramName =
    deletingProgramIndex !== null ? programNames[deletingProgramIndex] : undefined;

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
            onDelete={(index) => setDeletingProgramIndex(index)}
            onRename={(index, newName) => void handleRenameProgram(index, newName)}
            onClone={(index) => void handleCloneProgram(index)}
            onRefresh={(index) => void handleRefreshProgram(index)}
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
        open={deletingProgramIndex !== null}
        title="Delete Program"
        message={deleteInProgress
          ? 'Deleting program from device...'
          : `Delete program '${deletingProgramName ?? ''}'? This will remove the program and all its keygroups from the device.`}
        confirmLabel={deleteInProgress ? 'Deleting...' : 'Delete'}
        cancelLabel={deleteInProgress ? 'Cancel' : 'Cancel'}
        danger
        onConfirm={deleteInProgress ? () => {} : () => void handleDeleteProgram()}
        onCancel={() => setDeletingProgramIndex(null)}
      />

      <SteppedProgressDrawer
        open={cloneDrawerOpen}
        title="Clone Program"
        steps={cloneSteps}
        isComplete={cloneComplete}
        hasError={cloneError}
        onClose={() => setCloneDrawerOpen(false)}
      />
    </div>
  );
}
