/**
 * Module pour la simulation d'un NFA avec construction de DFA à la volée (on-the-fly)
 * 
 * Cette approche combine les avantages du NFA (pas de construction préalable coûteuse)
 * et du DFA (exécution rapide) en construisant le DFA de manière paresseuse pendant
 * la simulation, similaire à l'approche utilisée par grep.
 * 
 * L'idée est de mémoriser les ensembles d'états NFA visités et leurs transitions
 * pour éviter de recalculer les fermetures epsilon à chaque fois.
 */

import { NFA, DOT, epsilonClosure, state_ID } from "./utils";
import { Match } from "./Matcher";

/**
 * Cache pour stocker les états DFA construits à la volée
 * Chaque état DFA correspond à un ensemble d'états NFA
 */
interface DFACacheState {
  /** Ensemble d'états NFA représenté par cet état DFA */
  nfaStates: state_ID[];
  /** Est-ce un état acceptant ? */
  isAccepting: boolean;
  /** Transitions depuis cet état (symbole -> état DFA suivant) */
  transitions: Map<string, number>;
}

/**
 * Cache DFA construit à la volée pendant la simulation NFA
 */
class LazyDFACache {
  /** Map des ensembles d'états NFA vers leur ID dans le cache */
  private stateMap: Map<string, number> = new Map();
  /** États DFA construits */
  private states: DFACacheState[] = [];
  /** Prochain ID d'état disponible */
  private nextStateId: number = 0;
  /** Référence au NFA original */
  private nfa: NFA;

  constructor(nfa: NFA) {
    this.nfa = nfa;
  }

  /**
   * Obtient ou crée un état DFA pour un ensemble d'états NFA donné
   * @param nfaStates Ensemble d'états NFA (doit être trié)
   * @returns L'ID de l'état DFA correspondant
   */
  getOrCreateState(nfaStates: state_ID[]): number {
    // Créer une clé unique pour cet ensemble d'états
    const stateKey = JSON.stringify(nfaStates);

    // Vérifier si cet état existe déjà
    const existingId = this.stateMap.get(stateKey);
    if (existingId !== undefined) {
      return existingId;
    }

    // Créer un nouvel état DFA
    const newId = this.nextStateId++;
    const isAccepting = nfaStates.some((s) => this.nfa.accepts.includes(s));

    const newState: DFACacheState = {
      nfaStates,
      isAccepting,
      transitions: new Map(),
    };

    this.states[newId] = newState;
    this.stateMap.set(stateKey, newId);

    return newId;
  }

  /**
   * Obtient un état DFA par son ID
   */
  getState(stateId: number): DFACacheState | undefined {
    return this.states[stateId];
  }

  /**
   * Calcule la transition depuis un état DFA pour un symbole donné
   * @param stateId ID de l'état DFA source
   * @param symbol Symbole de transition
   * @returns ID de l'état DFA cible, ou undefined si pas de transition
   */
  computeTransition(stateId: number, symbol: string): number | undefined {
    const state = this.states[stateId];
    if (!state) return undefined;

    // Vérifier si la transition est déjà dans le cache
    const cached = state.transitions.get(symbol);
    if (cached !== undefined) {
      return cached;
    }

    // Calculer la transition en simulant le NFA
    const nextStatesSet = new Set<state_ID>();

    for (const nfaState of state.nfaStates) {
      // Transitions pour le caractère exact
      const charTransitions = this.nfa.transitions[nfaState]?.[symbol] || [];
      charTransitions.forEach((st) => nextStatesSet.add(st));

      // Transitions pour DOT (correspond à n'importe quel caractère)
      const dotTransitions = this.nfa.transitions[nfaState]?.[DOT] || [];
      dotTransitions.forEach((st) => nextStatesSet.add(st));
    }

    // Si aucune transition n'est possible, retourner undefined
    if (nextStatesSet.size === 0) {
      return undefined;
    }

    // Appliquer la fermeture epsilon
    const nextStates = epsilonClosure(this.nfa, Array.from(nextStatesSet));

    // Créer ou récupérer l'état DFA correspondant
    const nextStateId = this.getOrCreateState(nextStates);

    // Mettre en cache la transition
    state.transitions.set(symbol, nextStateId);

    return nextStateId;
  }

