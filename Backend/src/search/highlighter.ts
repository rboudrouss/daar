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
   * @param options Options de highlighting
   */
  generateSnippets(
    filePath: string,
    terms: string[],
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

    // Trouver toutes les occurrences des termes directement dans le texte
    const allMatches: Array<{
      term: string;
      position: number;
      length: number;
    }> = [];

    for (const term of terms) {
      const regex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, "gi");
      let match;
      while ((match = regex.exec(content)) !== null) {
        allMatches.push({
          term,
          position: match.index,
          length: match[0].length,
        });
      }
    }

    // Trier par position
    allMatches.sort((a, b) => a.position - b.position);

    // Générer les snippets
    const snippets: TextSnippet[] = [];
    const usedRanges: Array<{ start: number; end: number }> = [];

    for (const match of allMatches) {
      if (snippets.length >= opts.snippetCount) {
        break;
      }

      // Vérifier si cette position n'est pas déjà couverte
      const isOverlapping = usedRanges.some(
        (range) =>
          match.position >= range.start && match.position <= range.end
      );

      if (isOverlapping) {
        continue;
      }

      // Calculer les bornes du snippet avec plus de contexte
      const start = Math.max(0, match.position - opts.contextBefore);
      const end = Math.min(
        content.length,
        match.position + match.length + opts.contextAfter
      );

      // Extraire le texte
      let snippetText = content.substring(start, end);

      // Highlighter tous les termes dans ce snippet AVANT d'ajouter les ellipses
      const matchedTerms: string[] = [];
      for (const term of terms) {
        const regex = new RegExp(`\\b${this.escapeRegex(term)}\\b`, "gi");
        if (regex.test(snippetText)) {
          matchedTerms.push(term);
          // Réinitialiser lastIndex pour le replace
          regex.lastIndex = 0;
          snippetText = snippetText.replace(regex, "<mark>$&</mark>");
        }
      }

      // Ajouter des ellipses APRÈS le highlighting
      if (start > 0) {
        snippetText = "..." + snippetText;
      }
      if (end < content.length) {
        snippetText = snippetText + "...";
      }

      snippets.push({
        text: snippetText,
        position: match.position,
        matchedTerms,
      });

      usedRanges.push({ start, end });
    }

    return snippets;
  }

  /**
   * Échappe les caractères spéciaux pour RegEx
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
