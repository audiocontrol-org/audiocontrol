/**
 * Unit tests for ParameterMatcher service.
 *
 * Tests fuzzy matching of controller names to plugin parameters using Claude Code CLI.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ParameterMatcher,
  loadPluginDescriptor,
  type ParameterMatchResult,
} from '../ParameterMatcher.js';
import type { PluginDescriptor } from '@audiocontrol/canonical-midi-maps';
import { spawn } from 'child_process';

// Mock spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Mock plugin descriptor for testing
const mockPluginDescriptor: PluginDescriptor = {
  plugin: {
    manufacturer: 'Test Manufacturer',
    name: 'Test Plugin',
    version: '1.0.0',
    format: 'VST3',
    uid: 'test-uid',
  },
  metadata: {
    version: '1.0',
    created: '2024-01-01T00:00:00Z',
    updated: '2024-01-01T00:00:00Z',
    author: 'test',
    parameter_count: 5,
  },
  parameters: [
    {
      index: 0,
      name: 'Master Volume',
      min: 0,
      max: 1,
      default: 0.5,
      group: 'mixer',
      type: 'continuous',
      automatable: true,
    },
    {
      index: 1,
      name: 'Filter Cutoff',
      min: 0,
      max: 1,
      default: 0.5,
      group: 'filter',
      type: 'continuous',
      automatable: true,
    },
    {
      index: 2,
      name: 'Filter Resonance',
      min: 0,
      max: 1,
      default: 0.3,
      group: 'filter',
      type: 'continuous',
      automatable: true,
    },
    {
      index: 3,
      name: 'Envelope Attack',
      min: 0,
      max: 1,
      default: 0.1,
      group: 'envelope',
      type: 'continuous',
      automatable: true,
    },
    {
      index: 4,
      name: 'LFO Rate',
      min: 0,
      max: 1,
      default: 0.5,
      group: 'modulation',
      type: 'continuous',
      automatable: true,
    },
  ],
};

/**
 * Helper to create a mock spawn process
 */
function createMockProcess(stdout: string, stderr = '', exitCode = 0) {
  const mockProcess = {
    stdout: {
      on: vi.fn((event, handler) => {
        if (event === 'data' && stdout) {
          // Simulate async data emission
          setTimeout(() => handler(Buffer.from(stdout)), 0);
        }
      }),
    },
    stderr: {
      on: vi.fn((event, handler) => {
        if (event === 'data' && stderr) {
          setTimeout(() => handler(Buffer.from(stderr)), 0);
        }
      }),
    },
    stdin: {
      write: vi.fn(),
      end: vi.fn(),
    },
    on: vi.fn((event, handler) => {
      if (event === 'close') {
        setTimeout(() => handler(exitCode), 10);
      }
    }),
    kill: vi.fn(),
  };

  return mockProcess;
}

