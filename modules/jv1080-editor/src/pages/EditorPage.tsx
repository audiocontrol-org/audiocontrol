import { useMidiStore } from '@/stores/midiStore';

export function EditorPage(): JSX.Element {
  const { status, client, deviceId } = useMidiStore();

  return (
    <section className="panel">
      <h2>Editor</h2>
      <p>
        Base editor route is wired. {status === 'connected' ? 'MIDI client is connected.' : 'Connect MIDI on Home to enable editing.'}
      </p>
      <ul>
        <li>Device ID: {deviceId}</li>
        <li>Client: {client ? 'ready' : 'not connected'}</li>
      </ul>
      <p>Phase 4 will add JV-1080 system parameter controls on this page.</p>
    </section>
  );
}
