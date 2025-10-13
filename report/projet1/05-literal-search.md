## 2.3 Algorithmes de Recherche Littérale

Lorsque le pattern regex est réduit à une simple chaîne de caractères (sans opérateurs `*`, `|`, `.`), il est inefficace de construire un automate complet. Nous utilisons alors des algorithmes de recherche de sous-chaîne optimisés.

### 2.3.1 Knuth-Morris-Pratt (KMP)

L'algorithme KMP permet de rechercher un motif dans un texte en temps linéaire garanti $O(n + m)$ où $n$ est la longueur du texte et $m$ la longueur du motif.

KMP évite de revenir en arrière dans le texte en utilisant une table de préfixes (LPS - Longest Prefix Suffix) qui indique, pour chaque position du motif, la longueur du plus long préfixe qui est aussi un suffixe.

La complexité temporelle se divise en 2 composantes, une pour la phase de prétraitement du motif en $O(m)$ et une pour la phase de recherche dans le texte en $O(n)$ ce qui nous donne une complexité globale de $O(n + m)$. 

### 2.3.2 Boyer-Moore

L'algorithme de Boyer-Moore est souvent plus rapide que KMP en pratique, notamment pour les motifs longs, car il peut sauter plusieurs caractères à la fois. L'algorithme parcourt le texte de gauche à droite mais compare le motif de droite à gauche. Lorsqu'un mismatch se produit, il utilise des heuristiques pour déterminer de combien décaler le motif.

Notre implémentation utilise uniquement la bad character rule (règle du mauvais caractère) pour simplifier. Le principe étant que si un caractère du texte ne correspond pas au caractère attendu du motif, on peut décaler le motif pour aligner le caractère du texte avec le dernier occurrence du même caractère dans le motif.

La complexité spatiale est en $O(m)$ pour la table des mauvais caractères.

La complexité temporelle est plus difficile à estimer car elle dépend de la distribution des caractères dans le texte. En moyenne, on obtient $O(n / m)$ mais dans le pire cas, on peut avoir $O(n \times m)$ avec $n$ le nombre de caractères dans le texte et $m$ la longueur du motif.

