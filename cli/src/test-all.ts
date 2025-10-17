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
  findAllMatchesNfaWithDfaCache,
  findAllMatchesLiteralKmp,
  findAllMatchesLiteralBm,
  AhoCorasick,
  extractLiterals,
  canUsePrefilter,
  type Match,
} from "@monorepo/lib";
import * as fs from "fs";
import { MemoryTracker, getSafeMemoryUsage } from "./memory-utils";

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
    name: "Complex Regex",
    pattern: "(a|b)*c(d|e)*",
    text: "acd bce abcde aabccddee",
    description: "Complex regex with multiple operators (NFA might be better)",
  },
  {
    name: "Very complex Regex",
    pattern: "((t|T)(h|H)(e|E)( )*(m|M)(a|A)(n|N))|((s|S)(h|H)(e|E)( )*(s|S)(a|A)(i|I)(d|D))|((w|W)(a|A)(s|S)( )*(a|A)(l|L)(o|O)(n|N)(e|E))|((t|T)(h|H)(e|E)( )*(e|E)(n|N)(d|D))",
    text: "The man said was alone at the end",
    description: "Very complex regex with multiple operators (NFA might be better)",
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
  {
    name: "Wildcards",
    pattern: ".*",
    text: "abc def ghi jkl mno pqr",
    description: "Pattern with wildcards",
  }
];

/**
 * Generate large text for testing
 */
