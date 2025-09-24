// Registry for canonical MIDI maps

export interface MapRegistryEntry {
  id: string;
  filePath: string;
  metadata: {
    name: string;
    version: string;
    description?: string;
    author?: string;
    tags?: string[];
  };
  controller: {
    manufacturer: string;
    model: string;
  };
  plugin: {
    manufacturer: string;
    name: string;
    format?: string;
  };
}

export class CanonicalMapRegistry {
  private maps = new Map<string, MapRegistryEntry>();

  register(entry: MapRegistryEntry): void {
    this.maps.set(entry.id, entry);
  }

  unregister(id: string): boolean {
    return this.maps.delete(id);
  }

  get(id: string): MapRegistryEntry | undefined {
    return this.maps.get(id);
  }

  getAll(): MapRegistryEntry[] {
    return Array.from(this.maps.values());
  }

  findByController(manufacturer: string, model?: string): MapRegistryEntry[] {
    return this.getAll().filter(entry => {
      const controllerMatch = entry.controller.manufacturer.toLowerCase().includes(manufacturer.toLowerCase());
      if (model) {
        return controllerMatch && entry.controller.model.toLowerCase().includes(model.toLowerCase());
      }
      return controllerMatch;
    });
  }

  findByPlugin(manufacturer: string, name?: string): MapRegistryEntry[] {
    return this.getAll().filter(entry => {
      const manufacturerMatch = entry.plugin.manufacturer.toLowerCase().includes(manufacturer.toLowerCase());
      if (name) {
        return manufacturerMatch && entry.plugin.name.toLowerCase().includes(name.toLowerCase());
      }
      return manufacturerMatch;
    });
  }

  findByTags(tags: string[]): MapRegistryEntry[] {
    return this.getAll().filter(entry => {
      if (!entry.metadata.tags) return false;
      return tags.some(tag => 
        entry.metadata.tags?.some(entryTag => 
          entryTag.toLowerCase().includes(tag.toLowerCase())
        )
      );
    });
  }

  search(query: string): MapRegistryEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(entry => {
      return (
        entry.metadata.name.toLowerCase().includes(lowerQuery) ||
        entry.metadata.description?.toLowerCase().includes(lowerQuery) ||
        entry.controller.manufacturer.toLowerCase().includes(lowerQuery) ||
        entry.controller.model.toLowerCase().includes(lowerQuery) ||
        entry.plugin.manufacturer.toLowerCase().includes(lowerQuery) ||
        entry.plugin.name.toLowerCase().includes(lowerQuery) ||
        entry.metadata.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    });
  }

  getStats(): {
    totalMaps: number;
    controllerManufacturers: string[];
    pluginManufacturers: string[];
    formats: string[];
    tags: string[];
  } {
    const entries = this.getAll();
    const controllerManufacturers = new Set<string>();
    const pluginManufacturers = new Set<string>();
    const formats = new Set<string>();
    const tags = new Set<string>();

    entries.forEach(entry => {
      controllerManufacturers.add(entry.controller.manufacturer);
      pluginManufacturers.add(entry.plugin.manufacturer);
      if (entry.plugin.format) {
        formats.add(entry.plugin.format);
      }
      entry.metadata.tags?.forEach(tag => tags.add(tag));
    });

    return {
      totalMaps: entries.length,
      controllerManufacturers: Array.from(controllerManufacturers).sort(),
      pluginManufacturers: Array.from(pluginManufacturers).sort(),
      formats: Array.from(formats).sort(),
      tags: Array.from(tags).sort(),
    };
  }
}

// Default registry instance
export const defaultRegistry = new CanonicalMapRegistry();

// Register built-in maps
defaultRegistry.register({
  id: 'novation-launchkey-mk3-massive-x',
  filePath: 'maps/novation-launchkey-mk3-massive-x.yaml',
  metadata: {
    name: 'Novation Launchkey MK3 → Native Instruments Massive X',
    version: '1.0.0',
    description: 'Comprehensive mapping for controlling Massive X synthesizer with Novation Launchkey MK3',
    author: 'Audio Control Team',
    tags: ['synthesizer', 'novation', 'native-instruments', 'launchkey', 'massive-x'],
  },
  controller: {
    manufacturer: 'Novation',
    model: 'Launchkey MK3 49',
  },
  plugin: {
    manufacturer: 'Native Instruments',
    name: 'Massive X',
    format: 'VST3',
  },
});

defaultRegistry.register({
  id: 'akai-mpk-mini-arturia-pigments',
  filePath: 'maps/akai-mpk-mini-arturia-pigments.yaml',
  metadata: {
    name: 'Akai MPK Mini MK3 → Arturia Pigments',
    version: '1.0.0',
    description: 'Compact mapping for controlling Arturia Pigments with Akai MPK Mini MK3',
    author: 'Audio Control Team',
    tags: ['synthesizer', 'akai', 'arturia', 'mpk-mini', 'pigments'],
  },
  controller: {
    manufacturer: 'Akai',
    model: 'MPK Mini MK3',
  },
  plugin: {
    manufacturer: 'Arturia',
    name: 'Pigments',
    format: 'VST3',
  },
});