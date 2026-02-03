#!/usr/bin/env tsx

/**
 * Generate Ardour MIDI Maps from New Canonical Template Format
 *
 * This script:
 * 1. Finds all canonical MIDI map files in the new template format
 * 2. Converts each template to Ardour XML format
 * 3. Installs them to the appropriate Ardour configuration directory
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, basename, extname, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
// Import removed - will use CanonicalMapParser for YAML parsing
import { CanonicalMapParser } from '../../canonical-midi-maps/src/index.js';
import { MidiMapBuilder, ArdourXMLSerializer } from '../src/index.js';

interface ConversionResult {
  device: string;
  ardour: string;
  success: boolean;
  error?: string;
  pluginCount?: number;
  totalMappings?: number;
}

interface DeviceGroup {
  manufacturer: string;
  model: string;
  templates: ParsedTemplate[];
}

interface ParsedTemplate {
  filePath: string;
  fileName: string;
  map: any;
  assignedChannel: number;
}

interface MidiChannelRegistry {
  channels: Record<string, {
    plugin: string;
    description: string;
    manufacturer: string;
    type: string;
  }>;
  available_channels: number[];
}

/**
 * Get Ardour MIDI maps directory based on OS
 */
function getArdourMidiMapsDir(): string {
  const platform = process.platform;
  const home = homedir();

  switch (platform) {
    case 'darwin': // macOS
      return join(home, 'Library', 'Preferences', 'Ardour8', 'midi_maps');
    case 'linux':
      return join(home, '.config', 'ardour8', 'midi_maps');
    case 'win32': // Windows
      return join(home, 'AppData', 'Local', 'Ardour8', 'midi_maps');
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Convert template control to Ardour binding based on plugin parameter
 */
function convertControlToArdourBinding(control: any): { function?: string; uri?: string } {
  // If no plugin parameter is specified, use generic track controls
  if (!control.plugin_parameter) {
    return getGenericArdourBinding(control);
  }

  // Use URI format for plugin parameters: /route/plugin/parameter TRACK PLUGIN_SLOT PARAM_NAME
  // Use S1 (selected strip) for plugin parameters to control currently selected track
  return { uri: `/route/plugin/parameter S1 1 ${control.plugin_parameter}` };
}

/**
 * Get generic Ardour binding for controls without plugin parameters
 */
function getGenericArdourBinding(control: any): { function?: string; uri?: string } {
  const name = control.name.toLowerCase();
  const type = control.type;

  // Handle different control types and names
  if (type === 'slider') {
    if (name.includes('attack') || name.includes('a')) {
      return { function: 'track-set-send-gain[1,1]' };
    } else if (name.includes('decay') || name.includes('d')) {
      return { function: 'track-set-send-gain[1,2]' };
    } else if (name.includes('sustain') || name.includes('s')) {
      return { function: 'track-set-send-gain[1,3]' };
    } else if (name.includes('release') || name.includes('r')) {
      return { function: 'track-set-send-gain[1,4]' };
    } else if (name.includes('level') || name.includes('volume')) {
      return { function: 'track-set-gain[1]' };
    } else if (name.includes('osc') && name.includes('1')) {
      return { function: 'track-set-send-gain[1,5]' };
    } else if (name.includes('osc') && name.includes('2')) {
      return { function: 'track-set-send-gain[1,6]' };
    } else if (name.includes('osc') && name.includes('3')) {
      return { function: 'track-set-send-gain[1,7]' };
    } else if (name.includes('noise')) {
      return { function: 'track-set-send-gain[1,8]' };
    } else {
      return { function: 'track-set-trim[1]' };
    }
  } else if (type === 'encoder') {
    if (name.includes('cutoff')) {
      return { function: 'track-set-send-gain[1,1]' };
    } else if (name.includes('resonance')) {
      return { function: 'track-set-send-gain[1,2]' };
    } else if (name.includes('lfo') && name.includes('rate')) {
      return { function: 'track-set-send-gain[1,3]' };
    } else if (name.includes('glide') || name.includes('portamento')) {
      return { function: 'track-set-send-gain[1,4]' };
    } else {
      return { function: 'track-set-pan[1]' };
    }
  } else if (type === 'button') {
    if (name.includes('solo')) {
      return { function: 'track-solo[1]' };
    } else if (name.includes('mute')) {
      return { function: 'track-mute[1]' };
    } else {
      return { function: 'transport-stop' };
    }
  } else {
    // Default fallback
    return { function: 'track-select[1]' };
  }
}

/**
 * Find all canonical template files
 */
function findCanonicalTemplates(mapsDir: string): string[] {
  if (!existsSync(mapsDir)) {
    console.warn(`Maps directory not found: ${mapsDir}`);
    return [];
  }

  const templates: string[] = [];

  function scanDirectory(dir: string): void {
    const items = readdirSync(dir);

    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scanDirectory(fullPath);
      } else if (extname(item) === '.yaml' || extname(item) === '.yml') {
        // Skip README, process documentation files, and registry files
        if (!item.toLowerCase().includes('readme') &&
            !item.toLowerCase().includes('process') &&
            !item.toLowerCase().includes('midi-channel-registry')) {
          templates.push(fullPath);
        }
      }
    }
  }

  scanDirectory(mapsDir);
  return templates;
}

