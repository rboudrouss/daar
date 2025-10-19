import { Command } from "commander";
import * as fs from "fs";
import {
  parseRegex,
  createGrepMatcher,
  colorizeMatches,
  analyzePattern,
  getAlgorithmDescription,
  type AlgorithmType,
  PrefilterAlgorithm,
} from "@monorepo/lib";
import { MemoryTracker, getSafeMemoryUsage } from "./utils/memory-utils";
import {
  type OptimizationLevel,
  isValidOptimizationLevel,
  getOptimizationLevelError,
} from "./utils/validation";
import { printPerformanceMetrics } from "./utils/performance-metrics";
import { createMatcher } from "./utils/matcher-factory";
import { runAllTests } from "./test-all";

/**
 * Format output line with optional colorization
 */
function formatOutputLine(
  line: string,
  matches: Array<{ start: number; end: number; text: string }>,
  colorEnabled: boolean
): string {
  if (colorEnabled && matches.length > 0) {
    return colorizeMatches(line, matches);
  }
  return line;
}

/**
 * Print a matched line with optional line number
 */
function printMatchedLine(
  line: string,
  lineNumber: number,
  showLineNumber: boolean
): void {
  if (showLineNumber) {
    console.log(`${lineNumber} ${line}`);
  } else {
    console.log(line);
  }
}

function main() {
  const program = new Command();

  program
    .name("egrep-clone")
    .description("Search for pattern in files using regular expressions")
    .argument("[pattern]", "Regular expression pattern to search for")
    .argument("[file]", "File to search in")
    .option("-i, --ignore-case", "Ignore case distinctions", false)
    .option("-n, --line-number", "Prefix each line with its line number", false)
    .option("-v, --invert-match", "Select non-matching lines", false)
    .option(
      "-p, --perf",
      "Display performance metrics (time and memory)",
      false
    )
    .option("--color", "Highlight matching text with color", true)
    .option(
      "-O, --optimize <level>",
      "Optimization level: auto (default), literal-kmp, literal-bm, aho-corasick, nfa, nfa-dfa-cache, dfa, or min-dfa",
      "auto"
    )
    .option(
      "--prefilter <algorithm>",
      "Prefilter algorithm: auto (default), boyer-moore, kmp, aho-corasick, or off",
      "auto"
    )
    .option(
      "--test-all",
      "Run comprehensive tests on all algorithms with various scenarios"
    )
    .option(
      "--test-only-automata",
      "Only test automaton-based algorithms (NFA, DFA, min-DFA) (with --test-all)"
    )
    .option(
      "--test-only-literal",
      "Only test literal search algorithms (KMP, Boyer-Moore, Aho-Corasick) (with --test-all)"
    )
    .option(
      "--test-file <file>",
      "Optional: Use a specific file for testing (with --test-all)"
    )
    .option(
      "--test-folder <folder>",
      "Optional: Test on all files in a folder (with --test-all)"
    )
    .option(
      "--csv [filename]",
      "Export test results to CSV file (with --test-all). Default: performance-test-<timestamp>.csv"
    )
    .option(
      "--json [filename]",
      "Export test results to JSON file (with --test-all). Default: performance-test-<timestamp>.json"
    )
    .version("0.0.1");

  program.parse();

  const options = program.opts();

  // Handle --test-all flag
  if (options.testAll) {
    runAllTests({
      verbose: true,
      dataFile: options.testFile,
      dataFolder: options.testFolder,
      onlyAutomata: options.testOnlyAutomata,
      onlyLiteral: options.testOnlyLiteral,
      csvFile: options.csv,
      jsonFile: options.json,
    });
    process.exit(0);
  }

  const [pattern, filename] = program.args;

  // Validate required arguments when not in test mode
  if (!pattern || !filename) {
    console.error(
      "Error: pattern and file arguments are required (unless using --test-all)"
    );
    program.help();
    process.exit(1);
  }

  const regex = options.ignoreCase ? pattern.toLowerCase() : pattern;
  const optimizationLevel = options.optimize as OptimizationLevel;

  // Validate optimization level
  if (!isValidOptimizationLevel(optimizationLevel)) {
    console.error(getOptimizationLevelError(optimizationLevel));
    process.exit(1);
  }

  try {
    const startTotal = performance.now();
    const memTracker = new MemoryTracker(true);

    // Parse regex
    const startParse = performance.now();
    const syntaxTree = parseRegex(regex);
    const parseTime = performance.now() - startParse;
    memTracker.update();

    // Get file size for intelligent algorithm selection
    let fileSize: number | undefined;
    try {
      const stats = fs.statSync(filename);
      fileSize = stats.size;
    } catch (error) {
      // If we can't get file size, continue without it
      fileSize = undefined;
    }

    // Analyze pattern and choose optimal algorithm
    let selectedAlgorithm: AlgorithmType;
    let algorithmReason: string;

    if (optimizationLevel === "auto") {
      const analysis = analyzePattern(syntaxTree, fileSize);
      selectedAlgorithm = analysis.recommendedAlgorithm;
      algorithmReason = analysis.reason;
    } else {
      // Manual mode: use specified algorithm
      selectedAlgorithm = optimizationLevel as AlgorithmType;
      algorithmReason = `Manually selected: ${optimizationLevel}`;
    }

    // Determine prefilter algorithm
    let prefilterAlgorithm = options.prefilter as PrefilterAlgorithm;

    // Handle deprecated --no-prefilter flag
    if (!options.prefilter) {
      prefilterAlgorithm = "off";
    }

    const grepMatcher = createGrepMatcher(syntaxTree, {
      ignoreCase: options.ignoreCase,
      invertMatch: options.invertMatch,
      chunkSize: 64 * 1024, // 64KB chunks like grep
      prefilterAlgorithm,
      algorithm: selectedAlgorithm,
      fileSize, // Pass file size to disable prefiltering for small files
    });

    // Get prefilter stats
    const prefilterStats = grepMatcher.getPrefilterStats();

    // Create matcher using factory
    const matcherResult = createMatcher({
      syntaxTree,
      algorithm: selectedAlgorithm,
      pattern: regex,
      ignoreCase: options.ignoreCase,
      memTracker,
    });

    const { matcher, nfaTime, dfaTime, minDfaTime, structureStats } =
      matcherResult;

    // Match lines with prefiltering and chunk reading
    const startMatch = performance.now();
    for (const { line, lineNumber, matches } of grepMatcher.searchFile(
      filename,
      matcher
    )) {
      const outputLine = formatOutputLine(line, matches, options.color);
      printMatchedLine(outputLine, lineNumber, options.lineNumber);
      memTracker.update();
    }
    const matchTime = performance.now() - startMatch;

    const totalTime = performance.now() - startTotal;
    const memMeasurement = memTracker.getMeasurement();

    // Display performance metrics if requested
    if (options.perf) {
      printPerformanceMetrics({
        totalTime,
        parseTime,
        nfaTime: nfaTime || 0,
        dfaTime,
        minDfaTime,
        matchTime,
        memoryUsed: getSafeMemoryUsage(memMeasurement),
        peakMemory: memMeasurement.peak,
        prefilterStats,
        algorithmUsed: getAlgorithmDescription(selectedAlgorithm),
        algorithmReason,
        structureStats,
      });
    }
  } catch (error) {
    handleError(error);
    process.exit(1);
  }
}

/**
 * Handle and display errors
 */
function handleError(error: unknown): void {
  if (error instanceof Error) {
    console.error("Error:", error.message);
  } else {
    console.error("An unknown error occurred");
  }
}

main();
