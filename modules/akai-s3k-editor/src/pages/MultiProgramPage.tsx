import { useState, useEffect, useRef } from 'react';
import { ComparePane } from '@/components/programs/ComparePane';
import { useS3000xlClient } from '@/hooks/useS3000xlClient';
import { useProgramLoader } from '@/hooks/useProgramLoader';
import { useProgramStore } from '@/stores/programStore';
import { useConnectionDrawerStore } from '@/stores/connectionDrawerStore';

/**
 * Multi-Program Compare Page
 *
 * Side-by-side multi-editor for comparing two programs simultaneously.
 * Each pane has its own program selector, scroll position, and keygroup state.
 * Program data is shared through the global programStore cache so changes in
 * one pane are immediately visible if the other pane shows the same program.
 *
 * Editor-core extraction evaluation:
 * Defer extraction until a second editor (e.g., Roland) needs a compare feature.
 * The split-pane layout, per-pane state management, and selector pattern are
 * self-contained here with no cross-editor consumers. Extracting now would
 * create an unused abstraction in editor-core whose API would be designed
 * against a single use case and likely need rework when the second consumer
 * arrives. Extract when the Roland editor adds compare -- at that point,
 * two concrete implementations reveal the correct shared interface.
 */
export function MultiProgramPage(): JSX.Element {
  const { client, isConnected } = useS3000xlClient();
  const { loadProgramNames } = useProgramLoader(client);

  const programNames = useProgramStore((s) => s.programNames);
  const namesLoaded = useProgramStore((s) => s.namesLoaded);

  const hasInitiatedLoad = useRef(false);

  const [leftIndex, setLeftIndex] = useState<number | null>(null);
  const [rightIndex, setRightIndex] = useState<number | null>(null);

  // Load program names on first connect if not already loaded
  useEffect(() => {
    if (isConnected && !namesLoaded && !hasInitiatedLoad.current) {
      hasInitiatedLoad.current = true;
      loadProgramNames();
    }
  }, [isConnected, namesLoaded, loadProgramNames]);

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
        <div className="ac-page-header">
          <h2 className="text-xl font-bold">Compare Programs</h2>
          <div className="flex items-center gap-2">
            {!namesLoaded && (
              <span className="text-sm text-gray-400">Loading program names...</span>
            )}
            <button
              className="ac-btn ac-btn-sm ac-btn-secondary"
              onClick={() => {
                setLeftIndex(null);
                setRightIndex(null);
              }}
            >
              Clear Both
            </button>
          </div>
        </div>
      </div>

      <div className="compare-grid">
        <ComparePane
          label="Left"
          programNames={programNames}
          selectedIndex={leftIndex}
          onSelectIndex={setLeftIndex}
          client={client}
        />
        <div className="compare-divider" />
        <ComparePane
          label="Right"
          programNames={programNames}
          selectedIndex={rightIndex}
          onSelectIndex={setRightIndex}
          client={client}
        />
      </div>
    </div>
  );
}
