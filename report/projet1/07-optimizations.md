# 3. Stratégies d'Optimisation

Au-delà de l'implémentation classique des automates, nous avons développé plusieurs optimisations inspirées des moteurs de recherche modernes comme GNU `grep`. Ces optimisations permettent d'améliorer significativement les performances pour de nombreux cas d'usage.

## 3.1 Extraction de Littéraux et Préfiltrage

L'idée centrale du préfiltrage est d'extraire les segments littéraux (chaînes fixes) d'un pattern regex et de les utiliser (avec les algorithmes de recherche de sous-chaîne) pour éliminer rapidement les lignes qui ne peuvent pas matcher, avant d'appliquer le matching regex complet.

Exemple : Pour le pattern `.*hello.*world.*`, on extrait les littéraux `["hello", "world"]`. Une ligne ne peut matcher que si elle contient à la fois "hello" et "world". On peut donc utiliser Boyer-Moore ou Aho-Corasick pour filtrer rapidement les lignes candidates.

Une fois les littéraux extraits, si nous avons un seul littéral, on utilise Boyer-Moore. Sinon, si nous avons plusieurs littéraux, on utilise Aho-Corasick.

Le préfiltrage est d'abords appliqué sur les chunks de texte, avant de découper les lignes. Cela évite de découper inutilement les lignes qui ne contiennent pas le motif recherché.

## 3.2 Sélection Automatique d'Algorithme

Nous analysons automatiquement le pattern pour choisir l'algorithme optimal. L'analyse calcule plusieurs métriques notamment les types de sous-expressions, la longueur des littéraux, et la complexité globale du pattern.

- Si le pattern est une alternation pure de littéraux (ex: "from|what|who"), on utilise Aho-Corasick. 
- Si le pattern est un simple littéral (ex: "hello"), on utilise KMP si le littéral est court (moins de 10 caractères) et Boyer-Moore sinon. (Boyer Moore est plus rapide en pratique pour les motifs longs, mais KMP offre une garantie de complexité linéaire)
- Si le pattern est très simple (peu de wildcards/alternations) mais pas un littéral pur, on utilise DFA.
- Si le pattern est un peu plus complexe (un peu d'alternations mais pas énormément), on utilise DFA minimisé.
- Si le pattern est complexe (beaucoup d'alternations/étoiles), on utilise NFA.

## 3.3 Lecture par Chunks

Pour les fichiers volumineux (plusieurs GB), charger tout le fichier en mémoire est inefficace. Nous utilisons une lecture par chunks (blocs de 64 KB par défaut).
