/**
 * Tests for interactive prompt service.
 *
 * Uses mock inquirer responses to test all prompt types, validation,
 * and error handling without requiring actual user input.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  InteractivePrompt,
  createInteractivePrompt,
  UserCancelledError,
  DEVICE_TYPES,
  type SamplerPromptResult,
} from './interactive-prompt.js';

// Mock inquirer module
vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

import inquirer from 'inquirer';

describe('InteractivePrompt', () => {
  let promptService: InteractivePrompt;
  let mockPrompt: any;

  beforeEach(() => {
    promptService = new InteractivePrompt();
    mockPrompt = vi.mocked(inquirer.prompt);
    mockPrompt.mockReset();
  });

  describe('promptDeviceType', () => {
    it('should prompt for device type and return selected value', async () => {
      mockPrompt.mockResolvedValue({ deviceType: 'hard-drive' });

      const result = await promptService.promptDeviceType();

      expect(result).toBe('hard-drive');
      expect(mockPrompt).toHaveBeenCalledOnce();
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'list',
            name: 'deviceType',
            message: 'What type of storage device is this?',
            default: 'floppy',
          }),
        ])
      );
    });

    it('should include all device types as choices', async () => {
      mockPrompt.mockResolvedValue({ deviceType: 'floppy' });

      await promptService.promptDeviceType();

      const callArgs = mockPrompt.mock.calls[0][0];
      const prompt = callArgs[0];
      const choices = prompt.choices;

      // Verify all device types are present
      DEVICE_TYPES.forEach((deviceType) => {
        const found = choices.some((choice: any) => choice.value === deviceType.value);
        expect(found).toBe(true);
      });
    });

    it('should default to floppy', async () => {
      mockPrompt.mockResolvedValue({ deviceType: 'floppy' });

      await promptService.promptDeviceType();

      const callArgs = mockPrompt.mock.calls[0][0];
      const prompt = callArgs[0];
      expect(prompt.default).toBe('floppy');
    });

    it('should throw UserCancelledError on cancellation', async () => {
      const cancelError = new Error('User force closed the prompt');
      mockPrompt.mockRejectedValue(cancelError);

      await expect(promptService.promptDeviceType()).rejects.toThrow(UserCancelledError);
    });
  });

  describe('promptSampler', () => {
    it('should prompt with existing samplers and return selected value', async () => {
      const existingSamplers = ['s5000', 's3000xl', 's1000'];
      mockPrompt.mockResolvedValue({ sampler: 's5000' });

      const result = await promptService.promptSampler(existingSamplers);

      expect(result).toEqual({
        sampler: 's5000',
        isNew: false,
      });
      expect(mockPrompt).toHaveBeenCalledOnce();
    });

    it('should include "Add new sampler" option', async () => {
      const existingSamplers = ['s5000'];
      mockPrompt.mockResolvedValue({ sampler: 's5000' });

      await promptService.promptSampler(existingSamplers);

      const callArgs = mockPrompt.mock.calls[0][0];
      const prompt = callArgs[0];
      const choices = prompt.choices;

      // Should have existing sampler + "Add new" option
      expect(choices).toHaveLength(2);
      expect(choices[choices.length - 1].name).toContain('Add new');
    });

    it('should handle empty existing samplers list', async () => {
      const existingSamplers: string[] = [];
      mockPrompt.mockResolvedValue({ sampler: '__ADD_NEW__' });
      mockPrompt.mockResolvedValueOnce({ sampler: '__ADD_NEW__' });
      mockPrompt.mockResolvedValueOnce({ samplerName: 's6000' });

      const result = await promptService.promptSampler(existingSamplers);

      expect(result.isNew).toBe(true);
      expect(result.sampler).toBe('s6000');
    });

    it('should prompt for new sampler name when "Add new" selected', async () => {
      const existingSamplers = ['s5000'];
      // First call: user selects "Add new"
      // Second call: user enters new sampler name
      mockPrompt
        .mockResolvedValueOnce({ sampler: '__ADD_NEW__' })
        .mockResolvedValueOnce({ samplerName: 's6000' });

      const result = await promptService.promptSampler(existingSamplers);

      expect(result).toEqual({
        sampler: 's6000',
        isNew: true,
      });
      expect(mockPrompt).toHaveBeenCalledTimes(2);
    });

    it('should throw UserCancelledError on cancellation', async () => {
      const existingSamplers = ['s5000'];
      const cancelError = new Error('User force closed the prompt');
      mockPrompt.mockRejectedValue(cancelError);

      await expect(promptService.promptSampler(existingSamplers)).rejects.toThrow(UserCancelledError);
    });
  });

  describe('promptNewSamplerName', () => {
    it('should prompt for sampler name and return value', async () => {
      // Mock returns already-trimmed value (filter is applied by inquirer)
      mockPrompt.mockResolvedValue({ samplerName: 's6000' });

      const result = await promptService.promptNewSamplerName();

      expect(result).toBe('s6000');
      expect(mockPrompt).toHaveBeenCalledOnce();
      expect(mockPrompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'input',
            name: 'samplerName',
            message: 'Enter a name for the new sampler:',
          }),
        ])
      );
    });

    it('should validate non-empty sampler name', async () => {
      mockPrompt.mockResolvedValue({ samplerName: 'valid-name' });

      await promptService.promptNewSamplerName();

      const callArgs = mockPrompt.mock.calls[0][0];
      const prompt = callArgs[0];
      const validate = prompt.validate;

      // Test validation function
      expect(validate('')).toBe('Sampler name cannot be empty');
      expect(validate('   ')).toBe('Sampler name cannot be empty');
      expect(validate('valid-name')).toBe(true);
    });

    it('should validate sampler name length', async () => {
      mockPrompt.mockResolvedValue({ samplerName: 'valid-name' });

      await promptService.promptNewSamplerName();

      const callArgs = mockPrompt.mock.calls[0][0];
      const prompt = callArgs[0];
      const validate = prompt.validate;

      // Test length validation
      const longName = 'a'.repeat(51);
      expect(validate(longName)).toContain('50 characters or less');
      expect(validate('a'.repeat(50))).toBe(true);
    });

    it('should validate sampler name characters', async () => {
      mockPrompt.mockResolvedValue({ samplerName: 'valid-name' });

      await promptService.promptNewSamplerName();

      const callArgs = mockPrompt.mock.calls[0][0];
      const prompt = callArgs[0];
      const validate = prompt.validate;

      // Test character validation
      expect(validate('valid-name')).toBe(true);
      expect(validate('valid_name')).toBe(true);
      expect(validate('ValidName123')).toBe(true);
      expect(validate('invalid name')).toContain('can only contain');
      expect(validate('invalid@name')).toContain('can only contain');
      expect(validate('invalid.name')).toContain('can only contain');
    });

    it('should trim input automatically via filter', async () => {
      mockPrompt.mockResolvedValue({ samplerName: 'trimmed' });

      await promptService.promptNewSamplerName();

      const callArgs = mockPrompt.mock.calls[0][0];
      const prompt = callArgs[0];
      const filter = prompt.filter;

      // Test filter function
      expect(filter('  name  ')).toBe('name');
      expect(filter('name')).toBe('name');
    });

    it('should throw UserCancelledError on cancellation', async () => {
      const cancelError = new Error('User canceled');
      mockPrompt.mockRejectedValue(cancelError);

      await expect(promptService.promptNewSamplerName()).rejects.toThrow(UserCancelledError);
    });
  });

  describe('UserCancelledError', () => {
    it('should have correct name and message', () => {
      const error = new UserCancelledError();

      expect(error.name).toBe('UserCancelledError');
      expect(error.message).toBe('User cancelled the operation');
    });

    it('should allow custom message', () => {
      const error = new UserCancelledError('Custom cancellation message');

      expect(error.message).toBe('Custom cancellation message');
    });

    it('should be instance of Error', () => {
      const error = new UserCancelledError();

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(UserCancelledError);
    });
  });

  describe('createInteractivePrompt factory', () => {
    it('should create InteractivePrompt instance', () => {
      const instance = createInteractivePrompt();

      expect(instance).toBeInstanceOf(InteractivePrompt);
    });

    it('should pass options to constructor', () => {
      const options = {
        input: process.stdin,
        output: process.stdout,
      };

      const instance = createInteractivePrompt(options);

      expect(instance).toBeInstanceOf(InteractivePrompt);
    });

    it('should work without options', () => {
      const instance = createInteractivePrompt();

      expect(instance).toBeInstanceOf(InteractivePrompt);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete flow for existing sampler', async () => {
      const existingSamplers = ['s5000', 's3000xl'];

      // User selects device type
      mockPrompt.mockResolvedValueOnce({ deviceType: 'hard-drive' });
      const deviceType = await promptService.promptDeviceType();

      // User selects existing sampler
      mockPrompt.mockResolvedValueOnce({ sampler: 's5000' });
      const samplerResult = await promptService.promptSampler(existingSamplers);

      expect(deviceType).toBe('hard-drive');
      expect(samplerResult).toEqual({
        sampler: 's5000',
        isNew: false,
      });
    });

    it('should handle complete flow for new sampler', async () => {
      const existingSamplers = ['s5000'];

      // User selects device type
      mockPrompt.mockResolvedValueOnce({ deviceType: 'floppy' });
      const deviceType = await promptService.promptDeviceType();

      // User selects "Add new sampler"
      mockPrompt.mockResolvedValueOnce({ sampler: '__ADD_NEW__' });
      // User enters new sampler name
      mockPrompt.mockResolvedValueOnce({ samplerName: 's6000' });
      const samplerResult = await promptService.promptSampler(existingSamplers);

      expect(deviceType).toBe('floppy');
      expect(samplerResult).toEqual({
        sampler: 's6000',
        isNew: true,
      });
    });

    it('should handle cancellation at any step', async () => {
      const cancelError = new Error('User force closed the prompt');

      // Cancel during device type prompt
      mockPrompt.mockRejectedValueOnce(cancelError);
      await expect(promptService.promptDeviceType()).rejects.toThrow(UserCancelledError);

      // Cancel during sampler prompt
      mockPrompt.mockRejectedValueOnce(cancelError);
      await expect(promptService.promptSampler(['s5000'])).rejects.toThrow(UserCancelledError);

      // Cancel during new sampler name prompt
      mockPrompt.mockRejectedValueOnce(cancelError);
      await expect(promptService.promptNewSamplerName()).rejects.toThrow(UserCancelledError);
    });
  });
});