/**
 * Load MIDI channel registry for a device directory
 */
function loadMidiChannelRegistry(deviceDir: string): MidiChannelRegistry | null {
  // Try current directory first
  let registryPath = join(deviceDir, 'midi-channel-registry.yaml');

  // If not found, try parent directory (for subdirectory organization)
  if (!existsSync(registryPath)) {
    const parentDir = dirname(deviceDir);
    registryPath = join(parentDir, 'midi-channel-registry.yaml');
  }

  if (!existsSync(registryPath)) {
    console.warn(`No MIDI channel registry found at: ${registryPath} or parent directory`);
    return null;
  }

  try {
    const registryContent = readFileSync(registryPath, 'utf8');

    // Extract channels mapping from YAML content
    // Simple approach: parse the channels section manually
    const channels: Record<string, any> = {};

    const lines = registryContent.split('\n');
    let inChannelsSection = false;
    let currentChannel: string | null = null;
    let currentChannelData: any = null;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === 'channels:') {
        inChannelsSection = true;
        continue;
      }

      if (inChannelsSection) {
        // Check if we've left the channels section (no more indentation)
        if (trimmed && !line.startsWith('  ')) {
          break;
        }

        // Channel number (e.g., "  1:")
        if (line.match(/^  \d+:$/)) {
          if (currentChannel && currentChannelData) {
            channels[currentChannel] = currentChannelData;
          }
          currentChannel = trimmed.replace(':', '');
          currentChannelData = {};
        }

        // Channel properties (e.g., "    plugin: analog-obsession-channev")
        if (line.match(/^    \w+:/)) {
          if (currentChannelData) {
            const [key, value] = trimmed.split(':', 2);
            currentChannelData[key] = value.trim().replace(/^["']|["']$/g, ''); // Remove quotes
          }
        }
      }
    }

    // Don't forget the last channel
    if (currentChannel && currentChannelData) {
      channels[currentChannel] = currentChannelData;
    }

    if (Object.keys(channels).length === 0) {
      console.error(`No channels found in registry: ${registryPath}`);
      return null;
    }

    console.log(`✓ Registry loaded with ${Object.keys(channels).length} channels:`, Object.keys(channels));
    return { channels, available_channels: [] } as MidiChannelRegistry;
  } catch (error) {
    console.error(`Failed to load registry from ${registryPath}: ${error}`);
    return null;
  }
}

/**
 * Generate device-specific Ardour filename
 */
function generateDeviceFilename(manufacturer: string, model: string): string {
  const cleanManufacturer = manufacturer.toLowerCase().replace(/\s+/g, '-');
  const cleanModel = model.toLowerCase().replace(/\s+/g, '-');
  return `${cleanManufacturer}-${cleanModel}.map`;
}

/**
 * Parse all templates and group by device, using registry for MIDI channel assignment
 */
