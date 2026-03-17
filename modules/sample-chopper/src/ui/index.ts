/**
 * @audiocontrol/sample-chopper/ui
 *
 * React UI components for sample chopping.
 *
 * @example
 * ```tsx
 * import {
 *   SampleChopperDialog,
 *   WaveformEditor,
 *   useAudioPreview,
 *   type ChopperResult,
 * } from '@audiocontrol/sample-chopper/ui';
 * ```
 *
 * @packageDocumentation
 */

// Components
export {
  SampleChopperDialog,
  type SampleChopperDialogProps,
  type ChopperOutputState,
  type ChopperResult,
  type ChopperSavePayload,
  type SliceDefinitionOutput,
  type InitialSliceDefinition,
} from './components/SampleChopperDialog.js';

export {
  WaveformEditor,
  type SliceMarker,
  type SliceChange,
} from './components/WaveformEditor.js';

export {
  SliceMethodPanel,
  type SliceMethodPanelProps,
} from './components/SliceMethodPanel.js';

export {
  SliceList,
  type SliceListProps,
} from './components/SliceList.js';

// Hooks
export {
  useAudioPreview,
  type UseAudioPreviewOptions,
  type UseAudioPreviewReturn,
} from './hooks/useAudioPreview.js';

export {
  useSampleChopper,
  MIN_ZOOM,
  MAX_ZOOM,
  type UseSampleChopperParams,
  type SliceMethodTab,
} from './hooks/useSampleChopper.js';

export {
  TriggerMethodContent,
  type TriggerMethodContentProps,
} from './components/TriggerMethodContent.js';

export {
  useTriggerInput,
  type TriggerState,
  type TriggerId,
  type UseTriggerInputParams,
  type UseTriggerInputReturn,
} from './hooks/useTriggerInput.js';

export {
  useTriggerRecording,
  type UseTriggerRecordingParams,
  type UseTriggerRecordingReturn,
} from './hooks/useTriggerRecording.js';

export {
  useTriggerPlayback,
  type PolyphonyMode,
  type PlaybackMode,
  type TriggerPlaybackConfig,
  type UseTriggerPlaybackParams,
  type UseTriggerPlaybackReturn,
} from './hooks/useTriggerPlayback.js';

// Utilities
export { cn } from './utils.js';
