# Projets DAAR

## Arborescence du projet

- `lib` : Bibliothèque de fonctions communes
- `Frontend` : Frontend React avec TanStack Router
- `Backend` : Backend non réalisé
- `cli` : CLI pour tester le projet
- `report` : Rapports des projets

## Projet 1: egrep

### Lancer le projet

Plusieurs manières se portent à vous:

- Si le binaire est déjà existant (notamment si c'est le .zip de rendu de projet), il suffit de lancer `./egrep` ou `node ./egrep` suivi des arguments.

(Notez que `./egrep` est juste est symbolique vers `cli/dist/index.cjs`.)

Sinon, dans un premier temps penser à installer les dépendances avec `pnpm install`, puis de lancer `pnpm build` pour compiler le projet. Le binaire sera alors disponible à `cli/dist/index.cjs`.

Vous avez aussi plusieurs autres options mais qui nécessitent d'avoir build le projet `lib`:

- Dans le root du projet, lancer `pnpm cli` pour lancer la CLI.
- Depuis le dossier `cli`, lancer `pnpm start` pour lancer la CLI.

### Utilisation

- `./egrep --help` pour plus d'informations sur les options.
- `./egrep "test" file.txt` pour rechercher le motif "test" dans le fichier `file.txt`.
- `./egrep "test" file.txt --color -n -p -i` pour activer la coloration, le numéro de ligne, les métriques de performance et l'ignorance de la casse.
- `./egrep "test" file.txt -O nfa` pour forcer l'utilisation d'un NFA (Non-deterministic Finite Automaton). Voir `./egrep --help` pour plus d'options.
- `./egrep --test-all --test-folder ./data` pour lancer les tests de performance sur plusieurs motifs, fichiers et algorithmes.


### Architecture du projet

Le projet est structuré en monorepo. Chaque dossier (`lib`, `cli`) est un package npm quasi-indépendant. Ce choix a été fait pour faciliter le développement et le déploiement des différents composants du projet notamment que la `lib` sera utilisée par la CLI et la future backend.

- `lib` contient les fonctions communes utilisées par la CLI et la future backend. Notamment tout ce qui concernce les algorithmes de recherche de motifs.
  - `lib/test` contient les tests unitaires de la bibliothèque.
  - `lib/dist` contient le code compilé de la bibliothèque.
  - `lib/src` contient le code source de la CLI.
    - `lib/src/index.ts` est le point d'entrée de la bibliothèque, contient notamment les exports de tous les modules et quelques fonctions utilitaires (dont KMP)
    - `AhoCorasick.ts` implémente l'algorithme d'Aho-Corasick pour la recherche multi-motifs
    - `BoyerMoore.ts` implémente l'algorithme de Boyer-Moore pour la recherche de motifs
    - `AlgorithmSelector.ts` analyse le motif et choisit l'algorithme le plus adapté

- `cli` contient la CLI pour tester le projet. Il s'agit d'un simple wrapper autour des fonctions de `lib` avec une interface utilisateur.



