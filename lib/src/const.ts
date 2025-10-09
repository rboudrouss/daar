// Notez qu'on peut pas utiliser des charactères (string of length 1) car cela pourrait entrer en conflit avec des regex contenant ces caractères

// expression dans l'automate pour la valeur de transition '.'
export const DOT = "ANYCHAR";

// expression dans l'automate pour la valeur de transition ε (epsilon).
export const EPSILON = "EPSILON";

// Type pour les IDs d'états dans les automates
export type state_ID = number;