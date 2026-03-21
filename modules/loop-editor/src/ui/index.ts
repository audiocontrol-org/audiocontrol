/**
 * Loop editor — React UI exports.
 *
 * This entry point requires React:
 *   import { LoopEditor } from '@audiocontrol/loop-editor/ui'
 */

export { LoopEditor } from './LoopEditor';
export type { LoopEditorProps } from './LoopEditor';
export { useLoopDetection } from './hooks/useLoopDetection';
export type { UseLoopDetectionResult } from './hooks/useLoopDetection';
export { useLoopEditor } from '@/ui/hooks/use-loop-editor';
export type { UseLoopEditorParams, UseLoopEditorReturn, PlaybackMode } from '@/ui/hooks/use-loop-editor';
