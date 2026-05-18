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
  // Track explicit operator intent. The auto-start effect respects
  // this flag — once the operator clicks Stop, the stream stays
  // stopped until the operator clicks Start (or picks a new device).
  // Without this, the auto-start would re-fire as soon as the
  // isStreaming dependency settled, instantly undoing the Stop.
  const [userStopped, setUserStopped] = useState(false);

  // Front panel hook
  const { pressButton, isConnected, isPressing, activeButton } = useFrontPanel();

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
    // Clear the explicit-stop flag so the auto-start effect will
    // pick up the new device. Without this, switching devices after
    // the operator has clicked Stop wouldn't bring the stream back.
    setUserStopped(false);

    if (wasStreaming) {
      stopStream();
      // Small delay to allow state to settle, then restart
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }, [isStreaming, stopStream]);

  // Explicit Start / Stop click handlers — separate from auto-start
  // logic so the explicit-stop intent can be tracked.
  const handleStartClick = useCallback(() => {
    setUserStopped(false);
    void startStream();
  }, [startStream]);

  const handleStopClick = useCallback(() => {
    setUserStopped(true);
    stopStream();
  }, [stopStream]);

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

  // Auto-start stream when drawer opens — gated by `userStopped`
  // so the operator's explicit Stop is sticky until they click Start
  // again or switch devices.
  useEffect(() => {
    const shouldStream = isDrawerOpen && selectedDeviceId && hasPermission && !userStopped;
    if (shouldStream && !isStreaming) {
      startStream();
    } else if (!isDrawerOpen && isStreaming) {
      stopStream();
    }
  }, [isDrawerOpen, selectedDeviceId, hasPermission, isStreaming, userStopped, startStream, stopStream]);

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
      {/* Fixed 16:9 frame — video element is always mounted but
          hidden when paused so the frame's aspect ratio stays stable
          regardless of capture state. Skeleton placeholder shows the
          paused state with a CRT-evoking scanline pattern + camera
          glyph + status text. */}
      <div className="ac-video-frame">
        <video ref={videoRef} playsInline muted hidden={!isStreaming} />

        {!isStreaming && hasPermission && devices.length > 0 && !error && (
          <div className="ac-video-frame-skeleton" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="ac-video-frame-skeleton-label">Paused</span>
            <span className="ac-video-frame-skeleton-hint">Press START to begin capture</span>
          </div>
        )}

        {isSecureContext === false && (
          <div className="ac-video-frame-overlay">
            <span className="ac-video-frame-skeleton-label">Secure context required</span>
            <span className="ac-video-frame-skeleton-hint">Video capture needs HTTPS or localhost</span>
          </div>
        )}

        {isSecureContext && hasPermission === null && (
          <div className="ac-video-frame-overlay">
            <button
              type="button"
              onClick={requestPermission}
              className="ac-toolbar-btn ac-toolbar-btn--primary"
            >
              Enable Camera Access
            </button>
          </div>
        )}

        {hasPermission === false && (
          <div className="ac-video-frame-overlay">
            <span className="ac-video-frame-skeleton-label">Camera access denied</span>
            <button
              type="button"
              onClick={requestPermission}
              className="ac-toolbar-btn"
            >
              Try Again
            </button>
          </div>
        )}

        {hasPermission && devices.length === 0 && (
          <div className="ac-video-frame-overlay">
            <span className="ac-video-frame-skeleton-label">No video devices found</span>
          </div>
        )}

        {error && (
          <div className="ac-video-frame-error">{error}</div>
        )}
      </div>

      {/* Video Controls — lean v3 chrome: .ac-select for the device
          picker, .ac-toolbar-btn for Start/Stop so they share the
          same chrome family as Panic + the page-title icon buttons. */}
      {hasPermission && devices.length > 0 && (
        <div className="ac-drawer-section flex gap-2 items-center">
          <select
            value={selectedDeviceId ?? ''}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className="ac-select"
            style={{ flex: '1 1 0', minWidth: 0, fontFamily: 'var(--ac-font-mono)', fontSize: 'var(--ac-text-xs)', padding: '0.375rem 0.5rem' }}
          >
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
          {!isStreaming ? (
            <button
              type="button"
              onClick={handleStartClick}
              disabled={!selectedDeviceId}
              className="ac-toolbar-btn ac-toolbar-btn--primary"
            >
              Start
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStopClick}
              className="ac-toolbar-btn ac-toolbar-btn--danger"
            >
              Stop
            </button>
          )}
        </div>
      )}

      {/* Front Panel Controls */}
      <div className="ac-drawer-section space-y-3">
        <VirtualFrontPanel
          onPress={pressButton}
          activeButton={activeButton}
          disabled={!isConnected || isPressing}
        />
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