  /**
   * Obtient des statistiques sur le cache
   */
  getStats() {
    return {
      statesCreated: this.states.length,
      totalTransitions: this.states.reduce(
        (sum, state) => sum + state.transitions.size,
        0
      ),
    };
  }

  /**
   * Réinitialise le cache
   */
  clear() {
    this.stateMap.clear();
    this.states = [];
    this.nextStateId = 0;
  }
}

/**
 * Trouve toutes les occurrences d'un NFA dans une ligne en utilisant
 * la construction de DFA à la volée
 *
 * @param nfa Le NFA représentant le motif
 * @param line La ligne dans laquelle chercher
 * @returns Un tableau de matches trouvés
 */
export function findAllMatchesNfaWithDfaCache(nfa: NFA, line: string): Match[] {
  const matches: Match[] = [];
  const cache = new LazyDFACache(nfa);

  // Essayer de matcher à chaque position de la ligne
  for (let startPos = 0; startPos < line.length; startPos++) {
    // Essayer de trouver le plus long match à partir de cette position
    const match = findLongestMatchWithCache(nfa, line, startPos, cache);

    if (match) {
      matches.push(match);
      // Sauter après ce match pour éviter les chevauchements
      if (match.end === match.start) {
        // Match vide, continuer à la position suivante
      } else {
        startPos = match.end - 1; // -1 car la boucle va incrémenter
      }
    }
  }

  return matches;
}

/**
 * Trouve le plus long match d'un NFA à partir d'une position donnée
 * en utilisant le cache DFA
 *
 * @param nfa Le NFA représentant le motif
 * @param line La ligne dans laquelle chercher
 * @param startPos La position de départ
 * @param cache Le cache DFA à utiliser
 * @returns Le match trouvé, ou null
 */
function findLongestMatchWithCache(
  nfa: NFA,
  line: string,
  startPos: number,
  cache: LazyDFACache
): Match | null {
  // Commencer avec l'état initial du DFA
  const initialNfaStates = epsilonClosure(nfa, [nfa.start]);
  let currentStateId = cache.getOrCreateState(initialNfaStates);
  let lastAcceptPos = -1;

  // Vérifier si l'état initial est acceptant
  const initialState = cache.getState(currentStateId);
  if (initialState?.isAccepting) {
    lastAcceptPos = startPos;
  }

  // Parcourir la ligne caractère par caractère
  for (let i = startPos; i < line.length; i++) {
    const c = line[i];

    // Calculer la transition (avec mise en cache)
    const nextStateId = cache.computeTransition(currentStateId, c);

    if (nextStateId === undefined) {
      // Pas de transition possible, arrêter
      break;
    }

    currentStateId = nextStateId;

    // Vérifier si on est dans un état acceptant
    const currentState = cache.getState(currentStateId);
    if (currentState?.isAccepting) {
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
 * Vérifie si une chaîne correspond à un motif donné représenté par un NFA
 * en utilisant la construction de DFA à la volée
 *
 * @param nfa le NFA représentant le motif
 * @param input la chaîne de caractères à vérifier
 * @returns true si la chaîne correspond au motif, sinon false
 */
export function matchNfaWithDfaCache(nfa: NFA, input: string): boolean {
  const cache = new LazyDFACache(nfa);

  // Commencer avec l'état initial
  const initialNfaStates = epsilonClosure(nfa, [nfa.start]);
  let currentStateId = cache.getOrCreateState(initialNfaStates);

  // Parcourir l'entrée
  for (const c of input) {
    const nextStateId = cache.computeTransition(currentStateId, c);

    if (nextStateId === undefined) {
      return false;
    }

    currentStateId = nextStateId;
  }

  // Vérifier si l'état final est acceptant
  const finalState = cache.getState(currentStateId);
  return finalState?.isAccepting ?? false;
}

