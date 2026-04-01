import { useS3000xlClient } from '@/hooks/useS3000xlClient';
import { useSampleNames } from '@/hooks/useSampleNames';
import { SampleTransferPanel } from '@/components/samples';

export function SamplesPage(): JSX.Element {
  const { client, isConnected } = useS3000xlClient();
  const { sampleNames, isLoading } = useSampleNames(client);

  if (!isConnected) {
    return (
      <div className="ac-page">
        <div className="ac-page-content">
          <p className="text-gray-400">Connect to your S3000XL first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ac-page">
      <div className="ac-page-sticky-header">
        <div className="ac-page-header flex items-center justify-between">
          <h2 className="text-xl font-bold">Samples</h2>
          {isLoading && (
            <span className="text-sm text-gray-400">Loading sample names...</span>
          )}
        </div>
      </div>

      <div className="ac-page-content p-4">
        {client && (
          <SampleTransferPanel
            client={client}
            sampleNames={sampleNames}
          />
        )}
      </div>
    </div>
  );
}