async function parseAndGroupTemplates(templatePaths: string[]): Promise<DeviceGroup[]> {
  const deviceMap = new Map<string, DeviceGroup>();
  const deviceRegistries = new Map<string, MidiChannelRegistry>();

  for (const templatePath of templatePaths) {
    try {
      const yamlContent = readFileSync(templatePath, 'utf8');
      const { map, validation } = CanonicalMapParser.parseFromYAML(yamlContent);

      if (!validation.valid || !map) {
        console.error(`❌ Skipping invalid template ${basename(templatePath)}: ${validation.errors.map(e => e.message).join(', ')}`);
        continue;
      }

      const deviceKey = `${map.device.manufacturer}|${map.device.model}`;
      const deviceDir = dirname(templatePath);

      if (!deviceMap.has(deviceKey)) {
        deviceMap.set(deviceKey, {
          manufacturer: map.device.manufacturer,
          model: map.device.model,
          templates: [],
        });
      }

      const deviceGroup = deviceMap.get(deviceKey)!;

      // Load registry for this device if not already loaded
      if (!deviceRegistries.has(deviceKey)) {
        const registry = loadMidiChannelRegistry(deviceDir);
        if (registry) {
          deviceRegistries.set(deviceKey, registry);
        }
      }

      // Determine MIDI channel assignment
      let assignedChannel: number;

      console.log(`  Processing ${basename(templatePath)}: midi_channel_registry=${map.midi_channel_registry}, midi_channel=${map.midi_channel}`);

      if (map.midi_channel_registry) {
        // Use registry to look up channel assignment
        const registry = deviceRegistries.get(deviceKey);
        if (registry) {
          // Extract relative path from template path (subdirectory/filename without .yaml)
          const templateDir = dirname(templatePath);
          const parentDir = dirname(templateDir);
          const pluginFilename = basename(templatePath, '.yaml');

          // Create relative path like "roland-jupiter-8/tal-j8"
          let relativePath: string;
          if (templateDir === parentDir || basename(templateDir) === basename(parentDir)) {
            // File is in the main directory
            relativePath = pluginFilename;
          } else {
            // File is in a subdirectory
            const subdirectory = basename(templateDir);
            relativePath = `${subdirectory}/${pluginFilename}`;
          }

          // Find the channel assigned to this plugin in the registry
          console.log(`    Looking for registry entry: "${relativePath}"`);
          console.log(`    Registry channels:`, Object.entries(registry.channels).map(([ch, info]) => `${ch}:${info.path || info.plugin}`));

          const channelEntry = Object.entries(registry.channels).find(
            ([channel, info]) => {
              // Support both old 'plugin' field and new 'path' field
              const match = info.path === relativePath || info.plugin === pluginFilename;
              console.log(`    Checking channel ${channel}: ${info.path || info.plugin} === ${relativePath}? ${match}`);
              return match;
            }
          );

          if (channelEntry) {
            assignedChannel = parseInt(channelEntry[0]);
            console.log(`    ✓ Found registry assignment: ${relativePath} → Channel ${assignedChannel}`);
          } else {
            const available = Object.values(registry.channels).map(c => c.path || c.plugin).join(', ');
            console.error(`❌ Plugin ${relativePath} not found in registry. Available: ${available}`);
            continue;
          }
        } else {
          console.error(`❌ Registry reference found but no registry loaded for ${basename(templatePath)}`);
          continue;
        }
      } else if (map.midi_channel) {
        // Use explicit channel from template (legacy support)
        assignedChannel = map.midi_channel;
        console.log(`    Using explicit channel assignment: ${map.midi_channel}`);
      } else {
        // Fallback to auto-assignment (deprecated)
        assignedChannel = deviceGroup.templates.length + 1;
        console.warn(`    ⚠️  Using deprecated auto-assignment: Channel ${assignedChannel}. Consider adding to registry.`);
      }

      // Validate channel doesn't exceed MIDI limit
      if (assignedChannel > 16) {
        console.error(`❌ Skipping template ${basename(templatePath)}: Channel ${assignedChannel} exceeds MIDI limit (16)`);
        continue;
      }

      deviceGroup.templates.push({
        filePath: templatePath,
        fileName: basename(templatePath),
        map,
        assignedChannel,
      });

    } catch (error) {
      console.error(`❌ Error parsing template ${basename(templatePath)}: ${error}`);
    }
  }

  return Array.from(deviceMap.values());
}

