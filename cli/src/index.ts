import { readFileSync } from "fs";
import { parseRegex, nfaFromSyntaxTree, dfaFromNfa } from "@monorepo/lib";
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
    .version("1.0.0");

  program.parse();

  const options = program.opts();
  const [pattern, filename] = program.args;
  const regex = options.ignoreCase ? pattern.toLowerCase() : pattern;

  try {
    // Lecture du fichier
    const content = readFileSync(filename, "utf-8");
    const lines = content.split("\n");

    // Création du DFA à partir de l'expression régulière
    const syntaxTree = parseRegex(regex);
    const nfa = nfaFromSyntaxTree(syntaxTree);
    const dfa = dfaFromNfa(nfa);

    // Fonction pour vérifier si une ligne contient un mot qui correspond à l'expression régulière
    const matchesRegex = (line: string): boolean => {
      const processedLine = options.ignoreCase ? line.toLowerCase() : line;
      const words = processedLine.split(/\s+/);
      return words.some((word) => {
        let currentState = dfa.start;
        
        // Parcours des caractères du mot
        for (const char of word) {
          if (!dfa.transitions[currentState] || !dfa.transitions[currentState][char]) {
            return false;
          }
          currentState = dfa.transitions[currentState][char];
        }
        
        // Vérifie si on est dans un état final
        return dfa.accepts.includes(currentState);
      });
    };

    // Affichage des lignes qui correspondent
    lines.forEach((line, index) => {
      const matches = matchesRegex(line);
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