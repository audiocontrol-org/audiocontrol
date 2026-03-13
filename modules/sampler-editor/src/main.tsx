import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { App } from '@/App';
import { DeviceConfigProvider, useDeviceConfigOptional } from '@/context/DeviceConfigContext';
import { getSupportedDevices } from '@/configs/registry';
import { initLogCapture } from '@audiocontrol/editor-core';
import '@audiocontrol/editor-core/tokens.css';
import '@audiocontrol/editor-core/primitives.css';
import '@/index.css';

// Initialize log capture before anything else
initLogCapture();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
    },
  },
});

/**
 * Wrapper component that sets up the device config context
 * and applies the correct data-editor attribute.
 */
function DeviceEditorWrapper() {
  return (
    <DeviceConfigProvider>
      <DeviceEditorContent />
    </DeviceConfigProvider>
  );
}

/**
 * Inner component that has access to the device config.
 */
function DeviceEditorContent() {
  const config = useDeviceConfigOptional();

  // Set the data-editor attribute for styling
  React.useEffect(() => {
    if (config) {
      document.documentElement.dataset.editor = config.deviceType;
    }
  }, [config]);

  return <App />;
}

/**
 * Device selection page shown when no device is selected.
 */
function DeviceSelectionPage() {
  const supportedDevices = getSupportedDevices();

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-6">Sampler Editor</h1>
        <p className="text-gray-400 mb-8">Select a device to edit:</p>
        <div className="flex flex-col gap-4">
          {supportedDevices.map((device) => (
            <a
              key={device}
              href={`/roland/${device}/editor`}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-medium transition-colors"
            >
              Roland {device.toUpperCase()}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// LegacyRedirect removed - URL structure is now /roland/:device/editor/*

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Routes>
          {/* Main editor route with device parameter */}
          <Route path="/roland/:device/editor/*" element={<DeviceEditorWrapper />} />

          {/* Device selection page */}
          <Route path="/" element={<DeviceSelectionPage />} />

          {/* Legacy redirect for old S-330 paths */}
          <Route path="/roland/s330/editor" element={<Navigate to="/roland/s330/editor/" replace />} />

          {/* Catch-all redirect to device selection */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
