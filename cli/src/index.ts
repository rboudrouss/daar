import {
  parseRegex,
  nfaFromSyntaxTree,
  dfaFromNfa,
  minimizeDfa,
  type DFA,
  createGrepMatcher,
  findAllMatchesNfa,
  findAllMatchesDfa,
  findAllMatchesLiteralKmp,
  findAllMatchesLiteralBm,
  colorizeMatches,
  analyzePattern,
  getAlgorithmDescription,
  type AlgorithmType,
  AhoCorasick,
  isAlternationOfLiterals,
} from "@monorepo/lib";
import { Command } from "commander";
import { runAllTests } from "./test-all";
import {
  MemoryTracker,
  getSafeMemoryUsage,
  formatBytes as formatBytesUtil,
} from "./memory-utils";

type OptimizationLevel =
  | "auto"
  | "literal-kmp"
  | "literal-bm"
  | "aho-corasick"
  | "nfa"
  | "dfa"
  | "min-dfa";

interface PerformanceMetrics {
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
  };
  algorithmUsed?: string;
  algorithmReason?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const absBytes = Math.abs(bytes);
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(absBytes) / Math.log(k));
  const value = Math.round((absBytes / Math.pow(k, i)) * 100) / 100;
  const sign = bytes < 0 ? "-" : "";
  return sign + value + " " + sizes[i];
}

