# 9. Conclusion

## 8.1. Bilan

Ce projet a permis de développer un moteur de recherche complet pour une bibliothèque numérique de plus de 1700 livres. Les principales contributions sont :

**Structures de données** : L'index inversé avec positions permet une recherche efficace et le highlighting des résultats. Le graphe de Jaccard pondéré par IDF capture les relations thématiques entre documents.

**Algorithmes de similarité** : La similarité de Jaccard pondérée par IDF offre une meilleure discrimination que le Jaccard classique. L'algorithme PageRank identifie les documents centraux du corpus.

**Système de scoring** : La combinaison BM25 + PageRank produit des résultats pertinents en équilibrant correspondance textuelle et importance structurelle.

**Fonctionnalités avancées** : La recherche floue (Levenshtein) et le highlighting (Aho-Corasick) améliorent l'expérience utilisateur.

## 8.2. Limitations

Plusieurs limitations ont été identifiées :

- La construction du graphe de Jaccard reste quadratique, limitant le passage à l'échelle
- La recherche regex peut être lente sur des patterns complexes
- Le système ne prend pas en compte la sémantique (synonymes, concepts)

## 8.3. Perspectives

Plusieurs améliorations pourraient être envisagées :

**Passage à l'échelle** : Utilisation de techniques de hachage (MinHash, LSH) pour approximer la similarité Jaccard en temps sous-quadratique.

**Recherche sémantique** : Intégration d'embeddings de mots (Word2Vec, BERT) pour capturer les relations sémantiques.

**Personnalisation** : Adaptation du scoring en fonction du profil utilisateur et de son historique de recherche.

**Indexation incrémentale** : Amélioration de la mise à jour du graphe de Jaccard lors de l'ajout de nouveaux documents.

