/**
 * Parameter Matcher Service
 *
 * Uses Claude AI to perform fuzzy matching between hardware control names
 * and plugin parameter names, enabling intelligent auto-mapping of controllers
 * to plugin parameters.
 *
 * @module controller-workflow/services
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import type { PluginDescriptor, PluginParameter } from '@audiocontrol/canonical-midi-maps';

/**
 * Result of a parameter matching operation.
 * Contains the matched parameter index, confidence score, and reasoning.
 */
export interface ParameterMatchResult {
  /** Original control name from hardware controller */
  controlName: string;

  /** Matched plugin parameter index (undefined if no match) */
  pluginParameter?: number;

  /** Match confidence score from 0 to 1 */
  confidence: number;

  /** Name of the matched parameter */
  parameterName?: string;

  /** AI reasoning for the match decision */
  reasoning?: string;
}

/**
 * Options for parameter matching behavior.
 */
export interface MatchOptions {
  /** Minimum confidence threshold (0-1). Matches below this are discarded. */
  minConfidence?: number;

  /** Whether to preserve original control names in output */
  preserveControlNames?: boolean;

  /** Custom system prompt to guide matching behavior */
  customPrompt?: string;

  /** Timeout for AI request in milliseconds */
  timeout?: number;
}

/**
 * Interface for parameter matching implementations.
 * Allows for different matching strategies (AI-based, rule-based, etc.)
 */
export interface ParameterMatcherInterface {
  /**
   * Match hardware control names to plugin parameters.
   *
   * @param controlNames - List of hardware control names to match
   * @param pluginDescriptor - Plugin descriptor with parameter information
   * @param options - Optional matching configuration
   * @returns Promise resolving to array of match results
   */
  matchParameters(
    controlNames: string[],
    pluginDescriptor: PluginDescriptor,
    options?: MatchOptions
  ): Promise<ParameterMatchResult[]>;
}

/**
 * Claude AI-based parameter matcher implementation.
 *
 * Uses Claude Code CLI to intelligently match hardware control names to plugin parameters
 * based on semantic similarity, common naming patterns, and domain knowledge.
 *
 * Requires Claude Code CLI (`claude` command) to be installed and authenticated.
 */
export class ParameterMatcher implements ParameterMatcherInterface {
  private readonly minConfidence: number;
  private readonly timeout: number;

  /**
   * Create a new ParameterMatcher instance.
   *
   * @param options - Configuration options
   */
  constructor(options: { minConfidence?: number; timeout?: number } = {}) {
    this.minConfidence = options.minConfidence ?? 0.5;
    this.timeout = options.timeout ?? 30000; // 30 second default
  }

  /**
   * Factory method to create a ParameterMatcher instance.
   *
   * @param options - Configuration options
   * @returns New ParameterMatcher instance
   */
  static create(options?: { minConfidence?: number; timeout?: number }): ParameterMatcher {
    return new ParameterMatcher(options);
  }

  /**
   * Match hardware control names to plugin parameters using Claude AI.
   *
   * Constructs a prompt containing control names and plugin parameters,
   * sends it to Claude Code CLI, and parses the structured response.
   *
   * @param controlNames - Hardware control names to match
   * @param pluginDescriptor - Plugin descriptor with parameters
   * @param options - Optional matching configuration
   * @returns Promise resolving to match results
   * @throws Error if Claude Code CLI is unavailable
   * @throws Error if response parsing fails
   */
  async matchParameters(
    controlNames: string[],
    pluginDescriptor: PluginDescriptor,
    options: MatchOptions = {}
  ): Promise<ParameterMatchResult[]> {
    const minConfidence = options.minConfidence ?? this.minConfidence;

    // Build the matching prompt
    const prompt = this.buildMatchingPrompt(controlNames, pluginDescriptor, options);

    // Call Claude Code CLI
    const response = await this.callClaudeCLI(prompt);

    // Parse Claude's response
    const results = this.parseClaudeResponse(response, controlNames, pluginDescriptor);

    // Filter by confidence threshold
    return results.map((result): ParameterMatchResult => {
      if (result.confidence < minConfidence) {
        return {
          controlName: result.controlName,
          confidence: result.confidence,
          ...(result.reasoning !== undefined && { reasoning: result.reasoning }),
        };
      }
      return result;
    });
  }

