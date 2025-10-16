/**
 * Module de matching pour trouver toutes les occurrences d'un regex dans une ligne
 *
 */

import { NFA, DOT, epsilonClosure, state_ID } from "./utils";
import { DFA } from "./utils";
import { kmpSearch } from "./index";
import { boyerMooreSearch } from "./BoyerMoore";

// Re-export from NFAWithDFACache
export {
  findAllMatchesNfaWithDfaCache,
  matchNfaWithDfaCache,
} from "./NFAWithDFACache";

/**
 * Représente une occurrence trouvée dans une ligne
 */
export interface Match {
  /** Position de début du match  */
  start: number;
  /** Position de fin du match */
  end: number;
  /** Texte matché */
  text: string;
}

/**
 * Trouve toutes les occurrences d'un NFA dans une ligne
 *
 * @param nfa Le NFA représentant le motif
 * @param line La ligne dans laquelle chercher
 * @returns Un tableau de matches trouvés
 */
export function findAllMatchesNfa(nfa: NFA, line: string): Match[] {
  const matches: Match[] = [];

  // Essayer de matcher à chaque position de la ligne
  for (let startPos = 0; startPos < line.length; startPos++) {
    // Essayer de trouver le plus long match à partir de cette position
    const match = findLongestMatchNfa(nfa, line, startPos);

    if (match) {
      matches.push(match);
      // Sauter après ce match pour éviter les chevauchements
      // (comportement standard de grep)
      // Si le match est vide (start == end), avancer d'au moins 1 pour éviter une boucle infinie
      if (match.end === match.start) {
        // Match vide, continuer à la position suivante
        // startPos sera incrémenté par la boucle
      } else {
        startPos = match.end - 1; // -1 car la boucle va incrémenter
      }
    }
  }

  return matches;
}

/**
 * Trouve le plus long match d'un NFA à partir d'une position donnée
 *
 * @param nfa Le NFA représentant le motif
 * @param line La ligne dans laquelle chercher
 * @param startPos La position de départ
 * @returns Le match trouvé, ou null
 */
function findLongestMatchNfa(
  nfa: NFA,
  line: string,
  startPos: number
): Match | null {
  let states = epsilonClosure(nfa, [nfa.start]);
  let lastAcceptPos = -1;

  // Vérifier si l'état initial est acceptant (pour les regex qui matchent la chaîne vide)
  if (states.some((s) => nfa.accepts.includes(s))) {
    lastAcceptPos = startPos;
  }

  for (let i = startPos; i < line.length; i++) {
    const c = line[i];
    const nextStatesSet = new Set<state_ID>();

    for (let s of states) {
      // Transitions pour le caractère exact
      const charTransitions = nfa.transitions[s]?.[c] || [];
      charTransitions.forEach((st) => nextStatesSet.add(st));

      // Transitions pour DOT (correspond à n'importe quel caractère)
      const dotTransitions = nfa.transitions[s]?.[DOT] || [];
      dotTransitions.forEach((st) => nextStatesSet.add(st));
    }

    // Appliquer la fermeture epsilon
    states = epsilonClosure(nfa, Array.from(nextStatesSet));

    // Si aucun état n'est accessible, arrêter
    if (states.length === 0) {
      break;
    }

    // Vérifier si on est dans un état acceptant
    if (states.some((s) => nfa.accepts.includes(s))) {
      lastAcceptPos = i + 1; // Position après le dernier caractère matché
    }
  }

  // Si on a trouvé au moins un état acceptant
  if (lastAcceptPos > startPos) {
    return {
      start: startPos,
      end: lastAcceptPos,
      text: line.substring(startPos, lastAcceptPos),
    };
  }

  // Cas spécial : regex qui matche la chaîne vide
  if (lastAcceptPos === startPos) {
    return {
      start: startPos,
      end: startPos,
      text: "",
    };
  }

  return null;
}

/**
 * Trouve toutes les occurrences d'un DFA dans une ligne
 *
 * @param dfa Le DFA représentant le motif
 * @param line La ligne dans laquelle chercher
 * @returns Un tableau de matches trouvés
 */
