import { useCallback, useState } from 'react';
import type { S3000xlClientInterface } from '@audiocontrol/sampler-devices/s3k';
import type { SdsTransferProgress, SdsDumpHeader } from '@audiocontrol/midi-core';

export interface TransferState {
  isTransferring: boolean;
  direction: 'send' | 'receive' | null;
  progress: SdsTransferProgress | null;
  error: string | null;
}

export interface SdsReceiveResult {
  header: SdsDumpHeader;
  samples: Int16Array;
}

const INITIAL_STATE: TransferState = {
  isTransferring: false,
  direction: null,
  progress: null,
  error: null,
};

export function useSampleTransfer(client: S3000xlClientInterface | null) {
  const [transferState, setTransferState] = useState<TransferState>(INITIAL_STATE);

  const sendToDevice = useCallback(
    async (
      sampleNumber: number,
      sampleData: Int16Array,
      sampleRate: number,
    ): Promise<void> => {
      if (!client) {
        throw new Error('Cannot send sample: client is not connected');
      }

      setTransferState({
        isTransferring: true,
        direction: 'send',
        progress: null,
        error: null,
      });

      try {
        await client.sendSampleViaSds(sampleNumber, sampleData, sampleRate, {
          onProgress: (progress) => {
            console.log(`[S3000XL SDS] send ${progress.packetsSent}/${progress.packetsTotal}`);
            setTransferState((prev) => ({ ...prev, progress }));
          },
        });
        setTransferState(INITIAL_STATE);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setTransferState({
          isTransferring: false,
          direction: null,
          progress: null,
          error: `Send failed: ${message}`,
        });
      }
    },
    [client],
  );

  const receiveFromDevice = useCallback(
    async (sampleNumber: number): Promise<SdsReceiveResult | null> => {
      if (!client) {
        throw new Error('Cannot receive sample: client is not connected');
      }

      setTransferState({
        isTransferring: true,
        direction: 'receive',
        progress: null,
        error: null,
      });

      try {
        const result = await client.receiveSampleViaSds(
          sampleNumber,
          (progress) => {
            console.log(`[S3000XL SDS] receive ${progress.packetsSent}/${progress.packetsTotal}`);
            setTransferState((prev) => ({ ...prev, progress }));
          },
        );
        setTransferState(INITIAL_STATE);
        return result;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setTransferState({
          isTransferring: false,
          direction: null,
          progress: null,
          error: `Receive failed: ${message}`,
        });
        return null;
      }
    },
    [client],
  );

  const deleteSample = useCallback(
    async (sampleNumber: number): Promise<void> => {
      if (!client) {
        throw new Error('Cannot delete sample: client is not connected');
      }
      await client.deleteSample(sampleNumber);
    },
    [client],
  );

  const clearError = useCallback(() => {
    setTransferState((prev) => ({ ...prev, error: null }));
  }, []);

  return { transferState, sendToDevice, receiveFromDevice, deleteSample, clearError };
}
