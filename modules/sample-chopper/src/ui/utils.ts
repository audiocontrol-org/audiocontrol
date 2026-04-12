/**
 * UI utility functions for sample chopper components.
 *
 * Guideline deviation: cn() is duplicated here instead of imported from
 * @audiocontrol/editor-core because editor-core depends on sample-chopper,
 * so importing the other direction would create a circular dependency.
 * The canonical implementation lives in editor-core/src/utils/cn.ts.
 * Do not copy this pattern to other modules — use the editor-core export instead.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
