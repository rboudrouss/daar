# Conclusion

## Bilan

L'implémentation d'un moteur de recherche complet pour une bibliothèque numérique nous a permis d'explorer différentes approches algorithmiques pour la recherche d'information. Au-delà de la construction classique d'un index inversé avec positions, nous avons développé un graphe de similarité de Jaccard pondéré par IDF pour capturer les relations thématiques entre documents, et intégré l'algorithme PageRank pour identifier les ouvrages centraux du corpus.


## Perspectives

Plusieurs limitations ont été identifiées :

- La construction du graphe de Jaccard reste quadratique, limitant le passage à l'échelle
- La recherche regex peut être lente sur des patterns complexes, nécessitant un passage de l'automate sur tout les termes de l'index.

Plusieurs améliorations pourraient être envisagées :

- Utiliser des techniques de hachage (MinHash, LSH) pour approximer la similarité Jaccard en temps sous-quadratique.

- Intégration d'embeddings de mots (Word2Vec, BERT) pour capturer les relations sémantiques.