/**
 * Create consolidated Ardour map from device group
 */
async function createConsolidatedMap(deviceGroup: DeviceGroup): Promise<any> {
  // Use first template's device info for base configuration
  const firstTemplate = deviceGroup.templates[0];
  const device = firstTemplate.map.device;

  // Create consolidated map name
  const mapName = `${device.manufacturer} ${device.model}`;

  // Add DeviceInfo for controllers with multiple channels/faders
  let deviceInfo: any = undefined;
  if (device.model.toLowerCase().includes('launch control xl')) {
    deviceInfo = {
      'device-name': mapName,
      'device-info': {
        'bank-size': 8, // 8 fader banks on Launch Control XL
      }
    };
  }

  const ardourBuilder = new MidiMapBuilder({
    name: mapName,
    version: firstTemplate.map.version,
    deviceInfo: deviceInfo,
  });

  // Add mappings from all templates using their assigned channels
  for (const template of deviceGroup.templates) {
    const map = template.map;
    const midiChannel = template.assignedChannel;
    const pluginName = map.plugin ? map.plugin.name : map.metadata.name;

    console.log(`    Adding ${pluginName} mappings to channel ${midiChannel}`);

    // Add channel comment to builder with manufacturer
    const manufacturerName = map.plugin ? map.plugin.manufacturer : 'Generic';
    const commentText = map.plugin ? `${manufacturerName} ${pluginName}` : pluginName;
    ardourBuilder.addChannelComment(midiChannel, commentText);

    // Convert controls to Ardour bindings
    for (const control of map.controls) {
      // Handle regular controls (encoders, sliders, buttons)
      if (control.type !== 'button_group' && control.cc !== undefined) {
        const ardourBinding = convertControlToArdourBinding(control);

        if (control.type === 'button') {
          ardourBuilder.addNoteBinding({
            channel: midiChannel,
            note: control.cc,
            function: ardourBinding.function,
            uri: ardourBinding.uri,
            momentary: control.mode === 'momentary',
          });
        } else {
          ardourBuilder.addCCBinding({
            channel: midiChannel,
            controller: control.cc,
            function: ardourBinding.function,
            uri: ardourBinding.uri,
            encoder: control.type === 'encoder',
            momentary: false,
          });
        }
      }

      // Handle button groups
      if (control.type === 'button_group' && control.buttons) {
        for (const button of control.buttons) {
          // Skip buttons without plugin parameters to avoid transport-stop fallbacks
          if (!button.plugin_parameter) {
            console.log(`    Skipping unmapped button: ${button.name} (CC ${button.cc})`);
            continue;
          }

          const ardourBinding = { uri: `/route/plugin/parameter S1 1 ${button.plugin_parameter}` };

          ardourBuilder.addNoteBinding({
            channel: midiChannel,
            note: button.cc,
            function: ardourBinding.function,
            uri: ardourBinding.uri,
            momentary: button.mode === 'momentary',
          });
        }
      }
    }
  }

  return ardourBuilder.build();
}

/**
 * Main conversion function
 */
