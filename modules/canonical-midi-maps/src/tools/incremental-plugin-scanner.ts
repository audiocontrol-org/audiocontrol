#!/usr/bin/env npx tsx
/**
 * Incremental Plugin Scanner
 *
 * Scans all available plugins incrementally, writing results to a file as it goes.
 * This ensures we capture partial data even if the process crashes or times out.
 *
 * Usage:
 *   npx tsx incremental-plugin-scanner.ts
 *   npx tsx incremental-plugin-scanner.ts --output plugins-catalog.json
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLUGHOST_PATH = join(__dirname, '../../../../../../cmake-build/modules/juce/host/plughost_artefacts/plughost');
const DEFAULT_OUTPUT = join(__dirname, '../../plugins-catalog.json');

interface PluginCatalogEntry {
  name: string;
  format: string;
  manufacturer?: string;
  version?: string;
  uid?: string;
  category?: string;
  scanned_at: string;
  interrogation_status: 'pending' | 'success' | 'failed' | 'timeout';
  parameter_count?: number;
  error?: string;
}

interface PluginCatalog {
  version: string;
  scan_started: string;
  scan_completed?: string;
  total_plugins_found: number;
  plugins: PluginCatalogEntry[];
}

class IncrementalPluginScanner {
  private outputPath: string;
  private catalog: PluginCatalog;

  constructor(outputPath?: string) {
    this.outputPath = outputPath || DEFAULT_OUTPUT;

    // Load existing catalog if it exists
    if (existsSync(this.outputPath)) {
      console.log(`📂 Loading existing catalog from ${this.outputPath}`);
      this.catalog = JSON.parse(readFileSync(this.outputPath, 'utf-8'));
      console.log(`   Found ${this.catalog.plugins.length} existing entries`);
    } else {
      this.catalog = {
        version: '1.0',
        scan_started: new Date().toISOString(),
        total_plugins_found: 0,
        plugins: []
      };
    }
  }

  private saveCatalog() {
    writeFileSync(this.outputPath, JSON.stringify(this.catalog, null, 2));
  }

  private async runPlughost(args: string[], timeoutMs = 30000): Promise<string> {
    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        JUCE_DISABLE_AUDIOUNIT_PLUGIN_SCANNING: '1'
      };

      const child = spawn(PLUGHOST_PATH, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env
      });

      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`Timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`plughost exited with code ${code}: ${stderr}`));
        }
      });
    });
  }

  async scanPlugins() {
    console.log('🔍 Starting incremental plugin scan...');
    console.log(`📝 Output file: ${this.outputPath}`);

    // First, get the list of all plugins using VST3 format to avoid AudioUnit issues
    console.log('\n📋 Phase 1: Discovering VST3 plugins...');
    try {
      const listOutput = await this.runPlughost(['--list', '--format-filter', 'VST3'], 60000);
      const lines = listOutput.split('\n');

      for (const line of lines) {
        const match = line.match(/Next Plugin: <Format:([^>]+)>, <Name: ([^>]+)>/);
        if (match) {
          const format = match[1]!;
          const name = match[2]!;

          // Check if we already have this plugin
          const existing = this.catalog.plugins.find(p => p.name === name && p.format === format);
          if (!existing) {
            const entry: PluginCatalogEntry = {
              name,
              format,
              scanned_at: new Date().toISOString(),
              interrogation_status: 'pending'
            };
            this.catalog.plugins.push(entry);
            console.log(`   ✅ Found new plugin: ${name} (${format})`);

            // Save after each new plugin discovery
            this.catalog.total_plugins_found = this.catalog.plugins.length;
            this.saveCatalog();
          }
        }
      }
    } catch (error) {
      console.error('⚠️  VST3 listing failed:', error instanceof Error ? error.message : error);
    }

    // Now try VST format
    console.log('\n📋 Phase 2: Discovering VST plugins...');
    try {
      const listOutput = await this.runPlughost(['--list', '--format-filter', 'VST'], 60000);
      const lines = listOutput.split('\n');

      for (const line of lines) {
        const match = line.match(/Next Plugin: <Format:([^>]+)>, <Name: ([^>]+)>/);
        if (match) {
          const format = match[1]!;
          const name = match[2]!;

          // Check if we already have this plugin
          const existing = this.catalog.plugins.find(p => p.name === name && p.format === format);
          if (!existing) {
            const entry: PluginCatalogEntry = {
              name,
              format,
              scanned_at: new Date().toISOString(),
              interrogation_status: 'pending'
            };
            this.catalog.plugins.push(entry);
            console.log(`   ✅ Found new plugin: ${name} (${format})`);

            // Save after each new plugin discovery
            this.catalog.total_plugins_found = this.catalog.plugins.length;
            this.saveCatalog();
          }
        }
      }
    } catch (error) {
      console.error('⚠️  VST listing failed:', error instanceof Error ? error.message : error);
    }

    // Phase 3: Try to interrogate each pending plugin
    console.log(`\n📊 Phase 3: Interrogating ${this.catalog.plugins.length} plugins...`);

    for (let i = 0; i < this.catalog.plugins.length; i++) {
      const plugin = this.catalog.plugins[i]!;

      if (plugin.interrogation_status !== 'pending') {
        console.log(`[${i + 1}/${this.catalog.plugins.length}] ⏭️  Skipping ${plugin.name} (already ${plugin.interrogation_status})`);
        continue;
      }

      console.log(`[${i + 1}/${this.catalog.plugins.length}] 🔍 Interrogating ${plugin.name}...`);

      try {
        const interrogateOutput = await this.runPlughost(
          ['--interrogate', plugin.name, '--json'],
          15000  // 15 second timeout for individual plugin
        );

        // Extract JSON from output
        const lines = interrogateOutput.split('\n');
        let jsonStarted = false;
        const jsonLines: string[] = [];

        for (const line of lines) {
          if (line.trim().startsWith('{')) {
            jsonStarted = true;
          }
          if (jsonStarted) {
            jsonLines.push(line);
          }
          if (line.trim() === '}' && jsonStarted) {
            break;
          }
        }

        if (jsonLines.length > 0) {
          try {
            const pluginData = JSON.parse(jsonLines.join('\n'));
            plugin.manufacturer = pluginData.plugin?.manufacturer;
            plugin.version = pluginData.plugin?.version;
            plugin.uid = pluginData.plugin?.uid;
            plugin.category = pluginData.plugin?.category;
            plugin.parameter_count = pluginData.metadata?.parameter_count;
            plugin.interrogation_status = 'success';
            console.log(`   ✅ Success: ${plugin.parameter_count} parameters`);
          } catch (parseError) {
            plugin.interrogation_status = 'failed';
            plugin.error = 'JSON parse error';
            console.log(`   ❌ Failed to parse JSON`);
          }
        } else {
          plugin.interrogation_status = 'failed';
          plugin.error = 'No JSON output';
          console.log(`   ❌ No JSON output received`);
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Timeout')) {
          plugin.interrogation_status = 'timeout';
          plugin.error = error.message;
          console.log(`   ⏱️  Timeout`);
        } else {
          plugin.interrogation_status = 'failed';
          plugin.error = error instanceof Error ? error.message : String(error);
          console.log(`   ❌ Error: ${plugin.error}`);
        }
      }

      // Save after each interrogation
      this.saveCatalog();
    }

    // Mark scan as completed
    this.catalog.scan_completed = new Date().toISOString();
    this.saveCatalog();

    // Print summary
    console.log('\n📊 Scan Summary:');
    const successful = this.catalog.plugins.filter(p => p.interrogation_status === 'success').length;
    const failed = this.catalog.plugins.filter(p => p.interrogation_status === 'failed').length;
    const timeout = this.catalog.plugins.filter(p => p.interrogation_status === 'timeout').length;
    const pending = this.catalog.plugins.filter(p => p.interrogation_status === 'pending').length;

    console.log(`   Total plugins: ${this.catalog.plugins.length}`);
    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏱️  Timeout: ${timeout}`);
    console.log(`   ⏳ Pending: ${pending}`);
    console.log(`\n📁 Catalog saved to: ${this.outputPath}`);

    // Show some example Arturia plugins if found
    const arturiaPlugins = this.catalog.plugins.filter(p =>
      p.name.toLowerCase().includes('jup') ||
      p.manufacturer?.toLowerCase().includes('arturia')
    );

    if (arturiaPlugins.length > 0) {
      console.log('\n🎹 Found Arturia/JUP plugins:');
      arturiaPlugins.forEach(p => {
        console.log(`   - ${p.name} (${p.format}) - ${p.interrogation_status}`);
      });
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const outputPath = process.argv.includes('--output')
    ? process.argv[process.argv.indexOf('--output') + 1]
    : undefined;

  const scanner = new IncrementalPluginScanner(outputPath);
  scanner.scanPlugins().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { IncrementalPluginScanner };