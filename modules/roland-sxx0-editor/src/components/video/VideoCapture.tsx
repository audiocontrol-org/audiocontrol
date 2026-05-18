/**
 * Video Capture Panel
 *
 * Displays video from a USB capture device (or webcam) using the
 * browser's Media Devices API. Useful for viewing S-330's display
 * alongside the editor.
 *
 * Includes collapsible front panel controls for remote S-330 operation.
 * Renders as drawer content - the drawer itself is managed by Layout.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';
import { useFrontPanel, type NavigationButton, type FunctionButton } from '@/hooks/useFrontPanel';
import { VirtualFrontPanel } from '@/components/front-panel/VirtualFrontPanel';

const STORAGE_KEY_DEVICE = 's330-video-device';

interface VideoDevice {
  deviceId: string;
  label: string;
}

// Check if mediaDevices API is available (requires secure context)
const isMediaDevicesAvailable = () =>
  typeof navigator !== 'undefined' && navigator.mediaDevices !== undefined;

export function VideoCapture() {
  const isDrawerOpen = useUIStore((state) => state.isDrawerOpen);
  const [devices, setDevices] = useState<VideoDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isSecureContext, setIsSecureContext] = useState<boolean | null>(null);

  // Front panel hook
  const { pressButton, isConnected, isPressing, activeButton, navigationMode, setNavigationMode } = useFrontPanel();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isStartingRef = useRef(false);

  // Enumerate available video devices
  const enumerateDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = allDevices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 8)}...`,
        }));
      setDevices(videoDevices);

      // Restore saved device selection
      const savedDeviceId = localStorage.getItem(STORAGE_KEY_DEVICE);
      if (savedDeviceId && videoDevices.some((d) => d.deviceId === savedDeviceId)) {
        setSelectedDeviceId(savedDeviceId);
      } else if (videoDevices.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('[VideoCapture] Failed to enumerate devices:', err);
      setError('Failed to list video devices');
    }
  }, [selectedDeviceId]);

  // Request permission and enumerate devices
  const requestPermission = useCallback(async () => {
    try {
      setError(null);
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
      tempStream.getTracks().forEach((track) => track.stop());
      setHasPermission(true);
      await enumerateDevices();
    } catch (err) {
      console.error('[VideoCapture] Permission denied:', err);
      setHasPermission(false);
      setError('Camera permission denied');
    }
  }, [enumerateDevices]);

  // Start video stream
  const startStream = useCallback(async () => {
    if (!selectedDeviceId) return;
    if (isStartingRef.current) return; // Prevent concurrent start attempts

    isStartingRef.current = true;

    try {
      setError(null);

      // Stop existing stream and clear video element
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        // Allow the video element to settle before setting new source
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedDeviceId } },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          // Ignore "play interrupted" errors - they occur when switching devices rapidly
          if (playErr instanceof Error && playErr.name === 'AbortError') {
            return;
          }
          throw playErr;
        }
      }

      setIsStreaming(true);
      localStorage.setItem(STORAGE_KEY_DEVICE, selectedDeviceId);
    } catch (err) {
      console.error('[VideoCapture] Failed to start stream:', err);
      setError(err instanceof Error ? err.message : 'Failed to start video');
      setIsStreaming(false);
    } finally {
      isStartingRef.current = false;
    }
  }, [selectedDeviceId]);

  // Stop video stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    isStartingRef.current = false;
    setIsStreaming(false);
  }, []);

  // Handle device change - restart stream with new device
  const handleDeviceChange = useCallback(async (deviceId: string) => {
    const wasStreaming = isStreaming;
    setSelectedDeviceId(deviceId);

    if (wasStreaming) {
      stopStream();
      // Small delay to allow state to settle, then restart
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }, [isStreaming, stopStream]);

  // Check for permission on mount
  useEffect(() => {
    if (!isMediaDevicesAvailable()) {
      setIsSecureContext(false);
      return;
    }
    setIsSecureContext(true);

    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const hasLabels = devices.some((d) => d.kind === 'videoinput' && d.label);
      if (hasLabels) {
        setHasPermission(true);
        enumerateDevices();
      }
    });
  }, [enumerateDevices]);

  // Listen for device changes
  useEffect(() => {
    if (!isMediaDevicesAvailable()) return;

    const handleDeviceChange = () => {
      if (hasPermission) {
        enumerateDevices();
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [hasPermission, enumerateDevices]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Auto-start stream when drawer opens
  useEffect(() => {
    const shouldStream = isDrawerOpen && selectedDeviceId && hasPermission;
    if (shouldStream && !isStreaming) {
      startStream();
    } else if (!isDrawerOpen && isStreaming) {
      stopStream();
    }
  }, [isDrawerOpen, selectedDeviceId, hasPermission, isStreaming, startStream, stopStream]);

  // Keyboard shortcut handler for front panel
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore OS key-autorepeat. Without this guard a single physical key
    // press dispatches 3–4 SysEx messages to the device because the
    // `isPressing` closure below is captured at render time and stays
    // stale until React re-renders. Other keyboard handlers in this
    // monorepo (synth-core, sample-chopper) follow the same pattern.
    if (e.repeat) return;
    if (!isDrawerOpen || !isConnected || isPressing) return;

    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
      return;
    }

    const navKeyMap: Record<string, NavigationButton> = {
      'ArrowUp': 'up',
      'ArrowDown': 'down',
      'ArrowLeft': 'left',
      'ArrowRight': 'right',
      '+': 'inc',
      '=': 'inc',
      '-': 'dec',
      '_': 'dec',
    };

    const funcKeyMap: Record<string, FunctionButton> = {
      'F1': 'mode',
      'F2': 'menu',
      'F3': 'sub-menu',
      'F4': 'com',
      'F5': 'execute',
      'Enter': 'execute',
    };

    const navButton = navKeyMap[e.key];
    if (navButton) {
      e.preventDefault();
      pressButton(navButton);
      return;
    }

    const funcButton = funcKeyMap[e.key];
    if (funcButton) {
      e.preventDefault();
      pressButton(funcButton);
    }
  }, [isDrawerOpen, isConnected, isPressing, pressButton]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col h-full">
      {/* Video area */}
      <div className="aspect-video bg-black relative">
        <video ref={videoRef} className="w-full h-full object-contain" playsInline muted />

        {isSecureContext === false && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-s330-bg/90 p-4">
            <p className="text-s330-muted text-sm text-center">
              Video capture requires HTTPS or localhost
            </p>
          </div>
        )}

        {isSecureContext && hasPermission === null && (
          <div className="absolute inset-0 flex items-center justify-center bg-s330-bg/90">
            <button
              onClick={requestPermission}
              className="px-4 py-2 bg-s330-highlight text-white rounded hover:bg-s330-highlight/80"
            >
              Enable Camera Access
            </button>
          </div>
        )}

        {hasPermission === false && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-s330-bg/90 p-4">
            <p className="text-s330-muted text-sm text-center mb-2">Camera access denied</p>
            <button
              onClick={requestPermission}
              className="px-3 py-1 text-sm bg-s330-accent text-s330-text rounded hover:bg-s330-accent/80"
            >
              Try Again
            </button>
          </div>
        )}

        {hasPermission && devices.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-s330-bg/90">
            <p className="text-s330-muted text-sm">No video devices found</p>
          </div>
        )}

        {error && (
          <div
            className="absolute bottom-0 left-0 right-0 px-2 py-1"
            style={{ background: 'color-mix(in srgb, var(--ac-status-danger) 80%, transparent)' }}
          >
            <p className="text-white text-xs">{error}</p>
          </div>
        )}
      </div>

      {/* Video Controls */}
      {hasPermission && devices.length > 0 && (
        <div className="ac-drawer-section border-s330-accent flex gap-2 items-center">
          <select
            value={selectedDeviceId ?? ''}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className={cn(
              'flex-1 min-w-0 px-2 py-1 text-xs font-mono',
              'bg-s330-bg border border-s330-accent rounded',
              'text-s330-text focus:outline-none focus:ring-1 focus:ring-s330-highlight'
            )}
          >
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
          {!isStreaming ? (
            <button
              onClick={startStream}
              disabled={!selectedDeviceId}
              className={cn(
                'shrink-0 px-3 py-1 text-xs rounded',
                'bg-s330-highlight text-white hover:bg-s330-highlight/80',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Start
            </button>
          ) : (
            <button
              onClick={stopStream}
              className="ac-btn ac-btn-danger shrink-0 px-3 py-1 text-xs"
            >
              Stop
            </button>
          )}
        </div>
      )}

      {/* Front Panel Controls */}
      <div className="ac-drawer-section border-s330-accent space-y-3">
        <VirtualFrontPanel
          onPress={pressButton}
          activeButton={activeButton}
          disabled={!isConnected || isPressing}
        />
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs text-s330-muted">Arrow category:</span>
          <button
            onClick={() => setNavigationMode(navigationMode === 'menu' ? 'sampling' : 'menu')}
            className={cn(
              'px-2 py-0.5 text-xs font-mono rounded border transition-colors',
              navigationMode === 'menu'
                ? 'bg-s330-accent border-s330-accent text-s330-text'
                : 'bg-s330-highlight border-s330-highlight text-white'
            )}
            title={navigationMode === 'menu'
              ? 'Category 01: works in menus and parameter screens'
              : 'Category 09: works on sampling screen'}
          >
            {navigationMode === 'menu' ? '01' : '09'}
          </button>
        </div>
        <div className="text-xs text-s330-muted text-center opacity-70">
          Keys: Arrows, +/-, Enter, F1-F5
        </div>
        {!isConnected && (
          <div className="text-xs text-s330-muted text-center">
            Connect MIDI to use controls
          </div>
        )}
      </div>
    </div>
  );
}
