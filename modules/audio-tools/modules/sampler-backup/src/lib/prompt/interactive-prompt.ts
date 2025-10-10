/**
 * Interactive prompt service for sampler backup CLI.
 *
 * Provides user-friendly prompts for collecting missing backup configuration
 * information. Implements the minimal-command UX principle by asking only
 * for information that cannot be auto-detected.
 *
 * @module prompt/interactive-prompt
 */

import inquirer from 'inquirer';

/**
 * Custom error thrown when user cancels the interactive prompt.
 * Catch this to handle Ctrl+C gracefully in CLI workflows.
 */
export class UserCancelledError extends Error {
  constructor(message = 'User cancelled the operation') {
    super(message);
    this.name = 'UserCancelledError';
  }
}

/**
 * Device type choices for backup sources.
 * Ordered by commonality (most common first).
 */
export const DEVICE_TYPES = [
  { name: 'Floppy Disk', value: 'floppy', description: 'Standard 3.5" floppy disk' },
  { name: 'Hard Drive', value: 'hard-drive', description: 'Internal or external hard drive' },
  { name: 'CD-ROM', value: 'cd-rom', description: 'CD-ROM or optical disc' },
  { name: 'Other', value: 'other', description: 'Other storage device' },
] as const;

/**
 * Result of sampler selection prompt.
 */
export interface SamplerPromptResult {
  /** The selected or newly entered sampler name */
  sampler: string;
  /** Whether this is a new sampler (true) or existing (false) */
  isNew: boolean;
}

/**
 * Options for configuring the interactive prompt service.
 */
export interface InteractivePromptOptions {
  /**
   * Custom input/output streams for testing.
   * If not provided, uses process.stdin/stdout.
   */
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

/**
 * Interface for interactive prompt operations.
 *
 * Defines the contract for prompting users for backup configuration.
 * Use this interface for dependency injection and testing.
 */
export interface InteractivePromptInterface {
  /**
   * Prompt user to select a device type.
   *
   * @returns Promise resolving to selected device type
   * @throws {UserCancelledError} If user cancels with Ctrl+C
   */
  promptDeviceType(): Promise<string>;

  /**
   * Prompt user to select an existing sampler or add a new one.
   *
   * Shows list of existing samplers with option to add new.
   * If user chooses "Add new", prompts for sampler name.
   *
   * @param existingSamplers - List of sampler names from config
   * @returns Promise resolving to sampler selection result
   * @throws {UserCancelledError} If user cancels with Ctrl+C
   */
  promptSampler(existingSamplers: string[]): Promise<SamplerPromptResult>;

  /**
   * Prompt user to enter a name for a new sampler.
   *
   * @returns Promise resolving to new sampler name
   * @throws {UserCancelledError} If user cancels with Ctrl+C
   */
  promptNewSamplerName(): Promise<string>;
}

/**
 * Interactive prompt service implementation using inquirer.
 *
 * Provides user-friendly prompts for collecting backup configuration.
 * Implements validation and handles user cancellation gracefully.
 *
 * @example
 * ```typescript
 * const promptService = new InteractivePrompt();
 *
 * // Prompt for device type
 * const deviceType = await promptService.promptDeviceType();
 * console.log(`Selected: ${deviceType}`);
 *
 * // Prompt for sampler
 * const existingSamplers = ['s5000', 's3000xl'];
 * const { sampler, isNew } = await promptService.promptSampler(existingSamplers);
 * if (isNew) {
 *   console.log(`Created new sampler: ${sampler}`);
 * } else {
 *   console.log(`Selected existing sampler: ${sampler}`);
 * }
 * ```
 */
export class InteractivePrompt implements InteractivePromptInterface {
  private readonly options: InteractivePromptOptions;

  constructor(options: InteractivePromptOptions = {}) {
    this.options = options;
  }

  /**
   * Prompt user to select a device type.
   */
  async promptDeviceType(): Promise<string> {
    try {
      const answer = await inquirer.prompt<{ deviceType: string }>([
        {
          type: 'list',
          name: 'deviceType',
          message: 'What type of storage device is this?',
          choices: DEVICE_TYPES.map((dt) => ({
            name: `${dt.name} - ${dt.description}`,
            value: dt.value,
          })),
          default: 'floppy',
          ...this.getStreamOptions(),
        },
      ]);

      return answer.deviceType;
    } catch (error) {
      this.handleCancellation(error);
      throw error;
    }
  }

  /**
   * Prompt user to select existing sampler or add new.
   */
  async promptSampler(existingSamplers: string[]): Promise<SamplerPromptResult> {
    try {
      // Special value for "add new sampler"
      const ADD_NEW_VALUE = '__ADD_NEW__';

      // Build choices: existing samplers + "Add new" option
      const choices = [
        ...existingSamplers.map((name) => ({
          name: name,
          value: name,
        })),
        {
          name: '➕ Add new sampler...',
          value: ADD_NEW_VALUE,
        },
      ];

      const answer = await inquirer.prompt<{ sampler: string }>([
        {
          type: 'list',
          name: 'sampler',
          message: 'Select sampler for this backup source:',
          choices,
          ...this.getStreamOptions(),
        },
      ]);

      // If user selected "Add new", prompt for name
      if (answer.sampler === ADD_NEW_VALUE) {
        const newName = await this.promptNewSamplerName();
        return {
          sampler: newName,
          isNew: true,
        };
      }

      return {
        sampler: answer.sampler,
        isNew: false,
      };
    } catch (error) {
      this.handleCancellation(error);
      throw error;
    }
  }

  /**
   * Prompt user to enter a new sampler name.
   */
  async promptNewSamplerName(): Promise<string> {
    try {
      const answer = await inquirer.prompt<{ samplerName: string }>([
        {
          type: 'input',
          name: 'samplerName',
          message: 'Enter a name for the new sampler:',
          validate: (input: string) => {
            const trimmed = input.trim();
            if (!trimmed) {
              return 'Sampler name cannot be empty';
            }
            if (trimmed.length > 50) {
              return 'Sampler name must be 50 characters or less';
            }
            // Check for invalid characters (basic validation)
            if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
              return 'Sampler name can only contain letters, numbers, hyphens, and underscores';
            }
            return true;
          },
          filter: (input: string) => input.trim(),
          ...this.getStreamOptions(),
        },
      ]);

      return answer.samplerName;
    } catch (error) {
      this.handleCancellation(error);
      throw error;
    }
  }

  /**
   * Get input/output stream options for inquirer prompts.
   * Used for testing with custom streams.
   */
  private getStreamOptions() {
    const opts: any = {};
    if (this.options.input) {
      opts.input = this.options.input;
    }
    if (this.options.output) {
      opts.output = this.options.output;
    }
    return opts;
  }

  /**
   * Handle user cancellation (Ctrl+C) gracefully.
   * Converts inquirer errors to UserCancelledError.
   */
  private handleCancellation(error: unknown): void {
    if (error instanceof Error) {
      // Inquirer throws when user hits Ctrl+C
      if (error.message.includes('User force closed') || error.message.includes('canceled')) {
        throw new UserCancelledError();
      }
    }
  }
}

/**
 * Factory function to create an interactive prompt service.
 * Provides backward compatibility and convenience.
 *
 * @param options - Optional configuration
 * @returns New InteractivePrompt instance
 */
export function createInteractivePrompt(options?: InteractivePromptOptions): InteractivePromptInterface {
  return new InteractivePrompt(options);
}
