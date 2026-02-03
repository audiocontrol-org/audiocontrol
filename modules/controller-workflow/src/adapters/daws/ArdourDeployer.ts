/**
 * Ardour DAW Deployer
 *
 * Converts canonical MIDI maps to Ardour XML format and deploys to Ardour configuration directory.
 * Handles platform-specific paths and auto-installation.
 *
 * @module adapters/daws/ArdourDeployer
 */

import { writeFile, mkdir, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir, platform } from 'node:os';
import type { CanonicalMidiMap } from '@audiocontrol/canonical-midi-maps';
import { MidiMapBuilder, ArdourXMLSerializer } from '@audiocontrol/ardour-midi-maps';
import type {
  DAWDeployerInterface,
  DeploymentOptions,
  DeploymentResult,
} from '@/types/daw-deployer.js';

/**
 * Platform provider interface for dependency injection
 */
export interface PlatformProvider {
  platform(): NodeJS.Platform;
  homedir(): string;
}

/**
 * Default platform provider using Node.js os module
 */
export class DefaultPlatformProvider implements PlatformProvider {
  platform(): NodeJS.Platform {
    return platform();
  }

  homedir(): string {
    return homedir();
  }
}

/**
 * Ardour DAW Deployer
 *
 * Converts canonical MIDI maps to Ardour's native XML format and optionally
 * installs them to the Ardour MIDI maps directory.
 */
export class ArdourDeployer implements DAWDeployerInterface {
  readonly dawName = 'Ardour';
  readonly version = '8.x';

  private readonly serializer = new ArdourXMLSerializer();
  private readonly platformProvider: PlatformProvider;

  /**
   * Constructor with dependency injection
   *
   * @param platformProvider - Provider for platform and homedir (optional, defaults to DefaultPlatformProvider)
   */
  constructor(platformProvider?: PlatformProvider) {
    this.platformProvider = platformProvider ?? new DefaultPlatformProvider();
  }

  /**
   * Factory method to create ArdourDeployer instance
   */
  static create(platformProvider?: PlatformProvider): ArdourDeployer {
    return new ArdourDeployer(platformProvider);
  }

