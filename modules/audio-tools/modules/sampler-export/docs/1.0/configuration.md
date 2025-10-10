## Configuration

### Environment Variables

**None required.** The package uses sensible defaults and automatic platform detection.

### mtools Integration

The package automatically sets `MTOOLS_SKIP_CHECK=1` when invoking mcopy to skip mtools.conf configuration file checks. This allows zero-configuration operation with bundled binaries.

### Batch Extraction Defaults

```typescript
const DEFAULT_SOURCE_DIR = '~/.audiotools/backup';
const DEFAULT_DEST_DIR = '~/.audiotools/sampler-export/extracted';
const DEFAULT_RSNAPSHOT_INTERVAL = 'daily.0';  // Most recent backup
```

**Customization:**

```typescript
await extractBatch({
  sourceDir: '/custom/backup/location',
  destDir: '/custom/output/location',
  samplerTypes: ['s5k'],  // Extract only S5K disks
  force: true  // Force re-extraction of all disks
});
```

---
