/**
 * Workflows page — container with nested routes for workflow modules.
 *
 * URL structure:
 *   /workflows              → workflow hub (list of available workflows)
 *   /workflows/loop-editor  → loop editor workflow
 */

import { useState, useCallback } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { LoopEditor } from '@audiocontrol/loop-editor/ui';
import { useLoopDetection } from '@audiocontrol/loop-editor/ui';
import { WorkflowEnvironmentProvider, useWorkflowEnvironment } from '@/context/WorkflowEnvironmentContext';
import { useDeviceConfig } from '@/context/DeviceConfigContext';

function WorkflowHub() {
  const { basePath } = useDeviceConfig();

  return (
    <div className="ac-page">
      <div className="ac-page-header">
        <h2 className="text-xl font-bold text-s330-text">Workflows</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          to={`${basePath}/workflows/loop-editor`}
          className="card hover:border-s330-highlight transition-colors"
        >
          <h3 className="font-medium text-s330-text mb-1">Loop Editor</h3>
          <p className="text-sm text-s330-muted">
            Find and refine loop points with split-pane waveform visualization.
          </p>
        </Link>
      </div>
    </div>
  );
}

/**
 * Standalone loop editor workflow page.
 *
 * In standalone mode, loads audio from a file via FileIO.
 * When navigated from the Tones page, receives wave data via route state.
 */
function LoopEditorWorkflow() {
  const env = useWorkflowEnvironment();
  const [samples, setSamples] = useState<Int16Array | null>(null);
  const [sampleRate] = useState(30000);
  const [loopPoint, setLoopPoint] = useState(0);
  const [endPoint, setEndPoint] = useState(0);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number | undefined>(undefined);

  const {
    isSearching,
    progress,
    candidates,
    searchLoopPoints,
    clearResults,
  } = useLoopDetection();

  const handleLoadFile = useCallback(async () => {
    if (!env.fileIO) return;
    const handle = await env.fileIO.pickFile({ accept: { 'audio/wav': ['.wav'] } });
    if (!handle) return;

    const buffer = await env.fileIO.readFile(handle);
    // Simple WAV parsing — skip 44-byte header, read as 16-bit PCM
    const dataView = new DataView(buffer);
    const dataLength = (buffer.byteLength - 44) / 2;
    const wavSamples = new Int16Array(dataLength);
    for (let i = 0; i < dataLength; i++) {
      wavSamples[i] = dataView.getInt16(44 + i * 2, true);
    }

    setSamples(wavSamples);
    setLoopPoint(Math.floor(dataLength * 0.3));
    setEndPoint(Math.floor(dataLength * 0.8));
  }, [env.fileIO]);

  const handleAutoDetect = useCallback(() => {
    if (!samples) return;
    clearResults();
    setSelectedCandidateIndex(undefined);
    const copy = new Int16Array(samples);
    searchLoopPoints(copy, sampleRate, endPoint);
  }, [samples, sampleRate, endPoint, clearResults, searchLoopPoints]);

  const handleApplyCandidate = useCallback((loopStart: number, loopEnd: number) => {
    setLoopPoint(loopStart);
    setEndPoint(loopEnd);
  }, []);

  return (
    <div className="ac-page">
      <div className="ac-page-header">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-s330-text">Loop Editor</h2>
          {!samples && env.fileIO && (
            <button onClick={handleLoadFile} className="ac-btn ac-btn-sm ac-btn-primary">
              Load WAV File
            </button>
          )}
          {samples && env.fileIO && (
            <button onClick={handleLoadFile} className="ac-btn ac-btn-sm ac-btn-secondary">
              Load Different File
            </button>
          )}
        </div>
      </div>
      <LoopEditor
        samples={samples}
        sampleRate={sampleRate}
        startPoint={0}
        loopPoint={loopPoint}
        endPoint={endPoint}
        onLoopPointChange={setLoopPoint}
        onEndPointChange={setEndPoint}
        candidates={candidates}
        selectedCandidateIndex={selectedCandidateIndex}
        onCandidateSelect={setSelectedCandidateIndex}
        onApplyCandidate={handleApplyCandidate}
        onAutoDetect={handleAutoDetect}
        isSearching={isSearching}
        searchProgress={progress}
        audio={env.audio}
      />
    </div>
  );
}

export function WorkflowsPage() {
  return (
    <WorkflowEnvironmentProvider>
      <Routes>
        <Route index element={<WorkflowHub />} />
        <Route path="loop-editor" element={<LoopEditorWorkflow />} />
      </Routes>
    </WorkflowEnvironmentProvider>
  );
}
