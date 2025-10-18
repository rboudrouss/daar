/**
 * Comprehensive test suite for all algorithms
 * Tests KMP, Boyer-Moore, Aho-Corasick, NFA, DFA, min-DFA
 * with and without prefiltering across various scenarios
 */

import {
  findAllMatchesNfa,
  findAllMatchesDfa,
  findAllMatchesNfaWithDfaCache,
  findAllMatchesLiteralKmp,
  findAllMatchesLiteralBm,
  AhoCorasick,
} from "@monorepo/lib";
import * as fs from "fs";
import {
  calculateStructureSize,
  countTrieNodes,
} from "./utils/structure-analysis";
import {
  executeTest,
  executeLiteralTest,
  safeExecute,
  type AlgorithmResult,
} from "./utils/test-execution";
import {
  formatAlgorithmResult,
  printSectionHeader,
  printScenarioHeader,
  printTestSuiteHeader,
  printTestSuiteFooter,
} from "./utils/test-formatting";
import {
  buildNFA,
  buildDFA,
  buildMinDFA,
  getNFAStructureSize,
  getDFAStructureSize,
} from "./utils/automaton-builders";
import { matchWithPrefilter } from "./utils/prefilter-helpers";

interface TestScenario {
  name: string;
  pattern: string;
  text: string;
  description: string;
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
    pattern:
      "((t|T)(h|H)(e|E)( )*(m|M)(a|A)(n|N))|((s|S)(h|H)(e|E)( )*(s|S)(a|A)(i|I)(d|D))|((w|W)(a|A)(s|S)( )*(a|A)(l|L)(o|O)(n|N)(e|E))|((t|T)(h|H)(e|E)( )*(e|E)(n|N)(d|D))",
    text: "The man said was alone at the end",
    description:
      "Very complex regex with multiple operators (NFA might be better)",
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
  },
  {
    name: "Worst case DFA",
    pattern: "(a|b)*a(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)(a|b)",
    text: "a" + "b".repeat(1000) + "c",
    description: "Worst case for DFA (exponential blowup)",
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
  return executeLiteralTest(
    () => findAllMatchesLiteralKmp(pattern, text),
    "KMP"
  );
}

/**
 * Test a literal pattern with Boyer-Moore
 */
function testBoyerMoore(pattern: string, text: string): AlgorithmResult {
  return executeLiteralTest(
    () => findAllMatchesLiteralBm(pattern, text),
    "Boyer-Moore"
  );
}

/**
 * Test with NFA
 */
function testNFA(pattern: string, text: string): AlgorithmResult {
  return executeTest(
    () => buildNFA(pattern),
    ({ nfa }) => findAllMatchesNfa(nfa, text),
    "NFA",
    ({ nfa }) => getNFAStructureSize(nfa)
  );
}

/**
 * Test with NFA + DFA cache (lazy DFA construction)
 */
function testNFAWithDFACache(pattern: string, text: string): AlgorithmResult {
  return executeTest(
    () => buildNFA(pattern),
    ({ nfa }) => findAllMatchesNfaWithDfaCache(nfa, text),
    "NFA+DFA-cache",
    ({ nfa }) => getNFAStructureSize(nfa)
  );
}

/**
 * Test with DFA
 */
function testDFA(pattern: string, text: string): AlgorithmResult {
  try {
    return executeTest(
      () => buildDFA(pattern),
      ({ dfa }) => findAllMatchesDfa(dfa, text),
      "DFA",
      ({ dfa }) => getDFAStructureSize(dfa)
    );
  } catch (error) {
    throw new Error(`DFA construction failed: ${error}`);
  }
}

/**
 * Test with minimized DFA
 */
function testMinDFA(pattern: string, text: string): AlgorithmResult {
  return executeTest(
    () => buildMinDFA(pattern),
    ({ minDfa }) => findAllMatchesDfa(minDfa, text),
    "min-DFA",
    ({ minDfa }) => getDFAStructureSize(minDfa)
  );
}

/**
 * Test Aho-Corasick for multi-pattern matching
 */
