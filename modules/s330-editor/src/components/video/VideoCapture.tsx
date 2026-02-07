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
import { NavigationPad } from '@/components/front-panel/NavigationPad';
import { ValueButtons } from '@/components/front-panel/ValueButtons';
import { FunctionButtonRow } from '@/components/front-panel/FunctionButtonRow';

const STORAGE_KEY_DEVICE = 's330-video-device';
const STORAGE_KEY_CONTROLS = 's330-video-controls-expanded';

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
  const [controlsExpanded, setControlsExpanded] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY_CONTROLS);
    return saved === 'true';
  });

  // Front panel hook
  const { pressButton, isConnected, isPressing, activeButton, navigationMode, setNavigationMode } = useFrontPanel();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

    try {
      setError(null);

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: selectedDeviceId } },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsStreaming(true);
      localStorage.setItem(STORAGE_KEY_DEVICE, selectedDeviceId);
    } catch (err) {
      console.error('[VideoCapture] Failed to start stream:', err);
      setError(err instanceof Error ? err.message : 'Failed to start video');
      setIsStreaming(false);
    }
  }, [selectedDeviceId]);

  // Stop video stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  // Handle device change
  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    if (isStreaming) {
      stopStream();
    }
  };

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

  // Persist controls expanded state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONTROLS, String(controlsExpanded));
  }, [controlsExpanded]);

  // Keyboard shortcut handler for front panel
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isDrawerOpen || !controlsExpanded || !isConnected || isPressing) return;

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
  }, [isDrawerOpen, controlsExpanded, isConnected, isPressing, pressButton]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col h-full">
      {/* Header - matches main header height */}
      <div className="flex items-center justify-between h-[88px] px-3 border-b border-s330-accent select-none">
        <span className="text-sm font-medium text-s330-text">S-330 Display</span>
        <div className="flex items-center gap-2">
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Live
            </span>
          )}
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              isConnected ? 'bg-green-400' : 'bg-s330-muted'
            )}
            title={isConnected ? 'MIDI connected' : 'MIDI disconnected'}
          />
          <button
            onClick={() => setControlsExpanded(!controlsExpanded)}
            className={cn(
              'p-1 text-s330-muted hover:text-s330-text',
              controlsExpanded && 'text-s330-highlight'
            )}
            title={controlsExpanded ? 'Hide controls' : 'Show controls'}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          </button>
        </div>
      </div>

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
          <div className="absolute bottom-0 left-0 right-0 bg-red-500/80 px-2 py-1">
            <p className="text-white text-xs">{error}</p>
          </div>
        )}
      </div>

      {/* Video Controls */}
      {hasPermission && devices.length > 0 && (
        <div className="p-2 border-t border-s330-accent flex gap-2 items-center">
          <select
            value={selectedDeviceId ?? ''}
            onChange={(e) => handleDeviceChange(e.target.value)}
            className={cn(
              'flex-1 px-2 py-1 text-xs font-mono',
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
                'px-3 py-1 text-xs rounded',
                'bg-s330-highlight text-white hover:bg-s330-highlight/80',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              Start
            </button>
          ) : (
            <button
              onClick={stopStream}
              className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-500"
            >
              Stop
            </button>
          )}
        </div>
      )}

      {/* Front Panel Controls */}
      {controlsExpanded && (
        <div className="p-3 border-t border-s330-accent space-y-3">
          <FunctionButtonRow
            onPress={pressButton}
            activeButton={activeButton}
            disabled={!isConnected || isPressing}
          />
          <div className="flex items-center justify-between gap-2">
            <NavigationPad
              onPress={pressButton}
              activeButton={activeButton}
              disabled={!isConnected || isPressing}
            />
            <ValueButtons
              onPress={pressButton}
              activeButton={activeButton}
              disabled={!isConnected || isPressing}
            />
          </div>
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
      )}
    </div>
  );
}
