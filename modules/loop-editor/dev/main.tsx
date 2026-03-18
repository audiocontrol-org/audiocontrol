/**
 * Standalone dev harness for the loop editor.
 *
 * Provides test audio data and browser environment wiring so the
 * loop editor can be developed independently of sampler-editor.
 */

import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { LoopEditor } from '@/ui/LoopEditor';
import { useLoopDetection } from '@/ui/hooks/useLoopDetection';
import { createDevEnvironment } from './environment';

const env = createDevEnvironment();

/** Generate a test tone with a clean loop region. */
function generateTestAudio(sampleRate: number, durationSeconds: number): Int16Array {
  const length = sampleRate * durationSeconds;
  const samples = new Int16Array(length);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Mix of harmonics for a rich test tone
    const fundamental = Math.sin(2 * Math.PI * 440 * t);
    const harmonic2 = 0.5 * Math.sin(2 * Math.PI * 880 * t);
    const harmonic3 = 0.25 * Math.sin(2 * Math.PI * 1320 * t);
    // Envelope: quick attack, sustain, no release
    const envelope = Math.min(1, t * 20);
    const value = (fundamental + harmonic2 + harmonic3) * envelope * 0.6;
    samples[i] = Math.round(value * 32767);
  }

  return samples;
}

function DevHarness() {
  const sampleRate = 30000;
  const [samples] = useState(() => generateTestAudio(sampleRate, 2));
  const [loopPoint, setLoopPoint] = useState(Math.floor(sampleRate * 0.5));
  const [endPoint, setEndPoint] = useState(Math.floor(sampleRate * 1.5));
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number | undefined>(undefined);

  const {
    isSearching,
    progress,
    candidates,
    searchLoopPoints,
    clearResults,
  } = useLoopDetection();

  const handleAutoDetect = useCallback(() => {
    clearResults();
    setSelectedCandidateIndex(undefined);
    const samplesCopy = new Int16Array(samples);
    searchLoopPoints(samplesCopy, sampleRate, endPoint);
  }, [samples, sampleRate, endPoint, clearResults, searchLoopPoints]);

  const handleApplyCandidate = useCallback((loopStart: number, loopEnd: number) => {
    setLoopPoint(loopStart);
    setEndPoint(loopEnd);
  }, []);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
        Loop Editor — Dev Harness
      </h1>
      <p style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>
        Standalone development environment with synthetic test audio ({sampleRate} Hz, {samples.length} samples).
      </p>
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

const root = createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><DevHarness /></React.StrictMode>);
