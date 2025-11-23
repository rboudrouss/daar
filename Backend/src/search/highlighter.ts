/**
 * Highlighter - Génère des extraits de texte avec highlighting
 */

import * as fs from "fs";
import { TextSnippet } from "../utils/types";
import {
  SEARCH_HIGHLIGHT_SNIPPET_COUNT,
  SEARCH_HIGHLIGHT_SNIPPET_LENGTH,
  SEARCH_HIGHLIGHT_CONTEXT_LENGTH_BEFORE,
  SEARCH_HIGHLIGHT_CONTEXT_LENGTH_AFTER,
} from "../utils/const";

export interface HighlightOptions {
  snippetCount?: number; // Nombre de snippets à retourner
  snippetLength?: number; // Longueur d'un snippet en caractères
  contextBefore?: number; // Caractères avant le match
  contextAfter?: number; // Caractères après le match
}

/**
 * Classe pour générer des extraits de texte avec highlighting
 */
export class Highlighter {
  private defaultOptions: Required<HighlightOptions> = {
    snippetCount: SEARCH_HIGHLIGHT_SNIPPET_COUNT,
    snippetLength: SEARCH_HIGHLIGHT_SNIPPET_LENGTH,
    contextBefore: SEARCH_HIGHLIGHT_CONTEXT_LENGTH_BEFORE,
    contextAfter: SEARCH_HIGHLIGHT_CONTEXT_LENGTH_AFTER,
  };

  /**
   * Génère des snippets avec highlighting pour un livre
   * @param filePath Chemin du fichier du livre
   * @param terms Termes à highlighter
   * @param positions Positions des termes dans le document (map: term -> positions[])
   * @param options Options de highlighting
   */
  generateSnippets(
    filePath: string,
    terms: string[],
    positions: Map<string, number[]>,
    options?: HighlightOptions
  ): TextSnippet[] {
    const opts = { ...this.defaultOptions, ...options };

    // Lire le contenu du fichier
    let content: string;
    try {
      content = fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return [];
    }

    // Tokenizer le contenu pour avoir les positions exactes
    const tokens = this.tokenizeWithPositions(content);

    // Collecter toutes les positions de tous les termes
    const allPositions: Array<{
      term: string;
      tokenIndex: number;
      charPosition: number;
    }> = [];

    for (const term of terms) {
      const termPositions = positions.get(term) || [];
      for (const tokenIndex of termPositions) {
        if (tokenIndex < tokens.length) {
          allPositions.push({
            term,
            tokenIndex,
            charPosition: tokens[tokenIndex].start,
          });
        }
      }
    }

    // Trier par position
    allPositions.sort((a, b) => a.charPosition - b.charPosition);

    // Générer les snippets
    const snippets: TextSnippet[] = [];
    const usedRanges: Array<{ start: number; end: number }> = [];

    for (const pos of allPositions) {
      if (snippets.length >= opts.snippetCount) {
        break;
      }

      // Vérifier si cette position n'est pas déjà couverte
      const isOverlapping = usedRanges.some(
        (range) =>
          pos.charPosition >= range.start && pos.charPosition <= range.end
      );

      if (isOverlapping) {
        continue;
      }

      // Calculer les bornes du snippet
      const start = Math.max(0, pos.charPosition - opts.contextBefore);
      const end = Math.min(
        content.length,
        pos.charPosition + opts.contextAfter
      );

      // Extraire le texte
      let snippetText = content.substring(start, end);

      // Ajouter des ellipses si nécessaire
      if (start > 0) {
        snippetText = "..." + snippetText;
      }
      if (end < content.length) {
        snippetText = snippetText + "...";
      }

      // Highlighter tous les termes dans ce snippet
      const matchedTerms: string[] = [];
      for (const term of terms) {
        const regex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, "gi");
        if (regex.test(snippetText)) {
          matchedTerms.push(term);
          snippetText = snippetText.replace(regex, "<mark>$&</mark>");
        }
      }

      snippets.push({
        text: snippetText,
        position: pos.charPosition,
        matchedTerms,
      });

      usedRanges.push({ start, end });
    }

    return snippets;
  }

  /**
   * Tokenize le texte et retourne les positions de chaque token
   */
  private tokenizeWithPositions(
    text: string
  ): Array<{ token: string; start: number; end: number }> {
    const tokens: Array<{ token: string; start: number; end: number }> = [];
    const regex = /\b\w+\b/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
      tokens.push({
        token: match[0].toLowerCase(),
        start: match.index,
        end: match.index + match[0].length,
      });
    }

    return tokens;
  }

  /**
   * Échappe les caractères spéciaux pour RegEx
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
