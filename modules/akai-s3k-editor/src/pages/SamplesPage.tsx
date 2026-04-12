import { useCallback } from 'react';
import { useS3000xlClient } from '@/hooks/useS3000xlClient';
import { useSampleNames } from '@/hooks/useSampleNames';
import { useConnectionDrawerStore } from '@/stores/connectionDrawerStore';
import { SampleTransferPanel } from '@/components/samples';

export function SamplesPage(): JSX.Element {
  const { client, isConnected } = useS3000xlClient();
  const { sampleNames, isLoading, refreshSampleNames } = useSampleNames(client);

  const handleSampleListChanged = useCallback(async () => {
    if (client) await refreshSampleNames();
  }, [client, refreshSampleNames]);

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
        <div className="ac-page-header flex items-center justify-between">
          <h2 className="text-xl font-bold">Samples</h2>
          {isLoading && (
            <span className="text-sm text-gray-400">Loading sample names...</span>
          )}
        </div>
      </div>

      <div className="ac-page-content">
        {client && (
          <SampleTransferPanel
            client={client}
            sampleNames={sampleNames}
            onSampleListChanged={handleSampleListChanged}
          />
        )}
      </div>
    </div>
  );
}
