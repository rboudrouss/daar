# 3. Similarité de Jaccard

## 3.1. Définition

### 3.1.1. Jaccard Classique

L'indice de Jaccard mesure la similarité entre deux ensembles. Pour deux documents $A$ et $B$ représentés par leurs ensembles de termes :

$$J(A, B) = \frac{|A \cap B|}{|A \cup B|}$$

Cette mesure est comprise entre 0 (aucun terme commun) et 1 (ensembles identiques).

### 3.1.2. Jaccard Pondéré par IDF

Le Jaccard classique traite tous les termes de manière égale. Or, les termes rares sont plus discriminants que les termes fréquents. Nous utilisons donc une version pondérée par l'IDF :

$$J_{IDF}(A, B) = \frac{\sum_{t \in A \cap B} IDF(t)}{\sum_{t \in A \cup B} IDF(t)}$$

où $IDF(t) = \log(N / df(t))$.

Cette pondération favorise les documents partageant des termes rares, qui sont généralement plus significatifs pour déterminer la similarité thématique.

## 3.2. Construction du Graphe

### 3.2.1. Algorithme

La construction naïve du graphe de Jaccard a une complexité $O(n^2)$ comparaisons. Pour un corpus de 1664 livres, cela représente environ 1,4 million de paires à évaluer.

Nous appliquons plusieurs optimisations pour réduire ce coût :

1. **Filtrage des termes trop fréquents** : les termes présents dans plus de 70% des documents sont ignorés (stop words dynamiques)

2. **Minimum de termes partagés** : seules les paires ayant au moins 5 termes communs sont considérées

3. **Pré-calcul des candidats** : une requête SQL identifie les paires potentiellement similaires avant le calcul exact

### 3.2.2. Pseudo-code

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

### 3.2.3. Requête d'Identification des Candidats

```sql
WITH batch_terms AS (
  SELECT term, book_id FROM inverted_index
  WHERE book_id IN (batch_ids)
)
SELECT bt.book_id as book1, i2.book_id as book2, 
       COUNT(*) as shared_terms
FROM batch_terms bt
JOIN term_stats ts ON bt.term = ts.term 
  AND ts.document_frequency <= max_doc_freq
JOIN inverted_index i2 ON bt.term = i2.term 
  AND bt.book_id < i2.book_id
GROUP BY bt.book_id, i2.book_id
HAVING shared_terms >= min_shared_terms
```

## 3.3. Paramètres de Configuration

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `similarityThreshold` | 0.1 | Seuil minimum de similarité |
| `topK` | 50 | Nombre maximum de voisins par livre |
| `maxTermFrequency` | 0.7 | Fréquence maximum d'un terme (70%) |
| `minSharedTerms` | 5 | Minimum de termes partagés |

## 3.4. Complexité

- **Temps** : $O(n \times c \times \bar{t}^2)$ où $n$ est le nombre de livres, $c$ le nombre moyen de candidats par livre, et $\bar{t}$ le nombre moyen de termes par livre
- **Espace** : $O(n \times k)$ arêtes stockées avec le filtre Top-K

## 3.5. Exemple

Considérons trois livres avec les termes suivants (après filtrage des stop words) :

- Livre A : {adventure, treasure, island, pirate}
- Livre B : {adventure, ocean, pirate, ship}
- Livre C : {romance, love, heart, passion}

Les similarités Jaccard classiques sont :
- $J(A, B) = \frac{|\{adventure, pirate\}|}{|\{adventure, treasure, island, pirate, ocean, ship\}|} = \frac{2}{6} \approx 0.33$
- $J(A, C) = 0$
- $J(B, C) = 0$

Avec la pondération IDF, si "adventure" et "pirate" sont des termes rares (IDF élevé), la similarité $J_{IDF}(A, B)$ sera plus élevée, reflétant mieux leur proximité thématique.

