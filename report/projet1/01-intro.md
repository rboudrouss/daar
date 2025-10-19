# 1. Introduction

## 1.1. Contexte

Ce projet vise à développer un clone fonctionnel de `egrep` supportant un sous-ensemble de la norme ERE POSIX. Les opérateurs implémentés sont :

- Les parenthèses pour le groupement
- L'alternation (`|`) pour le choix entre motifs
- La concaténation de motifs
- L'étoile de Kleene (`*`) pour la répétition
- Le point (`.`) comme caractère universel
- Les caractères ASCII littéraux

L'approche classique décrite par Aho et Ullman dans *Foundations of Computer Science* consiste à :

1. Parser l'expression régulière en un arbre syntaxique
2. Construire un automate fini non-déterministe (NFA) avec $\epsilon$-transitions
3. Convertir le NFA en automate fini déterministe (DFA) par la méthode des sous-ensembles
4. Minimiser le DFA pour réduire le nombre d'états
5. Utiliser l'automate pour matcher les lignes du fichier

## 1.2. Démarche

En étudiant l'implémentation de grep, nous avons remarqué que GNU grep utilise une approche similaire mais avec plusieurs optimisations supplémentaires.
Notamment :

- Un préfiltrage des lignes candidates avant le matching regex complet (quand c'est pertinent)
- Une lecture par chunks pour gérer efficacement les fichiers volumineux
- Une sélection automatique des algorithmes les plus adaptés en fonction de la complexité du pattern et de la taille du texte

Nous avons donc décidé d'implémenter des optimisations supplémentaires dans notre projet. Voici dans un premier temps les algorithmes de recherche de motifs littéraux implémentés :

- Knuth-Morris-Pratt (KMP) : recherche linéaire garantie O(n+m) pour les motifs courts
- Boyer-Moore : recherche optimisée pour les motifs longs avec heuristique du mauvais caractère
- Aho-Corasick : recherche multi-motifs pour les alternations de littéraux

Puis nous avons implémenté les automates finis :

- NFA : automate fini non-déterministe avec $\epsilon$-transitions
   - Construit à partir de l'arbre syntaxique par la méthode de Thompson
- DFA : automate fini déterministe obtenu par la méthode des sous-ensembles
   - Construit à partir du NFA par la méthode des sous-ensembles
- Min-DFA : automate fini déterministe minimisé pour réduire la mémoire
   - Construit à partir du DFA par l'algorithme de partitionnement
- NFA+DFA-cache : simulation de l'NFA avec construction de DFA à la volée

Enfin, nous avons implémenté un préfiltrage des lignes candidates avant le matching regex complet, en utilisant KMP, Boyer-Moore ou Aho-Corasick en extractant les littéraux du pattern.

Dans ce rapport, nous discuterons des algorithmes implémentés, de leurs performances respectives, et des situations dans lesquelles ils sont les plus pertinents dans le cadre d'un outil de recherche de motifs tel que `egrep`.

## 1.3. Architecture Technique

L'implémentation est réalisée en TypeScript dans une architecture monorepo comprenant :

- `lib` : bibliothèque core contenant tous les algorithmes (NFA, DFA, KMP, Boyer-Moore, Aho-Corasick, préfiltrage)
- `cli` : interface en ligne de commande compatible avec `egrep`

Le projet inclut une suite de tests exhaustive (Vitest) et des benchmarks de performance sur des corpus du projet Gutenberg.

Le choix de TypeScript a été fait pour son coté fonctionnel et son typage statique, mais aussi pour sa rapidité d'exécution après transpilation en JavaScript.

Pour savoir comment lancer le projet, voir le fichier `README.md` à la racine du projet.

## 1.4. Organisation du Rapport

Ce rapport présente d'abord les fondements théoriques des algorithmes implémentés (Section 2), puis détaille les stratégies d'optimisation développées (Section 3). L'implémentation est exposée en Section 4, suivie d'une analyse de performance comparative (Section 5). Nous concluons par une discussion des résultats et des perspectives d'amélioration (Section 6).
