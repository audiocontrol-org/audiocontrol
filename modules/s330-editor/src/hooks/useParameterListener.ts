/**
 * Hook to listen for parameter changes from S-330 hardware
 *
 * When the user changes parameters on the S-330 front panel, the sampler
 * broadcasts DT1 SysEx messages. This hook parses those messages and
 * triggers UI updates via the s330Store.
 */

import { useEffect, useRef } from 'react';
import { useMidiStore } from '@/stores/midiStore';
import { useS330Store } from '@/stores/s330Store';
import {
  isDT1Message,
  parseDT1Message,
  type ParameterChangeEvent,
} from '@audiocontrol/sampler-devices/s330';

/**
 * Hook to listen for hardware parameter changes and trigger UI updates
 *
 * @param onParameterChange - Optional callback for each parameter change event
 */
export function useParameterListener(
  onParameterChange?: (event: ParameterChangeEvent) => void
): void {
  const adapter = useMidiStore((state) => state.adapter);
  const deviceId = useMidiStore((state) => state.deviceId);
  const notifyHardwareChange = useS330Store((state) => state.notifyHardwareChange);

  // Use ref for callback to avoid re-registering listener on every render
  const callbackRef = useRef(onParameterChange);
  callbackRef.current = onParameterChange;

  useEffect(() => {
    if (!adapter) return;

    const handleSysEx = (message: number[]) => {
      // Quick check if this is a DT1 message
      if (!isDT1Message(message)) return;

      // Parse the message
      const result = parseDT1Message(message, deviceId);

      if (!result.valid || !result.event) {
        // Log non-valid messages for debugging (but not spam for device ID mismatches)
        if (result.reason && !result.reason.includes('Device ID mismatch')) {
          console.log('[ParameterListener] Ignored:', result.reason);
        }
        return;
      }

      const event = result.event;
      console.log('[ParameterListener] Parameter change:', event.type, 'index:', event.index);

      // Notify the store to trigger UI updates
      notifyHardwareChange(event.type, event.index);

      // Call optional callback
      callbackRef.current?.(event);
    };

    // Register the listener
    adapter.onSysEx(handleSysEx);
    console.log('[ParameterListener] Listening for hardware parameter changes');

    // Cleanup
    return () => {
      adapter.removeSysExListener(handleSysEx);
      console.log('[ParameterListener] Stopped listening');
    };
  }, [adapter, deviceId, notifyHardwareChange]);
}
