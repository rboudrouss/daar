/**
 * Comprehensive test suite for all algorithms
 * Tests KMP, Boyer-Moore, Aho-Corasick, NFA, DFA, min-DFA
 * with and without prefiltering across various scenarios
 */

import {
  parseRegex,
  nfaFromSyntaxTree,
  dfaFromNfa,
  minimizeDfa,
  findAllMatchesNfa,
  findAllMatchesDfa,
  findAllMatchesLiteralKmp,
  findAllMatchesLiteralBm,
  AhoCorasick,
  createGrepMatcher,
  extractLiterals,
  type Match,
} from "@monorepo/lib";
import * as fs from "fs";
import { MemoryTracker, getSafeMemoryUsage, formatBytes } from "./memory-utils";

interface TestScenario {
  name: string;
  pattern: string;
  text: string;
  description: string;
}

interface AlgorithmResult {
  algorithm: string;
  matches: Match[];
  buildTime: number;
  matchTime: number;
  totalTime: number;
  memoryUsed: number;
}

interface TestResult {
  scenario: string;
  results: AlgorithmResult[];
  summary: string;
}

/**
 * Test scenarios covering different pattern and text complexities
 */
const TEST_SCENARIOS: TestScenario[] = [
  // Simple literal patterns - short
  {
    name: "Short Literal - Small Text",
    pattern: "abc",
    text: "abc def abc ghi abc",
    description: "Short literal pattern in small text",
  },
  {
    name: "Short Literal - Large Text",
    pattern: "the",
    text: "", // Will be filled with large text
    description: "Short literal pattern in large text (best for KMP)",
  },
  
  // Long literal patterns
  {
    name: "Long Literal - Small Text",
    pattern: "abcdefghijklmnop",
    text: "xyz abcdefghijklmnop xyz abcdefghijklmnop end",
    description: "Long literal pattern in small text (best for Boyer-Moore)",
  },
  {
    name: "Long Literal - Large Text",
    pattern: "constitution",
    text: "", // Will be filled with large text
    description: "Long literal pattern in large text (best for Boyer-Moore)",
  },
  
  // Simple regex patterns
  {
    name: "Simple Regex - Dot",
    pattern: "a.c",
    text: "abc adc aec axc ayc azc",
    description: "Simple regex with dot wildcard",
  },
  {
    name: "Simple Regex - Star",
    pattern: "ab*c",
    text: "ac abc abbc abbbc abbbbc",
    description: "Simple regex with star quantifier",
  },
  
  // Complex regex patterns
  {
    name: "Complex Regex - Alternation",
    pattern: "(cat|dog|bird)",
    text: "I have a cat and a dog but no bird here",
    description: "Regex with alternation (good for Aho-Corasick prefilter)",
  },
  {
    name: "Complex Regex - Multiple Operators",
    pattern: "(a|b).*c",
    text: "abc bdc axxxc byyyyc",
    description: "Complex regex with alternation and star",
  },
  {
    name: "Very Complex Regex",
    pattern: "(a|b)*c(d|e)*",
    text: "acd bce abcde aabccddee",
    description: "Complex regex with multiple operators (NFA might be better)",
  },
  
  // Edge cases
  {
    name: "Empty Matches",
    pattern: "xyz",
    text: "abc def ghi jkl mno pqr",
    description: "Pattern that doesn't match",
  },
  {
    name: "Many Matches",
    pattern: "a",
    text: "a".repeat(100) + "b" + "a".repeat(100),
    description: "Pattern with many matches",
  },
];

/**
 * Generate large text for testing
 */
function generateLargeText(size: number): string {
  const words = ["the", "quick", "brown", "fox", "jumps", "over", "lazy", "dog", "constitution", "freedom"];
  const result: string[] = [];
  let currentSize = 0;
  
  while (currentSize < size) {
    const word = words[Math.floor(Math.random() * words.length)];
    result.push(word);
    currentSize += word.length + 1; // +1 for space
  }
  
  return result.join(" ");
}

/**
 * Test a literal pattern with KMP
 */
function testKMP(pattern: string, text: string): AlgorithmResult {
  const startMemory = process.memoryUsage().heapUsed;
  const startBuild = performance.now();
  // KMP has minimal build time (just the pattern preprocessing)
  const buildTime = performance.now() - startBuild;
  
  const startMatch = performance.now();
  const matches = findAllMatchesLiteralKmp(pattern, text);
  const matchTime = performance.now() - startMatch;
  
  const endMemory = process.memoryUsage().heapUsed;
  
  return {
    algorithm: "KMP",
    matches,
    buildTime,
    matchTime,
    totalTime: buildTime + matchTime,
    memoryUsed: endMemory - startMemory,
  };
}