describe('ParameterMatcher', () => {
  let matcher: ParameterMatcher;

  beforeEach(() => {
    matcher = ParameterMatcher.create();
    vi.clearAllMocks();
  });

  describe('constructor and factory', () => {
    it('should create instance with default options', () => {
      const instance = ParameterMatcher.create();
      expect(instance).toBeInstanceOf(ParameterMatcher);
    });

    it('should create instance with custom options', () => {
      const instance = ParameterMatcher.create({
        minConfidence: 0.7,
        timeout: 60000,
      });
      expect(instance).toBeInstanceOf(ParameterMatcher);
    });
  });

  describe('matchParameters with Claude Code CLI', () => {
    it('should handle successful Claude CLI response', async () => {
      const mockResponse = JSON.stringify([
        {
          controlName: 'Cutoff',
          parameterIndex: 1,
          parameterName: 'Filter Cutoff',
          confidence: 0.95,
          reasoning: 'Direct semantic match',
        },
        {
          controlName: 'Resonance',
          parameterIndex: 2,
          parameterName: 'Filter Resonance',
          confidence: 0.9,
          reasoning: 'Direct semantic match',
        },
      ]);

      const mockProc = createMockProcess(mockResponse);
      vi.mocked(spawn).mockReturnValue(mockProc as any);

      const results = await matcher.matchParameters(
        ['Cutoff', 'Resonance'],
        mockPluginDescriptor
      );

      expect(results).toHaveLength(2);
      expect(results[0].controlName).toBe('Cutoff');
      expect(results[0].pluginParameter).toBe(1);
      expect(results[0].confidence).toBe(0.95);
      expect(results[1].controlName).toBe('Resonance');
      expect(results[1].pluginParameter).toBe(2);

      // Verify spawn was called correctly
      expect(spawn).toHaveBeenCalledWith('claude', [], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Verify prompt was written to stdin
      expect(mockProc.stdin.write).toHaveBeenCalled();
      expect(mockProc.stdin.end).toHaveBeenCalled();
    });

    it('should filter results below minimum confidence', async () => {
      const mockResponse = JSON.stringify([
        {
          controlName: 'Unknown',
          parameterIndex: null,
          parameterName: null,
          confidence: 0.2,
          reasoning: 'No good match found',
        },
      ]);

      const mockProc = createMockProcess(mockResponse);
      vi.mocked(spawn).mockReturnValue(mockProc as any);

      const results = await matcher.matchParameters(
        ['Unknown'],
        mockPluginDescriptor,
        { minConfidence: 0.5 }
      );

      expect(results).toHaveLength(1);
      expect(results[0].pluginParameter).toBeUndefined();
      expect(results[0].confidence).toBe(0.2);
    });

    it('should handle Claude CLI errors gracefully', async () => {
      const mockProc = createMockProcess('', 'Command failed', 1);
      vi.mocked(spawn).mockReturnValue(mockProc as any);

      await expect(
        matcher.matchParameters(['Test'], mockPluginDescriptor)
      ).rejects.toThrow('Claude CLI exited with code 1');
    });

    it('should handle empty CLI response', async () => {
      const mockProc = createMockProcess('');
      vi.mocked(spawn).mockReturnValue(mockProc as any);

      await expect(
        matcher.matchParameters(['Test'], mockPluginDescriptor)
      ).rejects.toThrow('Claude CLI returned empty response');
    });

    it('should handle CLI spawn errors', async () => {
      const mockProc = createMockProcess('');
      mockProc.on = vi.fn((event, handler) => {
        if (event === 'error') {
          setTimeout(() => handler(new Error('spawn ENOENT')), 0);
        }
      });
      vi.mocked(spawn).mockReturnValue(mockProc as any);

      await expect(
        matcher.matchParameters(['Test'], mockPluginDescriptor)
      ).rejects.toThrow('Failed to spawn Claude CLI: spawn ENOENT');
    });

    it('should handle CLI timeout', async () => {
      const mockProc = createMockProcess('');
      // Don't emit 'close' event to simulate timeout
      mockProc.on = vi.fn();
      vi.mocked(spawn).mockReturnValue(mockProc as any);

      const shortTimeoutMatcher = ParameterMatcher.create({ timeout: 100 });

      await expect(
        shortTimeoutMatcher.matchParameters(['Test'], mockPluginDescriptor)
      ).rejects.toThrow('Claude CLI request timed out after 100ms');

      expect(mockProc.kill).toHaveBeenCalled();
    });

    it('should handle invalid JSON in Claude response', async () => {
      const mockProc = createMockProcess('Not valid JSON');
      vi.mocked(spawn).mockReturnValue(mockProc as any);

      await expect(
        matcher.matchParameters(['Test'], mockPluginDescriptor)
      ).rejects.toThrow('Could not find JSON array in Claude response');
    });

    it('should handle malformed JSON in Claude response', async () => {
      const mockProc = createMockProcess('[{invalid json}]');
      vi.mocked(spawn).mockReturnValue(mockProc as any);

      await expect(
        matcher.matchParameters(['Test'], mockPluginDescriptor)
      ).rejects.toThrow('Failed to parse Claude response as JSON');
    });

    it('should handle non-array JSON response', async () => {
      const mockProc = createMockProcess('{"not": "an array"}');
      vi.mocked(spawn).mockReturnValue(mockProc as any);

      await expect(
        matcher.matchParameters(['Test'], mockPluginDescriptor)
      ).rejects.toThrow('Could not find JSON array');
    });

    it('should validate parameter indices from Claude', async () => {
      const mockResponse = JSON.stringify([
        {
          controlName: 'Test',
          parameterIndex: 999, // Invalid index
          parameterName: 'Invalid',
          confidence: 0.9,
          reasoning: 'Test',
        },
      ]);

      const mockProc = createMockProcess(mockResponse);
      vi.mocked(spawn).mockReturnValue(mockProc as any);

      const results = await matcher.matchParameters(['Test'], mockPluginDescriptor);

      expect(results).toHaveLength(1);
      expect(results[0].pluginParameter).toBeUndefined();
      expect(results[0].confidence).toBe(0);
      expect(results[0].reasoning).toContain('Invalid parameter index');
    });

    it('should handle null parameter indices from Claude', async () => {
      const mockResponse = JSON.stringify([
        {
          controlName: 'Test',
          parameterIndex: null,
          parameterName: null,
          confidence: 0.1,
          reasoning: 'No match',
        },
      ]);

      const mockProc = createMockProcess(mockResponse);
      vi.mocked(spawn).mockReturnValue(mockProc as any);

      const results = await matcher.matchParameters(['Test'], mockPluginDescriptor);

      expect(results).toHaveLength(1);
      expect(results[0].pluginParameter).toBeUndefined();
      expect(results[0].confidence).toBe(0.1);
    });

    it('should handle missing matches in Claude response', async () => {
      const mockResponse = JSON.stringify([
        {
          controlName: 'Control1',
          parameterIndex: 0,
          parameterName: 'Master Volume',
          confidence: 0.8,
          reasoning: 'Match',
        },
        // Missing second control
      ]);

      const mockProc = createMockProcess(mockResponse);
      vi.mocked(spawn).mockReturnValue(mockProc as any);

      const results = await matcher.matchParameters(
        ['Control1', 'Control2'],
        mockPluginDescriptor
      );

      expect(results).toHaveLength(2);
      expect(results[0].pluginParameter).toBe(0);
      expect(results[1].pluginParameter).toBeUndefined();
      expect(results[1].reasoning).toBe('No match found');
    });

    it('should extract JSON from markdown code blocks', async () => {
      const mockResponse = '```json\n' + JSON.stringify([
        {
          controlName: 'Test',
          parameterIndex: 0,
          parameterName: 'Master Volume',
          confidence: 0.8,
          reasoning: 'Match',
        },
      ]) + '\n```';

      const mockProc = createMockProcess(mockResponse);
      vi.mocked(spawn).mockReturnValue(mockProc as any);

      const results = await matcher.matchParameters(['Test'], mockPluginDescriptor);

      expect(results).toHaveLength(1);
      expect(results[0].pluginParameter).toBe(0);
    });
  });

  describe('prompt building', () => {
    it('should include plugin and parameter information in prompt', async () => {
      let capturedPrompt = '';

      const mockProc = createMockProcess('[]');
      mockProc.stdin.write = vi.fn((data) => {
        capturedPrompt = data.toString();
      });
      vi.mocked(spawn).mockReturnValue(mockProc as any);

      await matcher.matchParameters(['Cutoff'], mockPluginDescriptor);

      expect(capturedPrompt).toContain('Test Manufacturer');
      expect(capturedPrompt).toContain('Test Plugin');
      expect(capturedPrompt).toContain('Filter Cutoff');
      expect(capturedPrompt).toContain('Cutoff');
    });
  });
});

describe('loadPluginDescriptor', () => {
  it('should throw error if plugin descriptor not found', async () => {
    await expect(loadPluginDescriptor('nonexistent-plugin')).rejects.toThrow(
      'Plugin descriptor not found'
    );
  });

  it('should normalize plugin names to lowercase with hyphens', async () => {
    // This test depends on actual filesystem, but we're testing the error message
    // which shows the normalized name
    try {
      await loadPluginDescriptor('Test Plugin Name');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('test-plugin-name');
    }
  });

  // Note: Testing actual file loading would require either:
  // 1. Mocking fs.readFile and fs.readdir (complex with ESM)
  // 2. Having test fixture files in place
  // 3. Integration tests with real plugin descriptors
  // For unit tests, we focus on error paths and validation logic
});
