import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with clsx.
 *
 * Canonical implementation shared across all editors.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
