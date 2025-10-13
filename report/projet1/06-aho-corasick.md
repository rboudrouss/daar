## 2.4 Aho-Corasick : Recherche Multi-Motifs

L'algorithme d'Aho-Corasick permet de rechercher plusieurs motifs simultanément en un seul passage sur le texte. Il est particulièrement utile pour les patterns regex de type alternation de littéraux (ex: `from|what|who`).

### 2.4.1 Principe

Aho-Corasick combine deux structures de données :

1. Un trie : arbre préfixe contenant tous les motifs à rechercher
2. Des liens de failure : permettent de passer efficacement d'un motif à un autre lors d'un mismatch

Au lieu de recommencer la recherche depuis le début après un mismatch, les liens de failure permettent de "sauter" vers le plus long suffixe du chemin courant qui est aussi un préfixe d'un motif.

### 2.4.2 Structure de Données

Chaque nœud du trie contient :

```typescript
interface TrieNode {
  children: Map<char, TrieNode>;  // Transitions vers les enfants
  failure: TrieNode | null;        // Lien de failure
  output: number[];                // Indices des motifs qui se terminent ici
}
```

**Exemple** : Pour les motifs `["he", "she", "his", "hers"]`, le trie est :

```
        root
       /    \
      h      s
     / \      \
    e   i      h
   /     \      \
  r       s      e
 /                \
s                  r
                    \
                     s
```
### 2.4.3 Complexité

La complexité de la contruction du trie est $O(\sum_{i=1}^{k} |p_i|)$ où $k$ est le nombre de motifs et $|p_i|$ la longueur du motif $i$.

La complexité de la construction des liens de failure est aussi $O(\sum_{i=1}^{k} |p_i|)$. Car chaque caractère est visité une fois.

La complexité de la recherche est $O(n + z)$ où $n$ est la longueur du texte et $z$ le nombre total de matches trouvés.