/**
 * Test a literal pattern with Boyer-Moore
 */
function testBoyerMoore(pattern: string, text: string): AlgorithmResult {
  const memTracker = new MemoryTracker(true);

  const startBuild = performance.now();
  // BM has minimal build time (bad character table)
  const buildTime = performance.now() - startBuild;
  memTracker.update();

  const startMatch = performance.now();
  const matches = findAllMatchesLiteralBm(pattern, text);
  const matchTime = performance.now() - startMatch;
  memTracker.update();

  const memMeasurement = memTracker.getMeasurement();

  return {
    algorithm: "Boyer-Moore",
    matches,
    buildTime,
    matchTime,
    totalTime: buildTime + matchTime,
    memoryUsed: getSafeMemoryUsage(memMeasurement),
  };
}

/**
 * Test with NFA
 */
function testNFA(pattern: string, text: string): AlgorithmResult {
  const startMemory = process.memoryUsage().heapUsed;
  
  const startBuild = performance.now();
  const syntaxTree = parseRegex(pattern);
  const nfa = nfaFromSyntaxTree(syntaxTree);
  const buildTime = performance.now() - startBuild;
  
  const startMatch = performance.now();
  const matches = findAllMatchesNfa(nfa, text);
  const matchTime = performance.now() - startMatch;
  
  const endMemory = process.memoryUsage().heapUsed;
  
  return {
    algorithm: "NFA",
    matches,
    buildTime,
    matchTime,
    totalTime: buildTime + matchTime,
    memoryUsed: endMemory - startMemory,
  };
}

/**
 * Test with DFA
 */
function testDFA(pattern: string, text: string): AlgorithmResult {
  const memTracker = new MemoryTracker(true);

  try {
    const startBuild = performance.now();
    const syntaxTree = parseRegex(pattern);
    const nfa = nfaFromSyntaxTree(syntaxTree);
    const dfa = dfaFromNfa(nfa);
    const buildTime = performance.now() - startBuild;
    memTracker.update();

    const startMatch = performance.now();
    const matches = findAllMatchesDfa(dfa, text);
    const matchTime = performance.now() - startMatch;
    memTracker.update();

    const memMeasurement = memTracker.getMeasurement();

    return {
      algorithm: "DFA",
      matches,
      buildTime,
      matchTime,
      totalTime: buildTime + matchTime,
      memoryUsed: getSafeMemoryUsage(memMeasurement),
    };
  } catch (error) {
    throw new Error(`DFA construction failed: ${error}`);
  }
}

/**
 * Test with minimized DFA
 */
function testMinDFA(pattern: string, text: string): AlgorithmResult {
  const memTracker = new MemoryTracker(true);

  const startBuild = performance.now();
  const syntaxTree = parseRegex(pattern);
  const nfa = nfaFromSyntaxTree(syntaxTree);
  const dfa = dfaFromNfa(nfa);
  const minDfa = minimizeDfa(dfa);
  const buildTime = performance.now() - startBuild;
  memTracker.update();

  const startMatch = performance.now();
  const matches = findAllMatchesDfa(minDfa, text);
  const matchTime = performance.now() - startMatch;
  memTracker.update();

  const memMeasurement = memTracker.getMeasurement();

  return {
    algorithm: "min-DFA",
    matches,
    buildTime,
    matchTime,
    totalTime: buildTime + matchTime,
    memoryUsed: getSafeMemoryUsage(memMeasurement),
  };
}

/**
 * Test Aho-Corasick for multi-pattern matching
 */
function testAhoCorasick(patterns: string[], text: string): AlgorithmResult {
  const startMemory = process.memoryUsage().heapUsed;

  const startBuild = performance.now();
  const ac = new AhoCorasick(patterns);
  const buildTime = performance.now() - startBuild;

  const startMatch = performance.now();
  const results = ac.search(text);
  const matchTime = performance.now() - startMatch;

  const endMemory = process.memoryUsage().heapUsed;

  // Convert AC results to Match format
  const matches: Match[] = results.map(r => ({
    start: r.position,
    end: r.position + r.pattern.length,
    text: r.pattern,
  }));

  return {
    algorithm: "Aho-Corasick",
    matches,
    buildTime,
    matchTime,
    totalTime: buildTime + matchTime,
    memoryUsed: endMemory - startMemory,
  };
}

