#!/usr/bin/env npx tsx
/**
 * Batch Plugin Generator
 *
 * Uses the new plughost --batch-interrogate mode to generate plugin specs
 * in a single invocation with incremental output.
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLUGHOST_PATH = join(__dirname, '../../../../../../cmake-build/modules/juce/host/plughost_artefacts/plughost');
const OUTPUT_DIR = join(__dirname, '../../plugin-descriptors');

class BatchPluginGenerator {
  async generateSpecs() {
    console.log('🚀 Starting batch plugin spec generation...');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);

    const args = ['--batch-interrogate', '--format-filter', 'VST3'];

    console.log('🔧 Running plughost in batch mode...');

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

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
        // Show progress as we get data
        process.stdout.write('.');
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        console.log('\n'); // New line after progress dots

        if (code === 0) {
          console.log('✅ Batch interrogation completed successfully');

          // Parse and process the JSON output
          try {
            // Extract JSON from stdout (skip initial setup messages)
            const lines = stdout.split('\n');
            let jsonStarted = false;
            const jsonLines: string[] = [];

            for (const line of lines) {
              if (line.trim().startsWith('{"plugins":')) {
                jsonStarted = true;
              }
              if (jsonStarted) {
                jsonLines.push(line);
              }
            }

            if (jsonLines.length > 0) {
              const jsonStr = jsonLines.join('\n');
              const pluginData = JSON.parse(jsonStr);

              console.log(`📊 Found ${pluginData.plugins.length} plugins`);

              // Save the complete catalog
              const catalogPath = join(OUTPUT_DIR, 'plugins-catalog-batch.json');
              writeFileSync(catalogPath, JSON.stringify(pluginData, null, 2));
              console.log(`💾 Saved catalog to: ${catalogPath}`);

              // Now generate individual plugin spec files
              let successCount = 0;
              let errorCount = 0;

              for (const plugin of pluginData.plugins) {
                if (plugin.error) {
                  errorCount++;
                  console.log(`❌ ${plugin.plugin.name}: ${plugin.error}`);
                  continue;
                }

                try {
                  // Convert to plugin spec format and save individual file
                  const spec = this.convertToPluginSpec(plugin);
                  const filename = this.generateFilename(plugin.plugin);
                  const filepath = join(OUTPUT_DIR, filename);

                  writeFileSync(filepath, JSON.stringify(spec, null, 2));
                  console.log(`✅ ${plugin.plugin.name}: ${filename} (${plugin.metadata.parameter_count} params)`);
                  successCount++;

                } catch (error) {
                  console.error(`❌ Failed to process ${plugin.plugin.name}:`, error instanceof Error ? error.message : error);
                  errorCount++;
                }
              }

              console.log(`\n📊 Generation Summary:`);
              console.log(`   ✅ Success: ${successCount} plugins`);
              console.log(`   ❌ Errors: ${errorCount} plugins`);
              console.log(`   📁 Output: ${OUTPUT_DIR}`);

              resolve(successCount);
            } else {
              reject(new Error('No JSON output found'));
            }

          } catch (error) {
            reject(new Error(`Failed to parse JSON output: ${error instanceof Error ? error.message : error}`));
          }

        } else {
          reject(new Error(`plughost exited with code ${code}: ${stderr}`));
        }
      });

      // Kill after 10 minutes to prevent hanging
      setTimeout(() => {
        child.kill();
        reject(new Error('plughost timed out after 10 minutes'));
      }, 10 * 60 * 1000);
    });
  }

  private convertToPluginSpec(pluginData: any): any {
    const plugin = pluginData.plugin;
    const params = pluginData.parameters || [];

    // Categorize parameters
    const groups: Record<string, { name: string; parameters: number[] }> = {};
    const processedParams = params.map((param: any, index: number) => {
      const group = this.categorizeParameter(param.name);

      if (!groups[group]) {
        groups[group] = { name: group, parameters: [] };
      }
      groups[group].parameters.push(index);

      return {
        index: param.index,
        name: param.name,
        min: 0,
        max: 1,
        default: param.default_value,
        group: group,
        type: param.discrete ? 'discrete' : 'continuous',
        automatable: param.automatable,
        label: param.label || undefined
      };
    });

    return {
      plugin: {
        manufacturer: plugin.manufacturer,
        name: plugin.name,
        version: plugin.version,
        format: plugin.format,
        uid: plugin.uid
      },
      metadata: {
        version: "1.0",
        created: new Date().toISOString(),
        author: "plughost-batch",
        description: `Auto-generated plugin spec for ${plugin.name}`,
        parameter_count: params.length,
        tags: this.generateTags(plugin)
      },
      parameters: processedParams,
      groups: groups
    };
  }

  private categorizeParameter(paramName: string): string {
    const name = paramName.toLowerCase();

    if (name.includes('osc') || name.includes('vco')) return 'oscillator';
    if (name.includes('filter') || name.includes('cutoff') || name.includes('resonance')) return 'filter';
    if (name.includes('env') || name.includes('attack') || name.includes('decay') || name.includes('sustain') || name.includes('release')) return 'envelope';
    if (name.includes('lfo')) return 'lfo';
    if (name.includes('reverb') || name.includes('delay') || name.includes('chorus') || name.includes('effect')) return 'effects';
    if (name.includes('volume') || name.includes('gain') || name.includes('level')) return 'mixer';
    if (name.includes('pan')) return 'panning';

    return 'general';
  }

  private generateTags(plugin: any): string[] {
    const tags = [plugin.format.toLowerCase()];

    const name = plugin.name.toLowerCase();
    if (name.includes('synth') || name.includes('analog') || name.includes('digital')) tags.push('synthesizer');
    if (name.includes('reverb')) tags.push('reverb');
    if (name.includes('delay')) tags.push('delay');
    if (name.includes('comp')) tags.push('compressor');
    if (name.includes('eq')) tags.push('equalizer');
    if (name.includes('piano') || name.includes('organ')) tags.push('keyboard');

    return tags;
  }

  private generateFilename(plugin: any): string {
    const safeManufacturer = plugin.manufacturer.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const safeName = plugin.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${safeManufacturer}-${safeName}.json`;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const generator = new BatchPluginGenerator();
  generator.generateSpecs().catch(error => {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

export { BatchPluginGenerator };