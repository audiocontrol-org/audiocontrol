/**
 * Device configuration context for the sampler editor.
 *
 * Provides the current device configuration to all components in the tree.
 * The configuration is determined by the URL path (e.g., /roland/s330/editor).
 *
 * @packageDocumentation
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import type { DeviceConfig } from '@/configs/types.js';
import { getDeviceConfig, isDeviceSupported } from '@/configs/registry.js';

/**
 * Context for the current device configuration.
 */
const DeviceConfigContext = createContext<DeviceConfig | null>(null);

/**
 * Props for DeviceConfigProvider.
 */
interface DeviceConfigProviderProps {
  children: ReactNode;
  /** Optional override for the device type (useful for testing) */
  deviceType?: string;
}

/**
 * Provider component that reads the device type from the URL and provides
 * the corresponding configuration to all child components.
 *
 * Usage:
 * ```tsx
 * <Route path="/roland/:device/editor/*" element={
 *   <DeviceConfigProvider>
 *     <EditorApp />
 *   </DeviceConfigProvider>
 * } />
 * ```
 */
export function DeviceConfigProvider({ children, deviceType: deviceTypeOverride }: DeviceConfigProviderProps) {
  const params = useParams<{ device: string }>();
  const deviceType = deviceTypeOverride ?? params.device;

  const config = useMemo(() => {
    if (!deviceType) {
      return null;
    }

    if (!isDeviceSupported(deviceType)) {
      return null;
    }

    return getDeviceConfig(deviceType);
  }, [deviceType]);

  if (!deviceType) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No Device Selected</h1>
          <p className="text-gray-400">
            Please navigate to a device editor URL, e.g., /roland/s330/editor
          </p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Unsupported Device</h1>
          <p className="text-gray-400">
            Device type &quot;{deviceType}&quot; is not supported.
          </p>
        </div>
      </div>
    );
  }

  return (
    <DeviceConfigContext.Provider value={config}>
      {children}
    </DeviceConfigContext.Provider>
  );
}

/**
 * Hook to access the current device configuration.
 *
 * Must be used within a DeviceConfigProvider.
 *
 * @returns The current device configuration
 * @throws Error if used outside of a DeviceConfigProvider
 */
export function useDeviceConfig(): DeviceConfig {
  const config = useContext(DeviceConfigContext);

  if (!config) {
    throw new Error(
      'useDeviceConfig must be used within a DeviceConfigProvider. ' +
      'Make sure your component is wrapped in <DeviceConfigProvider>.'
    );
  }

  return config;
}

/**
 * Hook to optionally access the device configuration.
 *
 * Unlike useDeviceConfig, this won't throw if used outside a provider.
 *
 * @returns The current device configuration, or null if not available
 */
export function useDeviceConfigOptional(): DeviceConfig | null {
  return useContext(DeviceConfigContext);
}
