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

import {
  extractLiterals,
  canUsePrefilter,
  hasAlternation,
} from "./LiteralExtractor";
import { boyerMooreContains } from "../search/BoyerMoore";
import { ChunkedLineReader } from "./ChunkedLineReader";
import type { AlgorithmType } from "./AlgorithmSelector";
import { kmpContains } from "../search/KMP";
import { AhoCorasick } from "../search/AhoCorasick";
import { Match } from "../search/Matcher";
import { SyntaxTree } from "../search/utils";

/**
 * Type d'algorithme de préfiltrage
 */
export type PrefilterAlgorithm =
  | "auto"
  | "boyer-moore"
  | "kmp"
  | "aho-corasick"
  | "off";

export interface GrepMatcherOptions {
  /** Taille du chunk pour la lecture (défaut: 64KB) */
  chunkSize?: number;
  /** Ignorer la casse (défaut: false) */
  ignoreCase?: boolean;
  /** Inverser le match (défaut: false) */
  invertMatch?: boolean;
  /** Activer le préfiltrage (défaut: true) - deprecated, use prefilterAlgorithm instead */
  enablePrefilter?: boolean;
  /** Algorithme de préfiltrage (défaut: "auto") */
  prefilterAlgorithm?: PrefilterAlgorithm;
  /** Algorithme qui sera utilisé pour le matching (pour décider du préfiltrage) */
  algorithm?: AlgorithmType;
  /** Taille du fichier en octets (pour décider si le préfiltrage vaut le coup) */
  fileSize?: number;
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
  private prefilterAlgorithm: PrefilterAlgorithm;
  private isAlternation: boolean;

  constructor(
    private syntaxTree: SyntaxTree,
    private options: GrepMatcherOptions = {}
  ) {
    // Extraire les littéraux pour le préfiltrage
    this.literals = extractLiterals(syntaxTree);

    // Déterminer si le pattern contient une alternation (même imbriquée)
    // Si oui, on doit utiliser contains() au lieu de containsAll()
    this.isAlternation = hasAlternation(syntaxTree);

    // Déterminer l'algorithme de préfiltrage à utiliser
    this.prefilterAlgorithm = options.prefilterAlgorithm || "auto";

    // Support pour l'ancienne option enablePrefilter (deprecated)
    if (options.enablePrefilter === false) {
      this.prefilterAlgorithm = "off";
    }

    // Si "off", désactiver le préfiltrage
    if (this.prefilterAlgorithm === "off") {
      this.usePrefilter = false;
      return;
    }

    // Déterminer si le préfiltrage est utile
    // Le préfiltrage n'est PAS utile si l'algorithme utilisé est déjà un algorithme de recherche littérale
    const isLiteralAlgorithm =
      options.algorithm === "literal-kmp" ||
      options.algorithm === "literal-bm" ||
      options.algorithm === "aho-corasick";

    // En mode "auto", désactiver le préfiltrage pour les petits fichiers (< 10KB)
    // Le overhead de construction d'Aho-Corasick n'en vaut pas la peine
    const MIN_FILE_SIZE_FOR_PREFILTER = 10 * 1024; // 10KB
    const isFileTooSmall =
      this.prefilterAlgorithm === "auto" &&
      options.fileSize !== undefined &&
      options.fileSize < MIN_FILE_SIZE_FOR_PREFILTER;

    this.usePrefilter =
      !isLiteralAlgorithm && !isFileTooSmall && canUsePrefilter(syntaxTree);

    // Construire le préfiltre si activé
    if (this.usePrefilter) {
      this.buildPrefilter();
    }
  }

