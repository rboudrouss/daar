/**
 * Module de matching optimisé avec préfiltrage
 *
 * Ce module combine:
 * - Extraction de littéraux du regex
 * - Préfiltrage avec Boyer-Moore (1 motif) ou Aho-Corasick (plusieurs motifs)
 * - Lecture par chunks avec ChunkedLineReader
 * - Matching regex complet seulement sur les lignes préfiltrées
 *
 * Inspiré de grep qui utilise une approche similaire pour optimiser la recherche.
 */

import { SyntaxTree } from "./RegexParser";
import { extractLiterals, canUsePrefilter } from "./LiteralExtractor";
import { boyerMooreContains } from "./BoyerMoore";
import { AhoCorasick } from "./AhoCorasick";
import { ChunkedLineReader, LineMatch } from "./ChunkedLineReader";
import { Match } from "./Matcher";

export interface GrepMatcherOptions {
  /** Taille du chunk pour la lecture (défaut: 64KB) */
  chunkSize?: number;
  /** Ignorer la casse (défaut: false) */
  ignoreCase?: boolean;
  /** Inverser le match (défaut: false) */
  invertMatch?: boolean;
  /** Activer le préfiltrage (défaut: true) */
  enablePrefilter?: boolean;
}

export interface MatchResult {
  line: string;
  lineNumber: number;
  matches: Match[];
}

/**
 * Classe pour le matching optimisé avec préfiltrage
 */
export class GrepMatcher {
  private literals: string[];
  private prefilter: null | ((line: string) => boolean) = null;
  private usePrefilter: boolean;

  constructor(
    private syntaxTree: SyntaxTree,
    private options: GrepMatcherOptions = {}
  ) {
    // Extraire les littéraux pour le préfiltrage
    this.literals = extractLiterals(syntaxTree);

    // Vérifier si le préfiltrage est activé (par défaut: true)
    const enablePrefilter = options.enablePrefilter !== false;
    this.usePrefilter = enablePrefilter && canUsePrefilter(syntaxTree);

    // Construire le préfiltre si activé
    if (this.usePrefilter) {
      this.buildPrefilter();
    }
  }

  /**
   * Construit la fonction de préfiltrage en fonction des littéraux extraits
   */
  private buildPrefilter(): void {
    if (this.literals.length === 0) {
      this.prefilter = null;
      return;
    }

    // Appliquer ignoreCase si nécessaire
    const literals = this.options.ignoreCase
      ? this.literals.map((l) => l.toLowerCase())
      : this.literals;

    if (literals.length === 1) {
      // Un seul littéral: utiliser Boyer-Moore
      const pattern = literals[0];
      this.prefilter = (line: string) => {
        const text = this.options.ignoreCase ? line.toLowerCase() : line;
        return boyerMooreContains(text, pattern);
      };
    } else {
      // Plusieurs littéraux: utiliser Aho-Corasick
      const ac = new AhoCorasick(literals);
      this.prefilter = (line: string) => {
        const text = this.options.ignoreCase ? line.toLowerCase() : line;
        return ac.contains(text);
      };
    }
  }

  /**
   * Recherche dans un fichier avec préfiltrage et matching regex
   *
   * @param filename Le fichier à rechercher
   * @param matcher Fonction de matching regex qui retourne les matches trouvés
   * @yields Les lignes qui matchent avec leurs positions de match
   */
  *searchFile(
    filename: string,
    matcher: (line: string) => Match[]
  ): Generator<MatchResult> {
    const reader = new ChunkedLineReader(filename, {
      chunkSize: this.options.chunkSize,
    });

    let lineYeilder = this.usePrefilter && !this.options.invertMatch
      ? reader.linesWithPrefilter(this.prefilter)
      : reader.lines();

    try {
      for (const { line, lineNumber } of lineYeilder) {
        // Appliquer le matching regex complet
        const matches = matcher(line);

        // Appliquer invertMatch si nécessaire
        const hasMatches = matches.length > 0;
        const shouldYield = this.options.invertMatch ? !hasMatches : hasMatches;

        if (shouldYield) {
          yield { line, lineNumber, matches };
        }
      }
    } finally {
      reader.close();
    }
  }

  /**
   * Compte le nombre de lignes qui matchent (sans les retourner)
   *
   * @param filename Le fichier à rechercher
   * @param matcher Fonction de matching regex
   * @returns Le nombre de lignes qui matchent
   */
  countMatches(filename: string, matcher: (line: string) => Match[]): number {
    let count = 0;
    for (const _ of this.searchFile(filename, matcher)) {
      count++;
    }
    return count;
  }

  /**
   * Vérifie si au moins une ligne matche (s'arrête au premier match)
   *
   * @param filename Le fichier à rechercher
   * @param matcher Fonction de matching regex
   * @returns true si au moins une ligne matche
   */
  hasMatch(filename: string, matcher: (line: string) => Match[]): boolean {
    for (const _ of this.searchFile(filename, matcher)) {
      return true;
    }
    return false;
  }

  /**
   * Retourne des statistiques sur le préfiltrage
   */
  getPrefilterStats(): {
    enabled: boolean;
    literals: string[];
    literalCount: number;
  } {
    return {
      enabled: this.usePrefilter,
      literals: this.literals,
      literalCount: this.literals.length,
    };
  }
}

/**
 * Fonction utilitaire pour créer un matcher à partir d'un arbre syntaxique
 *
 * @param syntaxTree L'arbre syntaxique du regex
 * @param options Options du matcher
 * @returns Un GrepMatcher configuré
 */
export function createGrepMatcher(
  syntaxTree: SyntaxTree,
  options?: GrepMatcherOptions
): GrepMatcher {
  return new GrepMatcher(syntaxTree, options);
}
