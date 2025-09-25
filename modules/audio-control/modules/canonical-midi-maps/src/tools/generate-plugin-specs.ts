#!/usr/bin/env npx tsx
/**
 * Plugin Spec Generator for Canonical MIDI Maps
 *
 * Generates comprehensive JSON plugin descriptors for all installed plugins
 * using the enhanced plughost executable.
 *
 * Usage:
 *   pnpm generate:plugin-specs              # Generate all plugin specs
 *   pnpm generate:plugin-specs --format AudioUnit  # Only AudioUnit plugins
 *   pnpm generate:plugin-specs --quick       # Skip slow/problematic plugins
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to plughost relative to this module
const PLUGHOST_PATH = join(__dirname, '../../../../../../cmake-build/modules/juce/host/plughost_artefacts/plughost');
const OUTPUT_DIR = join(__dirname, '../../plugin-descriptors');

interface PluginInfo {
  manufacturer: string;
  name: string;
  version: string;
  format: string;
  uid: string;
  category: string;
}

interface PluginParameter {
  index: number;
  name: string;
  label: string;
  text: string;
  default_value: number;
  current_value: number;
  automatable: boolean;
  meta_parameter: boolean;
  discrete: boolean;
}

interface PluginSpec {
  plugin: {
    manufacturer: string;
    name: string;
    version: string;
    format: string;
    uid: string;
  };
  metadata: {
    version: string;
    created: string;
    author: string;
    description: string;
    parameter_count: number;
    tags: string[];
  };
  parameters: Array<{
    index: number;
    name: string;
    min: number;
    max: number;
    default: number;
    group: string;
    type: 'continuous' | 'discrete' | 'boolean';
    automatable: boolean;
    label?: string;
  }>;
  groups: Record<string, {
    name: string;
    parameters: number[];
  }>;
}

class PluginSpecGenerator {
  private args: {
    format: string | undefined;
    quick: boolean;
    help: boolean;
  };

  constructor() {
    this.args = this.parseArgs();
  }

  private parseArgs() {
    const args = process.argv.slice(2);
    const result = {
      format: undefined as string | undefined,
      quick: false,
      help: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg === '--help' || arg === '-h') {
        result.help = true;
      } else if (arg === '--quick') {
        result.quick = true;
      } else if (arg === '--format' && i + 1 < args.length) {
        result.format = args[i + 1];
        i++; // Skip next arg
      }
    }

    return result;
  }

  private showHelp(): void {
    console.log(`Plugin Spec Generator for Canonical MIDI Maps

Usage:
  generate-plugin-specs.ts [options]

Options:
  --help, -h          Show this help message
  --format <format>   Only generate specs for specific format (AudioUnit, VST3, VST)
  --quick            Skip slow/problematic plugins for faster generation

Examples:
  generate-plugin-specs.ts                    # Generate all plugin specs
  generate-plugin-specs.ts --format AudioUnit # Only AudioUnit plugins
  generate-plugin-specs.ts --quick           # Fast generation, skip problematic plugins

Output:
  Plugin descriptors are saved to: ${OUTPUT_DIR}
  File naming: {manufacturer}_{plugin_name}.json`);
  }

  private async runPlughost(args: string[], timeoutMs = 60000): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(PLUGHOST_PATH, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`plughost exited with code ${code}: ${stderr}`));
        }
      });

      // Configurable timeout
      setTimeout(() => {
        child.kill();
        reject(new Error(`plughost timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private async getPluginList(): Promise<PluginInfo[]> {
    console.log(`🔍 Scanning for plugins${this.args.format ? ` (${this.args.format} only)` : ''}...`);

    const plughostArgs = ['--list', '--skip-instantiation', '--batch-json'];
    if (this.args.quick) {
      plughostArgs.push('--quick-scan');
    }
    if (this.args.format) {
      plughostArgs.push('--format-filter', this.args.format);
    }

    try {
      const output = await this.runPlughost(plughostArgs, 120000); // 2 minute timeout for listing

      // Extract JSON from output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in plughost output');
      }

      const pluginData = JSON.parse(jsonMatch[0]);

      if (!pluginData.plugins || !Array.isArray(pluginData.plugins)) {
        throw new Error('Invalid plugin data format');
      }

      return pluginData.plugins.map((p: any) => ({
        manufacturer: p.manufacturer || 'Unknown',
        name: p.name,
        version: p.version || '1.0.0',
        format: p.format,
        uid: p.uid || '',
        category: p.category || 'Effect'
      }));

    } catch (error) {
      console.error('❌ Failed to get plugin list:', error instanceof Error ? error.message : error);
      return [];
    }
  }

  private categorizeParameter(paramName: string): string {
    const name = paramName.toLowerCase();

    // Master/Global controls
    if (name.includes('master') || name.includes('volume') || name.includes('gain') ||
        name.includes('tune') || name.includes('octave') || name.includes('output')) {
      return 'master';
    }

    // Oscillator parameters
    if (name.includes('osc') || name.includes('vco') || name.includes('wave') ||
        name.includes('pitch') || name.includes('detune') || name.includes('sync')) {
      return 'oscillator';
    }

    // Filter parameters
    if (name.includes('filter') || name.includes('vcf') || name.includes('cutoff') ||
        name.includes('resonance') || name.includes('q ') || name.includes('freq')) {
      return 'filter';
    }

    // Envelope parameters
    if (name.includes('env') || name.includes('attack') || name.includes('decay') ||
        name.includes('sustain') || name.includes('release') || name.includes('adsr')) {
      return 'envelope';
    }

    // LFO parameters
    if (name.includes('lfo') || name.includes('mod') || name.includes('rate') ||
        name.includes('depth') || name.includes('speed')) {
      return 'lfo';
    }

    // Effects parameters
    if (name.includes('chorus') || name.includes('delay') || name.includes('reverb') ||
        name.includes('phaser') || name.includes('flanger') || name.includes('distortion')) {
      return 'effects';
    }

    // Amplifier parameters
    if (name.includes('amp') || name.includes('vca') || name.includes('velocity')) {
      return 'amplifier';
    }

    return 'misc';
  }

  private async generatePluginSpec(plugin: PluginInfo): Promise<PluginSpec | null> {
    const safeManufacturer = plugin.manufacturer.toLowerCase().replace(/[^a-z0-9]/g, '_');

    console.log(`📋 Generating spec: ${plugin.name} (${plugin.manufacturer})`);

    try {
      const output = await this.runPlughost([
        '--interrogate', plugin.name,
        '--json',
        ...(this.args.quick ? ['--quick-scan'] : [])
      ], 45000); // 45 second timeout per plugin

      // Extract JSON from output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log(`⚠️  No parameter data for ${plugin.name}`);
        return null;
      }

      const paramData = JSON.parse(jsonMatch[0]);

      if (!paramData.parameters || !Array.isArray(paramData.parameters)) {
        console.log(`⚠️  No parameters found for ${plugin.name}`);
        return null;
      }

      // Convert to our format
      const parameters = paramData.parameters.map((param: PluginParameter) => ({
        index: param.index,
        name: param.name,
        min: param.discrete ? 0 : 0.0,
        max: param.discrete ? 1 : 1.0,
        default: param.default_value,
        group: this.categorizeParameter(param.name),
        type: param.discrete ? 'discrete' : 'continuous' as const,
        automatable: param.automatable,
        ...(param.label && param.label !== param.name ? { label: param.label } : {})
      }));

      // Group parameters
      const groups: Record<string, { name: string; parameters: number[] }> = {};
      parameters.forEach((param: { group: string; index: number }) => {
        if (!groups[param.group]) {
          groups[param.group] = {
            name: param.group.charAt(0).toUpperCase() + param.group.slice(1),
            parameters: []
          };
        }
        groups[param.group]!.parameters.push(param.index);
      });

      const spec: PluginSpec = {
        plugin: {
          manufacturer: plugin.manufacturer,
          name: plugin.name,
          version: plugin.version,
          format: plugin.format,
          uid: plugin.uid
        },
        metadata: {
          version: '1.0.0',
          created: new Date().toISOString(),
          author: 'plughost-generator',
          description: `Auto-generated parameter descriptor for ${plugin.name}`,
          parameter_count: parameters.length,
          tags: [
            'auto-generated',
            plugin.category.toLowerCase(),
            safeManufacturer
          ]
        },
        parameters,
        groups
      };

      return spec;

    } catch (error) {
      console.error(`❌ Failed to generate spec for ${plugin.name}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }

  private savePluginSpec(plugin: PluginInfo, spec: PluginSpec): string {
    const safeManufacturer = plugin.manufacturer.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const safeName = plugin.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `${safeManufacturer}_${safeName}.json`;
    const filepath = join(OUTPUT_DIR, filename);

    writeFileSync(filepath, JSON.stringify(spec, null, 2));
    return filepath;
  }

  async run(): Promise<void> {
    if (this.args.help) {
      this.showHelp();
      return;
    }

    // Check plughost exists
    if (!existsSync(PLUGHOST_PATH)) {
      console.error(`❌ plughost not found at: ${PLUGHOST_PATH}`);
      console.error('Please run "make all" from the project root first.');
      process.exit(1);
    }

    // Ensure output directory exists
    mkdirSync(OUTPUT_DIR, { recursive: true });

    console.log(`🚀 Starting plugin spec generation...`);
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);

    const plugins = await this.getPluginList();

    if (plugins.length === 0) {
      console.log('❌ No plugins found');
      return;
    }

    console.log(`📋 Found ${plugins.length} plugins to process\n`);

    let successCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i]!; // We know this exists since i < plugins.length
      console.log(`[${i + 1}/${plugins.length}] ${plugin.name}`);

      // Skip system plugins
      if (plugin.name.match(/^(AU|AUAudio|AUNet|AUMatrix|AUSample)/)) {
        console.log(`  ⏭️  Skipping system plugin`);
        skippedCount++;
        continue;
      }

      const spec = await this.generatePluginSpec(plugin);

      if (spec) {
        const filepath = this.savePluginSpec(plugin, spec);
        console.log(`  ✅ Saved: ${filepath.replace(OUTPUT_DIR, '.')}`);
        successCount++;
      } else {
        console.log(`  ⚠️  Skipped (no parameters or failed)`);
        skippedCount++;
      }
    }

    console.log(`\n🎉 Generation complete!`);
    console.log(`✅ Successfully generated: ${successCount} specs`);
    console.log(`⏭️  Skipped: ${skippedCount} plugins`);
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  }
}

// ES module equivalent of require.main === module
if (import.meta.url === `file://${process.argv[1]}`) {
  const generator = new PluginSpecGenerator();
  generator.run().catch(error => {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}