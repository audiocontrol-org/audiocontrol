import { useEffect, useCallback, useRef, useState } from 'react';
import { AcLiveStatusFooter, ConfirmDialog, PageTitleRow, SteppedProgressDrawer, type ProgressStep } from '@audiocontrol/editor-core';
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
import { CacheAge } from '@/components/ui/CacheAge';

export function ProgramsPage(): JSX.Element {
  const { client, isConnected } = useS3000xlClient();
  const { loadProgramNames, loadProgram } = useProgramLoader(client);
  const { loadKeygroups } = useKeygroupLoader(client);

  const programNames = useProgramStore((s) => s.programNames);
  const namesLoaded = useProgramStore((s) => s.namesLoaded);
  const programs = useProgramStore((s) => s.programs);
  const lastRefreshed = useProgramStore((s) => s.lastRefreshed);

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

  // Live-status footer timestamp — updated whenever a parameter edit
  // streams to the device. Per harmonization-spec section 2.5 plus the
  // `feedback_live_editing_no_save` operator memory.
  const [lastEditAt, setLastEditAt] = useState<number | null>(null);

  // Load program names on connect (background refresh if cached)
  useEffect(() => {
    if (isConnected && !hasInitiatedLoad.current) {
      hasInitiatedLoad.current = true;
      loadProgramNames();
    }
  }, [isConnected, loadProgramNames]);

  // Auto-select first program once names are loaded
  useEffect(() => {
    if (namesLoaded && selectedProgramIndex === null && programNames.length > 0) {
      selectProgram(0);
    }
  }, [namesLoaded, selectedProgramIndex, programNames.length, selectProgram]);

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
      setLastEditAt(Date.now());
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

      // Optimistic update: remove deleted program from local state
      const names = useProgramStore.getState().programNames.filter((_, i) => i !== indexToDelete);
      useProgramStore.getState().setProgramNames(names);

      // Clear cached header for deleted program and shift higher indices
      const progs = [...useProgramStore.getState().programs];
      progs.splice(indexToDelete, 1);
      for (let i = 0; i < progs.length; i++) {
        useProgramStore.getState().setProgram(i, progs[i]!);
      }

      client.invalidateProgramCache();
      lastLoadedKeygroupProgram.current = null;
      invalidateKeygroupCache();

      if (selectedProgramIndex === indexToDelete) {
        selectProgram(null);
      } else if (selectedProgramIndex !== null && selectedProgramIndex > indexToDelete) {
        selectProgram(selectedProgramIndex - 1);
      }
      setDeletingProgramIndex(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete program';
      useEditorStore.getState().setError(message);
      // Revert: reload from device
      client.invalidateProgramCache();
      useProgramStore.getState().invalidateCache();
      await loadProgramNames();
      setDeletingProgramIndex(null);
    } finally {
      setDeleteInProgress(false);
    }
  }, [deletingProgramIndex, selectedProgramIndex, client, loadProgramNames, selectProgram, invalidateKeygroupCache]);

  const handleRenameProgram = useCallback(async (index: number, newName: string) => {
    if (!client) return;
    try {
      // Optimistic update: show new name immediately
      const names = [...useProgramStore.getState().programNames];
      names[index] = newName.padEnd(12);
      useProgramStore.getState().setProgramNames(names);

      // Update the cached header if loaded
      const header = useProgramStore.getState().programs[index];
      if (header) {
        useProgramStore.getState().setProgram(index, { ...header, PRNAME: newName.padEnd(12), raw: [...header.raw] });
      }

      // Send to device
      await client.renameProgram(index, newName);
      client.invalidateProgramCache();
      // Rename is a device write — flip the live-status footer from
      // READY to LIVE so the operator gets the same visible/assistive
      // confirmation as for header-field edits (AUDIT-20260525-17).
      setLastEditAt(Date.now());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename program';
      useEditorStore.getState().setError(message);
      // Revert: reload from device
      client.invalidateProgramCache();
      useProgramStore.getState().invalidateCache();
      await loadProgramNames();
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

          // Optimistic: add clone name to list immediately
          const names = [...useProgramStore.getState().programNames, cloneName];
          useProgramStore.getState().setProgramNames(names);
        } else if (current === 3) {
          updateStep('create', { status: 'complete' });
          updateStep('keygroups', { status: 'active', detail: step });
        }
      });
      updateStep('keygroups', { status: 'complete' });
      setCloneComplete(true);

      // Fetch the actual header for the new program
      client.invalidateProgramCache();
      const freshHeader = await client.fetchProgramHeader(newIndex);
      useProgramStore.getState().setProgram(newIndex, freshHeader);
      selectProgram(newIndex);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to clone program';
      setCloneSteps((prev) => prev.map((s) =>
        s.status === 'active' ? { ...s, status: 'failed', error: message } : s,
      ));
      setCloneError(true);
      // Revert optimistic add: reload from device
      client.invalidateProgramCache();
      useProgramStore.getState().invalidateCache();
      await loadProgramNames();
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
    <div className="ac-page ac-page-shell ac-page-shell--fixed-viewport">
      {/* Lean page header — composed from .ac-page-title-* shared
          primitives via PageTitleRow. The `--fixed-viewport` modifier
          opts this page into the height-bounded shell so the list +
          detail columns scroll internally and the document does not
          scroll as one tall page (see DESIGN-SYSTEM.md
          § "Page Shell Pattern"). Promoted to the canonical shape
          during akai-harmonization Phase 2 task 2.2. */}
      <PageTitleRow
        headingId="programs-page-heading"
        headingText="Programs"
        metric={<CacheAge timestamp={lastRefreshed} />}
        loadingMessage={loadingMessage}
        isLoading={isLoading}
        loadingProgress={loadingProgress}
      />

      {error && <ErrorBanner message={error} />}

      {/* List + detail — fills the remaining vertical space. The
          `.ac-app-shell` 2-col grid lets its children scroll
          internally rather than the page scrolling as one document. */}
      <div className="ac-app-shell" aria-labelledby="programs-page-heading">
        <ProgramList
          programNames={programNames}
          selectedIndex={selectedProgramIndex}
          onSelect={selectProgram}
          onDelete={(index) => setDeletingProgramIndex(index)}
          onRename={(index, newName) => handleRenameProgram(index, newName)}
          onClone={(index) => void handleCloneProgram(index)}
          onRefresh={(index) => void handleRefreshProgram(index)}
          onRefreshAll={() => {
            useProgramStore.getState().invalidateCache();
            if (client) client.invalidateProgramCache();
            lastLoadedKeygroupProgram.current = null;
            invalidateKeygroupCache();
            loadProgramNames();
          }}
          isLoading={isLoading && !namesLoaded}
        />

        <div className="ac-detail-scroll">
          {selectedHeader ? (
            <ProgramEditor
              header={selectedHeader}
              programIndex={selectedProgramIndex!}
              onParameterChange={handleParameterChange}
            >
              <KeygroupSummary
                keygroups={keygroups}
                keygroupCount={keygroupCount}
                isLoading={isLoading}
                onAddKeygroup={() => void handleAddKeygroup()}
                onDeleteKeygroup={(index) => void handleDeleteKeygroup(index)}
              />
            </ProgramEditor>
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