async function generateArdourMaps(install: boolean = false): Promise<void> {
  console.log('🎛️  Generating Consolidated Ardour MIDI Maps from Canonical Templates\\n');

  // Find canonical templates
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const mapsDir = join(__dirname, '..', '..', 'canonical-midi-maps', 'maps');
  const canonicalTemplates = findCanonicalTemplates(mapsDir);

  if (canonicalTemplates.length === 0) {
    console.log('No canonical templates found');
    return;
  }

  console.log(`Found ${canonicalTemplates.length} canonical template(s):`);
  canonicalTemplates.forEach(template => {
    console.log(`  - ${basename(template)}`);
  });
  console.log();

  // Parse all templates and group by device
  const deviceGroups = await parseAndGroupTemplates(canonicalTemplates);

  if (deviceGroups.length === 0) {
    console.log('No valid templates found after parsing');
    return;
  }

  console.log(`\\nGrouped into ${deviceGroups.length} device(s):`);
  deviceGroups.forEach(group => {
    console.log(`  📱 ${group.manufacturer} ${group.model}: ${group.templates.length} plugin mappings`);
    group.templates.forEach(template => {
      console.log(`    - Ch.${template.assignedChannel}: ${template.fileName}`);
    });
  });
  console.log();

  // Prepare output directory
  const outputDir = join(process.cwd(), 'dist', 'ardour-maps');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Generate consolidated maps
  const results: ConversionResult[] = [];

  for (const deviceGroup of deviceGroups) {
    try {
      const deviceName = `${deviceGroup.manufacturer} ${deviceGroup.model}`;
      console.log(`\\n🔧 Generating consolidated map for: ${deviceName}`);

      const ardourFilename = generateDeviceFilename(deviceGroup.manufacturer, deviceGroup.model);
      const outputPath = join(outputDir, ardourFilename);

      // Create consolidated map
      const consolidatedMap = await createConsolidatedMap(deviceGroup);

      // Generate XML
      const serializer = new ArdourXMLSerializer();
      const ardourXML = serializer.serializeMidiMap(consolidatedMap);

      writeFileSync(outputPath, ardourXML);

      const totalMappings = consolidatedMap.bindings.length;

      results.push({
        device: deviceName,
        ardour: ardourFilename,
        success: true,
        pluginCount: deviceGroup.templates.length,
        totalMappings,
      });

      console.log(`  ✅ Generated: ${ardourFilename}`);
      console.log(`     Plugins: ${deviceGroup.templates.length}, Total mappings: ${totalMappings}`);

    } catch (error) {
      const deviceName = `${deviceGroup.manufacturer} ${deviceGroup.model}`;
      console.error(`  ❌ Failed to generate consolidated map for ${deviceName}: ${error}`);
      results.push({
        device: deviceName,
        ardour: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Install to Ardour directory if requested
  if (install) {
    console.log('\\n📦 Installing to Ardour directory...');

    try {
      const ardourDir = getArdourMidiMapsDir();
      console.log(`Installing to: ${ardourDir}`);

      if (!existsSync(ardourDir)) {
        mkdirSync(ardourDir, { recursive: true });
        console.log(`Created directory: ${ardourDir}`);
      }

      let installedCount = 0;
      for (const result of results) {
        if (result.success && result.ardour) {
          const sourcePath = join(outputDir, result.ardour);
          const targetPath = join(ardourDir, result.ardour);

          const content = readFileSync(sourcePath);
          writeFileSync(targetPath, content);
          console.log(`  ✓ Installed: ${result.ardour}`);
          installedCount++;
        }
      }

      console.log(`\\n✅ Installed ${installedCount} Ardour map(s) to ${ardourDir}`);

    } catch (error) {
      console.error(`❌ Installation failed: ${error}`);
    }
  }

  // Summary
  console.log('\\n📊 Conversion Summary:');
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`  ✅ Successful: ${successful}`);
  console.log(`  ❌ Failed: ${failed}`);

  if (failed > 0) {
    console.log('\\nFailed conversions:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.canonical}: ${r.error}`);
    });
  }

  console.log(`\\n📁 Output directory: ${outputDir}`);
}

/**
 * CLI interface
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const install = args.includes('--install') || args.includes('-i');

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: npm run generate:ardour [options]

Generate Ardour MIDI maps from canonical template files.

Options:
  --install, -i    Install generated maps to Ardour configuration directory
  --help, -h       Show this help message

Examples:
  npm run generate:ardour              # Generate maps to dist/ardour-maps
  npm run generate:ardour --install    # Generate and install to Ardour
`);
    return;
  }

  try {
    await generateArdourMaps(install);
  } catch (error) {
    console.error('❌ Generation failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}