# Similarité de Jaccard

## Définition

### Jaccard Classique

L'indice de Jaccard mesure la similarité entre deux ensembles. Pour deux documents $A$ et $B$ représentés par leurs ensembles de termes :

$$J(A, B) = \frac{|A \cap B|}{|A \cup B|}$$

Cette mesure est comprise entre 0 (aucun terme commun) et 1 (ensembles identiques).

### Jaccard Pondéré par IDF

Le Jaccard classique traite tous les termes de manière égale. Or, les termes rares sont plus discriminants que les termes fréquents. Nous utilisons donc une version pondérée par l'IDF :

$$J_{IDF}(A, B) = \frac{\sum_{t \in A \cap B} IDF(t)}{\sum_{t \in A \cup B} IDF(t)}$$

où $IDF(t) = \log(N / df(t))$.

Cette pondération favorise les documents partageant des termes rares, qui sont généralement plus significatifs pour déterminer la similarité thématique.

## Construction du Graphe

### Algorithme

La construction naïve du graphe de Jaccard a une complexité $O(n^2)$ comparaisons. Pour un corpus de 1664 livres, cela représente environ 1,4 million de paires à évaluer.

Nous appliquons plusieurs optimisations pour réduire ce coût :

1. **Incrémental** : le graphe est construit progressivement lors de l'ajout de nouveaux livres, en comparant seulement avec les livres existants

2. **Filtrage des termes trop fréquents** : les termes présents dans plus de 70% des documents sont ignorés (stop words dynamiques)

3. **Minimum de termes partagés** : seules les paires ayant au moins 5 termes communs sont considérées

4. **Pré-calcul des candidats** : une requête SQL identifie les paires potentiellement similaires avant le calcul exact. On peut perdre de potentielles paires, mais cela réduit drastiquement le nombre de comparaisons.

Plus on réduit le pourcentage ou on augmente le nombre de termes partagés requis, plus on perd de paires, mais plus on gagne en performance. L'algorithme étant quadratique, il est important de limiter au maximum le nombre de paires à comparer.

### Pseudo-code

```
fonction buildJaccardGraph():
    charger les fréquences documentaires
    pour chaque batch de livres:
        charger les termes avec IDF
        identifier les candidats (termes partagés >= seuil)
        pour chaque paire candidate:
            calculer similarité pondérée IDF
            si similarité >= threshold:
                ajouter à la liste des voisins
    appliquer le filtre Top-K
    insérer les arêtes dans la base
```

## Paramètres de Configuration du calcul de similarité

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `similarityThreshold` | 0.1 | Seuil minimum de similarité |
| `topK` | 50 | Nombre maximum de voisins par livre |
| `maxTermFrequency` | 0.7 | Fréquence maximum d'un terme (70%) |
| `minSharedTerms` | 5 | Minimum de termes partagés |

## Complexité

- **Temps** : $O(n \times c \times \bar{t}^2)$ où $n$ est le nombre de livres, $c$ le nombre moyen de candidats par livre, et $\bar{t}$ le nombre moyen de termes par livre
- **Espace** : $O(n \times k)$ arêtes stockées avec le filtre Top-K