function testAhoCorasick(patterns: string[], text: string): AlgorithmResult {
  return executeTest(
    () => new AhoCorasick(patterns),
    (ac) => {
      const results = ac.search(text);
      return results.map((r: { pattern: string; position: number }) => ({
        start: r.position,
        end: r.position + r.pattern.length,
        text: r.pattern,
      }));
    },
    "Aho-Corasick",
    (ac) => ({
      nodes: countTrieNodes(ac),
      kb: calculateStructureSize(ac),
    })
  );
}

/**
 * Test NFA with prefiltering
 */
function testNFAWithPrefilter(pattern: string, text: string): AlgorithmResult {
  return executeTest(
    () => buildNFA(pattern),
    ({ syntaxTree, nfa }) =>
      matchWithPrefilter(syntaxTree, text, nfa, (nfa, text) =>
        findAllMatchesNfa(nfa, text)
      ),
    "NFA (with prefilter)",
    ({ nfa }) => getNFAStructureSize(nfa)
  );
}

/**
 * Test DFA with prefiltering
 */
function testDFAWithPrefilter(pattern: string, text: string): AlgorithmResult {
  return executeTest(
    () => buildDFA(pattern),
    ({ syntaxTree, dfa }) =>
      matchWithPrefilter(syntaxTree, text, dfa, (dfa, text) =>
        findAllMatchesDfa(dfa, text)
      ),
    "DFA (with prefilter)",
    ({ dfa }) => getDFAStructureSize(dfa)
  );
}

/**
 * Test min-DFA with prefiltering
 */
function testMinDFAWithPrefilter(
  pattern: string,
  text: string
): AlgorithmResult {
  return executeTest(
    () => buildMinDFA(pattern),
    ({ syntaxTree, minDfa }) =>
      matchWithPrefilter(syntaxTree, text, minDfa, (minDfa, text) =>
        findAllMatchesDfa(minDfa, text)
      ),
    "min-DFA (with prefilter)",
    ({ minDfa }) => getDFAStructureSize(minDfa)
  );
}

/**
 * Test NFA+DFA-cache with prefiltering
 */
