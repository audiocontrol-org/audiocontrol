/**
 * Device configuration exports.
 *
 * @packageDocumentation
 */

export type {
  DeviceConfig,
  SamplerDeviceType,
  SamplerClientInterface,
  ClientFactory,
} from './types.js';

export {
  getPatchBankCount,
  getToneBankCount,
  getPatchBankIndex,
  getToneBankIndex,
} from './types.js';

export { s330Config } from './s330.js';
export { s550Config } from './s550.js';

export {
  getDeviceConfig,
  isDeviceSupported,
  getSupportedDevices,
  getAllDeviceConfigs,
} from './registry.js';
