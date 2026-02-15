import { useMidiStore } from '@/stores/midiStore';
import { SystemControls } from '@/components/system/SystemControls';
import { FxControls } from '@/components/system/FxControls';

export function EditorPage(): JSX.Element {
  const { status, client, deviceId } = useMidiStore();

  return (
    <>
      <section className="panel">
        <h2>Editor</h2>
        <p>
          {status === 'connected'
            ? 'Connected. System control writes are live.'
            : 'Connect MIDI on Home page to enable system parameter writes.'}
        </p>
        <ul>
          <li>Device ID: {deviceId}</li>
          <li>Client: {client ? 'ready' : 'not connected'}</li>
        </ul>
      </section>
      <SystemControls client={client} connected={status === 'connected'} />
      <FxControls client={client} connected={status === 'connected'} />
    </>
  );
}
