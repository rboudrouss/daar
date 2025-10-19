# Projets DAAR

## Arborescence du projet

- `lib` : Bibliothèque de fonctions communes
- `Frontend` : Frontend React avec TanStack Router
- `Backend` : Backend non réalisé
- `cli` : CLI pour tester le projet
- `report` : Rapports des projets

## Projet 1: egrep

Ce projet nécessite Node.js (testé avec v22.18.0 mais devrait fonctionner avec n'importe quelle version récente) pour fonctionner. Pensez à l'installer avant de continuer.

Pour pouvoir build le projet, vous aurez besoin de pnpm. Vous pouvez l'installer avec `npm install -g pnpm`. (Cela devrait fonctionner avec npm mais ce n'est pas recommandé)

### Lancer le projet

Plusieurs manières se portent à vous:

- Si le binaire est déjà existant (notamment si c'est le .zip de rendu de projet), il suffit de lancer `./egrep` ou `node ./egrep` suivi des arguments.

(Notez que `./egrep` est juste est symbolique vers `cli/dist/index.cjs`.)

Sinon :

- Il faut installer les dépendances avec `pnpm install` dans le root du projet.
- il faut build le dossier lib avec `pnpm build:lib` dans le root du projet ou `pnpm build` depuis le dossier `lib`

Puis toutes ses commandes sont équivalentes:

- Dans le root du projet :
  - `pnpm cli` pour lancer la CLI.
  - `pnpm cli:gc` pour lancer la CLI avec le garbage collector activé (améliore les mesures de mémoire mais ralentit un peu l'exécution).
- Depuis le dossier `cli` :
  - `pnpm start` pour lancer la CLI.

Pour lancer lui build du cli, il suffit de lancer `pnpm build` dans le root du projet ou `pnpm build` depuis le dossier `cli`. Cela crée un fichier js dans `cli/dist/index.cjs`.

Pour lancer les tests, il suffit de lancer `pnpm test` dans le dossier lib.

### Utilisation

Vous pouvez remplacer `./egrep` par votre méthode de lancement. (Notez juste que si vous utilisez `npm` ajouter `--` avant les arguments.)

- `./egrep --help` pour plus d'informations sur les options.
- `./egrep "test" file.txt` pour rechercher le motif "test" dans le fichier `file.txt`.
- `./egrep "test" file.txt --color -n -p -i` pour activer la coloration, le numéro de ligne, les métriques de performance et l'ignorance de la casse.
- `./egrep "test" file.txt -O nfa` pour forcer l'utilisation d'un NFA (Non-deterministic Finite Automaton). Voir `./egrep --help` pour plus d'options.
- `./egrep --test-all --test-file ./data/pg66555-100kb.txt` pour lancer les tests de performance sur plusieurs motifs et algorithmes sur le fichier `./data/pg66555-100kb.txt`.
