import { useEffect, useCallback, useRef } from 'react';
import { KeygroupList, KeygroupEditor } from '@/components/keygroups';
import { useS3000xlClient } from '@/hooks/useS3000xlClient';
import { useKeygroupLoader } from '@/hooks/useKeygroupLoader';
import { useSampleNames } from '@/hooks/useSampleNames';
import { useKeygroupStore } from '@/stores/keygroupStore';
import { useProgramStore } from '@/stores/programStore';
import { useEditorStore } from '@/stores/editorStore';

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

  const programs = useProgramStore((s) => s.programs);
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
      const updated = { ...header, [field]: value };
      useKeygroupStore.getState().setKeygroup(selectedKeygroupIndex, updated);

      // Write back to device
      await client.writeKeygroupHeader(updated);
    },
    [selectedKeygroupIndex, client, keygroups],
  );

  const handleRefresh = useCallback(() => {
    if (selectedProgramIndex === null || !selectedProgram) return;
    lastLoadedProgram.current = null;
    invalidateCache();
    selectKeygroup(null);
    loadKeygroups(selectedProgramIndex, selectedProgram.GROUPS);
  }, [selectedProgramIndex, selectedProgram, invalidateCache, selectKeygroup, loadKeygroups]);

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
