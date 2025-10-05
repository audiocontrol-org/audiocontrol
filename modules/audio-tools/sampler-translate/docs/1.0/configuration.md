## Configuration

### Translation Context

The `TranslateContext` can be customized by providing implementations of:

```typescript
interface TranslateContext {
  fs: fileio;                    // File system operations
  audioFactory: AudioFactory;    // Audio file loading
  audioTranslate: AudioTranslate; // Format conversion
}
```

### Custom Audio Factory

```typescript
const customFactory: AudioFactory = {
  loadFromFile: async (filepath) => {
    // Custom implementation
    return {
      meta: { /* metadata */ },
      filepath: filepath,
      getSample: async () => { /* return Sample */ }
    };
  }
};

const ctx = {
  ...await newDefaultTranslateContext(),
  audioFactory: customFactory
};
```

### Custom Mapping Functions

Create custom mapping logic by implementing `MapFunction`:

```typescript
const customMapper: MapFunction = (sources: AudioSource[]) => {
  const keygroups: AbstractKeygroup[] = [];

  // Your custom mapping logic
  sources.forEach((source, index) => {
    keygroups.push({
      zones: [{
        audioSource: source,
        lowNote: 60 + index,
        centerNote: 60 + index,
        highNote: 60 + index,
        lowVelocity: 0,
        highVelocity: 127
      }]
    });
  });

  return keygroups;
};

// Use with map()
const result = await map(ctx, customMapper, opts);
```

## Examples
