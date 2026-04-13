/**
 * Re-export the shared Dialog primitive from editor-core.
 *
 * All modal behavior (escape-to-close, overlay click, focus trap, scroll
 * prevention) is implemented in the editor-core Dialog. S3K consumers
 * import from this file to maintain the @/components/ui/Dialog path.
 */

export {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogActions,
  type DialogProps,
} from '@audiocontrol/editor-core';
