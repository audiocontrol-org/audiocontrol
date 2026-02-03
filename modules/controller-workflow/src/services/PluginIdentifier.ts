/**
 * PluginIdentifier - AI-powered service for identifying which plugin a controller mode is designed for
 *
 * Uses Claude Code CLI to analyze control names and match them to plugins
 * in the descriptor database. Returns confidence scores and reasoning.
 *
 * @module PluginIdentifier
 */

import { spawn } from 'child_process';
import type { PluginRegistryInterface } from './PluginRegistry.js';

/**
 * Result of plugin identification
 */
export interface PluginIdentificationResult {
  /** Name of the identified plugin (or null if no match) */
  pluginName: string | null;

  /** Confidence score (0-1, with 1 being certain) */
  confidence: number;

  /** Human-readable reasoning for the match */
  reasoning: string;

  /** Alternative matches if confidence is moderate */
  alternativeMatches?: Array<{
    pluginName: string;
    confidence: number;
    reasoning: string;
  }>;

  /** Whether Claude CLI was available */
  claudeAvailable: boolean;
}

/**
 * Interface for PluginIdentifier operations
 */
export interface PluginIdentifierInterface {
  /**
   * Identify which plugin a set of control names is designed for
   * @param controlNames Array of control label names from hardware
   * @param slotName Optional slot name/description
   * @returns Identification result with confidence and reasoning
   */
  identifyPlugin(controlNames: string[], slotName?: string): Promise<PluginIdentificationResult>;
}

/**
 * PluginIdentifier implementation using Claude Code CLI
 */
export class PluginIdentifier implements PluginIdentifierInterface {
  private pluginRegistry: PluginRegistryInterface;

  constructor(pluginRegistry: PluginRegistryInterface) {
    this.pluginRegistry = pluginRegistry;
  }

  /**
   * Identify which plugin a set of control names is designed for
   */
  async identifyPlugin(controlNames: string[], slotName?: string): Promise<PluginIdentificationResult> {
    // Filter out generic control names
    const meaningfulNames = controlNames.filter(name =>
      name && !this.isGenericName(name)
    );

    if (meaningfulNames.length === 0) {
      return {
        pluginName: null,
        confidence: 0,
        reasoning: 'No meaningful control names found. All controls have generic names (e.g., "Control 16").',
        claudeAvailable: false
      };
    }

    try {
      // Get available plugins for context
      const availablePlugins = this.pluginRegistry.getAllPlugins();
      const pluginNames = availablePlugins.map(p => `${p.manufacturer} ${p.pluginName}`);

      // Build Claude prompt
      const prompt = this.buildIdentificationPrompt(meaningfulNames, slotName, pluginNames);

      // Call Claude CLI
      const response = await this.callClaudeCLI(prompt);

      // Parse response
      return this.parseClaudeResponse(response);
    } catch (error: any) {
      // Claude CLI not available or error occurred
      return {
        pluginName: null,
        confidence: 0,
        reasoning: `AI identification unavailable: ${error.message}`,
        claudeAvailable: false
      };
    }
  }

  /**
   * Check if a control name is generic (not meaningful)
   */
  private isGenericName(name: string): boolean {
    // Generic patterns: "Control X", "Knob X", "Encoder X", etc.
    const genericPatterns = [
      /^Control \d+$/i,
      /^Knob \d+$/i,
      /^Encoder \d+$/i,
      /^Slider \d+$/i,
      /^Button \d+$/i,
      /^Pot \d+$/i,
      /^Track \d+$/i,
      /^Send \d+$/i
    ];

    return genericPatterns.some(pattern => pattern.test(name.trim()));
  }

  /**
   * Build Claude prompt for plugin identification
   */
  private buildIdentificationPrompt(
    controlNames: string[],
    slotName: string | undefined,
    availablePlugins: string[]
  ): string {
    const controlList = controlNames.map((name, i) => `${i + 1}. ${name}`).join('\n');
    const pluginList = availablePlugins.slice(0, 50).join('\n'); // Limit to first 50

    return `You are analyzing MIDI controller configuration to identify which VST/AU plugin it was designed to control.

**Controller Mode:** ${slotName || 'Unknown'}

**Control Names:**
${controlList}

**Available Plugins in Database (${availablePlugins.length} total, showing first 50):**
${pluginList}

Based on the control names, identify which plugin this controller mode was designed for. Consider:
- Synthesizer parameter naming patterns (VCF, VCO, LFO, envelope names, etc.)
- Manufacturer-specific terminology
- Common synthesizer architectures (Jupiter-8, Prophet-5, Juno-60, etc.)

Respond in JSON format:
{
  "pluginName": "Exact plugin name from the list, or null if no confident match",
  "confidence": 0.95,
  "reasoning": "Clear explanation of why this plugin matches",
  "alternativeMatches": [
    {
      "pluginName": "Alternative plugin name",
      "confidence": 0.75,
      "reasoning": "Why this could also match"
    }
  ]
}

**Guidelines:**
- confidence >= 0.8: High confidence match
- confidence 0.6-0.79: Moderate confidence (provide alternatives)
- confidence < 0.6: Low confidence (set pluginName to null)
- Use exact plugin names from the available list
- Consider synth architecture (e.g., "Jupiter 8" slot name suggests TAL-J-8 or Arturia Jupiter emulation)

Return ONLY the JSON response, no other text.`;
  }

  /**
   * Call Claude Code CLI with prompt
   */
  private callClaudeCLI(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const claude = spawn('claude', ['--prompt', prompt, '--output', 'json']);

      let stdout = '';
      let stderr = '';

      claude.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      claude.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      claude.on('error', (error) => {
        reject(new Error(`Claude CLI not found or failed to spawn: ${error.message}`));
      });

      claude.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
        }
      });

      // Set timeout (30 seconds)
      setTimeout(() => {
        claude.kill();
        reject(new Error('Claude CLI timeout after 30 seconds'));
      }, 30000);
    });
  }

  /**
   * Parse Claude response JSON
   */
  private parseClaudeResponse(response: string): PluginIdentificationResult {
    try {
      // Extract JSON from response (Claude might wrap it in markdown)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        pluginName: parsed.pluginName || null,
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        reasoning: parsed.reasoning || 'No reasoning provided',
        alternativeMatches: parsed.alternativeMatches || [],
        claudeAvailable: true
      };
    } catch (error: any) {
      throw new Error(`Failed to parse Claude response: ${error.message}`);
    }
  }

  /**
   * Factory method to create PluginIdentifier
   */
  static create(pluginRegistry: PluginRegistryInterface): PluginIdentifier {
    return new PluginIdentifier(pluginRegistry);
  }
}
