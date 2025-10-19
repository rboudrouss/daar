## 2.4 Simulation du NFA avec Construction de DFA à la Volée (NFA+DFA-cache)

### 2.4.1 Principe

Comme dit précédement, il y a beaucoup de similarité entre la construction de sous-ensembles et la simulation d'un NFA. En effet, à chaque étape de la simulation, on calcule l'ensemble des états atteignables à partir de l'ensemble courant par une transition marquée par le symbole courant. Cela ressemble beaucoup à la construction d'un état DFA à partir d'un ensemble d'états NFA.

L'idée de l'approche NFA+DFA-cache est de mémoriser les ensembles d'états NFA visités et leurs transitions pour éviter de recalculer les fermetures epsilon à chaque fois. Ainsi, à chaque étape de la simulation, on regarde si l'ensemble d'états courant a déjà été visité. Si c'est le cas, on réutilise l'état DFA correspondant. Sinon, on crée un nouvel état DFA, on calcule ses transitions (en utilisant la fermeture epsilon), et on les mémorise pour les futures étapes.

### 2.4.2 Implémentation

L'implémentation se trouve dans le fichier `lib/src/NFAWithDFACache.ts`. La classe `LazyDFACache` gère le cache et la création des états DFA. Les fonctions `matchNfaWithDfaCache` et `findAllMatchesNfaWithDfaCache` utilisent ce cache pour simuler l'NFA et trouver les correspondances.

