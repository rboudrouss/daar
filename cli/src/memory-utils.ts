/**
 * Utilities for precise memory measurement in Node.js
 * Handles garbage collection and provides accurate memory tracking
 */

/**
 * Memory snapshot with detailed breakdown
 */
export interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  timestamp: number;
}

/**
 * Memory measurement result
 */
export interface MemoryMeasurement {
  /** Memory allocated during the operation (can be negative if GC ran) */
  delta: number;
  /** Peak memory usage during the operation */
  peak: number;
  /** Starting memory */
  start: number;
  /** Ending memory */
  end: number;
  /** Whether garbage collection was forced */
  gcForced: boolean;
}

/**
 * Check if manual GC is available (requires --expose-gc flag)
 */
export function isGCAvailable(): boolean {
  return typeof global.gc === 'function';
}

/**
 * Force garbage collection if available
 * Returns true if GC was run, false otherwise
 */
export function forceGC(): boolean {
  if (isGCAvailable()) {
    global.gc!();
    return true;
  }
  return false;
}

/**
 * Take a memory snapshot
 */
export function takeSnapshot(): MemorySnapshot {
  const mem = process.memoryUsage();
  return {
    heapUsed: mem.heapUsed,
    heapTotal: mem.heapTotal,
    external: mem.external,
    arrayBuffers: mem.arrayBuffers,
    timestamp: Date.now(),
  };
}

/**
 * Wait for memory to stabilize after GC
 * This helps ensure more consistent measurements
 */
async function waitForMemoryStabilization(maxWaitMs: number = 100): Promise<void> {
  const startTime = Date.now();
  let lastHeapUsed = process.memoryUsage().heapUsed;
  let stableCount = 0;
  const requiredStableReadings = 3;
  
  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(resolve => setImmediate(resolve));
    const currentHeapUsed = process.memoryUsage().heapUsed;
    
    // Check if memory is stable (within 1% variation)
    const variation = Math.abs(currentHeapUsed - lastHeapUsed) / lastHeapUsed;
    if (variation < 0.01) {
      stableCount++;
      if (stableCount >= requiredStableReadings) {
        break;
      }
    } else {
      stableCount = 0;
    }
    
    lastHeapUsed = currentHeapUsed;
  }
}

/**
 * Prepare for memory measurement by optionally forcing GC
 * @param forceGCIfAvailable - Whether to force GC if available
 * @param waitForStabilization - Whether to wait for memory to stabilize
 */
export async function prepareForMeasurement(
  forceGCIfAvailable: boolean = true,
  waitForStabilization: boolean = false
): Promise<boolean> {
  let gcRan = false;
  
  if (forceGCIfAvailable) {
    gcRan = forceGC();
    if (gcRan && waitForStabilization) {
      await waitForMemoryStabilization();
    }
  }
  
  return gcRan;
}

/**
 * Measure memory usage of a synchronous operation
 * @param operation - The operation to measure
 * @param forceGCBefore - Whether to force GC before measurement
 * @returns Memory measurement and operation result
 */
export function measureMemorySync<T>(
  operation: () => T,
  forceGCBefore: boolean = true
): { result: T; memory: MemoryMeasurement } {
  // Optionally force GC before measurement
  const gcForced = forceGCBefore ? forceGC() : false;
  
  // Take initial snapshot
  const startMemory = process.memoryUsage().heapUsed;
  let peakMemory = startMemory;
  
  // Run the operation
  const result = operation();
  
  // Track peak memory
  peakMemory = Math.max(peakMemory, process.memoryUsage().heapUsed);
  
  // Take final snapshot
  const endMemory = process.memoryUsage().heapUsed;
  
  return {
    result,
    memory: {
      delta: endMemory - startMemory,
      peak: peakMemory - startMemory,
      start: startMemory,
      end: endMemory,
      gcForced,
    },
  };
}

/**
 * Measure memory usage of an async operation
 * @param operation - The async operation to measure
 * @param forceGCBefore - Whether to force GC before measurement
 * @returns Memory measurement and operation result
 */
export async function measureMemoryAsync<T>(
  operation: () => Promise<T>,
  forceGCBefore: boolean = true
): Promise<{ result: T; memory: MemoryMeasurement }> {
  // Optionally force GC before measurement
  const gcForced = forceGCBefore ? await prepareForMeasurement(forceGCBefore, true) : false;
  
  // Take initial snapshot
  const startMemory = process.memoryUsage().heapUsed;
  let peakMemory = startMemory;
  
  // Run the operation
  const result = await operation();
  
  // Track peak memory
  peakMemory = Math.max(peakMemory, process.memoryUsage().heapUsed);
  
  // Take final snapshot
  const endMemory = process.memoryUsage().heapUsed;
  
  return {
    result,
    memory: {
      delta: endMemory - startMemory,
      peak: peakMemory - startMemory,
      start: startMemory,
      end: endMemory,
      gcForced,
    },
  };
}

/**
 * Create a memory tracker that can track peak memory across multiple operations
 */
export class MemoryTracker {
  private startMemory: number;
  private peakMemory: number;
  private gcForced: boolean;
  
  constructor(forceGCOnStart: boolean = true) {
    this.gcForced = forceGCOnStart ? forceGC() : false;
    this.startMemory = process.memoryUsage().heapUsed;
    this.peakMemory = this.startMemory;
  }
  
  /**
   * Update peak memory tracking
   */
  update(): void {
    this.peakMemory = Math.max(this.peakMemory, process.memoryUsage().heapUsed);
  }
  
  /**
   * Get current memory measurement
   */
  getMeasurement(): MemoryMeasurement {
    const currentMemory = process.memoryUsage().heapUsed;
    this.peakMemory = Math.max(this.peakMemory, currentMemory);
    
    return {
      delta: currentMemory - this.startMemory,
      peak: this.peakMemory - this.startMemory,
      start: this.startMemory,
      end: currentMemory,
      gcForced: this.gcForced,
    };
  }
  
  /**
   * Reset the tracker with a new baseline
   */
  reset(forceGCOnReset: boolean = false): void {
    if (forceGCOnReset) {
      this.gcForced = forceGC();
    }
    this.startMemory = process.memoryUsage().heapUsed;
    this.peakMemory = this.startMemory;
  }
}

/**
 * Format bytes to human-readable string
 * Handles negative values gracefully
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const absBytes = Math.abs(bytes);
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(absBytes) / Math.log(k));
  const value = Math.round((absBytes / Math.pow(k, i)) * 100) / 100;
  const sign = bytes < 0 ? '-' : '';
  
  return sign + value + ' ' + sizes[i];
}

/**
 * Get a safe memory delta that's never negative
 * Use peak memory if delta is negative (GC ran during measurement)
 */
export function getSafeMemoryUsage(measurement: MemoryMeasurement): number {
  // If delta is negative, it means GC ran during measurement
  // In this case, use peak memory as a better estimate
  return measurement.delta < 0 ? measurement.peak : measurement.delta;
}

/**
 * Print memory measurement with helpful context
 */
export function printMemoryMeasurement(
  measurement: MemoryMeasurement,
  label: string = "Memory"
): void {
  console.error(`${label}:`);
  console.error(`  Delta:     ${formatBytes(measurement.delta)}${measurement.delta < 0 ? ' (GC ran)' : ''}`);
  console.error(`  Peak:      ${formatBytes(measurement.peak)}`);
  console.error(`  Safe est.: ${formatBytes(getSafeMemoryUsage(measurement))}`);
  
  if (!measurement.gcForced && measurement.delta < 0) {
    console.error(`  Note: Run with --expose-gc for more accurate measurements`);
  }
}