function generateLargeText(size: number): string {
  const words = [
    "the",
    "quick",
    "brown",
    "fox",
    "jumps",
    "over",
    "lazy",
    "dog",
    "constitution",
    "freedom",
  ];
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
  const memTracker = new MemoryTracker(true);

  const startBuild = performance.now();
  // KMP has minimal build time (just the pattern preprocessing)
  const buildTime = performance.now() - startBuild;
  memTracker.update();

  const startMatch = performance.now();
  const matches = findAllMatchesLiteralKmp(pattern, text);
  const matchTime = performance.now() - startMatch;
  memTracker.update();

  const memMeasurement = memTracker.getMeasurement();

  return {
    algorithm: "KMP",
    matches,
    buildTime,
    matchTime,
    totalTime: buildTime + matchTime,
    memoryUsed: getSafeMemoryUsage(memMeasurement),
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
  const memTracker = new MemoryTracker(true);

  const startBuild = performance.now();
  const syntaxTree = parseRegex(pattern);
  const nfa = nfaFromSyntaxTree(syntaxTree);
  const buildTime = performance.now() - startBuild;
  memTracker.update();

  const startMatch = performance.now();
  const matches = findAllMatchesNfa(nfa, text);
  const matchTime = performance.now() - startMatch;
  memTracker.update();

  const memMeasurement = memTracker.getMeasurement();

  return {
    algorithm: "NFA",
    matches,
    buildTime,
    matchTime,
    totalTime: buildTime + matchTime,
    memoryUsed: getSafeMemoryUsage(memMeasurement),
  };
}

/**
 * Test with NFA + DFA cache (lazy DFA construction)
 */
function testNFAWithDFACache(pattern: string, text: string): AlgorithmResult {
  const memTracker = new MemoryTracker(true);

  const startBuild = performance.now();
  const syntaxTree = parseRegex(pattern);
  const nfa = nfaFromSyntaxTree(syntaxTree);
  const buildTime = performance.now() - startBuild;
  memTracker.update();

  const startMatch = performance.now();
  const matches = findAllMatchesNfaWithDfaCache(nfa, text);
  const matchTime = performance.now() - startMatch;
  memTracker.update();

  const memMeasurement = memTracker.getMeasurement();

  return {
    algorithm: "NFA+DFA-cache",
    matches,
    buildTime,
    matchTime,
    totalTime: buildTime + matchTime,
    memoryUsed: getSafeMemoryUsage(memMeasurement),
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
  const memTracker = new MemoryTracker(true);

  const startBuild = performance.now();
  const ac = new AhoCorasick(patterns);
  const buildTime = performance.now() - startBuild;
  memTracker.update();

  const startMatch = performance.now();
  const results = ac.search(text);
  const matchTime = performance.now() - startMatch;
  memTracker.update();

  const memMeasurement = memTracker.getMeasurement();

  // Convert AC results to Match format
  const matches: Match[] = results.map(
    (r: { pattern: string; position: number }) => ({
      start: r.position,
      end: r.position + r.pattern.length,
      text: r.pattern,
    })
  );

  return {
    algorithm: "Aho-Corasick",
    matches,
    buildTime,
    matchTime,
    totalTime: buildTime + matchTime,
    memoryUsed: getSafeMemoryUsage(memMeasurement),
  };
}

/**
 * Test NFA with prefiltering
 *
 * Note: For in-memory text, we use extractLiterals + AhoCorasick.contains()
 * to quickly check if the text might match before running the full NFA.
 * This is the same approach used by GrepMatcher for file-based searching.
 */
function testNFAWithPrefilter(pattern: string, text: string): AlgorithmResult {
  const memTracker = new MemoryTracker(true);

  const startBuild = performance.now();
  const syntaxTree = parseRegex(pattern);
  const nfa = nfaFromSyntaxTree(syntaxTree);
  const buildTime = performance.now() - startBuild;
  memTracker.update();

  const startMatch = performance.now();
  let matches: Match[] = [];

  // Use prefiltering if beneficial
  if (canUsePrefilter(syntaxTree)) {
    const literals = extractLiterals(syntaxTree);
    const ac = new AhoCorasick(literals);
    // Only run full NFA matching if prefilter finds potential matches
    if (ac.contains(text)) {
      matches = findAllMatchesNfa(nfa, text);
    }
    // If prefilter doesn't find anything, matches stays empty (correct!)
  } else {
    // No useful prefilter, run NFA directly
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
 *
 * Note: For in-memory text, we use extractLiterals + AhoCorasick.contains()
 * to quickly check if the text might match before running the full DFA.
 */
function testDFAWithPrefilter(pattern: string, text: string): AlgorithmResult {
  const memTracker = new MemoryTracker(true);

  const startBuild = performance.now();
  const syntaxTree = parseRegex(pattern);
  const nfa = nfaFromSyntaxTree(syntaxTree);
  const dfa = dfaFromNfa(nfa);
  const buildTime = performance.now() - startBuild;
  memTracker.update();

  const startMatch = performance.now();
  let matches: Match[] = [];

  // Use prefiltering if beneficial
  if (canUsePrefilter(syntaxTree)) {
    const literals = extractLiterals(syntaxTree);
    const ac = new AhoCorasick(literals);
    // Only run full DFA matching if prefilter finds potential matches
    if (ac.contains(text)) {
      matches = findAllMatchesDfa(dfa, text);
    }
  } else {
    // No useful prefilter, run DFA directly
    matches = findAllMatchesDfa(dfa, text);
  }

  const matchTime = performance.now() - startMatch;
  memTracker.update();

  const memMeasurement = memTracker.getMeasurement();

  return {
    algorithm: "DFA (with prefilter)",
    matches,
    buildTime,
    matchTime,
    totalTime: buildTime + matchTime,
    memoryUsed: getSafeMemoryUsage(memMeasurement),
  };
}

/**
 * Test min-DFA with prefiltering
 *
 * Note: For in-memory text, we use extractLiterals + AhoCorasick.contains()
 * to quickly check if the text might match before running the full min-DFA.
 */
function testMinDFAWithPrefilter(
  pattern: string,
  text: string
): AlgorithmResult {
  const memTracker = new MemoryTracker(true);

  const startBuild = performance.now();
  const syntaxTree = parseRegex(pattern);
  const nfa = nfaFromSyntaxTree(syntaxTree);
  const dfa = dfaFromNfa(nfa);
  const minDfa = minimizeDfa(dfa);
  const buildTime = performance.now() - startBuild;
  memTracker.update();

  const startMatch = performance.now();
  let matches: Match[] = [];

  // Use prefiltering if beneficial
  if (canUsePrefilter(syntaxTree)) {
    const literals = extractLiterals(syntaxTree);
    const ac = new AhoCorasick(literals);
    // Only run full min-DFA matching if prefilter finds potential matches
    if (ac.contains(text)) {
      matches = findAllMatchesDfa(minDfa, text);
    }
  } else {
    // No useful prefilter, run min-DFA directly
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
 * Test NFA+DFA-cache with prefiltering
 *
 * Note: For in-memory text, we use extractLiterals + AhoCorasick.contains()
 * to quickly check if the text might match before running the full NFA+DFA-cache.
 */
function testNFAWithDFACacheAndPrefilter(
  pattern: string,
  text: string
): AlgorithmResult {
  const memTracker = new MemoryTracker(true);

  const startBuild = performance.now();
  const syntaxTree = parseRegex(pattern);
  const nfa = nfaFromSyntaxTree(syntaxTree);
  const buildTime = performance.now() - startBuild;
  memTracker.update();

  const startMatch = performance.now();
  let matches: Match[] = [];

  // Use prefiltering if beneficial
  if (canUsePrefilter(syntaxTree)) {
    const literals = extractLiterals(syntaxTree);
    const ac = new AhoCorasick(literals);
    // Only run full NFA+DFA-cache matching if prefilter finds potential matches
    if (ac.contains(text)) {
      matches = findAllMatchesNfaWithDfaCache(nfa, text);
    }
  } else {
    // No useful prefilter, run NFA+DFA-cache directly
    matches = findAllMatchesNfaWithDfaCache(nfa, text);
  }

  const matchTime = performance.now() - startMatch;
  memTracker.update();

  const memMeasurement = memTracker.getMeasurement();

  return {
    algorithm: "NFA+DFA-cache (with prefilter)",
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
    if (alternatives.every((alt) => isLiteralPattern(alt))) {
      return alternatives;
    }
  }
  return null;
}

/**
 * Format a result line for an algorithm
 */
function formatAlgorithmResult(name: string, result: AlgorithmResult): string {
  const matchStr = `${result.matches.length} matches`.padEnd(15);
  const totalTime = `${result.totalTime.toFixed(3)}ms`.padEnd(12);
  const buildTime = `build: ${result.buildTime.toFixed(3)}ms`.padEnd(20);
  const matchTime = `match: ${result.matchTime.toFixed(3)}ms`.padEnd(20);
  const memory = `${(result.memoryUsed / 1024).toFixed(2)} KB`;

  return `  ${name.padEnd(30)} | ${matchStr} | ${totalTime} | ${buildTime} | ${matchTime} | ${memory}`;
}

/**
 * Run a single test scenario
 */
function runTestScenario(
  scenario: TestScenario,
  options: { onlyAutomata?: boolean; onlyLiteral?: boolean } = {}
): TestResult {
  console.log(`\n${"=".repeat(100)}`);
  console.log(`TEST: ${scenario.name}`);
  console.log(`${"=".repeat(100)}`);
  console.log(`Pattern:     ${scenario.pattern}`);
  console.log(`Description: ${scenario.description}`);
  console.log(
    `Text size:   ${scenario.text.length.toLocaleString()} characters (${(scenario.text.length / 1024).toFixed(2)} KB)`
  );
  console.log(`${"=".repeat(100)}\n`);

  const results: AlgorithmResult[] = [];

  try {
    // Test literal algorithms if pattern is literal (and not excluded)
    if (isLiteralPattern(scenario.pattern) && !options.onlyAutomata) {
      console.log("LITERAL ALGORITHMS");
      console.log("-".repeat(100));
      console.log(
        `  ${"Algorithm".padEnd(30)} | ${"Matches".padEnd(15)} | ${"Total Time".padEnd(12)} | ${"Build Time".padEnd(20)} | ${"Match Time".padEnd(20)} | Memory`
      );
      console.log("-".repeat(100));

      try {
        const kmpResult = testKMP(scenario.pattern, scenario.text);
        results.push(kmpResult);
        console.log(formatAlgorithmResult("KMP", kmpResult));
      } catch (e) {
        console.log(`  KMP: FAILED - ${e}`);
      }

      try {
        const bmResult = testBoyerMoore(scenario.pattern, scenario.text);
        results.push(bmResult);
        console.log(formatAlgorithmResult("Boyer-Moore", bmResult));
      } catch (e) {
        console.log(`  Boyer-Moore: FAILED - ${e}`);
      }
      console.log();
    }

    // Test Aho-Corasick if pattern has alternations (and not excluded)
    const alternatives = extractAlternatives(scenario.pattern);
    if (alternatives && !options.onlyAutomata) {
      console.log("MULTI-PATTERN ALGORITHM");
      console.log("-".repeat(100));
      console.log(
        `  ${"Algorithm".padEnd(30)} | ${"Matches".padEnd(15)} | ${"Total Time".padEnd(12)} | ${"Build Time".padEnd(20)} | ${"Match Time".padEnd(20)} | Memory`
      );
      console.log("-".repeat(100));

      try {
        const acResult = testAhoCorasick(alternatives, scenario.text);
        results.push(acResult);
        console.log(formatAlgorithmResult("Aho-Corasick", acResult));
      } catch (e) {
        console.log(`  Aho-Corasick: FAILED - ${e}`);
      }
      console.log();
    }

    // Test automaton-based algorithms WITHOUT prefiltering (if not excluded)
    if (!options.onlyLiteral) {
      console.log("AUTOMATON ALGORITHMS (without prefiltering)");
      console.log("-".repeat(100));
      console.log(
        `  ${"Algorithm".padEnd(30)} | ${"Matches".padEnd(15)} | ${"Total Time".padEnd(12)} | ${"Build Time".padEnd(20)} | ${"Match Time".padEnd(20)} | Memory`
      );
      console.log("-".repeat(100));

      try {
        const nfaResult = testNFA(scenario.pattern, scenario.text);
        results.push(nfaResult);
        console.log(formatAlgorithmResult("NFA", nfaResult));
      } catch (e) {
        console.log(`  NFA: FAILED - ${e}`);
      }

      try {
        const nfaDfaCacheResult = testNFAWithDFACache(
          scenario.pattern,
          scenario.text
        );
        results.push(nfaDfaCacheResult);
        console.log(formatAlgorithmResult("NFA+DFA-cache", nfaDfaCacheResult));
      } catch (e) {
        console.log(`  NFA+DFA-cache: FAILED - ${e}`);
      }

      try {
        const dfaResult = testDFA(scenario.pattern, scenario.text);
        results.push(dfaResult);
        console.log(formatAlgorithmResult("DFA", dfaResult));
      } catch (e) {
        console.log(`  DFA: FAILED - ${e}`);
      }

      try {
        const minDfaResult = testMinDFA(scenario.pattern, scenario.text);
        results.push(minDfaResult);
        console.log(formatAlgorithmResult("min-DFA", minDfaResult));
      } catch (e) {
        console.log(`  min-DFA: FAILED - ${e}`);
      }
      console.log();

      // Test automaton-based algorithms WITH prefiltering (if applicable)
      if (!isLiteralPattern(scenario.pattern)) {
        console.log("AUTOMATON ALGORITHMS (with prefiltering)");
        console.log("-".repeat(100));
        console.log(
          `  ${"Algorithm".padEnd(30)} | ${"Matches".padEnd(15)} | ${"Total Time".padEnd(12)} | ${"Build Time".padEnd(20)} | ${"Match Time".padEnd(20)} | Memory`
        );
        console.log("-".repeat(100));

        try {
          const nfaPrefilterResult = testNFAWithPrefilter(
            scenario.pattern,
            scenario.text
          );
          results.push(nfaPrefilterResult);
          console.log(
            formatAlgorithmResult("NFA (prefiltered)", nfaPrefilterResult)
          );
        } catch (e) {
          console.log(`  NFA (prefiltered): FAILED - ${e}`);
        }

        try {
          const nfaDfaCachePrefilterResult = testNFAWithDFACacheAndPrefilter(
            scenario.pattern,
            scenario.text
          );
          results.push(nfaDfaCachePrefilterResult);
          console.log(
            formatAlgorithmResult(
              "NFA+DFA-cache (prefiltered)",
              nfaDfaCachePrefilterResult
            )
          );
        } catch (e) {
          console.log(`  NFA+DFA-cache (prefiltered): FAILED - ${e}`);
        }

        try {
          const dfaPrefilterResult = testDFAWithPrefilter(
            scenario.pattern,
            scenario.text
          );
          results.push(dfaPrefilterResult);
          console.log(
            formatAlgorithmResult("DFA (prefiltered)", dfaPrefilterResult)
          );
        } catch (e) {
          console.log(`  DFA (prefiltered): FAILED - ${e}`);
        }

        try {
          const minDfaPrefilterResult = testMinDFAWithPrefilter(
            scenario.pattern,
            scenario.text
          );
          results.push(minDfaPrefilterResult);
          console.log(
            formatAlgorithmResult(
              "min-DFA (prefiltered)",
              minDfaPrefilterResult
            )
          );
        } catch (e) {
          console.log(`  min-DFA (prefiltered): FAILED - ${e}`);
        }
        console.log();
      }
    }
  } catch (error) {
    console.error(`\nERROR in scenario: ${error}`);
  }

  return {
    scenario: scenario.name,
    results,
  };
}

/**
 * Main test runner
 */
export function runAllTests(
  options: {
    verbose?: boolean;
    dataFile?: string;
    dataFolder?: string;
    onlyAutomata?: boolean;
    onlyLiteral?: boolean;
  } = {}
) {
  // Determine which algorithms to test
  let algorithmsToTest = "KMP, Boyer-Moore, Aho-Corasick, NFA, DFA, min-DFA";
  if (options.onlyAutomata) {
    algorithmsToTest = "NFA, DFA, min-DFA (automata only)";
  } else if (options.onlyLiteral) {
    algorithmsToTest = "KMP, Boyer-Moore, Aho-Corasick (literal search only)";
  }

  console.log("\n" + "=".repeat(100));
  console.log("COMPREHENSIVE ALGORITHM TEST SUITE");
  console.log("=".repeat(100));
  console.log(`Algorithms: ${algorithmsToTest}`);
  console.log(`Scenarios:  Simple patterns, complex regex, small/large texts`);
  console.log("=".repeat(100));

  // Prepare test scenarios
  let scenarios = [...TEST_SCENARIOS];

  // Fill in large text scenarios
  const largeText = generateLargeText(100000); // 100KB of text
  scenarios.forEach((scenario) => {
    if (scenario.text === "") {
      scenario.text = largeText;
    }
  });

  // If a data file is provided, add a scenario for it
  if (options.dataFile && fs.existsSync(options.dataFile)) {
    const fileContent = fs.readFileSync(options.dataFile, "utf-8");
    const fileSizeKB = (fileContent.length / 1024).toFixed(2);
    console.log(`\nAdding file: ${options.dataFile} (${fileSizeKB} KB)`);

    scenarios.forEach((scenario) => {
      scenario.text = fileContent;
    });
  }

  // If a data folder is provided, add scenarios for all files in it
  if (options.dataFolder && fs.existsSync(options.dataFolder)) {
    const files = fs
      .readdirSync(options.dataFolder)
      .filter((f) => f.endsWith(".txt"));
    console.log(
      `\nFound ${files.length} text file(s) in ${options.dataFolder}`
    );

    const oldScenarios = scenarios;
    scenarios = [];

    files.forEach((file) => {
      const filePath = `${options.dataFolder}/${file}`;
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const fileSizeKB = (fileContent.length / 1024).toFixed(2);
      console.log(`  - ${file} (${fileSizeKB} KB)`);

      oldScenarios.forEach((scenario) => {
        const newScenario = { ...scenario };
        newScenario.text = fileContent;
        scenarios.push(newScenario);
      });
    });
  }

  console.log(`\nTotal scenarios to test: ${scenarios.length}\n`);

  // Run all scenarios
  const allResults: TestResult[] = [];
  let scenarioNumber = 1;

  for (const scenario of scenarios) {
    console.log(`\n[Scenario ${scenarioNumber}/${scenarios.length}]`);
    const result = runTestScenario(scenario, {
      onlyAutomata: options.onlyAutomata,
      onlyLiteral: options.onlyLiteral,
    });
    allResults.push(result);
    scenarioNumber++;
  }

  // Print final summary
  console.log("\n" + "=".repeat(100));
  console.log("ALL TESTS COMPLETED");
  console.log("=".repeat(100));
  console.log(`Total scenarios tested: ${allResults.length}`);
  console.log("=".repeat(100) + "\n");
}
