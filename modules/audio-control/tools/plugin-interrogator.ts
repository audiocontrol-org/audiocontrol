#!/usr/bin/env npx tsx
/**
 * Plugin Interrogator
 *
 * A flexible tool for interrogating audio plugins using the enhanced plughost executable.
 * Supports interrogating specific plugins or all installed plugins.
 *
 * Usage:
 *   # Interrogate specific plugin
 *   npx tsx plugin-interrogator.ts "Jup-8 V3"
 *   npx tsx plugin-interrogator.ts "Jup-8 V3" --json
 *
 *   # Interrogate all plugins
 *   npx tsx plugin-interrogator.ts --all
 *   npx tsx plugin-interrogator.ts --all --json
 *
 *   # List all plugins
 *   npx tsx plugin-interrogator.ts --list
 */

import { spawn } from 'child_process';
import { join } from 'path';

interface PluginInfo {
  format: string;
  name: string;
}

const PLUGHOST_PATH = join(__dirname, '../../../cmake-build/modules/juce/host/plughost_artefacts/plughost');

function parseArgs(): { mode: 'list' | 'single' | 'all'; pluginName?: string; json: boolean; help: boolean } {
  const args = process.argv.slice(2);

  const result = {
    mode: 'single' as const,
    pluginName: undefined as string | undefined,
    json: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--json') {
      result.json = true;
    } else if (arg === '--list') {
      result.mode = 'list';
    } else if (arg === '--all') {
      result.mode = 'all';
    } else if (!result.pluginName && !arg.startsWith('--')) {
      result.pluginName = arg;
    }
  }

  return result;
}

function showHelp(): void {
  console.log(`Plugin Interrogator - Audio plugin parameter extraction tool

Usage:
  plugin-interrogator.ts [options] [plugin-name]

Options:
  --help, -h     Show this help message
  --list         List all available plugins
  --all          Interrogate all installed plugins
  --json         Output in JSON format

Examples:
  plugin-interrogator.ts "Jup-8 V3"           # Interrogate specific plugin
  plugin-interrogator.ts "Jup-8 V3" --json   # JSON output for specific plugin
  plugin-interrogator.ts --all               # Interrogate all plugins
  plugin-interrogator.ts --all --json        # JSON output for all plugins
  plugin-interrogator.ts --list              # List available plugins

Note: This tool wraps the enhanced plughost executable with additional functionality.`);
}

async function runPlughost(args: string[]): Promise<string> {
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
        reject(new Error(`plughost exited with code ${code}:\n${stderr}`));
      }
    });

    // Kill after 5 minutes to prevent hanging
    setTimeout(() => {
      child.kill();
      reject(new Error('plughost timed out after 5 minutes'));
    }, 5 * 60 * 1000);
  });
}

async function listAllPlugins(): Promise<PluginInfo[]> {
  console.log('📋 Listing all available plugins...');
  const output = await runPlughost(['--list']);

  const plugins: PluginInfo[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const match = line.match(/Next Plugin: <Format:([^>]+)>, <Name: ([^>]+)>/);
    if (match) {
      plugins.push({
        format: match[1],
        name: match[2]
      });
    }
  }

  return plugins;
}

async function interrogatePlugin(pluginName: string, json: boolean): Promise<void> {
  console.log(`🔍 Interrogating plugin: ${pluginName}${json ? ' (JSON format)' : ''}`);

  const args = ['--interrogate', pluginName];
  if (json) args.push('--json');

  try {
    const output = await runPlughost(args);

    if (json) {
      // Extract JSON from output (filter out non-JSON lines)
      const lines = output.split('\n');
      let jsonStarted = false;
      const jsonLines: string[] = [];

      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          jsonStarted = true;
        }
        if (jsonStarted) {
          jsonLines.push(line);
        }
        if (line.trim().endsWith('}') && jsonStarted) {
          break;
        }
      }

      if (jsonLines.length > 0) {
        console.log(jsonLines.join('\n'));
      } else {
        console.log('No JSON output found');
      }
    } else {
      // Filter for parameter report section
      const lines = output.split('\n');
      let reportStarted = false;

      for (const line of lines) {
        if (line.includes('=== Parameter Interrogation Report ===')) {
          reportStarted = true;
        }
        if (reportStarted) {
          console.log(line);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Failed to interrogate plugin "${pluginName}":`, error instanceof Error ? error.message : error);
  }
}

async function interrogateAllPlugins(json: boolean): Promise<void> {
  console.log('🔍 Interrogating ALL installed plugins...');

  const plugins = await listAllPlugins();
  console.log(`Found ${plugins.length} plugins to interrogate\n`);

  if (json) {
    console.log('[');
  }

  for (let i = 0; i < plugins.length; i++) {
    const plugin = plugins[i];
    const isLast = i === plugins.length - 1;

    console.error(`[${i + 1}/${plugins.length}] Processing: ${plugin.name} (${plugin.format})`);

    try {
      const args = ['--interrogate', plugin.name];
      if (json) args.push('--json');

      const output = await runPlughost(args);

      if (json) {
        // Extract and format JSON
        const lines = output.split('\n');
        let jsonStarted = false;
        const jsonLines: string[] = [];

        for (const line of lines) {
          if (line.trim().startsWith('{')) {
            jsonStarted = true;
          }
          if (jsonStarted) {
            jsonLines.push(line);
          }
          if (line.trim().endsWith('}') && jsonStarted) {
            break;
          }
        }

        if (jsonLines.length > 0) {
          const jsonStr = jsonLines.join('\n');
          console.log(jsonStr + (isLast ? '' : ','));
        }
      } else {
        console.log(`\n=== ${plugin.name} (${plugin.format}) ===`);
        // Extract parameter report
        const lines = output.split('\n');
        let reportStarted = false;

        for (const line of lines) {
          if (line.includes('=== Parameter Interrogation Report ===')) {
            reportStarted = true;
            continue; // Skip the header line since we added our own
          }
          if (reportStarted) {
            console.log(line);
          }
        }
        console.log(''); // Add spacing between plugins
      }
    } catch (error) {
      console.error(`❌ Failed to interrogate ${plugin.name}:`, error instanceof Error ? error.message : error);
      if (json && !isLast) {
        console.log('null,'); // Placeholder for failed interrogation
      }
    }
  }

  if (json) {
    console.log(']');
  }

  console.error(`\n✅ Completed interrogation of ${plugins.length} plugins`);
}

async function main(): Promise<void> {
  const { mode, pluginName, json, help } = parseArgs();

  if (help) {
    showHelp();
    return;
  }

  try {
    switch (mode) {
      case 'list':
        const plugins = await listAllPlugins();
        plugins.forEach(p => console.log(`${p.format}: ${p.name}`));
        console.error(`\nFound ${plugins.length} plugins`);
        break;

      case 'single':
        if (!pluginName) {
          console.error('❌ Plugin name required for single interrogation');
          console.error('Usage: plugin-interrogator.ts "Plugin Name"');
          process.exit(1);
        }
        await interrogatePlugin(pluginName, json);
        break;

      case 'all':
        await interrogateAllPlugins(json);
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { interrogatePlugin, interrogateAllPlugins, listAllPlugins };