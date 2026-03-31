import { useEffect, useCallback, useRef } from 'react';
import { ProgramList, ProgramEditor } from '@/components/programs';
import { useS3000xlClient } from '@/hooks/useS3000xlClient';
import { useProgramLoader } from '@/hooks/useProgramLoader';
import { useProgramStore } from '@/stores/programStore';
import { useEditorStore } from '@/stores/editorStore';
import { writeProgramField } from '@/lib/program-writers';

export function ProgramsPage(): JSX.Element {
  const { client, isConnected } = useS3000xlClient();
  const { loadProgramNames, loadProgram, loadAllPrograms } = useProgramLoader(client);

  const programNames = useProgramStore((s) => s.programNames);
  const namesLoaded = useProgramStore((s) => s.namesLoaded);
  const programs = useProgramStore((s) => s.programs);

  const selectedProgramIndex = useEditorStore((s) => s.selectedProgramIndex);
  const selectProgram = useEditorStore((s) => s.selectProgram);
  const isLoading = useEditorStore((s) => s.isLoading);
  const loadingMessage = useEditorStore((s) => s.loadingMessage);
  const loadingProgress = useEditorStore((s) => s.loadingProgress);
  const error = useEditorStore((s) => s.error);

  const hasInitiatedLoad = useRef(false);

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

  const selectedHeader =
    selectedProgramIndex !== null ? programs[selectedProgramIndex] : undefined;

  if (!isConnected) {
    return (
      <div className="ac-page">
        <div className="ac-page-content">
          <p className="text-gray-400">Connect to your S3000XL first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page">
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
              onClick={loadProgramNames}
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

      {error && (
        <div className="mx-4 mb-3 p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

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
            <ProgramEditor
              header={selectedHeader}
              programIndex={selectedProgramIndex!}
              onParameterChange={handleParameterChange}
            />
          ) : selectedProgramIndex !== null ? (
            <p className="text-gray-400">Loading program...</p>
          ) : (
            <p className="text-gray-400">Select a program to edit.</p>
          )}
        </div>
      </div>
    </div>
  );
}
