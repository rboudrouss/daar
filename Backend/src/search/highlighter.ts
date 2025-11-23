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
import { AhoCorasick } from "@monorepo/lib";

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
   * @param positions Positions des termes dans le document (map: term -> character positions[])
   * @param options Options de highlighting
   */
  generateSnippets(
    filePath: string,
    terms: string[],
    positions: Map<string, number[]>,
    options?: HighlightOptions
  ): TextSnippet[] {
    const opts = { ...this.defaultOptions, ...options };
    console.log(`[HIGHLIGHTER] opts.snippetCount=${opts.snippetCount}`);
    console.log(`[HIGHLIGHTER] positions=${positions}`);

    // Collecter toutes les positions avec leurs termes
    const allMatches: Array<{
      term: string;
      position: number;
      length: number;
    }> = [];

    // Les positions ne contiennent que les termes non-stop words
    for (const term of terms) {
      const termPositions = positions.get(term) || [];
      for (const pos of termPositions) {
        allMatches.push({
          term,
          position: pos,
          length: term.length,
        });
      }
    }

    // Trier par position
    allMatches.sort((a, b) => a.position - b.position);

    // Si aucune position, retourner vide
    if (allMatches.length === 0) {
      return [];
    }

    // Lire le fichier entier en mode texte (UTF-8)
    let fileContent: string;
    try {
      fileContent = fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      return [];
    }
    const fileSize = fileContent.length;

    // Générer les snippets
    const snippets: TextSnippet[] = [];
    const snippetRanges: Array<{ start: number; end: number }> = [];

    console.log(
      `[HIGHLIGHTER] Starting snippet generation, target count=${opts.snippetCount}, max length=${opts.snippetLength}`
    );
    let matchIndex = 0;
    while (
      snippetRanges.length < opts.snippetCount &&
      matchIndex < allMatches.length
    ) {
      console.log(
        `[HIGHLIGHTER] Loop iteration: snippets.length=${snippets.length}, snippetRanges.length=${snippetRanges.length}, matchIndex=${matchIndex}`
      );
      const match = allMatches[matchIndex];
      const start = Math.max(0, match.position - opts.contextBefore);
      const end = Math.min(
        fileSize,
        match.position + match.length + opts.contextAfter
      );

      // Chercher un overlap avec un snippet existant
      let overlappingIndex = -1;
      for (let i = 0; i < snippetRanges.length; i++) {
        const range = snippetRanges[i];
        if (!(end < range.start || start > range.end)) {
          // Vérifier si le merge respecterait la longueur maximale
          const mergedStart = Math.min(range.start, start);
          const mergedEnd = Math.max(range.end, end);
          const mergedLength = mergedEnd - mergedStart;

          if (mergedLength <= opts.snippetLength) {
            overlappingIndex = i;
            console.log(
              `[HIGHLIGHTER] Found overlap at index ${i}, merged length would be ${mergedLength}`
            );
          } else {
            console.log(
              `[HIGHLIGHTER] Overlap found but merge would exceed max length (${mergedLength} > ${opts.snippetLength}), treating as separate snippet`
            );
          }
          break;
        }
      }

      if (overlappingIndex !== -1) {
        // Merge avec le snippet existant
        console.log(
          `[HIGHLIGHTER] Merging with existing snippet at index ${overlappingIndex}`
        );
        const existingRange = snippetRanges[overlappingIndex];
        existingRange.start = Math.min(existingRange.start, start);
        existingRange.end = Math.max(existingRange.end, end);
      } else {
        // Ajouter un nouveau snippet
        console.log(`[HIGHLIGHTER] Adding new snippet range`);
        snippetRanges.push({ start, end });
      }

      matchIndex++;
    }

    console.log(
      `[HIGHLIGHTER] After loop: snippetRanges.length=${snippetRanges.length}, snippets.length=${snippets.length}`
    );

    // Créer un Aho-Corasick pour rechercher tous les termes
    const ac = new AhoCorasick(terms);

    console.log(
      `[HIGHLIGHTER] Generating snippets from ${snippetRanges.length} ranges`
    );
    // Générer les snippets à partir des ranges
    for (const range of snippetRanges) {
      // Extraire le snippet du contenu
      let snippetText = fileContent.substring(range.start, range.end);

      // Trouver tous les matches dans ce snippet avec Aho-Corasick
      const acResults = ac.search(snippetText.toLocaleLowerCase());

      const snippetMatches: Array<{
        position: number;
        length: number;
      }> = [];
      const matchedTermsSet = new Set<string>();
      let firstMatchPosition = -1;

      for (const result of acResults) {
        snippetMatches.push({
          position: result.position,
          length: result.pattern.length,
        });
        matchedTermsSet.add(result.pattern);
        const absolutePosition = range.start + result.position;
        if (firstMatchPosition === -1) {
          firstMatchPosition = absolutePosition;
        }
      }

      // Highlighter - trier en ordre inverse pour ne pas décaler les positions
      snippetMatches.sort((a, b) => b.position - a.position);
      for (const sm of snippetMatches) {
        const before = snippetText.substring(0, sm.position);
        const matched = snippetText.substring(
          sm.position,
          sm.position + sm.length
        );
        const after = snippetText.substring(sm.position + sm.length);
        snippetText = before + "<mark>" + matched + "</mark>" + after;
      }

      // Ellipses
      if (range.start > 0) {
        snippetText = "..." + snippetText;
      }
      if (range.end < fileSize) {
        snippetText = snippetText + "...";
      }

      snippets.push({
        text: snippetText,
        position: firstMatchPosition,
        matchedTerms: Array.from(matchedTermsSet),
      });
      console.log(
        `[HIGHLIGHTER] Snippet added, total snippets now: ${snippets.length}`
      );
    }

    console.log(
      `[HIGHLIGHTER] Returning ${snippets.length} snippets (expected ${opts.snippetCount})`
    );
    return snippets;
  }
}
