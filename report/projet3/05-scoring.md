# Système de Scoring

## Score BM25

Notamment utilisé pour le classement des résultats de la recherche textuelle.

### Définition

BM25 (Best Matching 25) est une fonction de scoring probabiliste issue du modèle de pertinence BM. C'est une évolution du TF-IDF qui intègre une normalisation par la longueur du document et une saturation de la fréquence des termes.

Pour une requête $Q$ composée des termes $q_1, ..., q_n$ et un document $D$ :

$$BM25(D, Q) = \sum_{i=1}^{n} IDF(q_i) \cdot \frac{tf(q_i, D) \cdot (k_1 + 1)}{tf(q_i, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{avgdl}\right)}$$

où :
- $tf(q_i, D)$ est la fréquence du terme $q_i$ dans le document $D$
- $|D|$ est la longueur du document (en mots)
- $avgdl$ est la longueur moyenne des documents du corpus
- $k_1$ et $b$ sont des paramètres de tuning

### Composantes

**IDF (Inverse Document Frequency)** :
$$IDF(t) = \log\left(\frac{N - df(t) + 0.5}{df(t) + 0.5} + 1\right)$$

Cette formule, légèrement différente du IDF classique, évite les valeurs négatives pour les termes très fréquents.

**Saturation TF** : Le terme $(k_1 + 1)$ au numérateur et $k_1$ au dénominateur créent une saturation, augmenter la fréquence d'un terme au-delà d'un certain point a un effet décroissant sur le score.

**Normalisation de longueur** : Le paramètre $b$ contrôle l'impact de la longueur du document. Avec $b = 0$, pas de normalisation ; avec $b = 1$, normalisation complète.

### Paramètres

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| $k_1$ | 1.2 | Saturation de la fréquence |
| $b$ | 0.75 | Normalisation par la longueur |

## Score Hybride (BM25 + PageRank)

Nous combinons le score BM25 avec le score PageRank pour obtenir un score hybride. Cela nous permet d'exploiter à la fois la pertinence textuelle et l'importance structurelle des documents.

$$Score_{hybride} = w_{BM25} \cdot BM25(D, Q) + w_{PR} \cdot PR(D) \cdot N$$

où :
- $w_{BM25} = 0.6$ est le poids du score BM25
- $w_{PR} = 0.4$ est le poids du PageRank
- $N$ est le nombre total de documents (pour normaliser PageRank)

### Bonus de Proximité

Un bonus multiplicatif est appliqué lorsque les termes de la requête apparaissent proches les uns des autres dans le document. La proximité est calculée à partir des positions stockées dans l'index inversé. 

Il est de 1 par défaut, de 3 si il existe une phrase exacte, et de manière croissante entre 1 et 3 dépendant de la proximité des termes.

### Bonus de Titre

Auquel est ajouté un bonus si les termes de la requête apparaissent dans le titre du document. Il est de 2 si et seulement si tous les termes apparaissent dans le titre.

## Scoring des Suggestions

Pour les suggestions de livres similaires, nous utilisons :

$$Score_{suggestion} = 0.6 \times Jaccard(D, D_{ref}) + 0.4 \times PR(D) \times 100$$

où $D_{ref}$ est le document de référence (celui consulté par l'utilisateur).

### Recommandations Basées sur les Clics

Sur la page d'accueil, nous recommandons des livres populaires et des livres proches des livres populaires.

```
pour chaque livre figurant parmi les livres les plus cliqués:
    récupérer les voisins Jaccard
    pour chaque voisin:
        score ← similarité × (clics / max_clics)
        agréger les scores des voisins multi-sources
```

## Configuration

Les poids du scoring sont configurables dynamiquement via l'interface d'administration :

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `bm25Weight` | 0.6 | Poids du score BM25 |
| `pageRankWeight` | 0.4 | Poids du PageRank |
| `enableProximityBonus` | true | Activer le bonus de proximité |

