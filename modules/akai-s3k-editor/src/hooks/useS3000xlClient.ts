import { useRef, useMemo } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import {
  createS3000xlClient,
  type S3000xlClientInterface,
} from '@audiocontrol/sampler-devices/s3k';

interface UseS3000xlClientResult {
  client: S3000xlClientInterface | null;
  isConnected: boolean;
}

/**
 * Hook that creates and manages an S3000XL MIDI client instance.
 *
 * The client is created when the MIDI adapter becomes available (i.e., the user
 * connects to a MIDI port) and torn down when the adapter disconnects. The
 * client instance is memoized so it is stable across re-renders as long as the
 * adapter and deviceId remain the same.
 */
export function useS3000xlClient(): UseS3000xlClientResult {
  const adapter = useMidiStore((s) => s.adapter);
  const sdsChannel = useMidiStore((s) => s.sdsChannel);
  const deviceId = useMidiStore((s) => s.deviceId);
  const status = useMidiStore((s) => s.status);

  const prevAdapterRef = useRef<unknown>(undefined);
  const prevSdsChannelRef = useRef<unknown>(undefined);
  const prevDeviceIdRef = useRef<number | undefined>(undefined);
  const clientRef = useRef<S3000xlClientInterface | null>(null);

  if (
    prevAdapterRef.current !== adapter ||
    prevSdsChannelRef.current !== sdsChannel ||
    prevDeviceIdRef.current !== deviceId
  ) {
    prevAdapterRef.current = adapter;
    prevSdsChannelRef.current = sdsChannel;
    prevDeviceIdRef.current = deviceId;

    if (adapter) {
      // writeFlushDelayMs: 0 — The S3000XL protocol sends the entire header on
      // each write, so buffered write coalescing provides no benefit. Immediate
      // writes avoid a race where navigating away before the flush timer fires
      // causes the write to be silently dropped.
      clientRef.current = createS3000xlClient(adapter, {
        channel: 0,
        deviceId,
        writeFlushDelayMs: 0,
        ...(sdsChannel ? { sdsChannel } : {}),
      });
    } else {
      clientRef.current = null;
    }
  }

  const isConnected = status === 'connected' && clientRef.current !== null;

  return useMemo(
    () => ({ client: clientRef.current, isConnected }),
    [isConnected],
  );
}
