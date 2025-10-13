# 6. Conclusion

## 6.1 Synthèse des Contributions

Ce projet a permis de développer un clone fonctionnel de `egrep` implémentant l'approche classique d'Aho-Ullman (NFA, DFA, minimisation) tout en allant significativement au-delà des exigences initiales.

Nous avons d'abord implémenté la chaîne théorique complète : parser d'expressions régulières avec construction d'AST, construction de NFA par méthode de Thompson, conversion NFA → DFA par méthode des sous-ensembles, et minimisation du DFA par raffinement de partitions.

Au-delà de cette base théorique, nous avons ajouté des algorithmes de recherche littérale spécialisés. Knuth-Morris-Pratt pour les patterns courts (O(n+m)), Boyer-Moore pour les patterns longs (O(n/m) en moyenne), et Aho-Corasick pour la recherche multi-motifs (O(n+z)).

Enfin, plusieurs optimisations avancées ont été développées : extraction automatique de littéraux depuis les regex, préfiltrage des lignes avant matching complet, sélection automatique d'algorithme selon la complexité du pattern, et lecture par chunks pour fichiers volumineux.

## 6.2 Résultats Obtenus

Les benchmarks sur corpus Gutenberg (1 KB à 2 MB) ont validé l'efficacité de notre approche. Pour les patterns littéraux, KMP et Boyer-Moore sont 12 à 59× plus rapides que le NFA. Pour les patterns avec wildcards, le DFA est 2-3× plus rapide que le NFA. Les algorithmes littéraux montrent une croissance linéaire jusqu'à 2 MB, et la sélection automatique fait le choix optimal dans plus de 95% des cas testés.

Nous avons aussi identifié certaines limites. Le NFA souffre d'une consommation mémoire excessive (jusqu'à 12 MB) et de temps prohibitifs (> 600 ms sur 2 MB). Le préfiltrage peut dégrader les performances si le littéral extrait est peu sélectif. Aho-Corasick a un overhead de construction qui n'est pas amorti sur petits textes.

## 6.3 Perspectives d'Amélioration

Plusieurs axes d'amélioration pourraient être explorés pour étendre les capacités de notre implémentation.

Du côté fonctionnel, le support ERE complet nécessiterait d'ajouter les classes de caractères (`[a-z]`), les quantificateurs (`+`, `?`, `{n,m}`), les ancres de début/fin de ligne (`^`, `$`) et les frontières de mots (`\b`). Les backreferences nécessiteraient un moteur différent basé sur le backtracking.

Les performances pourraient être améliorées par plusieurs optimisations algorithmiques. L'algorithme de Hopcroft permettrait une minimisation en O(n log n) au lieu de O(n²), ce qui serait particulièrement utile pour les patterns complexes générant de gros DFA. La construction lazy du DFA ne construirait que les états effectivement visités, réduisant ainsi le coût de construction pour les patterns rarement utilisés. La vectorisation SIMD pourrait accélérer Boyer-Moore et KMP sur les architectures modernes. Enfin, un préfiltrage adaptatif pourrait se désactiver automatiquement s'il s'avère inefficace, évitant ainsi les dégradations observées sur certains patterns.

Pour les fichiers très volumineux, des optimisations système seraient nécessaires notamment la parallélisation permettrait de traiter plusieurs chunks simultanément sur les processeurs multi-cœurs mais aussi une implémentation en langage compilé pour tirer parti de l'architecture moderne.

## 6.4 Conclusion Générale

Ce projet a permis de mettre en pratique les concepts théoriques d'automates finis et d'algorithmique du texte, tout en explorant des optimisations pratiques inspirées de GNU grep.

L'implémentation résultante est fonctionnelle, performante et extensible, avec des performances satisfaisantes pour un clone éducatif de `egrep`. Les benchmarks montrent que notre approche hybride permet d'atteindre des speedups significatifs (jusqu'à 59×) par rapport à une implémentation naïve basée uniquement sur le NFA.

Les perspectives d'amélioration identifiées ouvrent la voie à de futurs travaux, notamment l'extension du support ERE et l'optimisation pour fichiers très volumineux (> 1 GB).
