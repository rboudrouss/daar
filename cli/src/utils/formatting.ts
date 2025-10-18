/**
 * Formatting utilities for displaying time and bytes
 */

/**
 * Format time in milliseconds to a human-readable string
 * @param ms - Time in milliseconds
 * @returns Formatted time string (μs, ms, or s)
 */
export function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)} μs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

