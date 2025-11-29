/**
 * Test output formatting utilities
 */

import type { AlgorithmResult } from "./test-execution";

/**
 * Format a result line for an algorithm
 */
export function formatAlgorithmResult(
  name: string,
  result: AlgorithmResult
): string {
  const matchStr = `${result.matches.length} matches`.padEnd(15);
  const totalTime = `${result.totalTime.toFixed(3)}ms`.padEnd(12);
  const buildTime = `build: ${result.buildTime.toFixed(3)}ms`.padEnd(20);
  const matchTime = `match: ${result.matchTime.toFixed(3)}ms`.padEnd(20);
  const memory = `${(result.memoryUsed / 1024).toFixed(2)} KB`.padEnd(12);

  let structureInfo = "-".padEnd(25);
  if (result.structureSize) {
    const nodes = result.structureSize.nodes
      ? `${result.structureSize.nodes} nodes`
      : "";
    const kb = result.structureSize.kb
      ? `${result.structureSize.kb.toFixed(2)} KB`
      : "";
    structureInfo = (nodes && kb ? `${nodes}, ${kb}` : nodes || kb).padEnd(25);
  }

  return `  ${name.padEnd(30)} | ${matchStr} | ${totalTime} | ${buildTime} | ${matchTime} | ${memory} | ${structureInfo}`;
}

/**
 * Print table header for algorithm results
 */
export function printTableHeader(): void {
  console.log("-".repeat(130));
  console.log(
    `  ${"Algorithm".padEnd(30)} | ${"Matches".padEnd(15)} | ${"Total Time".padEnd(12)} | ${"Build Time".padEnd(20)} | ${"Match Time".padEnd(20)} | ${"Memory".padEnd(12)} | Structure Size`
  );
  console.log("-".repeat(130));
}

/**
 * Print section header
 */
export function printSectionHeader(title: string): void {
  console.log(title);
  printTableHeader();
}

/**
 * Print scenario header
 */
export function printScenarioHeader(
  name: string,
  pattern: string,
  description: string,
  textLength: number
): void {
  console.log(`\n${"=".repeat(100)}`);
  console.log(`TEST: ${name}`);
  console.log(`${"=".repeat(100)}`);
  console.log(`Pattern:     ${pattern}`);
  console.log(`Description: ${description}`);
  console.log(
    `Text size:   ${textLength.toLocaleString()} characters (${(textLength / 1024).toFixed(2)} KB)`
  );
  console.log(`${"=".repeat(100)}\n`);
}

/**
 * Print test suite header
 */
export function printTestSuiteHeader(
  algorithmsToTest: string,
  scenarioCount: number
): void {
  console.log("\n" + "=".repeat(100));
  console.log("COMPREHENSIVE ALGORITHM TEST SUITE");
  console.log("=".repeat(100));
  console.log(`Algorithms: ${algorithmsToTest}`);
  console.log(`Scenarios:  Simple patterns, complex regex, small/large texts`);
  console.log("=".repeat(100));
  console.log(`\nTotal scenarios to test: ${scenarioCount}\n`);
}

/**
 * Print test suite footer
 */
export function printTestSuiteFooter(
  resultCount: number,
  gcAvailable: boolean
): void {
  console.log("\n" + "=".repeat(100));
  console.log("ALL TESTS COMPLETED");
  console.log("=".repeat(100));
  console.log(`Total scenarios tested: ${resultCount}`);
  console.log("=".repeat(100));

  // Print memory measurement disclaimer
  console.log("\n" + "<!>  MEMORY MEASUREMENT DISCLAIMER".padStart(60));
  console.log("-".repeat(100));
  console.log(
    "Memory measurements shown above are NOT reliable and are provided only to give a rough idea."
  );
  console.log("They are affected by:");
  console.log("  • Garbage collection timing (unpredictable)");
  console.log("  • Shared heap memory (includes temporary objects)");
  console.log("  • V8 engine internals (hidden classes, inline caches, etc.)");
  console.log("  • Measurement overhead");
  console.log(
    "\nFor reliable size estimates, refer to the 'Structure Size' column instead."
  );
  console.log(
    "Structure Size is calculated from the data structure itself and is consistent."
  );

  // Print GC warning if not available
  if (!gcAvailable) {
    console.log(
      "\n" +
        "<!>  WARNING: --expose-gc NOT ENABLED. Memory measurements are even less reliable without manual garbage collection."
    );
  }

  console.log("=".repeat(100) + "\n");
}