/**
 * Test NFA with prefiltering
 */
function testNFAWithPrefilter(pattern: string, text: string): AlgorithmResult {
  const memTracker = new MemoryTracker(true);

  const startBuild = performance.now();
  const syntaxTree = parseRegex(pattern);
  const nfa = nfaFromSyntaxTree(syntaxTree);
  const literals = extractLiterals(syntaxTree);
  const buildTime = performance.now() - startBuild;
  memTracker.update();

  const startMatch = performance.now();
  let matches: Match[] = [];

  // Simulate prefiltering
  if (literals.length > 0) {
    const ac = new AhoCorasick(literals);
    if (ac.contains(text)) {
      matches = findAllMatchesNfa(nfa, text);
    }
  } else {
    matches = findAllMatchesNfa(nfa, text);
  }

  const matchTime = performance.now() - startMatch;
  memTracker.update();

  const memMeasurement = memTracker.getMeasurement();

  return {
    algorithm: "NFA (with prefilter)",
    matches,
    buildTime,
    matchTime,
    totalTime: buildTime + matchTime,
    memoryUsed: getSafeMemoryUsage(memMeasurement),
  };
}

/**
 * Test DFA with prefiltering
 */
function testDFAWithPrefilter(pattern: string, text: string): AlgorithmResult {
  const startMemory = process.memoryUsage().heapUsed;

  const startBuild = performance.now();
  const syntaxTree = parseRegex(pattern);
  const nfa = nfaFromSyntaxTree(syntaxTree);
  const dfa = dfaFromNfa(nfa);
  const literals = extractLiterals(syntaxTree);
  const buildTime = performance.now() - startBuild;

  const startMatch = performance.now();
  let matches: Match[] = [];

  // Simulate prefiltering
  if (literals.length > 0) {
    const ac = new AhoCorasick(literals);
    if (ac.contains(text)) {
      matches = findAllMatchesDfa(dfa, text);
    }
  } else {
    matches = findAllMatchesDfa(dfa, text);
  }

  const matchTime = performance.now() - startMatch;
  const endMemory = process.memoryUsage().heapUsed;

  return {
    algorithm: "DFA (with prefilter)",
    matches,
    buildTime,
    matchTime,
    totalTime: buildTime + matchTime,
    memoryUsed: endMemory - startMemory,
  };
}

/**
 * Test min-DFA with prefiltering
 */
function testMinDFAWithPrefilter(pattern: string, text: string): AlgorithmResult {
  const memTracker = new MemoryTracker(true);

  const startBuild = performance.now();
  const syntaxTree = parseRegex(pattern);
  const nfa = nfaFromSyntaxTree(syntaxTree);
  const dfa = dfaFromNfa(nfa);
  const minDfa = minimizeDfa(dfa);
  const literals = extractLiterals(syntaxTree);
  const buildTime = performance.now() - startBuild;
  memTracker.update();

  const startMatch = performance.now();
  let matches: Match[] = [];

  // Simulate prefiltering
  if (literals.length > 0) {
    const ac = new AhoCorasick(literals);
    if (ac.contains(text)) {
      matches = findAllMatchesDfa(minDfa, text);
    }
  } else {
    matches = findAllMatchesDfa(minDfa, text);
  }

  const matchTime = performance.now() - startMatch;
  memTracker.update();

  const memMeasurement = memTracker.getMeasurement();

  return {
    algorithm: "min-DFA (with prefilter)",
    matches,
    buildTime,
    matchTime,
    totalTime: buildTime + matchTime,
    memoryUsed: getSafeMemoryUsage(memMeasurement),
  };
}

/**
 * Determine if a pattern is a simple literal
 */
function isLiteralPattern(pattern: string): boolean {
  // Check if pattern contains regex special characters
  const specialChars = /[.*|()]/;
  return !specialChars.test(pattern);
}

/**
 * Extract literal alternatives from alternation pattern
 */
function extractAlternatives(pattern: string): string[] | null {
  // Simple extraction for patterns like (cat|dog|bird)
  const match = pattern.match(/^\(([^()]+)\)$/);
  if (match) {
    const alternatives = match[1].split("|");
    // Check if all alternatives are literals
    if (alternatives.every(alt => isLiteralPattern(alt))) {
      return alternatives;
    }
  }
  return null;
}