  /**
   * Deploy a canonical MIDI map to Ardour format
   *
   * @param canonicalMap - Canonical MIDI map to convert and deploy
   * @param options - Deployment options (output path, auto-install, dry run)
   * @returns Deployment result with success status and output path
   */
  async deploy(canonicalMap: CanonicalMidiMap, options: DeploymentOptions): Promise<DeploymentResult> {
    const errors: string[] = [];

    try {
      // Convert canonical map to Ardour format
      const ardourMap = this.convertToArdour(canonicalMap);

      // Serialize to XML
      const xmlContent = this.serializer.serializeMidiMap(ardourMap);

      // Determine output path
      let outputPath: string;
      if (options.outputPath) {
        outputPath = options.outputPath;
      } else if (options.autoInstall) {
        const configDir = await this.getConfigDirectory();
        outputPath = join(configDir, this.getDefaultOutputPath(canonicalMap));
      } else {
        outputPath = this.getDefaultOutputPath(canonicalMap);
      }

      // Dry run - don't write files
      if (options.dryRun) {
        return {
          success: true,
          dawName: this.dawName,
          outputPath,
          installed: false,
        };
      }

      // Ensure directory exists
      await mkdir(dirname(outputPath), { recursive: true });

      // Write XML file
      await writeFile(outputPath, xmlContent, 'utf-8');

      return {
        success: true,
        dawName: this.dawName,
        outputPath,
        installed: options.autoInstall === true,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Deployment failed: ${message}`);

      return {
        success: false,
        dawName: this.dawName,
        errors,
      };
    }
  }

  /**
   * Check if Ardour is installed on the system
   *
   * Checks for the existence of Ardour's configuration directory.
   *
   * @returns true if Ardour configuration directory exists
   */
  async isInstalled(): Promise<boolean> {
    try {
      const configDir = await this.getConfigDirectory();
      await access(configDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Ardour's MIDI maps configuration directory
   *
   * Returns platform-specific paths:
   * - macOS: ~/Library/Application Support/Ardour8/midi_maps
   * - Linux: ~/.config/ardour8/midi_maps
   * - Windows: %APPDATA%/Ardour8/midi_maps
   *
   * @returns Absolute path to Ardour MIDI maps directory
   * @throws Error if platform is not supported
   */
  async getConfigDirectory(): Promise<string> {
    const home = this.platformProvider.homedir();
    const os = this.platformProvider.platform();

    switch (os) {
      case 'darwin':
        return join(home, 'Library', 'Application Support', 'Ardour8', 'midi_maps');
      case 'linux':
        return join(home, '.config', 'ardour8', 'midi_maps');
      case 'win32':
        return join(process.env['APPDATA'] || join(home, 'AppData', 'Roaming'), 'Ardour8', 'midi_maps');
      default:
        throw new Error(`Unsupported platform: ${os}`);
    }
  }

  /**
   * Convert canonical MIDI map to Ardour format
   *
   * Maps canonical control definitions to Ardour MIDI bindings.
   * Groups controls by MIDI channel for better organization.
   *
   * @param canonicalMap - Canonical MIDI map
   * @returns Ardour MIDI map with bindings
   */
  private convertToArdour(canonicalMap: CanonicalMidiMap) {
    const mapName = this.generateMapName(canonicalMap);
    const builder = new MidiMapBuilder({ name: mapName });

    // Group controls by MIDI channel
    const channelGroups = this.groupControlsByChannel(canonicalMap);

    // Add bindings for each channel group
    for (const [channel, controls] of channelGroups) {
      // Add comment for this channel
      const channelComment = canonicalMap.plugin
        ? `${canonicalMap.plugin.name}`
        : `${canonicalMap.device.manufacturer} ${canonicalMap.device.model}`;

      builder.addChannelComment(channel, channelComment);

      // Add control bindings
      for (const control of controls) {
        this.addControlBinding(builder, control, channel);
      }
    }

    return builder.build();
  }

  /**
   * Group controls by MIDI channel for organized output
   *
   * @param canonicalMap - Canonical MIDI map
   * @returns Map of channel number to controls
   */
  private groupControlsByChannel(canonicalMap: CanonicalMidiMap): Map<number, typeof canonicalMap.controls> {
    const groups = new Map<number, typeof canonicalMap.controls>();

    for (const control of canonicalMap.controls) {
      // Determine channel (control-specific or map-wide default)
      const channel = this.resolveChannel(control.channel, canonicalMap.midi_channel);

      if (!groups.has(channel)) {
        groups.set(channel, []);
      }
      groups.get(channel)!.push(control);
    }

    // Sort by channel number
    return new Map([...groups.entries()].sort((a, b) => a[0] - b[0]));
  }

  /**
   * Resolve MIDI channel from control or map-level default
   *
   * @param controlChannel - Control-specific channel (string or number)
   * @param mapChannel - Map-level default channel
   * @returns Resolved channel number (0-15)
   */
  private resolveChannel(controlChannel: string | number | undefined, mapChannel: number | undefined): number {
    if (controlChannel !== undefined) {
      return typeof controlChannel === 'string' ? parseInt(controlChannel, 10) : controlChannel;
    }
    return mapChannel ?? 0;
  }

  /**
   * Add a control binding to the Ardour MIDI map builder
   *
   * @param builder - Ardour MIDI map builder
   * @param control - Canonical control definition
   * @param channel - MIDI channel number
   */
  private addControlBinding(builder: MidiMapBuilder, control: any, channel: number): void {
    // Handle button groups
    if (control.type === 'button_group' && control.buttons) {
      for (const button of control.buttons) {
        const buttonChannel = this.resolveChannel(button.channel, channel);
        builder.addNoteBinding({
          channel: buttonChannel,
          note: button.cc,
          uri: this.generateParameterURI(control),
          momentary: button.mode === 'momentary',
        });
      }
      return;
    }

    // Handle regular controls
    if (control.cc === undefined) {
      throw new Error(`Control ${control.id} missing CC number`);
    }

    switch (control.type) {
      case 'encoder':
        builder.addCCBinding({
          channel,
          controller: control.cc,
          uri: this.generateParameterURI(control),
          encoder: true,
        });
        break;

      case 'slider':
        builder.addCCBinding({
          channel,
          controller: control.cc,
          uri: this.generateParameterURI(control),
        });
        break;

      case 'button':
        builder.addNoteBinding({
          channel,
          note: control.cc,
          uri: this.generateParameterURI(control),
          momentary: control.mode === 'momentary',
        });
        break;

      default:
        throw new Error(`Unsupported control type: ${control.type}`);
    }
  }

  /**
   * Generate Ardour parameter URI from control definition
   *
   * @param control - Canonical control definition
   * @returns Parameter URI string
   */
  private generateParameterURI(control: any): string {
    if (control.plugin_parameter !== undefined) {
      return `/plugins/parameter/${control.plugin_parameter}`;
    }
    // Fallback to generic parameter based on control ID
    return `/plugins/parameter/${control.id}`;
  }

  /**
   * Generate Ardour map name from canonical map metadata
   *
   * @param canonicalMap - Canonical MIDI map
   * @returns Map name for Ardour
   */
  private generateMapName(canonicalMap: CanonicalMidiMap): string {
    const device = `${canonicalMap.device.manufacturer} ${canonicalMap.device.model}`;
    if (canonicalMap.plugin) {
      return `${device} - ${canonicalMap.plugin.name}`;
    }
    return device;
  }

  /**
   * Get default output filename for a canonical map
   *
   * @param canonicalMap - Canonical MIDI map
   * @returns XML filename
   */
  private getDefaultOutputPath(canonicalMap: CanonicalMidiMap): string {
    const name = this.generateMapName(canonicalMap)
      .replace(/[^a-zA-Z0-9-_\s]/g, '') // Remove special chars
      .replace(/\s+/g, '_')              // Replace spaces with underscores
      .toLowerCase();

    return `${name}.map`;
  }
}

/**
 * Factory function for creating ArdourDeployer instances
 */
export function createArdourDeployer(): ArdourDeployer {
  return ArdourDeployer.create();
}
