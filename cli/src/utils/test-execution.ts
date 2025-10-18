/**
 * Common test execution utilities
 */

import { MemoryTracker, getSafeMemoryUsage } from "./memory-utils";
import type { Match } from "@monorepo/lib";

export interface AlgorithmResult {
  algorithm: string;
  matches: Match[];
  buildTime: number;
  matchTime: number;
  totalTime: number;
  memoryUsed: number;
  structureSize?: {
    nodes?: number;
    kb?: number;
  };
}

export interface TimedResult<T> {
  result: T;
  buildTime: number;
  matchTime: number;
  memoryUsed: number;
}

/**
 * Execute a test with timing and memory tracking
 * @param buildFn - Function to build the data structure
 * @param matchFn - Function to perform matching
 * @param algorithmName - Name of the algorithm
 * @returns Algorithm result with metrics
 */
export function executeTest<TStructure>(
  buildFn: () => TStructure,
  matchFn: (structure: TStructure) => Match[],
  algorithmName: string,
  getStructureSize?: (structure: TStructure) => { nodes?: number; kb?: number }
): AlgorithmResult {
  // Create a fresh memory tracker with GC
  const buildMemTracker = new MemoryTracker(true);

  // Build phase - measure memory for structure construction only
  const startBuild = performance.now();
  const structure = buildFn();
  const buildTime = performance.now() - startBuild;
  const buildMemMeasurement = buildMemTracker.getMeasurement();

  // Force GC before match phase to get clean measurement
  const matchMemTracker = new MemoryTracker(true);

  // Match phase - measure memory for matching only
  const startMatch = performance.now();
  const matches = matchFn(structure);
  const matchTime = performance.now() - startMatch;
  const matchMemMeasurement = matchMemTracker.getMeasurement();

  // Use build phase memory as the primary metric (structure size)
  // This is more reliable than total memory delta
  const memoryUsed = getSafeMemoryUsage(buildMemMeasurement);

  const result: AlgorithmResult = {
    algorithm: algorithmName,
    matches,
    buildTime,
    matchTime,
    totalTime: buildTime + matchTime,
    memoryUsed,
  };

  if (getStructureSize) {
    result.structureSize = getStructureSize(structure);
  }

  return result;
}

/**
 * Execute a test with minimal build time (for literal algorithms)
 */
export function executeLiteralTest(
  matchFn: () => Match[],
  algorithmName: string
): AlgorithmResult {
  // For literal algorithms, there's no build phase
  // Just measure match phase memory
  const memTracker = new MemoryTracker(true);

  const startBuild = performance.now();
  const buildTime = performance.now() - startBuild;

  const startMatch = performance.now();
  const matches = matchFn();
  const matchTime = performance.now() - startMatch;

  const memMeasurement = memTracker.getMeasurement();

  return {
    algorithm: algorithmName,
    matches,
    buildTime,
    matchTime,
    totalTime: buildTime + matchTime,
    memoryUsed: getSafeMemoryUsage(memMeasurement),
  };
}

/**
 * Safe test execution with error handling
 */
export function safeExecute<T>(
  testFn: () => T,
  errorMessage: string
): T | null {
  try {
    return testFn();
  } catch (error) {
    console.log(`  ${errorMessage}: FAILED - ${error}`);
    return null;
  }
}