/**
 * Run a single test scenario
 */
function runTestScenario(
  scenario: TestScenario,
  options: { onlyAutomata?: boolean; onlyLiteral?: boolean } = {}
): TestResult {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`Testing: ${scenario.name}`);
  console.log(`Pattern: ${scenario.pattern}`);
  console.log(`Description: ${scenario.description}`);
  console.log(`Text length: ${scenario.text.length} characters`);
  console.log("=".repeat(80));

  const results: AlgorithmResult[] = [];

  try {
    // Test literal algorithms if pattern is literal (and not excluded)
    if (isLiteralPattern(scenario.pattern) && !options.onlyAutomata) {
      console.log("\nTesting literal algorithms...");

      try {
        const kmpResult = testKMP(scenario.pattern, scenario.text);
        results.push(kmpResult);
        console.log(`  ✓ KMP:`);
        console.log(`      Matches: ${kmpResult.matches.length}`);
        console.log(`      Time: ${kmpResult.totalTime.toFixed(3)}ms (build: ${kmpResult.buildTime.toFixed(3)}ms, match: ${kmpResult.matchTime.toFixed(3)}ms)`);
        console.log(`      Memory: ${(kmpResult.memoryUsed / 1024).toFixed(2)} KB`);
      } catch (e) {
        console.log(`  ✗ KMP failed: ${e}`);
      }

      try {
        const bmResult = testBoyerMoore(scenario.pattern, scenario.text);
        results.push(bmResult);
        console.log(`  ✓ Boyer-Moore:`);
        console.log(`      Matches: ${bmResult.matches.length}`);
        console.log(`      Time: ${bmResult.totalTime.toFixed(3)}ms (build: ${bmResult.buildTime.toFixed(3)}ms, match: ${bmResult.matchTime.toFixed(3)}ms)`);
        console.log(`      Memory: ${(bmResult.memoryUsed / 1024).toFixed(2)} KB`);
      } catch (e) {
        console.log(`  ✗ Boyer-Moore failed: ${e}`);
      }
    }

    // Test Aho-Corasick if pattern has alternations (and not excluded)
    const alternatives = extractAlternatives(scenario.pattern);
    if (alternatives && !options.onlyAutomata) {
      console.log("\nTesting Aho-Corasick (multi-pattern)...");
      try {
        const acResult = testAhoCorasick(alternatives, scenario.text);
        results.push(acResult);
        console.log(`  ✓ Aho-Corasick:`);
        console.log(`      Matches: ${acResult.matches.length}`);
        console.log(`      Time: ${acResult.totalTime.toFixed(3)}ms (build: ${acResult.buildTime.toFixed(3)}ms, match: ${acResult.matchTime.toFixed(3)}ms)`);
        console.log(`      Memory: ${(acResult.memoryUsed / 1024).toFixed(2)} KB`);
      } catch (e) {
        console.log(`  ✗ Aho-Corasick failed: ${e}`);
      }
    }

    // Test automaton-based algorithms WITHOUT prefiltering (if not excluded)
    if (!options.onlyLiteral) {
      console.log("\nTesting automaton algorithms (WITHOUT prefiltering)...");

    try {
      const nfaResult = testNFA(scenario.pattern, scenario.text);
      results.push(nfaResult);
      console.log(`  ✓ NFA:`);
      console.log(`      Matches: ${nfaResult.matches.length}`);
      console.log(`      Time: ${nfaResult.totalTime.toFixed(3)}ms (build: ${nfaResult.buildTime.toFixed(3)}ms, match: ${nfaResult.matchTime.toFixed(3)}ms)`);
      console.log(`      Memory: ${(nfaResult.memoryUsed / 1024).toFixed(2)} KB`);
    } catch (e) {
      console.log(`  ✗ NFA failed: ${e}`);
    }

    try {
      const dfaResult = testDFA(scenario.pattern, scenario.text);
      results.push(dfaResult);
      console.log(`  ✓ DFA:`);
      console.log(`      Matches: ${dfaResult.matches.length}`);
      console.log(`      Time: ${dfaResult.totalTime.toFixed(3)}ms (build: ${dfaResult.buildTime.toFixed(3)}ms, match: ${dfaResult.matchTime.toFixed(3)}ms)`);
      console.log(`      Memory: ${(dfaResult.memoryUsed / 1024).toFixed(2)} KB`);
    } catch (e) {
      console.log(`  ✗ DFA failed: ${e}`);
    }

    try {
      const minDfaResult = testMinDFA(scenario.pattern, scenario.text);
      results.push(minDfaResult);
      console.log(`  ✓ min-DFA:`);
      console.log(`      Matches: ${minDfaResult.matches.length}`);
      console.log(`      Time: ${minDfaResult.totalTime.toFixed(3)}ms (build: ${minDfaResult.buildTime.toFixed(3)}ms, match: ${minDfaResult.matchTime.toFixed(3)}ms)`);
      console.log(`      Memory: ${(minDfaResult.memoryUsed / 1024).toFixed(2)} KB`);
    } catch (e) {
      console.log(`  ✗ min-DFA failed: ${e}`);
    }

      // Test automaton-based algorithms WITH prefiltering (if applicable)
      if (!isLiteralPattern(scenario.pattern)) {
        console.log("\nTesting automaton algorithms (WITH prefiltering)...");

        try {
          const nfaPrefilterResult = testNFAWithPrefilter(scenario.pattern, scenario.text);
          results.push(nfaPrefilterResult);
          console.log(`  ✓ NFA (prefiltered):`);
          console.log(`      Matches: ${nfaPrefilterResult.matches.length}`);
          console.log(`      Time: ${nfaPrefilterResult.totalTime.toFixed(3)}ms (build: ${nfaPrefilterResult.buildTime.toFixed(3)}ms, match: ${nfaPrefilterResult.matchTime.toFixed(3)}ms)`);
          console.log(`      Memory: ${(nfaPrefilterResult.memoryUsed / 1024).toFixed(2)} KB`);
        } catch (e) {
          console.log(`  ✗ NFA (prefiltered) failed: ${e}`);
        }

        try {
          const dfaPrefilterResult = testDFAWithPrefilter(scenario.pattern, scenario.text);
          results.push(dfaPrefilterResult);
          console.log(`  ✓ DFA (prefiltered):`);
          console.log(`      Matches: ${dfaPrefilterResult.matches.length}`);
          console.log(`      Time: ${dfaPrefilterResult.totalTime.toFixed(3)}ms (build: ${dfaPrefilterResult.buildTime.toFixed(3)}ms, match: ${dfaPrefilterResult.matchTime.toFixed(3)}ms)`);
          console.log(`      Memory: ${(dfaPrefilterResult.memoryUsed / 1024).toFixed(2)} KB`);
        } catch (e) {
          console.log(`  ✗ DFA (prefiltered) failed: ${e}`);
        }

        try {
          const minDfaPrefilterResult = testMinDFAWithPrefilter(scenario.pattern, scenario.text);
          results.push(minDfaPrefilterResult);
          console.log(`  ✓ min-DFA (prefiltered):`);
          console.log(`      Matches: ${minDfaPrefilterResult.matches.length}`);
          console.log(`      Time: ${minDfaPrefilterResult.totalTime.toFixed(3)}ms (build: ${minDfaPrefilterResult.buildTime.toFixed(3)}ms, match: ${minDfaPrefilterResult.matchTime.toFixed(3)}ms)`);
          console.log(`      Memory: ${(minDfaPrefilterResult.memoryUsed / 1024).toFixed(2)} KB`);
        } catch (e) {
          console.log(`  ✗ min-DFA (prefiltered) failed: ${e}`);
        }
      }
    } // Close the !options.onlyLiteral if block

  } catch (error) {
    console.error(`\n❌ Error in scenario: ${error}`);
  }

  // Generate summary
  const summary = generateSummary(results);
  console.log(summary);

  return {
    scenario: scenario.name,
    results,
    summary,
  };
}