  /**
   * Construit la fonction de préfiltrage en fonction des littéraux extraits
   *
   * Stratégie en mode "auto":
   * - Pour un seul littéral: utiliser Boyer-Moore
   * - Pour plusieurs littéraux: utiliser Aho-Corasick avec containsAll
   *   pour vérifier que TOUS les littéraux sont présents (nécessaire pour
   *   les patterns de concaténation comme "test.*keyword")
   *
   * En mode manuel, utilise l'algorithme spécifié.
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

    // Déterminer l'algorithme à utiliser
    let algorithm: "boyer-moore" | "kmp" | "aho-corasick";

    if (this.prefilterAlgorithm === "auto") {
      // Mode auto: Boyer-Moore pour 1 littéral, Aho-Corasick pour plusieurs
      algorithm = literals.length === 1 ? "boyer-moore" : "aho-corasick";
    } else {
      // Mode manuel
      algorithm = this.prefilterAlgorithm as
        | "boyer-moore"
        | "kmp"
        | "aho-corasick";
    }

    // Construire le préfiltre selon l'algorithme choisi
    switch (algorithm) {
      case "boyer-moore":
        this.buildBoyerMoorePrefilter(literals);
        break;
      case "kmp":
        this.buildKmpPrefilter(literals);
        break;
      case "aho-corasick":
        this.buildAhoCorasickPrefilter(literals);
        break;
    }
  }

  /**
   * Construit un préfiltre Boyer-Moore
   */
  private buildBoyerMoorePrefilter(literals: string[]): void {
    // Boyer-Moore fonctionne mieux avec un seul pattern
    // Si plusieurs littéraux, utiliser le plus long
    const pattern = literals[0];
    this.prefilter = (line: string) => {
      const text = this.options.ignoreCase ? line.toLowerCase() : line;
      return boyerMooreContains(text, pattern);
    };
  }

  /**
   * Construit un préfiltre KMP
   */
  private buildKmpPrefilter(literals: string[]): void {
    // KMP fonctionne mieux avec un seul pattern
    // Si plusieurs littéraux, utiliser le plus long
    const pattern = literals[0];
    this.prefilter = (line: string) => {
      const text = this.options.ignoreCase ? line.toLowerCase() : line;
      return kmpContains(text, pattern);
    };
  }

  /**
   * Construit un préfiltre Aho-Corasick
   */
  private buildAhoCorasickPrefilter(literals: string[]): void {
    // Aho-Corasick peut gérer plusieurs patterns efficacement
    const ac = new AhoCorasick(literals);
    this.prefilter = (line: string) => {
      const text = this.options.ignoreCase ? line.toLowerCase() : line;
      // Choisir la méthode appropriée selon le type de pattern:
      // - Pour les alternations (e.g., "cat|dog|bird"), utiliser contains() - N'IMPORTE QUEL littéral doit être présent
      // - Pour les concaténations (e.g., "test.*keyword"), utiliser containsAll() - TOUS les littéraux doivent être présents
      return this.isAlternation ? ac.contains(text) : ac.containsAll(text);
    };
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

    let lineYeilder =
      this.usePrefilter && !this.options.invertMatch
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
    algorithm: string;
  } {
    let algorithm = "None";

    if (this.usePrefilter) {
      if (this.prefilterAlgorithm === "auto") {
        if (this.literals.length === 1) {
          algorithm = "Boyer-Moore";
        } else {
          // Indiquer quelle méthode Aho-Corasick est utilisée
          algorithm = this.isAlternation
            ? "Aho-Corasick (contains)"
            : "Aho-Corasick (containsAll)";
        }
      } else {
        switch (this.prefilterAlgorithm) {
          case "boyer-moore":
            algorithm = "Boyer-Moore";
            break;
          case "kmp":
            algorithm = "KMP";
            break;
          case "aho-corasick":
            // Indiquer quelle méthode Aho-Corasick est utilisée
            algorithm = this.isAlternation
              ? "Aho-Corasick (contains)"
              : "Aho-Corasick (containsAll)";
            break;
        }
      }
    }

    return {
      enabled: this.usePrefilter,
      literals: this.literals,
      literalCount: this.literals.length,
      algorithm,
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
