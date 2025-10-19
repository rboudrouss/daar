import { DOT, EPSILON, epsilonClosure, type NFA, type state_ID } from "./utils";
import { SyntaxTree } from "./RegexParser";

/**
 * Construction d'un NFA à partir d'un arbre syntaxique représentant une expression régulière
 *
 * @param tree l'arbre syntaxique représentant l'expression régulière
 * @returns un NFA construit à partir de l'arbre syntaxique
 */
export function nfaFromSyntaxTree(tree: SyntaxTree): NFA {
  let stateId = 0;
  /**
   * Génère un nouvel identifiant d'état unique
   * @returns Un nouvel identifiant d'état unique
   */
  function newState() {
    return stateId++;
  }

  /**
   * Construit récursivement un NFA à partir d'un noeud de l'arbre syntaxique
   * Cette fonction implémente les constructions de Thompson pour chaque opérateur
   *
   * @param t - Le noeud de l'arbre syntaxique à traiter
   * @returns Un objet contenant :
   *          - start: l'état initial du fragment
   *          - end: l'état final du fragment
   *          - nfa: le fragment d'NFA construit
   * @throws {Error} Si le type de noeud n'est pas reconnu
   */
  function build(t: SyntaxTree): { start: state_ID; end: state_ID; nfa: NFA } {
    // Si c'est un charactère, nous créeons un état initial, un état final et une transition entre eux avec le symbole correspondant
    if (t.type === "char") {
      const s = newState(),
        e = newState();
      return {
        start: s,
        end: e,
        nfa: {
          states: [s, e],
          transitions: { [s]: { [t.value || EPSILON]: [e] } }, // Handle empty char as EPSILON
          start: s,
          accepts: [e],
        },
      };
    }

    // Un peu similaire au cas d'un charactère, mais avec le symbole DOT
    if (t.type === "dot") {
      const s = newState(),
        e = newState();
      return {
        start: s,
        end: e,
        nfa: {
          states: [s, e],
          transitions: { [s]: { [DOT]: [e] } },
          start: s,
          accepts: [e],
        },
      };
    }

    // Pour le cas de l'étoile, nous créons un état initial et un état final
    // Nous ajoutons donc 4 transitions supplémentaires
    // - À l'état initial, une transition epsilon vers l'état final et vers l'état initial du fils
    // - À l'état final du fils, une transition epsilon vers l'état initial du fils et vers l'état final 
    if (t.type === "star") {
      const s = newState(),
        e = newState();
      const child = build(t.child);
      return {
        start: s,
        end: e,
        nfa: {
          states: [s, e, ...child.nfa.states],
          transitions: {
            [s]: { [EPSILON]: [child.start, e] },
            [child.end]: { [EPSILON]: [child.start, e] },
            ...child.nfa.transitions,
          },
          start: s,
          accepts: [e],
        },
      };
    }

    // Pour la concaténation, nous créons une transition epsilon entre l'état final du fils gauche et l'état initial du fils droit
    if (t.type === "concat") {
      const left = build(t.left);
      const right = build(t.right);
      return {
        start: left.start,
        end: right.end,
        nfa: {
          states: [...left.nfa.states, ...right.nfa.states],
          transitions: {
            ...left.nfa.transitions,
            ...right.nfa.transitions,
            [left.end]: { [EPSILON]: [right.start] },
          },
          start: left.start,
          accepts: [right.end],
        },
      };
    }

    // Pour l'alternation, nous créons un état initial et un état final
    // Nous ajoutons 4 transitions supplémentaires
    // - À l'état initial, une transition epsilon vers l'état initial du fils gauche et vers l'état initial du fils droit
    // - À l'état final du fils gauche, une transition epsilon vers l'état final
    // - À l'état final du fils droit, une transition epsilon vers l'état final
    if (t.type === "alt") {
      const s = newState(),
        e = newState();
      const left = build(t.left);
      const right = build(t.right);
      return {
        start: s,
        end: e,
        nfa: {
          states: [s, e, ...left.nfa.states, ...right.nfa.states],
          transitions: {
            [s]: { [EPSILON]: [left.start, right.start] },
            [left.end]: { [EPSILON]: [e] },
            [right.end]: { [EPSILON]: [e] },
            ...left.nfa.transitions,
            ...right.nfa.transitions,
          },
          start: s,
          accepts: [e],
        },
      };
    }
    throw new Error("Type de noeud inconnu");
  }
  const result = build(tree);
  return result.nfa;
}

/**
 * Vérifie si une chaîne de caractères correspond à un motif donné représenté par un NFA
 *
 * @param nfa le NFA représentant le motif
 * @param input la chaîne de caractères à vérifier
 * @returns true si la chaîne correspond au motif représenté par le NFA, sinon false
 */
export function matchNfa(nfa: NFA, input: string): boolean {
  // Commencer avec la fermeture epsilon de l'état initial
  let states = epsilonClosure(nfa, [nfa.start]);

  for (let c of input) {
    const nextStatesSet = new Set<state_ID>();

    for (let s of states) {
      // Si on est dans un état acceptant et qu'on a une transition EPSILON ou DOT vers lui-même, on accepte immédiatement
      if (
        nfa.accepts.includes(s) &&
        (nfa.transitions[s]?.[EPSILON].includes(s) ||
          nfa.transitions[s]?.[DOT].includes(s))
      ) {
        return true;
      }

      // Transitions pour le caractère exact
      const charTransitions = nfa.transitions[s]?.[c] || [];
      charTransitions.forEach((st) => nextStatesSet.add(st));

      // Transitions pour DOT (correspond à n'importe quel caractère)
      const dotTransitions = nfa.transitions[s]?.[DOT] || [];
      dotTransitions.forEach((st) => nextStatesSet.add(st));
    }

    // Appliquer la fermeture epsilon après chaque transition
    states = epsilonClosure(nfa, Array.from(nextStatesSet));

    // Si aucun état n'est accessible, la correspondance échoue
    if (states.length === 0) {
      return false;
    }
  }

  // Vérifier si au moins un des états finaux est un état acceptant
  return states.some((s) => nfa.accepts.includes(s));
}
