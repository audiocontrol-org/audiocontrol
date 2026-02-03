/**
 * Ableton Live DAW Deployer
 *
 * Converts canonical MIDI maps to Max for Live cc-router format.
 * Updates the plugin-mappings.json data file used by the M4L device.
 *
 * @module adapters/daws/LiveDeployer
 */

import { homedir } from 'os';
import { join, dirname } from 'path';
import { readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import type { CanonicalMidiMap } from '@audiocontrol/canonical-midi-maps';
import type {
  DAWDeployerInterface,
  DeploymentOptions,
  DeploymentResult,
} from '../../types/daw-deployer.js';

/**
 * Max for Live plugin mapping data structure.
 * Represents a complete MIDI CC to plugin parameter mapping for the cc-router device.
 */
interface PluginMapping {
  /** Controller device information */
  controller: {
    /** Controller manufacturer name */
    manufacturer?: string;
    /** Controller model name */
    model?: string;
  };
  /** Plugin name being controlled */
  pluginName: string;
  /** Plugin manufacturer name */
  pluginManufacturer: string;
  /** MIDI CC number to parameter mappings */
  mappings: {
    [ccNumber: number]: {
      /** Index of the device in the Live track (0 = cc-router, 1 = first plugin) */
      deviceIndex: number;
      /** Index of the parameter within the plugin */
      parameterIndex: number;
      /** Human-readable parameter name */
      parameterName: string;
      /** Parameter value curve type */
      curve: 'linear' | 'exponential' | 'logarithmic';
    };
  };
  /** Optional mapping metadata */
  metadata: {
    /** Mapping configuration name */
    name?: string;
    /** Description of this mapping */
    description?: string;
    /** Version of this mapping */
    version?: string;
  };
}

/**
 * Ableton Live DAW Deployer
 *
 * Converts canonical maps to Max for Live format and updates the cc-router's
 * canonical-plugin-maps.ts file so mappings are available in Live.
 */
export class LiveDeployer implements DAWDeployerInterface {
  readonly dawName = 'Ableton Live';
  readonly version = '11/12';

  /**
   * Factory method to create LiveDeployer instance
   */
  static create(): LiveDeployer {
    return new LiveDeployer();
  }

  /**
   * Deploy canonical map to Live's cc-router module
   *
   * @param canonicalMap - Canonical MIDI map
   * @param options - Deployment options
   * @returns Deployment result with path to updated plugin-mappings.json
   */
  async deploy(canonicalMap: CanonicalMidiMap, options: DeploymentOptions): Promise<DeploymentResult> {
    try {
      // Convert to M4L format
      const pluginMapping = this.convertToM4LFormat(canonicalMap);

      // Get path to live-max-cc-router module
      const ccRouterPath = this.getCCRouterPath();
      const jsonMappingsFile = join(ccRouterPath, 'data', 'plugin-mappings.json');

      if (options.dryRun) {
        const result: DeploymentResult = {
          success: true,
          dawName: this.dawName,
          outputPath: jsonMappingsFile,
          installed: false,
        };
        return result;
      }

      // Read existing plugin-mappings.json (or create empty database)
      let existingMappings: Record<string, PluginMapping> = {};
      try {
        const existingContent = await readFile(jsonMappingsFile, 'utf-8');
        existingMappings = JSON.parse(existingContent);
      } catch (error) {
        // File doesn't exist yet, start with empty mappings
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error; // Re-throw if it's not a "file not found" error
        }
      }

      // Update with new mapping
      const updatedMappings = await this.updateCanonicalMaps(existingMappings, pluginMapping, canonicalMap);

      // Write back to file with 2-space indentation
      await writeFile(jsonMappingsFile, JSON.stringify(updatedMappings, null, 2) + '\n', 'utf-8');

      return {
        success: true,
        dawName: this.dawName,
        outputPath: jsonMappingsFile,
        installed: true,
        message: `Updated ${jsonMappingsFile}. Reload cc-router mapping with: cd ${ccRouterPath} && npm run build`,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        dawName: this.dawName,
        errors: [errorMsg],
      };
    }
  }

  /**
   * Get path to live-max-cc-router module.
   *
   * Navigates from controller-workflow to the sibling live-max-cc-router module
   * where the cc-router Max for Live device and its data files are located.
   *
   * @returns Absolute path to live-max-cc-router module
   * @internal
   */
  private getCCRouterPath(): string {
    // Assume we're in controller-workflow, navigate to sibling module
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    return join(__dirname, '..', '..', '..', '..', 'live-max-cc-router');
  }

  /**
   * Convert canonical MIDI map to M4L plugin mapping format.
   *
   * Transforms canonical control definitions into the JSON structure expected
   * by the cc-router Max for Live device. Each control's CC number is mapped
   * to a plugin parameter with device/parameter indices.
   *
   * Prioritizes plugin_parameter if available, otherwise falls back to extracting
   * from control ID.
   *
   * @param canonicalMap - Canonical MIDI map to convert
   * @returns PluginMapping structure for cc-router
   * @internal
   */
  private convertToM4LFormat(canonicalMap: CanonicalMidiMap): PluginMapping {
    const mappings: PluginMapping['mappings'] = {};

    // Convert each control to M4L format
    for (const control of canonicalMap.controls) {
      if (control.cc === undefined) {
        continue; // Skip controls without CC numbers
      }

      // Use plugin_parameter if available, otherwise extract from control ID
      const parameterIndex = (control as any).plugin_parameter !== undefined
        ? (control as any).plugin_parameter
        : this.extractParameterIndex(control.id);

      mappings[control.cc] = {
        deviceIndex: 1, // Device 1 is the first plugin after cc-router (device 0)
        parameterIndex,
        parameterName: control.name || control.id,
        curve: 'linear', // Default curve, could be enhanced with metadata
      };
    }

    // Determine plugin name from map name or metadata
    const pluginName = canonicalMap.plugin?.name || canonicalMap.metadata.name || 'Unknown Plugin';
    const pluginManufacturer = canonicalMap.plugin?.manufacturer || 'Unknown';

    return {
      controller: {
        manufacturer: canonicalMap.device.manufacturer,
        model: canonicalMap.device.model,
      },
      pluginName,
      pluginManufacturer,
      mappings,
      metadata: {
        ...(canonicalMap.metadata.name !== undefined && { name: canonicalMap.metadata.name }),
        ...(canonicalMap.metadata.description !== undefined && { description: canonicalMap.metadata.description }),
        ...(canonicalMap.version !== undefined && { version: canonicalMap.version }),
      },
    };
  }

  /**
   * Extract parameter index from control ID.
   *
   * Parses numeric suffix from control IDs to determine parameter index.
   * Control IDs like "encoder_16" or "slider_3" map to parameter indices
   * based on their semantic meaning.
   *
   * This is used as a fallback when plugin_parameter is not specified.
   *
   * @param controlId - Control identifier (e.g., "encoder_16", "slider_3")
   * @returns Parameter index (0 if no number found)
   * @internal
   *
   * @example
   * ```typescript
   * extractParameterIndex("encoder_16") // returns 16
   * extractParameterIndex("slider_3")   // returns 3
   * extractParameterIndex("button")     // returns 0
   * ```
   */
  private extractParameterIndex(controlId: string): number {
    // Try to extract number from control ID
    const match = controlId.match(/(\d+)$/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    // Fallback to 0 if no number found
    return 0;
  }

  /**
   * Update plugin mappings database with new mapping.
   *
   * Adds or updates a mapping in the plugin-mappings.json database.
   * The mapping key is generated from controller and plugin names to ensure
   * uniqueness across different controller-plugin combinations.
   *
   * @param existingMappings - Current mappings database
   * @param newMapping - New mapping to add/update
   * @param canonicalMap - Source canonical map for key generation
   * @returns Updated mappings database
   * @internal
   */
  private async updateCanonicalMaps(
    existingMappings: Record<string, PluginMapping>,
    newMapping: PluginMapping,
    canonicalMap: CanonicalMidiMap
  ): Promise<Record<string, PluginMapping>> {
    // Generate mapping key from controller and plugin name
    const mappingKey = this.generateMappingKey(canonicalMap);

    // Add or update mapping in the database
    const updatedMappings = {
      ...existingMappings,
      [mappingKey]: newMapping,
    };

    return updatedMappings;
  }

  /**
   * Generate unique mapping key from canonical map.
   *
   * Creates a key in the format "controller_plugin" where both parts
   * are lowercase and space-separated. This key uniquely identifies
   * a controller-plugin pairing in the mappings database.
   *
   * @param canonicalMap - Canonical map containing device and plugin info
   * @returns Mapping key (e.g., "launch-control-xl-3_vital-synth")
   * @internal
   *
   * @example
   * ```typescript
   * // For a Launch Control XL 3 mapped to Vital synth:
   * generateMappingKey(map) // returns "launch-control-xl-3_vital-synth"
   * ```
   */
  private generateMappingKey(canonicalMap: CanonicalMidiMap): string {
    const controller = (canonicalMap.device.model ?? 'unknown').toLowerCase().replace(/\s+/g, '-');
    const plugin = (canonicalMap.plugin?.name ?? canonicalMap.metadata.name ?? 'unknown')
      .toLowerCase()
      .replace(/\s+/g, '-');
    return `${controller}_${plugin}`;
  }


  /**
   * Check if Ableton Live is installed.
   *
   * For Live, we check if the cc-router module exists rather than checking
   * for Live itself, since the cc-router is required for deployment to work.
   *
   * @returns true if cc-router module is accessible
   */
  async isInstalled(): Promise<boolean> {
    // For now, assume Live is installed if cc-router module exists
    try {
      const ccRouterPath = this.getCCRouterPath();
      await readFile(join(ccRouterPath, 'package.json'), 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Ableton Live's User Library Remote Scripts directory.
   *
   * Returns platform-specific paths:
   * - macOS: ~/Music/Ableton/User Library/Remote Scripts
   * - Windows: ~/Documents/Ableton/User Library/Remote Scripts
   * - Linux: ~/Ableton/User Library/Remote Scripts
   *
   * @returns Absolute path to Live's Remote Scripts directory
   * @throws Error if platform is not supported
   */
  async getConfigDirectory(): Promise<string> {
    const home = homedir();
    switch (process.platform) {
      case 'darwin':
        return join(home, 'Music', 'Ableton', 'User Library', 'Remote Scripts');
      case 'win32':
        return join(home, 'Documents', 'Ableton', 'User Library', 'Remote Scripts');
      case 'linux':
        return join(home, 'Ableton', 'User Library', 'Remote Scripts');
      default:
        throw new Error(`Unsupported platform: ${process.platform}`);
    }
  }
}

/**
 * Factory function for creating LiveDeployer instances
 */
export function createLiveDeployer(): LiveDeployer {
  return LiveDeployer.create();
}
