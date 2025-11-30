# 5. Système de Scoring

Notre système combine plusieurs metriques pour produire un score final qui reflète la correspondance textuelle et l'importance du document.

## 5.1. Score BM25

### 5.1.1. Définition

BM25 (Best Matching 25) est une fonction de scoring probabiliste issue du modèle de pertinence BM. C'est une évolution du TF-IDF qui intègre une normalisation par la longueur du document et une saturation de la fréquence des termes.

Pour une requête $Q$ composée des termes $q_1, ..., q_n$ et un document $D$ :

$$BM25(D, Q) = \sum_{i=1}^{n} IDF(q_i) \cdot \frac{tf(q_i, D) \cdot (k_1 + 1)}{tf(q_i, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{avgdl}\right)}$$

où :
- $tf(q_i, D)$ est la fréquence du terme $q_i$ dans le document $D$
- $|D|$ est la longueur du document (en mots)
- $avgdl$ est la longueur moyenne des documents du corpus
- $k_1$ et $b$ sont des paramètres de tuning

### 5.1.2. Composantes

**IDF (Inverse Document Frequency)** :
$$IDF(t) = \log\left(\frac{N - df(t) + 0.5}{df(t) + 0.5} + 1\right)$$

Cette formule, légèrement différente du IDF classique, évite les valeurs négatives pour les termes très fréquents.

**Saturation TF** : Le terme $(k_1 + 1)$ au numérateur et $k_1$ au dénominateur créent une saturation : augmenter la fréquence d'un terme au-delà d'un certain point a un effet décroissant sur le score.

**Normalisation de longueur** : Le paramètre $b$ contrôle l'impact de la longueur du document. Avec $b = 0$, pas de normalisation ; avec $b = 1$, normalisation complète.

### 5.1.3. Paramètres

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| $k_1$ | 1.2 | Saturation de la fréquence |
| $b$ | 0.75 | Normalisation par la longueur |

## 5.2. Score Hybride

### 5.2.1. Combinaison BM25 + PageRank

Le score final combine la pertinence textuelle (BM25) et l'importance structurelle (PageRank) :

$$Score_{hybride} = w_{BM25} \cdot BM25(D, Q) + w_{PR} \cdot PR(D) \cdot N$$

où :
- $w_{BM25} = 0.6$ est le poids du score BM25
- $w_{PR} = 0.4$ est le poids du PageRank
- $N$ est le nombre total de documents (pour normaliser PageRank)

### 5.2.2. Justification

Cette combinaison permet de :
- Favoriser les documents correspondant bien à la requête (BM25)
- Promouvoir les documents "centraux" dans le corpus (PageRank)
- Équilibrer entre nouveauté et popularité

### 5.2.3. Bonus de Proximité

Un bonus multiplicatif est appliqué lorsque les termes de la requête apparaissent proches les uns des autres dans le document :

$$Score_{final} = Score_{hybride} \times (1 + \alpha \cdot proximity\_bonus)$$

La proximité est calculée à partir des positions stockées dans l'index inversé.

### 5.2.4. Bonus de Titre

Les correspondances dans le titre sont valorisées par un facteur multiplicatif, car un terme dans le titre est généralement plus significatif qu'un terme dans le corps du texte.

## 5.3. Scoring des Suggestions

### 5.3.1. Formule

Pour les suggestions de livres similaires, nous utilisons :

$$Score_{suggestion} = 0.6 \times Jaccard(D, D_{ref}) + 0.4 \times PR(D) \times 100$$

où $D_{ref}$ est le document de référence (celui consulté par l'utilisateur).

### 5.3.2. Recommandations Basées sur les Clics

Le système de recommandation prend en compte l'historique des clics :

```
pour chaque livre cliqué:
    récupérer les voisins Jaccard
    pour chaque voisin:
        score ← similarité × (clics / max_clics)
        agréger les scores des voisins multi-sources
```

## 5.4. Configuration

Les poids du scoring sont configurables dynamiquement via l'interface d'administration :

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `bm25Weight` | 0.6 | Poids du score BM25 |
| `pageRankWeight` | 0.4 | Poids du PageRank |
| `enableProximityBonus` | true | Activer le bonus de proximité |