  /**
   * Build the matching prompt for Claude.
   *
   * Creates a structured prompt that guides Claude to match control names
   * to plugin parameters with confidence scores and reasoning.
   *
   * @param controlNames - Control names to match
   * @param pluginDescriptor - Plugin descriptor
   * @param options - Optional configuration
   * @returns Formatted prompt string
   */
  private buildMatchingPrompt(
    controlNames: string[],
    pluginDescriptor: PluginDescriptor,
    options: MatchOptions
  ): string {
    const systemPrompt =
      options.customPrompt ||
      `You are an expert at mapping MIDI controller controls to audio plugin parameters.
Your task is to match hardware control names to plugin parameter names based on semantic similarity,
common audio engineering naming conventions, and logical groupings.

For each control name, provide:
1. The best matching plugin parameter index (or null if no good match)
2. A confidence score from 0.0 to 1.0
3. Brief reasoning for your choice

Consider:
- Semantic similarity (e.g., "Filter Cutoff" matches "Cutoff", "LP Freq", "Filter Frequency")
- Common abbreviations (e.g., "Res" for "Resonance", "Env" for "Envelope")
- Logical groupings (e.g., oscillator controls, filter controls, envelope controls)
- Parameter groups and categories in the plugin
- Audio engineering domain knowledge

Respond with a JSON array of objects with this structure:
[
  {
    "controlName": "string",
    "parameterIndex": number | null,
    "parameterName": "string" | null,
    "confidence": number,
    "reasoning": "string"
  }
]`;

    // Format parameter list
    const parameterList = pluginDescriptor.parameters
      .map((param: PluginParameter) => {
        const group = param.group ? ` [${param.group}]` : '';
        return `  ${param.index}: ${param.name}${group}`;
      })
      .join('\n');

    const controlList = controlNames.map((name, i) => `  ${i}: ${name}`).join('\n');

    const prompt = `${systemPrompt}

PLUGIN: ${pluginDescriptor.plugin.manufacturer} - ${pluginDescriptor.plugin.name}
Total Parameters: ${pluginDescriptor.parameters.length}

PLUGIN PARAMETERS:
${parameterList}

HARDWARE CONTROLS TO MATCH:
${controlList}

Please provide the JSON response with matches for each control.`;

    return prompt;
  }

  /**
   * Call Claude Code CLI to process the matching request.
   *
   * Spawns the `claude` CLI process and pipes the prompt to stdin.
   *
   * @param prompt - The matching prompt
   * @returns Promise resolving to Claude's response text
   * @throws Error if CLI command fails or times out
   */
  private async callClaudeCLI(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn('claude', [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      const timeoutHandle = setTimeout(() => {
        process.kill();
        reject(new Error(`Claude CLI request timed out after ${this.timeout}ms`));
      }, this.timeout);

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('error', (error) => {
        clearTimeout(timeoutHandle);
        reject(new Error(`Failed to spawn Claude CLI: ${error.message}`));
      });

      process.on('close', (code) => {
        clearTimeout(timeoutHandle);

        if (code !== 0) {
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
          return;
        }

        if (!stdout.trim()) {
          reject(new Error('Claude CLI returned empty response'));
          return;
        }

        resolve(stdout);
      });

      // Write prompt to stdin
      process.stdin.write(prompt);
      process.stdin.end();
    });
  }

