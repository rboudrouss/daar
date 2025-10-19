## 2.3 Algorithmes de Recherche Littérale

Lorsque le pattern regex est réduit à une simple chaîne de caractères (sans opérateurs `*`, `|`, `.`), il est inefficace de construire un automate complet. Nous utilisons alors des algorithmes de recherche de sous-chaîne optimisés.

### 2.3.1 Knuth-Morris-Pratt (KMP)

L'algorithme KMP permet de rechercher un motif dans un texte en temps linéaire garanti $O(n + m)$ où $n$ est la longueur du texte et $m$ la longueur du motif.

KMP évite de revenir en arrière dans le texte en utilisant une table de préfixes (LPS - Longest Prefix Suffix) qui indique, pour chaque position du motif, la longueur du plus long préfixe qui est aussi un suffixe.

La complexité temporelle se divise en 2 composantes, une pour la phase de prétraitement du motif en $O(m)$ et une pour la phase de recherche dans le texte en $O(n)$ ce qui nous donne une complexité globale de $O(n + m)$.

### 2.3.2 Boyer-Moore

L'algorithme de Boyer-Moore est souvent plus rapide que KMP en pratique, notamment pour les motifs longs, car il peut sauter plusieurs caractères à la fois. L'algorithme parcourt le texte de gauche à droite mais compare le motif de droite à gauche.

L'algorithme utilise deux tables précalculées :

- Une table des mauvais caractères qui indique, pour chaque caractère du motif, la dernière position à laquelle il apparaît. Cela permet de décaler le motif de manière à aligner le mauvais caractère avec sa dernière occurrence dans le motif.
- Une table des bons suffixes qui indique, pour chaque suffixe du motif, le décalage à effectuer lorsque ce suffixe correspond. Cela permet de décaler le motif de manière à aligner le suffixe correspondant avec son occurrence la plus à droite dans le motif.

L'implémentation se trouve dans le fichier `lib/src/BoyerMoore.ts`.

La complexité spatiale est en $O(m)$ pour les deux tables précalculées avec $m$ la longueur du motif.

La complexité temporelle est plus difficile à estimer car elle dépend de la distribution des caractères dans le texte. En moyenne, on obtient $O(n / m)$ mais dans le pire cas, on peut avoir $O(n \times m)$ avec $n$ le nombre de caractères dans le texte et $m$ la longueur du motif.