export function findAllMatchesDfa(dfa: DFA, line: string): Match[] {
  const matches: Match[] = [];

  // Essayer de matcher à chaque position de la ligne
  for (let startPos = 0; startPos < line.length; startPos++) {
    // Essayer de trouver le plus long match à partir de cette position
    const match = findLongestMatchDfa(dfa, line, startPos);

    if (match) {
      matches.push(match);
      // Sauter après ce match pour éviter les chevauchements
      // Si le match est vide (start == end), avancer d'au moins 1 pour éviter une boucle infinie
      if (match.end === match.start) {
        // Match vide, continuer à la position suivante
        // startPos sera incrémenté par la boucle
      } else {
        startPos = match.end - 1; // -1 car la boucle va incrémenter
      }
    }
  }

  return matches;
}

/**
 * Trouve le plus long match d'un DFA à partir d'une position donnée
 *
 * @param dfa Le DFA représentant le motif
 * @param line La ligne dans laquelle chercher
 * @param startPos La position de départ
 * @returns Le match trouvé, ou null
 */
function findLongestMatchDfa(
  dfa: DFA,
  line: string,
  startPos: number
): Match | null {
  let state = dfa.start;
  let lastAcceptPos = -1;

  // Vérifier si l'état initial est acceptant
  if (dfa.accepts.includes(state)) {
    lastAcceptPos = startPos;
  }

  for (let i = startPos; i < line.length; i++) {
    const c = line[i];
    const next = dfa.transitions[state]?.[c] ?? dfa.transitions[state]?.[DOT];

    if (next === undefined) {
      break;
    }

    state = next;

    // Vérifier si on est dans un état acceptant
    if (dfa.accepts.includes(state)) {
      lastAcceptPos = i + 1;
    }
  }

  // Si on a trouvé au moins un état acceptant
  if (lastAcceptPos > startPos) {
    return {
      start: startPos,
      end: lastAcceptPos,
      text: line.substring(startPos, lastAcceptPos),
    };
  }

  // Cas spécial : regex qui matche la chaîne vide
  if (lastAcceptPos === startPos) {
    return {
      start: startPos,
      end: startPos,
      text: "",
    };
  }

  return null;
}

/**
 * Trouve toutes les occurrences d'un littéral avec KMP
 *
 * @param literal Le littéral à rechercher
 * @param line La ligne dans laquelle chercher
 * @returns Un tableau de matches trouvés
 */
export function findAllMatchesLiteralKmp(
  literal: string,
  line: string
): Match[] {
  const positions = kmpSearch(literal, line);
  return positions.map((pos) => ({
    start: pos,
    end: pos + literal.length,
    text: literal,
  }));
}

/**
 * Trouve toutes les occurrences d'un littéral avec Boyer-Moore
 *
 * @param literal Le littéral à rechercher
 * @param line La ligne dans laquelle chercher
 * @returns Un tableau de matches trouvés
 */
export function findAllMatchesLiteralBm(
  literal: string,
  line: string
): Match[] {
  const positions = boyerMooreSearch(line, literal);
  return positions.map((pos) => ({
    start: pos,
    end: pos + literal.length,
    text: literal,
  }));
}

/**
 * Colore les matches dans une ligne (pour l'option --color)
 *
 * @param line La ligne originale
 * @param matches Les matches trouvés
 * @param colorStart Code ANSI pour démarrer la couleur (ex: '\x1b[31m' pour rouge)
 * @param colorEnd Code ANSI pour terminer la couleur (ex: '\x1b[0m' pour reset)
 * @returns La ligne avec les matches colorés
 */
export function colorizeMatches(
  line: string,
  matches: Match[],
  colorStart: string = "\x1b[31m\x1b[1m", // Rouge gras par défaut
  colorEnd: string = "\x1b[0m" // Reset
): string {
  if (matches.length === 0) {
    return line;
  }

  let result = "";
  let lastPos = 0;

  for (const match of matches) {
    // Ajouter le texte avant le match
    result += line.substring(lastPos, match.start);
    // Ajouter le match coloré
    result += colorStart + match.text + colorEnd;
    lastPos = match.end;
  }

  // Ajouter le reste de la ligne
  result += line.substring(lastPos);

  return result;
}
