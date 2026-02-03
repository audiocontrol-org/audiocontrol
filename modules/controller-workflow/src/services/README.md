# Controller Workflow Services

Intelligent services for controller configuration and plugin mapping.

## ParameterMatcher

The `ParameterMatcher` service uses Claude Code CLI to intelligently match hardware controller control names to plugin parameters based on semantic similarity, common naming conventions, and audio engineering domain knowledge.

### Features

- **AI-Powered Matching**: Uses Claude Code CLI for intelligent parameter matching
- **Confidence Scoring**: Provides 0-1 confidence scores for each match
- **Semantic Understanding**: Recognizes common abbreviations and synonyms
- **Plugin Descriptor Support**: Works with the canonical-midi-maps plugin descriptor registry
- **Timeout Handling**: Configurable timeouts for CLI requests
- **Error Handling**: Robust error handling for CLI failures

### Requirements

**Claude Code CLI must be installed and authenticated:**

```bash
# Claude Code is already installed on your system
# Verify it's working:
claude --version

# If you need to authenticate:
claude auth
```

### Basic Usage

```typescript
import { ParameterMatcher, loadPluginDescriptor } from '@oletizi/controller-workflow';

// Load plugin descriptor
const descriptor = await loadPluginDescriptor('tal-j-8');

// Create matcher instance
const matcher = ParameterMatcher.create({
  minConfidence: 0.6,  // Minimum confidence threshold
  timeout: 30000,      // 30 second timeout
});

// Match control names to parameters
const hardwareControls = ['Cutoff', 'Resonance', 'Attack', 'Release'];
const results = await matcher.matchParameters(hardwareControls, descriptor);

// Process results
for (const result of results) {
  if (result.pluginParameter !== undefined) {
    console.log(`${result.controlName} → ${result.parameterName}`);
    console.log(`  Confidence: ${result.confidence}`);
    console.log(`  Parameter Index: ${result.pluginParameter}`);
  }
}
```

### Configuration

#### Match Options

```typescript
interface MatchOptions {
  minConfidence?: number;        // 0-1, default 0.5
  preserveControlNames?: boolean; // Preserve original names
  customPrompt?: string;         // Custom system prompt
  timeout?: number;              // Request timeout in ms
}
```

### Advanced Usage

#### Custom Prompts

You can provide a custom system prompt to guide matching behavior:

```typescript
const results = await matcher.matchParameters(controls, descriptor, {
  customPrompt: `You are an expert at mapping MIDI controls to synthesizer parameters.
Focus on common synthesizer workflows and standard naming conventions.
Consider these priority mappings:
- Cutoff → Filter Frequency
- Res → Filter Resonance
- Atk → Envelope Attack
...`
});
```

#### Filtering by Confidence

```typescript
const highConfidenceMatches = results.filter(r => r.confidence >= 0.8);
const unknownControls = results.filter(r => r.pluginParameter === undefined);
```

#### Integration with Deployment Workflow

```typescript
// Match parameters
const matches = await matcher.matchParameters(controlNames, descriptor);

// Add to canonical map
const canonicalMap = {
  name: 'My Controller',
  plugin: descriptor.plugin,
  bindings: matches.map((match, index) => ({
    control: match.controlName,
    cc: index + 1,
    parameter: match.pluginParameter,
    name: match.parameterName,
  })),
};
```

### Plugin Descriptor Loading

The `loadPluginDescriptor` function loads plugin descriptors from the canonical-midi-maps registry:

```typescript
// By plugin name (case-insensitive, space-insensitive)
const descriptor = await loadPluginDescriptor('TAL-J-8');
const descriptor = await loadPluginDescriptor('tal j 8');
const descriptor = await loadPluginDescriptor('tal-togu-audio-line-tal-j-8');

// All normalize to the same descriptor file
```

### Error Handling

```typescript
try {
  const results = await matcher.matchParameters(controls, descriptor);
} catch (error) {
  if (error.message.includes('Failed to spawn Claude CLI')) {
    // Handle CLI not found or spawn errors
    console.error('Claude Code CLI is not installed or not in PATH');
  } else if (error.message.includes('timeout')) {
    // Handle timeout
    console.error('Claude CLI request timed out - try increasing timeout');
  } else if (error.message.includes('exited with code')) {
    // Handle CLI execution errors
    console.error('Claude CLI failed to execute');
  } else if (error.message.includes('Plugin descriptor not found')) {
    // Handle missing plugin descriptor
    console.error('Plugin not found in registry');
  }
}
```

### Performance Considerations

- **CLI Response Time**: Typical 2-10 seconds for 10-20 controls (depends on Claude Code CLI performance)
- **Batch Processing**: Process multiple controllers sequentially to avoid spawning too many processes
- **Timeouts**: Default 30s should handle most plugins; increase for large plugins (>500 params)
- **Caching**: Consider caching results for frequently used plugin/control combinations

### Examples

See `/examples/parameter-matching-example.ts` for a complete working example.

### Testing

Unit tests use mocked `spawn` to avoid actual CLI calls:

```typescript
import { ParameterMatcher } from '@oletizi/controller-workflow';
import { vi } from 'vitest';
import { spawn } from 'child_process';

// Mock spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

// Create mock process
const mockProc = {
  stdout: { on: vi.fn() },
  stderr: { on: vi.fn() },
  stdin: { write: vi.fn(), end: vi.fn() },
  on: vi.fn((event, handler) => {
    if (event === 'close') handler(0);
  }),
};

vi.mocked(spawn).mockReturnValue(mockProc);

const results = await matcher.matchParameters(controls, descriptor);
```

### Architecture

The ParameterMatcher follows interface-first design:

- **Interface**: `ParameterMatcherInterface` - contract for matching implementations
- **Implementation**: `ParameterMatcher` - Claude Code CLI-based implementation
- **Factory Pattern**: `ParameterMatcher.create()` for dependency injection
- **Composition**: No inheritance, uses functional composition

### Implementation Details

#### How it Works

1. **Prompt Construction**: Builds a detailed prompt with plugin parameters and control names
2. **CLI Invocation**: Spawns `claude` command and pipes prompt to stdin
3. **Response Parsing**: Extracts JSON from Claude's response (handles markdown code blocks)
4. **Validation**: Validates parameter indices and confidence scores
5. **Filtering**: Applies minimum confidence threshold

#### CLI Command

The service spawns the Claude Code CLI as:

```bash
claude < prompt.txt
```

The prompt is piped to stdin, and the response is read from stdout.

#### Response Format

Claude is instructed to respond with JSON:

```json
[
  {
    "controlName": "Cutoff",
    "parameterIndex": 42,
    "parameterName": "Filter Cutoff",
    "confidence": 0.95,
    "reasoning": "Direct semantic match"
  }
]
```

### Future Enhancements

- Rule-based fallback matcher for offline usage
- Caching layer for common plugin/control combinations
- Learning from user corrections
- Support for multi-plugin scenarios
- Parameter group awareness (envelope, filter, oscillator)
- Batch processing optimization for multiple controllers
