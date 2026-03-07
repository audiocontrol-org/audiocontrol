import { describe, it, expect } from 'vitest';
import { homedir } from 'os';
import { join } from 'path';
import {
  getLibraryRoot,
  getDeviceLibraryPath,
  getTonesDirectory,
  getPatchesDirectory,
  getTemplatesDirectory,
  getTonePath,
  getToneWavePath,
  getPatchPath,
  getTemplatePath,
  sanitizeFilename,
  getBaseName,
} from '@/storage/library-paths.js';

describe('library-paths', () => {
  describe('getLibraryRoot', () => {
    it('should return path under home directory', () => {
      const root = getLibraryRoot();
      expect(root).toBe(join(homedir(), 'Documents', 'AudioTools', 'library'));
    });
  });

  describe('getDeviceLibraryPath', () => {
    it('should return device-specific path', () => {
      expect(getDeviceLibraryPath('s330')).toBe(
        join(homedir(), 'Documents', 'AudioTools', 'library', 's330')
      );
      expect(getDeviceLibraryPath('jv1080')).toBe(
        join(homedir(), 'Documents', 'AudioTools', 'library', 'jv1080')
      );
    });
  });

  describe('directory paths', () => {
    it('should return correct tones directory', () => {
      expect(getTonesDirectory('s330')).toBe(
        join(homedir(), 'Documents', 'AudioTools', 'library', 's330', 'tones')
      );
    });

    it('should return correct patches directory', () => {
      expect(getPatchesDirectory('s330')).toBe(
        join(homedir(), 'Documents', 'AudioTools', 'library', 's330', 'patches')
      );
    });

    it('should return correct templates directory', () => {
      expect(getTemplatesDirectory('s330')).toBe(
        join(homedir(), 'Documents', 'AudioTools', 'library', 's330', 'templates')
      );
    });
  });

  describe('file paths', () => {
    it('should return correct tone YAML path', () => {
      expect(getTonePath('s330', 'Kick_01')).toBe(
        join(homedir(), 'Documents', 'AudioTools', 'library', 's330', 'tones', 'Kick_01.yaml')
      );
    });

    it('should return correct tone WAV path', () => {
      expect(getToneWavePath('s330', 'Kick_01')).toBe(
        join(homedir(), 'Documents', 'AudioTools', 'library', 's330', 'tones', 'Kick_01.wav')
      );
    });

    it('should return correct patch path', () => {
      expect(getPatchPath('s330', 'DrumKit_01')).toBe(
        join(homedir(), 'Documents', 'AudioTools', 'library', 's330', 'patches', 'DrumKit_01.yaml')
      );
    });

    it('should return correct template path', () => {
      expect(getTemplatePath('s330', 'drum-kit')).toBe(
        join(homedir(), 'Documents', 'AudioTools', 'library', 's330', 'templates', 'drum-kit.yaml')
      );
    });
  });

  describe('sanitizeFilename', () => {
    it('should pass through safe names unchanged', () => {
      expect(sanitizeFilename('Kick_01')).toBe('Kick_01');
      expect(sanitizeFilename('my-patch')).toBe('my-patch');
    });

    it('should replace unsafe characters', () => {
      expect(sanitizeFilename('file<>:"/\\|?*name')).toBe('file_name');
    });

    it('should replace spaces with underscores', () => {
      expect(sanitizeFilename('My Cool Tone')).toBe('My_Cool_Tone');
    });

    it('should collapse multiple underscores', () => {
      expect(sanitizeFilename('a___b')).toBe('a_b');
    });

    it('should trim leading/trailing underscores', () => {
      expect(sanitizeFilename('_name_')).toBe('name');
    });

    it('should limit length to 64 characters', () => {
      const longName = 'a'.repeat(100);
      expect(sanitizeFilename(longName).length).toBe(64);
    });

    it('should handle complex cases', () => {
      expect(sanitizeFilename('  My <Cool> "Tone"  ')).toBe('My_Cool_Tone');
    });
  });

  describe('getBaseName', () => {
    it('should extract base name from path', () => {
      expect(getBaseName('/path/to/file.yaml')).toBe('file');
      expect(getBaseName('C:\\path\\to\\file.yaml')).toBe('file');
    });

    it('should handle names without extension', () => {
      expect(getBaseName('/path/to/file')).toBe('file');
    });

    it('should handle multiple dots', () => {
      expect(getBaseName('/path/to/file.test.yaml')).toBe('file.test');
    });

    it('should handle just a filename', () => {
      expect(getBaseName('file.yaml')).toBe('file');
    });
  });
});
