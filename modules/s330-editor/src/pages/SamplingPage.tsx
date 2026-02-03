/**
 * Sampling page - Record and upload samples
 */

import { useMidiStore } from '@/stores/midiStore';

export function SamplingPage() {
  const { status } = useMidiStore();
  const isConnected = status === 'connected';

  if (!isConnected) {
    return (
      <div className="card text-center py-12">
        <h2 className="text-xl font-bold text-s330-text mb-2">Not Connected</h2>
        <p className="text-s330-muted mb-4">
          Connect to your S-330 to record and upload samples.
        </p>
        <a href="/" className="btn btn-primary inline-block">
          Go to Connection
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-s330-text">Sampling</h2>

      <div className="card">
        <h3 className="font-medium text-s330-text mb-4">Record Sample</h3>
        <p className="text-s330-muted mb-4">
          Recording functionality will allow you to capture audio from your
          microphone or audio interface and upload it directly to the S-330.
        </p>
        <div className="bg-s330-bg rounded-md p-8 text-center">
          <div className="text-4xl mb-4">🎤</div>
          <p className="text-s330-muted">Coming soon</p>
        </div>
      </div>

      <div className="card">
        <h3 className="font-medium text-s330-text mb-4">Import Sample</h3>
        <p className="text-s330-muted mb-4">
          Import existing WAV files and convert them for upload to the S-330.
        </p>
        <div className="bg-s330-bg rounded-md p-8 text-center border-2 border-dashed border-s330-accent">
          <div className="text-4xl mb-4">📁</div>
          <p className="text-s330-muted">
            Drag and drop WAV files here, or click to browse
          </p>
          <p className="text-xs text-s330-muted mt-2">
            Files will be converted to 12-bit format
          </p>
        </div>
      </div>

      <div className="card">
        <h3 className="font-medium text-s330-text mb-4">Technical Notes</h3>
        <ul className="text-sm text-s330-muted space-y-2">
          <li>
            <strong className="text-s330-text">Sample Rate:</strong> S-330 supports
            15kHz and 30kHz sample rates
          </li>
          <li>
            <strong className="text-s330-text">Bit Depth:</strong> Samples are stored
            in 12-bit format
          </li>
          <li>
            <strong className="text-s330-text">Memory:</strong> Standard S-330 has
            256KB of sample RAM (512KB with expansion)
          </li>
          <li>
            <strong className="text-s330-text">Transfer:</strong> Uses WSD/DAT SysEx
            protocol for uploading wave data
          </li>
        </ul>
      </div>
    </div>
  );
}
