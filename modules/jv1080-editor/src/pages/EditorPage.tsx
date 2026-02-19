import { useMidiStore } from '@/stores/midiStore';
import { SystemControls } from '@/components/system/SystemControls';
import { FxControls } from '@/components/system/FxControls';

export function EditorPage(): JSX.Element {
  const { status, client, deviceId } = useMidiStore();

  return (
    <div className="ac-page ac-page-shell">
      <section className="panel">
        <h2 className="text-lg font-semibold text-jv1080-text">Editor</h2>
        <p className="mt-2 text-sm text-jv1080-muted">
          {status === 'connected'
            ? 'Connected. System control writes are live.'
            : 'Connect MIDI on Home page to enable system parameter writes.'}
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm text-jv1080-text">
          <li>Device ID: {deviceId}</li>
          <li>Client: {client ? 'ready' : 'not connected'}</li>
        </ul>
      </section>
      <SystemControls client={client} connected={status === 'connected'} />
      <FxControls client={client} connected={status === 'connected'} />
    </div>
  );
}