/**
 * Generate a summary comparing all algorithms
 */
function generateSummary(results: AlgorithmResult[]): string {
  if (results.length === 0) {
    return "\nNo results to compare";
  }

  // Verify all algorithms found the same number of matches
  const matchCounts = results.map(r => r.matches.length);
  const allSame = matchCounts.every(count => count === matchCounts[0]);

  let summary = "\n" + "─".repeat(80) + "\n";
  summary += "SUMMARY\n";
  summary += "─".repeat(80) + "\n";

  if (!allSame) {
    summary += "WARNING: Algorithms found different numbers of matches!\n";
    results.forEach(r => {
      summary += `  ${r.algorithm}: ${r.matches.length} matches\n`;
    });
  } else {
    summary += `All algorithms found ${matchCounts[0]} matches\n`;
  }

  // Find fastest algorithm
  const fastest = results.reduce((min, r) => r.totalTime < min.totalTime ? r : min);
  const slowest = results.reduce((max, r) => r.totalTime > max.totalTime ? r : max);

  summary += `\nFastest: ${fastest.algorithm} (${fastest.totalTime.toFixed(3)}ms)\n`;
  summary += `Slowest: ${slowest.algorithm} (${slowest.totalTime.toFixed(3)}ms)\n`;
  summary += `Speedup: ${(slowest.totalTime / fastest.totalTime).toFixed(2)}x\n`;

  // Memory comparison
  const leastMemory = results.reduce((min, r) => r.memoryUsed < min.memoryUsed ? r : min);
  const mostMemory = results.reduce((max, r) => r.memoryUsed > max.memoryUsed ? r : max);

  summary += `\nLeast memory: ${leastMemory.algorithm} (${(leastMemory.memoryUsed / 1024).toFixed(2)} KB)\n`;
  summary += `Most memory: ${mostMemory.algorithm} (${(mostMemory.memoryUsed / 1024).toFixed(2)} KB)\n`;

  // Detailed comparison table
  summary += "\n" + "─".repeat(80) + "\n";
  summary += "Algorithm".padEnd(20) + "Total Time".padEnd(15) + "Build Time".padEnd(15) + "Match Time".padEnd(15) + "Memory\n";
  summary += "─".repeat(80) + "\n";

  results.forEach(r => {
    summary += r.algorithm.padEnd(20);
    summary += `${r.totalTime.toFixed(3)}ms`.padEnd(15);
    summary += `${r.buildTime.toFixed(3)}ms`.padEnd(15);
    summary += `${r.matchTime.toFixed(3)}ms`.padEnd(15);
    summary += `${(r.memoryUsed / 1024).toFixed(2)} KB\n`;
  });

  summary += "─".repeat(80) + "\n";

  return summary;
}