function testNFAWithDFACacheAndPrefilter(
  pattern: string,
  text: string
): AlgorithmResult {
  return executeTest(
    () => buildNFA(pattern),
    ({ syntaxTree, nfa }) =>
      matchWithPrefilter(syntaxTree, text, nfa, (nfa, text) =>
        findAllMatchesNfaWithDfaCache(nfa, text)
      ),
    "NFA+DFA-cache (with prefilter)",
    ({ nfa }) => getNFAStructureSize(nfa)
  );
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
 * Run a single test scenario
 */
function runTestScenario(
  scenario: TestScenario,
  options: { onlyAutomata?: boolean; onlyLiteral?: boolean } = {}
): TestResult {
  printScenarioHeader(
    scenario.name,
    scenario.pattern,
    scenario.description,
    scenario.text.length
  );

  const results: AlgorithmResult[] = [];

  try {
    // Test literal algorithms if pattern is literal (and not excluded)
    if (isLiteralPattern(scenario.pattern) && !options.onlyAutomata) {
      printSectionHeader("LITERAL ALGORITHMS");

      const kmpResult = safeExecute(
        () => testKMP(scenario.pattern, scenario.text),
        "KMP"
      );
      if (kmpResult) {
        results.push(kmpResult);
        console.log(formatAlgorithmResult("KMP", kmpResult));
      }

      const bmResult = safeExecute(
        () => testBoyerMoore(scenario.pattern, scenario.text),
        "Boyer-Moore"
      );
      if (bmResult) {
        results.push(bmResult);
        console.log(formatAlgorithmResult("Boyer-Moore", bmResult));
      }
      console.log();
    }

    // Test Aho-Corasick if pattern has alternations (and not excluded)
    const alternatives = extractAlternatives(scenario.pattern);
    if (alternatives && !options.onlyAutomata) {
      printSectionHeader("MULTI-PATTERN ALGORITHM");

      const acResult = safeExecute(
        () => testAhoCorasick(alternatives, scenario.text),
        "Aho-Corasick"
      );
      if (acResult) {
        results.push(acResult);
        console.log(formatAlgorithmResult("Aho-Corasick", acResult));
      }
      console.log();
    }

    // Test automaton-based algorithms WITHOUT prefiltering (if not excluded)
    if (!options.onlyLiteral) {
      printSectionHeader("AUTOMATON ALGORITHMS (without prefiltering)");

      const nfaResult = safeExecute(
        () => testNFA(scenario.pattern, scenario.text),
        "NFA"
      );
      if (nfaResult) {
        results.push(nfaResult);
        console.log(formatAlgorithmResult("NFA", nfaResult));
      }

      const nfaDfaCacheResult = safeExecute(
        () => testNFAWithDFACache(scenario.pattern, scenario.text),
        "NFA+DFA-cache"
      );
      if (nfaDfaCacheResult) {
        results.push(nfaDfaCacheResult);
        console.log(formatAlgorithmResult("NFA+DFA-cache", nfaDfaCacheResult));
      }

      const dfaResult = safeExecute(
        () => testDFA(scenario.pattern, scenario.text),
        "DFA"
      );
      if (dfaResult) {
        results.push(dfaResult);
        console.log(formatAlgorithmResult("DFA", dfaResult));
      }

      const minDfaResult = safeExecute(
        () => testMinDFA(scenario.pattern, scenario.text),
        "min-DFA"
      );
      if (minDfaResult) {
        results.push(minDfaResult);
        console.log(formatAlgorithmResult("min-DFA", minDfaResult));
      }
      console.log();

      // Test automaton-based algorithms WITH prefiltering (if applicable)
      if (!isLiteralPattern(scenario.pattern)) {
        printSectionHeader("AUTOMATON ALGORITHMS (with prefiltering)");

        const nfaPrefilterResult = safeExecute(
          () => testNFAWithPrefilter(scenario.pattern, scenario.text),
          "NFA (prefiltered)"
        );
        if (nfaPrefilterResult) {
          results.push(nfaPrefilterResult);
          console.log(
            formatAlgorithmResult("NFA (prefiltered)", nfaPrefilterResult)
          );
        }

        const nfaDfaCachePrefilterResult = safeExecute(
          () =>
            testNFAWithDFACacheAndPrefilter(scenario.pattern, scenario.text),
          "NFA+DFA-cache (prefiltered)"
        );
        if (nfaDfaCachePrefilterResult) {
          results.push(nfaDfaCachePrefilterResult);
          console.log(
            formatAlgorithmResult(
              "NFA+DFA-cache (prefiltered)",
              nfaDfaCachePrefilterResult
            )
          );
        }

        const dfaPrefilterResult = safeExecute(
          () => testDFAWithPrefilter(scenario.pattern, scenario.text),
          "DFA (prefiltered)"
        );
        if (dfaPrefilterResult) {
          results.push(dfaPrefilterResult);
          console.log(
            formatAlgorithmResult("DFA (prefiltered)", dfaPrefilterResult)
          );
        }

        const minDfaPrefilterResult = safeExecute(
          () => testMinDFAWithPrefilter(scenario.pattern, scenario.text),
          "min-DFA (prefiltered)"
        );
        if (minDfaPrefilterResult) {
          results.push(minDfaPrefilterResult);
          console.log(
            formatAlgorithmResult(
              "min-DFA (prefiltered)",
              minDfaPrefilterResult
            )
          );
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
 * Prepare test scenarios with appropriate text content
 */
function prepareTestScenarios(options: {
  dataFile?: string;
  dataFolder?: string;
}): TestScenario[] {
  let scenarios = [...TEST_SCENARIOS];

  // Fill in large text scenarios
  const largeText = generateLargeText(100000); // 100KB of text
  scenarios.forEach((scenario) => {
    if (scenario.text === "") {
      scenario.text = largeText;
    }
  });

  // If a data file is provided, use it for all scenarios
  if (options.dataFile && fs.existsSync(options.dataFile)) {
    const fileContent = fs.readFileSync(options.dataFile, "utf-8");
    const fileSizeKB = (fileContent.length / 1024).toFixed(2);
    console.log(`\nAdding file: ${options.dataFile} (${fileSizeKB} KB)`);

    scenarios.forEach((scenario) => {
      scenario.text = fileContent;
    });
  }

  // If a data folder is provided, create scenarios for all files
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

  return scenarios;
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

  // Prepare test scenarios
  const scenarios = prepareTestScenarios(options);

  printTestSuiteHeader(algorithmsToTest, scenarios.length);

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
  printTestSuiteFooter(allResults.length);
}
