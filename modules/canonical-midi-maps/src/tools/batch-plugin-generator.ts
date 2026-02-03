#!/usr/bin/env npx tsx
/**
 * Batch Plugin Generator
 *
 * Uses the new plughost --batch-interrogate mode to generate plugin specs
 * in a single invocation with incremental output.
 */

import { spawn } from 'child_process';
import { join, dirname } from 'path';
import { writeFileSync, createWriteStream, existsSync, statSync, createReadStream } from 'fs';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PLUGHOST_PATH = join(__dirname, '../../../../../../cmake-build/modules/juce/host/plughost_artefacts/plughost');
const OUTPUT_DIR = join(__dirname, '../../plugin-descriptors');
const LOG_CACHE_EXPIRY_HOURS = 24; // Cache log file for 24 hours

class BatchPluginGenerator {
  constructor(private forceRegenerate: boolean = false) {}

  async generateSpecs() {
    console.log('🚀 Starting batch plugin spec generation...');
    console.log(`📁 Output directory: ${OUTPUT_DIR}`);

    const logFile = join(OUTPUT_DIR, 'batch-interrogation.log');

    // Check if we have a recent log file to reuse
    if (!this.forceRegenerate && existsSync(logFile)) {
      const logStat = statSync(logFile);
      const logAge = Date.now() - logStat.mtime.getTime();
      const cacheExpiryMs = LOG_CACHE_EXPIRY_HOURS * 60 * 60 * 1000;

      if (logAge < cacheExpiryMs) {
        console.log(`📋 Using cached log file (${Math.round(logAge / (60 * 60 * 1000))}h old): ${logFile}`);
        return this.processLogFile(logFile);
      } else {
        console.log(`⏰ Log file is stale (${Math.round(logAge / (60 * 60 * 1000))}h old), regenerating...`);
      }
    } else if (this.forceRegenerate) {
      console.log(`🔄 Force regenerate flag set, ignoring cache`);
    }

    const args = ['--batch-interrogate', '--format-filter', 'VST3'];
    console.log(`🔧 Running plughost in batch mode...`);
    console.log(`📋 Logging to: ${logFile}`);

    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        JUCE_DISABLE_AUDIOUNIT_PLUGIN_SCANNING: '1'
      };

