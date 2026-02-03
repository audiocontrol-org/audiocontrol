/**
 * Core type definitions for the controller-workflow module.
 * Provides interfaces for controller adapters, canonical converters, and DAW deployers.
 *
 * @module controller-workflow/types
 */

// Controller adapter interfaces
export type {
  ControllerAdapterInterface,
  ControllerCapabilities,
  ControllerConfiguration,
  ConfigurationSlot,
  ControlMapping,
  ControlType,
  DeviceInfo,
} from './controller-adapter.js';

// Canonical converter interfaces
export type {
  CanonicalConverterInterface,
  ConversionOptions,
  ConverterInfo,
} from './canonical-converter.js';

// DAW deployer interfaces
export type {
  DAWDeployerInterface,
  DeploymentOptions,
  DeploymentResult,
} from './daw-deployer.js';
