/**
 * Abstract interface for deploying canonical MIDI maps to specific DAW formats.
 * Each DAW implements this interface to handle format conversion and installation.
 *
 * @module controller-workflow/types
 */

import type { CanonicalMidiMap } from '@audiocontrol/canonical-midi-maps';

/**
 * Interface for deploying canonical MIDI maps to DAW-specific formats.
 * Each DAW provides its own implementation.
 */
export interface DAWDeployerInterface {
  /** Name of the DAW (e.g., "Ardour", "Ableton Live") */
  readonly dawName: string;
  /** DAW version this deployer targets */
  readonly version: string;

  /**
   * Deploy a canonical MIDI map to this DAW's format.
   *
   * @param canonicalMap - Canonical MIDI map to deploy
   * @param options - Deployment options (output path, auto-install, etc.)
   * @returns Deployment result with success status and output path
   */
  deploy(
    canonicalMap: CanonicalMidiMap,
    options: DeploymentOptions
  ): Promise<DeploymentResult>;

  /**
   * Check if this DAW is installed on the system.
   *
   * @returns true if DAW is installed and accessible
   */
  isInstalled(): Promise<boolean>;

  /**
   * Get the configuration directory for this DAW.
   *
   * @returns Absolute path to DAW configuration directory
   * @throws Error if DAW is not installed or path cannot be determined
   */
  getConfigDirectory(): Promise<string>;
}

/**
 * Options for controlling the deployment process.
 */
export interface DeploymentOptions {
  /** Whether to automatically install to DAW config directory */
  autoInstall?: boolean;
  /** Custom output path (overrides default) */
  outputPath?: string;
  /** Preview deployment without writing files */
  dryRun?: boolean;
}

/**
 * Result of a deployment operation.
 */
export interface DeploymentResult {
  /** Whether deployment succeeded */
  success: boolean;
  /** Name of the DAW deployed to */
  dawName?: string;
  /** Path where configuration was written */
  outputPath?: string;
  /** Whether configuration was installed to DAW directory */
  installed?: boolean;
  /** List of errors that occurred during deployment */
  errors?: string[];
  /** Optional informational message about deployment */
  message?: string;
}