      const child = spawn(PLUGHOST_PATH, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env
      });

      let successCount = 0;
      let errorCount = 0;
      let currentJsonBuffer = '';
      let braceCount = 0;
      let inJsonStanza = false;

      // Create log file for tee functionality
      const logStream = createWriteStream(logFile);

      let lineBuffer = '';

      child.stdout?.on('data', (data) => {
        const chunk = data.toString();

        // Tee to log file
        logStream.write(chunk);

        // Add to line buffer and process complete lines
        lineBuffer += chunk;
        const lines = lineBuffer.split('\n');

        // Keep the last line in buffer (might be incomplete)
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();

          if (trimmedLine === '{') {
            if (!inJsonStanza) {
              inJsonStanza = true;
              braceCount = 1;
              currentJsonBuffer = '{\n';
            } else {
              braceCount++;
              currentJsonBuffer += line + '\n';
            }
          } else if (trimmedLine === '}') {
            braceCount--;
            currentJsonBuffer += line + '\n';

            if (inJsonStanza && braceCount === 0) {
              // Complete JSON stanza found
              try {
                const pluginData = JSON.parse(currentJsonBuffer.trim());

                if (pluginData.error) {
                  errorCount++;
                  console.log(`❌ ${pluginData.plugin.name}: ${pluginData.error}`);
                } else {
                  // Convert to plugin spec and save immediately
                  const spec = this.convertToPluginSpec(pluginData);
                  const filename = this.generateFilename(pluginData.plugin);
                  const filepath = join(OUTPUT_DIR, filename);

                  writeFileSync(filepath, JSON.stringify(spec, null, 2));
                  console.log(`✅ ${pluginData.plugin.name}: ${filename} (${pluginData.metadata.parameter_count} params)`);
                  successCount++;
                }

              } catch (parseError) {
                console.error(`❌ Failed to parse JSON stanza: ${parseError instanceof Error ? parseError.message : parseError}`);
                console.error(`   Problem JSON: ${currentJsonBuffer.substring(0, 100)}...`);
                errorCount++;
              }

              // Reset for next stanza
              currentJsonBuffer = '';
              inJsonStanza = false;
              braceCount = 0;
            }
          } else if (inJsonStanza) {
            currentJsonBuffer += line + '\n';
            // Count braces in this line for nested objects
            for (const char of line) {
              if (char === '{') braceCount++;
              if (char === '}') braceCount--;
            }
          }
        }
      });

      child.stderr?.on('data', (data) => {
        // Progress and error messages go to stderr, just pass them through
        process.stderr.write(data);
      });

      child.on('close', (code) => {
        // Process any remaining data in line buffer
        if (lineBuffer.trim() && inJsonStanza) {
          currentJsonBuffer += lineBuffer;
          // Try to parse if we think we have a complete JSON
          if (currentJsonBuffer.trim().endsWith('}')) {
            try {
              const pluginData = JSON.parse(currentJsonBuffer.trim());
              if (!pluginData.error) {
                const spec = this.convertToPluginSpec(pluginData);
                const filename = this.generateFilename(pluginData.plugin);
                const filepath = join(OUTPUT_DIR, filename);
                writeFileSync(filepath, JSON.stringify(spec, null, 2));
                console.log(`✅ ${pluginData.plugin.name}: ${filename} (${pluginData.metadata.parameter_count} params)`);
                successCount++;
              }
            } catch (parseError) {
              errorCount++;
            }
          }
        }

        logStream.end();

        if (code === 0) {
          console.log('\n📊 Generation Summary:');
          console.log(`   ✅ Success: ${successCount} plugins`);
          console.log(`   ❌ Errors: ${errorCount} plugins`);
          console.log(`   📁 Output: ${OUTPUT_DIR}`);
          console.log(`   📋 Log: ${logFile}`);

          // Update catalog from log file
          this.updateCatalogFromLog(logFile, successCount + errorCount);

          resolve(successCount);
        } else {
          reject(new Error(`plughost exited with code ${code}`));
        }
      });

      // Kill after 15 minutes to prevent hanging
      setTimeout(() => {
        child.kill();
        reject(new Error('plughost timed out after 15 minutes'));
      }, 15 * 60 * 1000);
    });
  }

  private async processLogFile(logFile: string): Promise<number> {
    console.log('📖 Processing existing log file for JSON stanzas...');

    let successCount = 0;
    let errorCount = 0;
    let currentJsonBuffer = '';
    let braceCount = 0;
    let inJsonStanza = false;
    let linesProcessed = 0;
    let jsonStanzasFound = 0;

    const fileStream = createReadStream(logFile);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      linesProcessed++;
      const trimmedLine = line.trim();

      if (trimmedLine === '{') {
        if (!inJsonStanza) {
          jsonStanzasFound++;
          console.log(`🔍 Found JSON stanza #${jsonStanzasFound} at line ${linesProcessed}`);
        }
        if (!inJsonStanza) {
          inJsonStanza = true;
          braceCount = 1;
          currentJsonBuffer = '{\n';
        } else {
          braceCount++;
          currentJsonBuffer += line + '\n';
        }
      } else if (trimmedLine === '}') {
        braceCount--;
        currentJsonBuffer += line + '\n';

        if (inJsonStanza && braceCount === 0) {
          // Complete JSON stanza found
          try {
            const pluginData = JSON.parse(currentJsonBuffer.trim());

            if (pluginData.error) {
              errorCount++;
              console.log(`❌ ${pluginData.plugin.name}: ${pluginData.error}`);
            } else if (pluginData.plugin) {
              // Convert to plugin spec and save immediately
              const spec = this.convertToPluginSpec(pluginData);
              const filename = this.generateFilename(pluginData.plugin);
              const filepath = join(OUTPUT_DIR, filename);

              writeFileSync(filepath, JSON.stringify(spec, null, 2));
              console.log(`✅ ${pluginData.plugin.name}: ${filename} (${pluginData.metadata.parameter_count} params)`);
              successCount++;
            }

          } catch (parseError) {
            console.error(`❌ Failed to parse JSON stanza: ${parseError instanceof Error ? parseError.message : parseError}`);
            console.error(`   Problem JSON: ${currentJsonBuffer.substring(0, 100)}...`);
            errorCount++;
          }

          // Reset for next stanza
          currentJsonBuffer = '';
          inJsonStanza = false;
          braceCount = 0;
        }
      } else if (inJsonStanza) {
        currentJsonBuffer += line + '\n';
        // Count braces in this line for nested objects
        for (const char of line) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }
      }
    }

    console.log('\n📊 Processing Summary:');
    console.log(`   📄 Lines processed: ${linesProcessed}`);
    console.log(`   🔍 JSON stanzas found: ${jsonStanzasFound}`);
    console.log(`   ✅ Success: ${successCount} plugins`);
    console.log(`   ❌ Errors: ${errorCount} plugins`);
    console.log(`   📁 Output: ${OUTPUT_DIR}`);

    // Update catalog
    this.updateCatalogFromLog(logFile, successCount + errorCount);

    return successCount;
  }

  private updateCatalogFromLog(logFile: string, totalPlugins: number) {
    try {
      const catalogPath = join(OUTPUT_DIR, 'plugins-catalog-batch.json');
      const catalog = {
        version: '1.0',
        created: new Date().toISOString(),
        total_plugins: totalPlugins,
        source_log: logFile,
        description: 'Plugin catalog generated from batch interrogation'
      };

      writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
      console.log(`💾 Updated catalog: ${catalogPath}`);
    } catch (error) {
      console.error(`⚠️  Failed to update catalog: ${error instanceof Error ? error.message : error}`);
    }
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
  const forceRegenerate = process.argv.includes('--force');
  const generator = new BatchPluginGenerator(forceRegenerate);
  generator.generateSpecs().catch(error => {
    console.error('❌ Fatal error:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

export { BatchPluginGenerator };