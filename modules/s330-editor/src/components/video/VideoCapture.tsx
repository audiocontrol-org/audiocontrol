/**
 * Video Capture Panel
 *
 * Displays video from a USB capture device (or webcam) using the
 * browser's Media Devices API. Useful for viewing S-330's display
 * alongside the editor.
 *
 * Includes collapsible front panel controls for remote S-330 operation.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useFrontPanel, type NavigationButton, type FunctionButton } from '@/hooks/useFrontPanel';
import { NavigationPad } from '@/components/front-panel/NavigationPad';
import { ValueButtons } from '@/components/front-panel/ValueButtons';
import { FunctionButtonRow } from '@/components/front-panel/FunctionButtonRow';

const STORAGE_KEY_DEVICE = 's330-video-device';
const STORAGE_KEY_POSITION = 's330-video-position';
const STORAGE_KEY_SIZE = 's330-video-size';
const STORAGE_KEY_CONTROLS = 's330-video-controls-expanded';

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 300;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;
const CONTROLS_HEIGHT = 180;

interface VideoDevice {
  deviceId: string;
  label: string;
}

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

// Check if mediaDevices API is available (requires secure context)
const isMediaDevicesAvailable = () =>
  typeof navigator !== 'undefined' && navigator.mediaDevices !== undefined;

export function VideoCapture() {
  const [isExpanded, setIsExpanded] = useState(false);
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

  // Position and size state
  const [position, setPosition] = useState<Position>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_POSITION);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return { x: window.innerWidth - DEFAULT_WIDTH - 16, y: window.innerHeight - DEFAULT_HEIGHT - 16 };
  });

  const [size, setSize] = useState<Size>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SIZE);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const resizeDirection = useRef<string | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });

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

  // Drag handlers
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, select, input')) return;
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
    e.preventDefault();
  }, [position]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging.current) return;
    const totalHeight = size.height + (controlsExpanded ? CONTROLS_HEIGHT : 0);
    const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragOffset.current.x));
    const newY = Math.max(0, Math.min(window.innerHeight - totalHeight, e.clientY - dragOffset.current.y));
    setPosition({ x: newX, y: newY });
  }, [size, controlsExpanded]);

  const handleDragEnd = useCallback(() => {
    if (isDragging.current) {
      isDragging.current = false;
      localStorage.setItem(STORAGE_KEY_POSITION, JSON.stringify(position));
    }
  }, [position]);

  // Resize handlers
  const handleResizeStart = useCallback((direction: string) => (e: React.MouseEvent) => {
    isResizing.current = true;
    resizeDirection.current = direction;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y,
    };
    e.preventDefault();
    e.stopPropagation();
  }, [size, position]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current || !resizeDirection.current) return;

    const deltaX = e.clientX - resizeStart.current.x;
    const deltaY = e.clientY - resizeStart.current.y;
    const dir = resizeDirection.current;

    let newWidth = resizeStart.current.width;
    let newHeight = resizeStart.current.height;
    let newX = resizeStart.current.posX;
    let newY = resizeStart.current.posY;

    if (dir.includes('e')) {
      newWidth = Math.max(MIN_WIDTH, resizeStart.current.width + deltaX);
    }
    if (dir.includes('w')) {
      const proposedWidth = resizeStart.current.width - deltaX;
      if (proposedWidth >= MIN_WIDTH) {
        newWidth = proposedWidth;
        newX = resizeStart.current.posX + deltaX;
      }
    }
    if (dir.includes('s')) {
      newHeight = Math.max(MIN_HEIGHT, resizeStart.current.height + deltaY);
    }
    if (dir.includes('n')) {
      const proposedHeight = resizeStart.current.height - deltaY;
      if (proposedHeight >= MIN_HEIGHT) {
        newHeight = proposedHeight;
        newY = resizeStart.current.posY + deltaY;
      }
    }

    newX = Math.max(0, Math.min(window.innerWidth - newWidth, newX));
    newY = Math.max(0, newY);

    setSize({ width: newWidth, height: newHeight });
    setPosition({ x: newX, y: newY });
  }, []);

  const handleResizeEnd = useCallback(() => {
    if (isResizing.current) {
      isResizing.current = false;
      resizeDirection.current = null;
      localStorage.setItem(STORAGE_KEY_SIZE, JSON.stringify(size));
      localStorage.setItem(STORAGE_KEY_POSITION, JSON.stringify(position));
    }
  }, [size, position]);

  // Global mouse event listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e);
      handleResizeMove(e);
    };
    const handleMouseUp = () => {
      handleDragEnd();
      handleResizeEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleDragMove, handleDragEnd, handleResizeMove, handleResizeEnd]);

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

  // Auto-start stream when expanded
  useEffect(() => {
    if (isExpanded && selectedDeviceId && hasPermission && !isStreaming) {
      startStream();
    } else if (!isExpanded && isStreaming) {
      stopStream();
    }
  }, [isExpanded, selectedDeviceId, hasPermission, isStreaming, startStream, stopStream]);

  // Persist controls expanded state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONTROLS, String(controlsExpanded));

    if (controlsExpanded) {
      const totalHeight = size.height + CONTROLS_HEIGHT;
      const maxY = window.innerHeight - totalHeight;
      if (position.y > maxY) {
        setPosition(prev => ({ ...prev, y: Math.max(0, maxY) }));
      }
    }
  }, [controlsExpanded, size.height, position.y]);

  // Keyboard shortcut handler for front panel
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isExpanded || !controlsExpanded || !isConnected || isPressing) return;

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
  }, [isExpanded, controlsExpanded, isConnected, isPressing, pressButton]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Collapsed button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className={cn(
            'px-4 py-2 rounded-lg shadow-lg',
            'bg-s330-panel border border-s330-accent',
            'text-s330-text hover:bg-s330-accent/50',
            'transition-colors flex items-center gap-2'
          )}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          Video
        </button>
      )}

      {/* Expanded panel */}
      {isExpanded && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            width: size.width,
            height: size.height + (controlsExpanded ? CONTROLS_HEIGHT : 0),
          }}
          className={cn(
            'bg-s330-panel border border-s330-accent rounded-lg shadow-xl',
            'overflow-hidden flex flex-col'
          )}
        >
          {/* Header - draggable */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b border-s330-accent cursor-move select-none"
            onMouseDown={handleDragStart}
          >
            <span className="text-sm font-medium text-s330-text">S-330 Display</span>
            <div className="flex items-center gap-2">
              {isStreaming && (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  Live
                </span>
              )}
              {/* MIDI connection indicator */}
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  isConnected ? 'bg-green-400' : 'bg-s330-muted'
                )}
                title={isConnected ? 'MIDI connected' : 'MIDI disconnected'}
              />
              {/* Controls toggle button */}
              <button
                onClick={() => setControlsExpanded(!controlsExpanded)}
                className={cn(
                  'p-1 text-s330-muted hover:text-s330-text',
                  controlsExpanded && 'text-s330-highlight'
                )}
                title={controlsExpanded ? 'Hide controls' : 'Show controls'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </button>
              {/* Close button */}
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 text-s330-muted hover:text-s330-text"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Video area */}
          <div className="flex-1 bg-black relative min-h-0">
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              playsInline
              muted
            />

            {/* Secure context required overlay */}
            {isSecureContext === false && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-s330-bg/90 p-4">
                <p className="text-s330-muted text-sm text-center">
                  Video capture requires HTTPS or localhost
                </p>
              </div>
            )}

            {/* Permission request overlay */}
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

            {/* No permission overlay */}
            {hasPermission === false && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-s330-bg/90 p-4">
                <p className="text-s330-muted text-sm text-center mb-2">
                  Camera access denied
                </p>
                <button
                  onClick={requestPermission}
                  className="px-3 py-1 text-sm bg-s330-accent text-s330-text rounded hover:bg-s330-accent/80"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* No devices overlay */}
            {hasPermission && devices.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-s330-bg/90">
                <p className="text-s330-muted text-sm">No video devices found</p>
              </div>
            )}

            {/* Error overlay */}
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

              {/* Mode toggle */}
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

          {/* Resize handles - corners */}
          <div
            onMouseDown={handleResizeStart('nw')}
            className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize hover:bg-s330-highlight/30"
          />
          <div
            onMouseDown={handleResizeStart('ne')}
            className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize hover:bg-s330-highlight/30"
          />
          <div
            onMouseDown={handleResizeStart('sw')}
            className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize hover:bg-s330-highlight/30"
          />
          <div
            onMouseDown={handleResizeStart('se')}
            className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize hover:bg-s330-highlight/30"
            style={{
              background: 'linear-gradient(135deg, transparent 50%, rgba(233, 69, 96, 0.5) 50%)',
            }}
          />

          {/* Resize handles - edges */}
          <div
            onMouseDown={handleResizeStart('n')}
            className="absolute top-0 left-3 right-3 h-1 cursor-n-resize hover:bg-s330-highlight/30"
          />
          <div
            onMouseDown={handleResizeStart('s')}
            className="absolute bottom-0 left-3 right-3 h-1 cursor-s-resize hover:bg-s330-highlight/30"
          />
          <div
            onMouseDown={handleResizeStart('w')}
            className="absolute left-0 top-3 bottom-3 w-1 cursor-w-resize hover:bg-s330-highlight/30"
          />
          <div
            onMouseDown={handleResizeStart('e')}
            className="absolute right-0 top-3 bottom-3 w-1 cursor-e-resize hover:bg-s330-highlight/30"
          />
        </div>
      )}
    </div>
  );
}
