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

// Utilities
export { cn } from './utils.js';
