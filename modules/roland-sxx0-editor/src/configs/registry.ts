/**
 * Device configuration registry.
 *
 * Maps device type identifiers to their configurations.
 *
 * @packageDocumentation
 */

import type { DeviceConfig, SamplerDeviceType } from './types.js';
import { s330Config } from './s330.js';
import { s550Config } from './s550.js';

/**
 * Registry of all supported device configurations.
 */
const deviceConfigs: Record<SamplerDeviceType, DeviceConfig> = {
  s330: s330Config,
  s550: s550Config,
};

/**
 * Get the configuration for a device type.
 *
 * @param deviceType - The device type identifier (e.g., 's330', 's550')
 * @returns The device configuration
 * @throws Error if the device type is not supported
 */
export function getDeviceConfig(deviceType: string): DeviceConfig {
  const config = deviceConfigs[deviceType as SamplerDeviceType];
  if (!config) {
    throw new Error(
      `Unsupported device type: ${deviceType}. Supported devices: ${Object.keys(deviceConfigs).join(', ')}`
    );
  }
  return config;
}

/**
 * Check if a device type is supported.
 *
 * @param deviceType - The device type to check
 * @returns true if the device is supported
 */
export function isDeviceSupported(deviceType: string): deviceType is SamplerDeviceType {
  return deviceType in deviceConfigs;
}

/**
 * Get all supported device types.
 */
export function getSupportedDevices(): SamplerDeviceType[] {
  return Object.keys(deviceConfigs) as SamplerDeviceType[];
}

/**
 * Get all device configurations.
 */
export function getAllDeviceConfigs(): DeviceConfig[] {
  return Object.values(deviceConfigs);
}