function formatTime(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)} μs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function printPerformanceMetrics(metrics: PerformanceMetrics): void {
  console.error("\n=== Performance Metrics ===");
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
  console.error(`\nMemory usage:`);
  console.error(`  - Total allocated:  ${formatBytes(metrics.memoryUsed)}`);
  console.error(`  - Peak memory:      ${formatBytes(metrics.peakMemory)}`);

  if (metrics.prefilterStats) {
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
      console.error(
        `  - Algorithm:        ${metrics.prefilterStats.literalCount === 1 ? "Boyer-Moore" : "Aho-Corasick"}`
      );
    }
  }

  if (metrics.algorithmUsed) {
    console.error(`\nAlgorithm selection:`);
    console.error(`  - Algorithm:        ${metrics.algorithmUsed}`);
    if (metrics.algorithmReason) {
      console.error(`  - Reason:           ${metrics.algorithmReason}`);
    }
  }

  console.error("===========================\n");
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
      "Optimization level: auto (default), literal-kmp, literal-bm, aho-corasick, nfa, dfa, or min-dfa",
      "auto"
    )
    .option(
      "--no-prefilter",
      "Disable prefiltering (use only NFA/DFA matching)"
    )
    .option(
      "--test-all",
      "Run comprehensive tests on all algorithms with various scenarios"
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
      "--test-only-automata",
      "Only test automaton-based algorithms (NFA, DFA, min-DFA)"
    )
    .option(
      "--test-only-literal",
      "Only test literal search algorithms (KMP, Boyer-Moore, Aho-Corasick)"
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
  if (
    !["auto", "literal-kmp", "literal-bm", "aho-corasick", "nfa", "dfa", "min-dfa"].includes(
      optimizationLevel
    )
  ) {
    console.error(`Invalid optimization level: ${optimizationLevel}`);
    console.error(
      "Valid options are: auto, literal-kmp, literal-bm, aho-corasick, nfa, dfa, min-dfa"
    );
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

    // Analyser le pattern et choisir l'algorithme optimal
    let selectedAlgorithm: AlgorithmType;
    let algorithmReason: string;

    if (optimizationLevel === "auto") {
      const analysis = analyzePattern(syntaxTree);
      selectedAlgorithm = analysis.recommendedAlgorithm;
      algorithmReason = analysis.reason;
    } else {
      // Mode manuel : utiliser l'algorithme spécifié
      selectedAlgorithm = optimizationLevel as AlgorithmType;
      algorithmReason = `Manually selected: ${optimizationLevel}`;
    }

    // Créer le GrepMatcher avec ou sans préfiltrage
    // Note: Commander.js transforme --no-prefilter en prefilter: false
    // Si prefilter est undefined, on l'active par défaut (true)
    const enablePrefilter = options.prefilter !== false;

    const grepMatcher = createGrepMatcher(syntaxTree, {
      ignoreCase: options.ignoreCase,
      invertMatch: options.invertMatch,
      chunkSize: 64 * 1024, // 64KB chunks comme grep
      enablePrefilter,
    });

    // Obtenir les stats du préfiltre
    const prefilterStats = grepMatcher.getPrefilterStats();

    // Variables pour les différents automates
    let nfaTime: number | undefined;
    let dfaTime: number | undefined;
    let minDfaTime: number | undefined;
    let dfa: DFA | undefined;
    let minDfa: DFA | undefined;
    let literalPattern: string | undefined;

    // Créer la fonction de matching appropriée selon l'algorithme sélectionné
    let matcher: (
      line: string
    ) => Array<{ start: number; end: number; text: string }>;

    if (
      selectedAlgorithm === "literal-kmp" ||
      selectedAlgorithm === "literal-bm"
    ) {
      // Pour les littéraux, extraire le pattern littéral
      literalPattern = regex; // Le pattern est déjà un littéral

      if (selectedAlgorithm === "literal-kmp") {
        matcher = (line: string) =>
          findAllMatchesLiteralKmp(literalPattern!, line);
      } else {
        matcher = (line: string) =>
          findAllMatchesLiteralBm(literalPattern!, line);
      }

      // Pas besoin de construire NFA/DFA pour les littéraux
      nfaTime = 0;
    } else if (selectedAlgorithm === "aho-corasick") {
      // Pour Aho-Corasick, extraire les littéraux de l'alternation
      const alternationCheck = isAlternationOfLiterals(syntaxTree);

      if (!alternationCheck.isAlternation || !alternationCheck.literals) {
        console.error("Error: Aho-Corasick requires an alternation of literals (e.g., 'from|what|who')");
        process.exit(1);
      }

      const patterns = alternationCheck.literals;
      const ac = new AhoCorasick(patterns);

      matcher = (line: string) => {
        const results = ac.search(line);
        return results.map(r => ({
          start: r.position,
          end: r.position + r.pattern.length,
          text: r.pattern,
        }));
      };

      // Pas besoin de construire NFA/DFA pour Aho-Corasick
      nfaTime = 0;
    } else {
      // Pour les regex, construire NFA
      const startNfa = performance.now();
      const nfa = nfaFromSyntaxTree(syntaxTree);
      nfaTime = performance.now() - startNfa;
      memTracker.update();

      if (selectedAlgorithm === "dfa" || selectedAlgorithm === "min-dfa") {
        // Build DFA
        const startDfa = performance.now();
        dfa = dfaFromNfa(nfa);
        dfaTime = performance.now() - startDfa;
        memTracker.update();

        if (selectedAlgorithm === "min-dfa") {
          // Minimize DFA
          const startMinDfa = performance.now();
          minDfa = minimizeDfa(dfa);
          minDfaTime = performance.now() - startMinDfa;
          memTracker.update();

          matcher = (line: string) => findAllMatchesDfa(minDfa!, line);
        } else {
          matcher = (line: string) => findAllMatchesDfa(dfa!, line);
        }
      } else {
        // NFA
        matcher = (line: string) => findAllMatchesNfa(nfa, line);
      }
    }

    // Match lines avec préfiltrage et lecture par chunks
    const startMatch = performance.now();
    for (const { line, lineNumber, matches } of grepMatcher.searchFile(
      filename,
      matcher
    )) {
      let outputLine = line;

      // Coloriser les matches si l'option --color est activée
      if (options.color && matches.length > 0) {
        outputLine = colorizeMatches(line, matches);
      }

      if (options.lineNumber) {
        console.log(`${lineNumber} ${outputLine}`);
      } else {
        console.log(outputLine);
      }
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
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error("Erreur:", error.message);
    } else {
      console.error("Une erreur inconnue s'est produite");
    }
    process.exit(1);
  }
}

main();
