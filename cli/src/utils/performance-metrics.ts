/**
 * Performance metrics tracking and display
 */

import { formatBytes } from "./memory-utils";

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

export interface PerformanceMetrics {
  totalTime: number;
  parseTime: number;
  nfaTime: number;
  dfaTime?: number;
  minDfaTime?: number;
  matchTime: number;
  memoryUsed: number;
  peakMemory: number;
  prefilterStats?: {
    enabled: boolean;
    literals: string[];
    literalCount: number;
    algorithm: string;
  };
  algorithmUsed?: string;
  algorithmReason?: string;
  structureStats?: {
    nfaNodes?: number;
    nfaSize?: number;
    dfaNodes?: number;
    dfaSize?: number;
    minDfaNodes?: number;
    minDfaSize?: number;
    acNodes?: number;
    acSize?: number;
  };
}

/**
 * Print performance metrics to stderr
 * @param metrics - The performance metrics to display
 */
export function printPerformanceMetrics(metrics: PerformanceMetrics): void {
  console.error("\n=== Performance Metrics ===");

  printTimingMetrics(metrics);
  printMemoryMetrics(metrics);
  printPrefilterStats(metrics);
  printAlgorithmSelection(metrics);
  printStructureStats(metrics);

  console.error("===========================\n");
}

/**
 * Print timing metrics
 */
function printTimingMetrics(metrics: PerformanceMetrics): void {
  console.error(`Total execution time: ${formatTime(metrics.totalTime)}`);
  console.error(`  - Regex parsing:    ${formatTime(metrics.parseTime)}`);
  console.error(`  - NFA construction: ${formatTime(metrics.nfaTime)}`);

  if (metrics.dfaTime !== undefined) {
    console.error(`  - DFA construction: ${formatTime(metrics.dfaTime)}`);
  }

  if (metrics.minDfaTime !== undefined) {
    console.error(`  - DFA minimization: ${formatTime(metrics.minDfaTime)}`);
  }

  console.error(`  - Pattern matching: ${formatTime(metrics.matchTime)}`);
}

/**
 * Print memory metrics
 */
function printMemoryMetrics(metrics: PerformanceMetrics): void {
  console.error(`\nMemory usage:`);
  console.error(`  - Total allocated:  ${formatBytes(metrics.memoryUsed)}`);
  console.error(`  - Peak memory:      ${formatBytes(metrics.peakMemory)}`);
}

/**
 * Print prefilter statistics
 */
function printPrefilterStats(metrics: PerformanceMetrics): void {
  if (!metrics.prefilterStats) return;

  console.error(`\nPrefilter optimization:`);
  console.error(
    `  - Enabled:          ${metrics.prefilterStats.enabled ? "Yes" : "No"}`
  );

  if (metrics.prefilterStats.enabled) {
    console.error(
      `  - Literal count:    ${metrics.prefilterStats.literalCount}`
    );
    console.error(
      `  - Literals:         ${metrics.prefilterStats.literals.join(", ")}`
    );
    console.error(`  - Algorithm:        ${metrics.prefilterStats.algorithm}`);
  }
}

/**
 * Print algorithm selection information
 */
function printAlgorithmSelection(metrics: PerformanceMetrics): void {
  if (!metrics.algorithmUsed) return;

  console.error(`\nAlgorithm selection:`);
  console.error(`  - Algorithm:        ${metrics.algorithmUsed}`);

  if (metrics.algorithmReason) {
    console.error(`  - Reason:           ${metrics.algorithmReason}`);
  }
}

/**
 * Print data structure statistics
 */
function printStructureStats(metrics: PerformanceMetrics): void {
  if (!metrics.structureStats) return;

  console.error(`\nData structure size:`);
  const stats = metrics.structureStats;

  if (stats.nfaNodes !== undefined) {
    console.error(
      `  - NFA:              ${stats.nfaNodes} nodes, ${stats.nfaSize?.toFixed(2)} KB`
    );
  }

  if (stats.dfaNodes !== undefined) {
    console.error(
      `  - DFA:              ${stats.dfaNodes} nodes, ${stats.dfaSize?.toFixed(2)} KB`
    );
  }

  if (stats.minDfaNodes !== undefined) {
    console.error(
      `  - min-DFA:          ${stats.minDfaNodes} nodes, ${stats.minDfaSize?.toFixed(2)} KB`
    );
  }

  if (stats.acNodes !== undefined) {
    console.error(
      `  - Aho-Corasick:     ${stats.acNodes} nodes, ${stats.acSize?.toFixed(2)} KB`
    );
  }
}
