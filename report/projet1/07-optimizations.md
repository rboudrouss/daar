# 3. Stratégies d'Optimisation

Au-delà de l'implémentation classique des automates, nous avons développé plusieurs optimisations inspirées des moteurs de recherche modernes comme GNU `grep`. Ces optimisations permettent d'améliorer significativement les performances pour de nombreux cas d'usage.

## 3.1 Lecture par Chunks

Pour les fichiers volumineux (plusieurs GB), charger tout le fichier en mémoire est inefficace. Nous utilisons une lecture par chunks (blocs de 64 KB par défaut).


## 3.2 Extraction de Littéraux et Préfiltrage

L'idée centrale du préfiltrage est d'extraire les segments littéraux (chaînes fixes) d'un pattern regex et de les utiliser (avec les algorithmes de recherche de sous-chaîne) pour éliminer rapidement les lignes qui ne peuvent pas matcher, avant d'appliquer le matching regex complet.

Exemple : Pour le pattern `.*hello.*world.*`, on extrait les littéraux `["hello", "world"]`. Une ligne ne peut matcher que si elle contient à la fois "hello" et "world". On peut donc utiliser Boyer-Moore ou Aho-Corasick pour filtrer rapidement les lignes candidates.

Le préfiltrage est d'abords appliqué sur les chunks de texte, avant de découper les lignes. Cela évite de découper inutilement les lignes qui ne contiennent pas le motif recherché.

## 3.3 Sélection Automatique d'Algorithme

Nous analysons automatiquement le pattern et la taille du texte pour choisir l'algorithme de matching et de préfiltrage optimal. Nous prennons en compte plusieurs métriques notamment les types de sous-expressions, la longueur des littéraux, la complexité globale du pattern, et la taille du texte.

Pour l'algorithme de préfiltrage :
- Si le pattern ne contient pas de littéraux, on désactive le préfiltrage.
- Si le texte à analyser est petit (< 10KB), on désactive le préfiltrage, car l'overhead que cela inclue n'est pas amorti (notamment la construction d'Aho-Corasick ou le fait d'analyser une ligne dans un premier temps avec le préfiltrage puis par la suite avec le matcher regex).
- Si le pattern ne contient pas de sous-expressions (`|`, `*`, `.`), on désactive le préfiltrage. (Car l'algorithme de matching sera probablement ceux utilisés pour les patterns littéraux, qui sont déjà très rapides).
- Si le pattern contient un seul littéral, on utilise Boyer-Moore.
- Si le pattern contient plusieurs littéraux, on utilise Aho-Corasick.

Pour l'algorithme de matching :
- Si le pattern est une alternation pure de littéraux (ex: "from|what|who"), on utilise Aho-Corasick.
- Si le pattern est un simple littéral (ex: "hello"), on utilise KMP si le littéral est court (moins de 10 caractères) et Boyer-Moore sinon. (Boyer Moore est plus rapide en pratique pour les motifs longs, mais KMP offre une garantie de complexité linéaire)
- Si le texte à analyser est très petit (< 500 bytes), on utilise NFA. (Car le coût de construction du DFA n'est pas amorti)
- Si le texte à analyser est petit (500 bytes - 10KB), on utilise un Nfa avec cache DFA (on-the-fly). Cela permet d'éviter la construction coûteuse du DFA tout en bénéficiant de la rapidité de l'exécution DFA.
- Si le pattern n'est pas trop complexe, on utilise un DFA minimisé.