  /**
   * Parse Claude's JSON response into ParameterMatchResult objects.
   *
   * Extracts the JSON array from Claude's response and validates the structure.
   *
   * @param response - Raw response text from Claude
   * @param controlNames - Original control names for validation
   * @param pluginDescriptor - Plugin descriptor for parameter lookup
   * @returns Array of match results
   * @throws Error if response cannot be parsed or is invalid
   */
  private parseClaudeResponse(
    response: string,
    controlNames: string[],
    pluginDescriptor: PluginDescriptor
  ): ParameterMatchResult[] {
    // Extract JSON from response (Claude might wrap it in markdown code blocks)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error(`Could not find JSON array in Claude response: ${response.substring(0, 200)}`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to parse Claude response as JSON: ${error}`);
    }

    if (!Array.isArray(parsed)) {
      throw new Error('Claude response is not an array');
    }

    // Validate and transform response
    const results: ParameterMatchResult[] = [];

    for (let i = 0; i < controlNames.length; i++) {
      const controlName = controlNames[i];
      if (!controlName) {
        continue;
      }

      const match = parsed[i];

      if (!match || typeof match !== 'object') {
        // If Claude didn't provide a match for this control, add a no-match result
        results.push({
          controlName,
          confidence: 0,
          reasoning: 'No match found',
        });
        continue;
      }

      const paramIndex = match.parameterIndex as number | null | undefined;
      const confidence = typeof match.confidence === 'number' ? match.confidence : 0;
      const reasoning = typeof match.reasoning === 'string' ? match.reasoning : undefined;

      if (paramIndex === null || paramIndex === undefined || paramIndex < 0) {
        results.push({
          controlName,
          confidence,
          reasoning,
        });
        continue;
      }

      // Validate parameter index
      const parameter = pluginDescriptor.parameters[paramIndex];
      if (!parameter) {
        results.push({
          controlName,
          confidence: 0,
          reasoning: `Invalid parameter index ${paramIndex}`,
        });
        continue;
      }

      results.push({
        controlName,
        pluginParameter: paramIndex,
        parameterName: parameter.name,
        confidence,
        reasoning,
      });
    }

    return results;
  }
}

/**
 * Load a plugin descriptor from the canonical-midi-maps registry.
 *
 * Looks up plugin descriptor files by manufacturer and plugin name,
 * normalizing names to match filesystem conventions.
 *
 * @param pluginName - Plugin name (e.g., "TAL-J-8" or "tal-togu-audio-line-tal-j-8")
 * @returns Promise resolving to plugin descriptor
 * @throws Error if descriptor file not found or cannot be loaded
 */
export async function loadPluginDescriptor(pluginName: string): Promise<PluginDescriptor> {
  // Normalize plugin name to filename format
  const normalizedName = pluginName.toLowerCase().replace(/\s+/g, '-');

  // Find the canonical-midi-maps module
  // Get current file's directory (ES module approach)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Navigate from controller-workflow to canonical-midi-maps
  const baseDir = path.resolve(__dirname, "../../../canonical-midi-maps/plugin-descriptors");

  // Try to find matching descriptor file
  let descriptorPath: string | undefined;

  try {
    const files = await fs.readdir(baseDir);

    // Look for exact match or substring match
    const matchingFile = files.find(
      (file) => file === `${normalizedName}.json` || file.includes(normalizedName)
    );

    if (matchingFile) {
      descriptorPath = path.join(baseDir, matchingFile);
    }
  } catch (error) {
    throw new Error(`Failed to read plugin descriptors directory: ${error}`);
  }

  if (!descriptorPath) {
    throw new Error(
      `Plugin descriptor not found for "${pluginName}". ` +
        `Searched in ${baseDir} for files matching "${normalizedName}"`
    );
  }

  // Load and parse the descriptor
  try {
    const content = await fs.readFile(descriptorPath, 'utf-8');
    const descriptor = JSON.parse(content) as PluginDescriptor;

    // Validate basic structure
    if (!descriptor.plugin || !descriptor.parameters) {
      throw new Error('Invalid plugin descriptor structure: missing plugin or parameters');
    }

    return descriptor;
  } catch (error) {
    throw new Error(`Failed to load plugin descriptor from ${descriptorPath}: ${error}`);
  }
}
