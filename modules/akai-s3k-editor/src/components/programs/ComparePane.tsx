import { useEffect, useCallback, useRef } from 'react';
import type { S3000xlClientInterface, ProgramHeader } from '@audiocontrol/sampler-devices/s3k';
import { ProgramEditor } from '@/components/programs/ProgramEditor';
import { KeygroupSummary } from '@/components/programs/KeygroupSummary';
import { ProgramSelector } from '@/components/programs/ProgramSelector';
import { usePaneKeygroups } from '@/hooks/usePaneKeygroups';
import { useProgramStore } from '@/stores/programStore';
import { writeProgramField } from '@/lib/program-writers';

interface ComparePaneProps {
  label: string;
  programNames: string[];
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
  client: S3000xlClientInterface | null;
}

/**
 * One side of the multi-editor compare view.
 *
 * Contains a program selector dropdown, ProgramEditor, and KeygroupSummary.
 * Manages its own scroll position and keygroup state independently.
 */
export function ComparePane({
  label,
  programNames,
  selectedIndex,
  onSelectIndex,
  client,
}: ComparePaneProps): JSX.Element {
  const programs = useProgramStore((s) => s.programs);
  const { keygroups, keygroupCount, isLoading, loadKeygroups, clear } =
    usePaneKeygroups(client);

  const lastLoadedKeygroupProgram = useRef<number | null>(null);

  const selectedHeader: ProgramHeader | undefined =
    selectedIndex !== null ? programs[selectedIndex] : undefined;

  // Load program header when selection changes
  useEffect(() => {
    if (selectedIndex === null || !client) return;
    const existing = programs[selectedIndex];
    if (!existing) {
      client.fetchProgramHeader(selectedIndex).then(
        (header) => {
          useProgramStore.getState().setProgram(selectedIndex, header);
        },
        () => {
          // Fetch failure is not critical here -- user can reselect
        },
      );
    }
  }, [selectedIndex, client, programs]);

  // Load keygroups when program header becomes available
  useEffect(() => {
    if (selectedIndex === null || !selectedHeader || !client) {
      if (selectedIndex === null) {
        lastLoadedKeygroupProgram.current = null;
        clear();
      }
      return;
    }
    if (lastLoadedKeygroupProgram.current === selectedIndex) return;

    lastLoadedKeygroupProgram.current = selectedIndex;
    loadKeygroups(selectedIndex, selectedHeader.GROUPS);
  }, [selectedIndex, selectedHeader, client, loadKeygroups, clear]);

  const handleParameterChange = useCallback(
    async (field: string, value: number | string) => {
      if (selectedIndex === null || !client) return;

      const header = programs[selectedIndex];
      if (!header) return;

      const updated = { ...header, [field]: value, raw: [...header.raw] };
      useProgramStore.getState().setProgram(selectedIndex, updated);

      if (field === 'PRNAME' && typeof value === 'string') {
        const names = [...useProgramStore.getState().programNames];
        names[selectedIndex] = value;
        useProgramStore.getState().setProgramNames(names);
        client.invalidateProgramCache();
      }

      writeProgramField(updated, field, value);
      await client.writeProgramHeader(updated);
    },
    [selectedIndex, client, programs],
  );

  return (
    <div className="compare-pane flex flex-col border border-gray-700 rounded-lg overflow-hidden min-h-0">
      <ProgramSelector
        programNames={programNames}
        selectedIndex={selectedIndex}
        onSelect={onSelectIndex}
        label={label}
      />
      <div className="flex-1 overflow-y-auto p-3">
        {selectedIndex !== null && selectedHeader ? (
          <>
            <ProgramEditor
              header={selectedHeader}
              programIndex={selectedIndex}
              onParameterChange={handleParameterChange}
            />
            <KeygroupSummary
              keygroups={keygroups}
              keygroupCount={keygroupCount}
              isLoading={isLoading}
            />
          </>
        ) : selectedIndex !== null ? (
          <p className="text-gray-400 text-sm">Loading program...</p>
        ) : (
          <p className="text-gray-500 text-sm">Select a program to view.</p>
        )}
      </div>
    </div>
  );
}