/**
 * Main test runner
 */
export function runAllTests(options: {
  verbose?: boolean;
  dataFile?: string;
  dataFolder?: string;
  onlyAutomata?: boolean;
  onlyLiteral?: boolean;
} = {}) {
  // Determine which algorithms to test
  let algorithmsToTest = "KMP, Boyer-Moore, Aho-Corasick, NFA, DFA, min-DFA";
  if (options.onlyAutomata) {
    algorithmsToTest = "NFA, DFA, min-DFA (automata only)";
  } else if (options.onlyLiteral) {
    algorithmsToTest = "KMP, Boyer-Moore, Aho-Corasick (literal search only)";
  }

  console.log(`\nTesting algorithms: ${algorithmsToTest}`);
  console.log("Scenarios: Simple patterns, complex regex, small/large texts\n");

  // Prepare test scenarios
  const scenarios = [...TEST_SCENARIOS];

  // Fill in large text scenarios
  const largeText = generateLargeText(100000); // 100KB of text
  scenarios.forEach(scenario => {
    if (scenario.text === "") {
      scenario.text = largeText;
    }
  });

  // If a data file is provided, add a scenario for it
  if (options.dataFile && fs.existsSync(options.dataFile)) {
    const fileContent = fs.readFileSync(options.dataFile, "utf-8");
    scenarios.push({
      name: "Real File Test",
      pattern: "the",
      text: fileContent,
      description: `Testing on real file: ${options.dataFile}`,
    });
  }

  // If a data folder is provided, add scenarios for all files in it
  if (options.dataFolder && fs.existsSync(options.dataFolder)) {
    const files = fs.readdirSync(options.dataFolder).filter(f => f.endsWith('.txt'));
    console.log(`\nFound ${files.length} text files in ${options.dataFolder}`);

    files.forEach(file => {
      const filePath = `${options.dataFolder}/${file}`;
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const fileSizeKB = (fileContent.length / 1024).toFixed(2);

      scenarios.push({
        name: `File: ${file}`,
        pattern: "the",
        text: fileContent,
        description: `Testing on ${file} (${fileSizeKB} KB)`,
      });
    });
  }

  // Run all scenarios
  const allResults: TestResult[] = [];

  for (const scenario of scenarios) {
    const result = runTestScenario(scenario, {
      onlyAutomata: options.onlyAutomata,
      onlyLiteral: options.onlyLiteral,
    });
    allResults.push(result);
  }
}

