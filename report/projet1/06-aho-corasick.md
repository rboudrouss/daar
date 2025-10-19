## 2.4 Aho-Corasick : Recherche Multi-Motifs

L'algorithme d'Aho-Corasick permet de rechercher plusieurs motifs simultanément en un seul passage sur le texte. Il est particulièrement utile pour les patterns regex de type alternation de littéraux (ex: `from|what|who`).

### 2.4.1 Principe

Aho-Corasick combine deux structures de données :

1. Un trie : arbre préfixe contenant tous les motifs à rechercher
2. Des liens de failure : permettent de passer efficacement d'un motif à un autre lors d'un mismatch

Au lieu de recommencer la recherche depuis le début après un mismatch, les liens de failure permettent de sauter vers le plus long suffixe du chemin courant qui est aussi un préfixe d'un motif.

### 2.4.2 Structure de Données

Chaque nœud du trie contient :

```typescript
interface TrieNode {
  children: Map<char, TrieNode>;  // Transitions vers les enfants
  failure: TrieNode | null;        // Lien de failure
  output: number[];                // Indices des motifs qui se terminent ici
}
```

L'implémentation se trouve dans le fichier `lib/src/AhoCorasick.ts`.

### 2.4.3 Construction des Liens de Failure

La construction des liens de failure se fait en BFS (parcours en largeur) après avoir construit le trie.

L'algorithme initialise les enfants directs de la racine avec un lien de failure vers la racine. Ensuite, pour chaque nœud en BFS, on cherche le lien de failure de ses enfants en remontant les liens de failure du nœud courant jusqu'à trouver un ancêtre qui a une transition par le même caractère.

Pour les motifs `["he", "she"]`, le nœud correspondant à "she" aura un lien de failure vers le nœud "he", car "he" est le plus long suffixe de "she" qui est aussi un préfixe d'un motif. Cela permet de détecter "he" même si on était en train de chercher "she".

Un aspect important est l'héritage des outputs : lorsqu'un nœud a un lien de failure vers un nœud final, il hérite de ses outputs. Cela permet de détecter tous les motifs qui se terminent à une position donnée, y compris ceux qui sont des suffixes du motif principal.

### 2.4.4 Matching avec Aho-Corasick

Lors de la recherche dans le texte, les liens de failure permettent de ne jamais revenir en arrière dans le texte. Pour chaque caractère, si aucune transition n'est possible depuis le nœud courant, on suit les liens de failure jusqu'à trouver un nœud qui a une transition pour ce caractère, ou jusqu'à revenir à la racine.

À chaque position, on vérifie si le nœud courant contient des outputs, ce qui indique qu'un ou plusieurs motifs se terminent à cette position.

### 2.4.5 Complexité

La complexité de la construction du trie est $O(\sum_{i=1}^{k} |p_i|)$ où $k$ est le nombre de motifs et $|p_i|$ la longueur du motif $i$.

La complexité de la construction des liens de failure est aussi $O(\sum_{i=1}^{k} |p_i|)$. Chaque nœud est visité une fois en BFS, et pour chaque nœud, on remonte au plus $|p_i|$ liens de failure.

La complexité de la recherche est $O(n + z)$ où $n$ est la longueur du texte et $z$ le nombre total de matches trouvés. Le parcours du texte est linéaire, et les liens de failure peuvent être suivis plusieurs fois, mais le nombre total de suivis est borné par $n$ (analyse amortie).
