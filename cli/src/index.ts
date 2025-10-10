import { readFileSync } from "fs";
import { parseRegex, nfaFromSyntaxTree, dfaFromNfa, matchDfa, minimizeDfa } from "@monorepo/lib";
import { Command } from "commander";

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
    .version("0.0.1");

  program.parse();

  const options = program.opts();
  const [pattern, filename] = program.args;
  const regex = options.ignoreCase ? pattern.toLowerCase() : pattern;

  try {
    // Lecture du fichier
    const content = readFileSync(filename, "utf-8");
    const lines = content.split("\n");
    const internalRegex = `(.*)(${regex})(.*)`; // On veut matcher n'importe quel caractère avant et après le pattern

    const syntaxTree = parseRegex(internalRegex);
    const nfa = nfaFromSyntaxTree(syntaxTree);
    const dfa = dfaFromNfa(nfa);

    // Affichage des lignes qui correspondent
    lines.forEach((line, index) => {
      const matches = matchDfa(dfa, line);
      console.log(`Line ${index + 1}: ${matches}`);
      if (matches !== options.invertMatch) {
        if (options.lineNumber) {
          console.log(`${index + 1} ${line}`);
        } else {
          console.log(line);
        }
      }
    });

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