/**
 * PluginRegistry - Service for cataloging and searching plugin descriptors
 *
 * This service scans the plugin descriptor directory and provides
 * fast lookup and search capabilities for AI-powered plugin identification.
 *
 * @module PluginRegistry
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

/**
 * Plugin descriptor metadata extracted from JSON files
 */
export interface PluginRegistryEntry {
  /** Full display name (e.g., "TAL-J-8") */
  pluginName: string;

  /** Manufacturer name (e.g., "TAL-Togu Audio Line") */
  manufacturer: string;

  /** Plugin version */
  version: string;

  /** Plugin format (VST3, AU, etc.) */
  format: string;

  /** Absolute path to descriptor JSON file */
  descriptorPath: string;

  /** Number of parameters in this plugin */
  parameterCount: number;

  /** Optional description from metadata */
  description?: string;

  /** Optional tags for categorization */
  tags?: string[];

  /** Filename (for debugging) */
  filename: string;
}

/**
 * Interface for PluginRegistry operations
 */
export interface PluginRegistryInterface {
  /**
   * Load all plugin descriptors from the directory
   * @returns Array of registry entries
   */
  loadPlugins(): Promise<PluginRegistryEntry[]>;

  /**
   * Get all loaded plugins
   * @returns Array of registry entries
   */
  getAllPlugins(): PluginRegistryEntry[];

  /**
   * Search plugins by name (case-insensitive, partial match)
   * @param query Search query
   * @returns Matching plugins
   */
  searchByName(query: string): PluginRegistryEntry[];

  /**
   * Find exact plugin by name
   * @param name Plugin name
   * @returns Plugin entry or undefined
   */
  findByName(name: string): PluginRegistryEntry | undefined;

  /**
   * Get plugin by descriptor filename
   * @param filename Descriptor filename
   * @returns Plugin entry or undefined
   */
  findByFilename(filename: string): PluginRegistryEntry | undefined;
}

/**
 * Plugin descriptor structure from JSON files
 */
interface PluginDescriptor {
  plugin: {
    manufacturer: string;
    name: string;
    version: string;
    format: string;
    uid: string;
  };
  metadata: {
    version: string;
    created: string;
    author: string;
    description?: string;
    parameter_count: number;
    tags?: string[];
  };
  parameters: unknown[];
}

/**
 * PluginRegistry implementation
 */
export class PluginRegistry implements PluginRegistryInterface {
  private plugins: PluginRegistryEntry[] = [];
  private baseDir: string;

  constructor(baseDir?: string) {
    if (baseDir) {
      this.baseDir = baseDir;
    } else {
      // Default to canonical-midi-maps/plugin-descriptors
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      this.baseDir = path.resolve(__dirname, '../../../canonical-midi-maps/plugin-descriptors');
    }
  }

  /**
   * Load all plugin descriptors from the directory
   */
  async loadPlugins(): Promise<PluginRegistryEntry[]> {
    try {
      const files = await fs.readdir(this.baseDir);
      const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'plugins-catalog-batch.json');

      this.plugins = [];

      for (const filename of jsonFiles) {
        try {
          const descriptorPath = path.join(this.baseDir, filename);
          const content = await fs.readFile(descriptorPath, 'utf-8');
          const descriptor: PluginDescriptor = JSON.parse(content);

          const entry: PluginRegistryEntry = {
            pluginName: descriptor.plugin.name,
            manufacturer: descriptor.plugin.manufacturer,
            version: descriptor.plugin.version,
            format: descriptor.plugin.format,
            descriptorPath,
            parameterCount: descriptor.metadata.parameter_count,
            filename
          };

          if (descriptor.metadata.description) {
            entry.description = descriptor.metadata.description;
          }
          if (descriptor.metadata.tags) {
            entry.tags = descriptor.metadata.tags;
          }

          this.plugins.push(entry);
        } catch (error: any) {
          // Skip invalid files, log warning
          console.warn(`Warning: Failed to load plugin descriptor ${filename}: ${error.message}`);
        }
      }

      // Sort by name for consistent ordering
      this.plugins.sort((a, b) => a.pluginName.localeCompare(b.pluginName));

      return this.plugins;
    } catch (error: any) {
      throw new Error(`Failed to load plugin descriptors: ${error.message}`);
    }
  }

  /**
   * Get all loaded plugins
   */
  getAllPlugins(): PluginRegistryEntry[] {
    return [...this.plugins];
  }

  /**
   * Search plugins by name (case-insensitive, partial match)
   */
  searchByName(query: string): PluginRegistryEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.plugins.filter(p =>
      p.pluginName.toLowerCase().includes(lowerQuery) ||
      p.manufacturer.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Find exact plugin by name (case-insensitive)
   */
  findByName(name: string): PluginRegistryEntry | undefined {
    const lowerName = name.toLowerCase();
    return this.plugins.find(p =>
      p.pluginName.toLowerCase() === lowerName
    );
  }

  /**
   * Get plugin by descriptor filename
   */
  findByFilename(filename: string): PluginRegistryEntry | undefined {
    return this.plugins.find(p => p.filename === filename);
  }

  /**
   * Factory method to create and load registry
   */
  static async create(baseDir?: string): Promise<PluginRegistry> {
    const registry = new PluginRegistry(baseDir);
    await registry.loadPlugins();
    return registry;
  }
}
