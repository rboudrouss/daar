# 4. Implémentation

## 4.1 Interface CLI

Notre implémentation fournit une interface CLI compatible avec `egrep`, permettant de rechercher des motifs dans des fichiers textuels.

**Utilisation de base** :
```bash
./egrep <pattern> <file>
```

**Options principales** :

- `-i, --ignore-case` : Ignorer la casse
- `-n, --line-number` : Afficher les numéros de ligne
- `-v, --invert-match` : Sélectionner les lignes ne correspondant pas
- `-p, --perf` : Afficher les métriques de performance (temps, mémoire)
- `--color` : Colorer les correspondances trouvées
- `-O, --optimize <level>` : Forcer un algorithme spécifique (`auto`, `literal-kmp`, `literal-bm`, `aho-corasick`, `nfa`, `dfa`, `min-dfa`)
- `--no-prefilter` : Désactiver le préfiltrage

**Exemples** :
```bash
# Recherche simple
./egrep "hello" data/pg84.txt

# Avec numéros de ligne et couleur
./egrep -n --color "error" data/log.txt

# Forcer l'utilisation de Boyer-Moore
./egrep -O literal-bm "pattern" data/file.txt

# Afficher les statistiques de performance
./egrep -p "S(a|g|r)+on" data/56667-0.txt
```

## 4.2 Mode de test de performance automatisé

La CLI fournit un mode de test automatisé qui exécute tous les scénarios :

```bash
# Tester tous les algorithmes sur tous les scénarios
./egrep --test-all

# Tester sur un fichier spécifique
./egrep --test-all --test-file data/pg84.txt

# Tester sur tous les fichiers d'un dossier
./egrep --test-all --test-folder data/ # recommandé

# Tester uniquement les automates
./egrep --test-all --test-only-automata

# Tester uniquement les algorithmes littéraux
./egrep --test-all --test-only-literal
```

Ce mode génère automatiquement :
- Des comparaisons entre algorithmes
- Des statistiques de performance (temps, mémoire, nombre de matches)
- Des tableaux récapitulatifs
