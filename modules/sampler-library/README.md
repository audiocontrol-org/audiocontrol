# @audiocontrol/sampler-library

Library storage, schemas, and converters for sampler data. Provides CRUD operations for samples, tones, patches, and sets with support for multiple storage backends (local filesystem, Google Drive, S3).

## Progress Reporting

All sample operations support optional progress callbacks for UI feedback during long-running transfers. This is especially useful when loading large samples from high-latency backends like Google Drive.

### Basic Usage

```typescript
import { loadSample, saveSample, type OperationProgress } from '@audiocontrol/sampler-library/browser';

// Load with progress reporting
const result = await loadSample(root, 'my-sample', [], {
  onProgress: (progress: OperationProgress) => {
    const percent = Math.round(
      (progress.bytesSentAllSteps + progress.bytesSent) / progress.bytesTotalAllSteps * 100
    );
    console.log(`${progress.stepLabel}: ${percent}%`);
  },
});

// Save with progress reporting
await saveSample(root, { name, yaml, wavData }, [], {
  onProgress: (progress) => {
    console.log(`Step ${progress.currentStep}/${progress.totalSteps}: ${progress.stepLabel}`);
  },
});
```

### With UI Components

The `OperationProgress` type is compatible with `OperationProgressBar` from `@audiocontrol/editor-core`:

```typescript
import { loadSample, type OperationProgress } from '@audiocontrol/sampler-library/browser';
import { OperationProgressBar } from '@audiocontrol/editor-core';

function MyComponent() {
  const [progress, setProgress] = useState<OperationProgress | undefined>();

  const handleLoad = async () => {
    const result = await loadSample(root, name, path, {
      onProgress: setProgress,
    });
    setProgress(undefined);
    // ... use result
  };

  return (
    <div>
      {progress && <OperationProgressBar progress={progress} />}
      <button onClick={handleLoad}>Load Sample</button>
    </div>
  );
}
```

### Progress Data Structure

The `OperationProgress` object provides byte-weighted progress tracking:

| Field | Description |
|-------|-------------|
| `currentStep` | Current step number (1-based) |
| `totalSteps` | Total steps in operation |
| `stepLabel` | Human-readable step description |
| `bytesSent` | Bytes transferred in current step |
| `bytesTotal` | Total bytes in current step |
| `bytesSentAllSteps` | Bytes completed in prior steps |
| `bytesTotalAllSteps` | Total bytes across all steps |

Overall percentage: `(bytesSentAllSteps + bytesSent) / bytesTotalAllSteps * 100`

### Functions with Progress Support

- `loadSample(root, name, path, options)` - Load YAML + WAV pair
- `loadSampleMeta(root, name, path, options)` - Load YAML metadata only
- `saveSample(root, payload, path, options)` - Save YAML + WAV pair

### Low-Level Streaming

For custom progress handling, use the streaming utilities directly:

```typescript
import { readFileWithProgress } from '@audiocontrol/sampler-library/browser';

const buffer = await readFileWithProgress(file, (bytesRead, bytesTotal) => {
  console.log(`${bytesRead}/${bytesTotal} bytes`);
});
```

## Storage Backends

- **Local Filesystem** - Browser File System Access API (FSAA)
- **Google Drive** - OAuth 2.0 with PKCE, drive.file scope
- **S3** - AWS Signature v4, compatible with MinIO/Cloudflare R2

## Related Packages

- `@audiocontrol/editor-core` - UI components including `OperationProgressBar`
- `@audiocontrol/sampler-devices` - MIDI device communication
