import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Configuration for resolving hierarchical repository paths
 */
export interface RepoPathConfig {
  /** Source type (remote or local) */
  sourceType: 'remote' | 'local';

  /** Sampler name (hostname for remote, required --sampler for local) */
  sampler?: string;

  /** Device name (scsi0, scsi1, floppy, etc.) - REQUIRED */
  device: string;

  /** Remote host (for remote sources) */
  host?: string;
}

/**
 * Resolve hierarchical repository path for sampler/device backup
 *
 * Creates path structure: ~/.audiotools/backup/{sampler}/{device}/
 *
 * @param config - Repository path configuration
 * @returns Resolved absolute repository path
 * @throws Error if required parameters are missing
 *
 * @example
 * // Remote source (hostname used as sampler)
 * resolveRepositoryPath({
 *   sourceType: 'remote',
 *   host: 'pi-scsi2.local',
 *   device: 'scsi0'
 * })
 * // => '/Users/user/.audiotools/backup/pi-scsi2/scsi0'
 *
 * @example
 * // Local source (explicit sampler required)
 * resolveRepositoryPath({
 *   sourceType: 'local',
 *   sampler: 's5k-studio',
 *   device: 'floppy'
 * })
 * // => '/Users/user/.audiotools/backup/s5k-studio/floppy'
 */
export function resolveRepositoryPath(config: RepoPathConfig): string {
  const baseDir = join(homedir(), '.audiotools', 'backup');

  // Validate device name
  if (!config.device) {
    throw new Error('Device name is required (--device scsi0|scsi1|floppy|...)');
  }

  // Determine sampler name
  const samplerName = resolveSamplerName(config);

  // Build hierarchical path: {base}/{sampler}/{device}/
  return join(baseDir, samplerName, config.device);
}

/**
 * Resolve sampler name from configuration
 *
 * For remote sources: uses hostname (sanitized)
 * For local sources: uses --sampler flag (required)
 *
 * @param config - Repository path configuration
 * @returns Sanitized sampler name
 * @throws Error if required sampler/host is missing
 */
function resolveSamplerName(config: RepoPathConfig): string {
  if (config.sourceType === 'remote') {
    // Remote: allow sampler override, otherwise use hostname
    if (config.sampler) {
      return sanitizeSamplerName(config.sampler);
    }
    if (!config.host) {
      throw new Error('Host is required for remote sources');
    }
    return sanitizeSamplerName(config.host);
  } else {
    // Local: require --sampler flag
    if (!config.sampler) {
      throw new Error(
        'Sampler name is required for local sources (use --sampler flag)\n' +
          'Example: --sampler s5k-studio --device floppy'
      );
    }
    return sanitizeSamplerName(config.sampler);
  }
}

/**
 * Sanitize sampler name for use in filesystem paths
 *
 * Sanitization rules:
 * - Remove .local suffix from hostnames
 * - Convert to lowercase
 * - Replace special characters with hyphens
 * - Collapse multiple consecutive hyphens
 * - Remove leading/trailing hyphens
 *
 * @param name - Raw sampler name or hostname
 * @returns Sanitized sampler name safe for filesystem use
 *
 * @example
 * sanitizeSamplerName('pi-scsi2.local') // => 'pi-scsi2'
 * sanitizeSamplerName('My S5000') // => 'my-s5000'
 * sanitizeSamplerName('S3K--Zulu!') // => 's3k-zulu'
 */
function sanitizeSamplerName(name: string): string {
  return name
    .replace(/\.local$/i, '') // Remove .local suffix (case-insensitive)
    .toLowerCase() // Lowercase
    .replace(/[^a-z0-9-]/g, '-') // Replace special chars with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}
