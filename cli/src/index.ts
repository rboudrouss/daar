import { readFileSync } from "fs";
import { parseRegex, nfaFromSyntaxTree, dfaFromNfa, matchDfa, minimizeDfa } from "@monorepo/lib";
import { Command } from "commander";

interface PerformanceMetrics {
  totalTime: number;
  parseTime: number;
  nfaTime: number;
  dfaTime: number;
  matchTime: number;
  memoryUsed: number;
  peakMemory: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
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
  console.error(`  - DFA construction: ${formatTime(metrics.dfaTime)}`);
  console.error(`  - Pattern matching: ${formatTime(metrics.matchTime)}`);
  console.error(`\nMemory usage:`);
  console.error(`  - Total allocated:  ${formatBytes(metrics.memoryUsed)}`);
  console.error(`  - Peak memory:      ${formatBytes(metrics.peakMemory)}`);
  console.error("===========================\n");
}

function main() {
  const program = new Command();

  program
    .name("egrep-clone")
    .description("Search for pattern in files using regular expressions")
    .argument("<pattern>", "Regular expression pattern to search for")
    .argument("<file>", "File to search in")
    .option("-i, --ignore-case", "Ignore case distinctions", false)
    .option("-n, --line-number", "Prefix each line with its line number", false)
    .option("-v, --invert-match", "Select non-matching lines", false)
    .option("-p, --perf", "Display performance metrics (time and memory)", false)
    .version("0.0.1");

  program.parse();

  const options = program.opts();
  const [pattern, filename] = program.args;
  const regex = options.ignoreCase ? pattern.toLowerCase() : pattern;

  try {
    const startTotal = performance.now();
    const startMemory = process.memoryUsage();
    let peakMemory = startMemory.heapUsed;

    // Lecture du fichier
    const content = readFileSync(filename, "utf-8");
    const lines = content.split("\n");
    const internalRegex = `(.*)(${regex})(.*)`; // On veut matcher n'importe quel caractère avant et après le pattern

    // Parse regex
    const startParse = performance.now();
    const syntaxTree = parseRegex(internalRegex);
    const parseTime = performance.now() - startParse;
    peakMemory = Math.max(peakMemory, process.memoryUsage().heapUsed);

    // Build NFA
    const startNfa = performance.now();
    const nfa = nfaFromSyntaxTree(syntaxTree);
    const nfaTime = performance.now() - startNfa;
    peakMemory = Math.max(peakMemory, process.memoryUsage().heapUsed);

    // Build DFA
    const startDfa = performance.now();
    const dfa = dfaFromNfa(nfa);
    const dfaTime = performance.now() - startDfa;
    peakMemory = Math.max(peakMemory, process.memoryUsage().heapUsed);

    // Match lines
    const startMatch = performance.now();
    lines.forEach((line, index) => {
      const matches = matchDfa(dfa, line);
      if (matches !== options.invertMatch) {
        if (options.lineNumber) {
          console.log(`${index + 1} ${line}`);
        } else {
          console.log(line);
        }
      }
      peakMemory = Math.max(peakMemory, process.memoryUsage().heapUsed);
    });
    const matchTime = performance.now() - startMatch;

    const totalTime = performance.now() - startTotal;
    const endMemory = process.memoryUsage();
    const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

    // Display performance metrics if requested
    if (options.perf) {
      printPerformanceMetrics({
        totalTime,
        parseTime,
        nfaTime,
        dfaTime,
        matchTime,
        memoryUsed,
        peakMemory: peakMemory - startMemory.heapUsed,
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