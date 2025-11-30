# 4. Algorithme PageRank

## 4.1. Définition

### 4.1.1. Principe

PageRank est un algorithme développé par Larry Page et Sergey Brin pour classer les pages web. Il modélise un "surfeur aléatoire" qui navigue de page en page en suivant les liens. La probabilité stationnaire de se trouver sur une page définit son score PageRank.

Dans notre contexte, les "pages" sont les livres et les "liens" sont les arêtes du graphe de Jaccard. Un livre avec un PageRank élevé est un livre central, connecté à de nombreux autres livres importants.

### 4.1.2. Formule Itérative

Le score PageRank d'un sommet $v$ est défini par :

$PR(v) = \frac{1-d}{N} + \frac{d \cdot S}{N} + d \sum_{u \in \text{In}(v)} \frac{PR(u)}{\text{deg}^+(u)}$

avec

$S = \sum_{u \text{dangling}} \frac{PR(u)}{N}$

où :
- $d$ est le facteur d'amortissement (typiquement 0.85)
- $N$ est le nombre total de sommets
- $\text{In}(v)$ est l'ensemble des sommets pointant vers $v$
- $\text{deg}^+(u)$ est le degré sortant de $u$
- Les sommets "dangling" sont ceux sans liens sortants

$d-1$ représente la probabilité de téléportation vers une page aléatoire, assurant que le surfeur ne reste pas bloqué. $S$ redistribue le score des sommets sans liens sortants.

Ces ajout permettent la convergence de l'algorithme. Sans gestion des danglings, leur score accumulé ne contribuerait plus au score général, biaisant les résultats.

## 4.2. Implémentation

### 4.2.1. Algorithme Itératif (Power Iteration)

```
fonction computePageRank(graph, d, maxIter, tolerance):
    N ← nombre de sommets
    incomingEdges, outDegrees, danglingNodes ← prétraiter(graph)
    r ← vecteur de taille N initialisé à 1/N
    pour i de 1 à maxIter:
        danglingSum ← somme des r[u] pour u dans danglingNodes
        baseRank ← (1 - d)/N + d × (danglingSum / N)
        r_new ← vecteur vide de taille N
        pour chaque sommet v de 0 à N-1:
            r_v ← baseRank
            pour chaque u dans incomingEdges[v]:
                r_v ← r_v + d × (r[u] / outDegrees[u])
            r_new[v] ← r_v
        diff ← somme des |r_new[v] - r[v]| pour tous les v
        r ← r_new
        si diff < tolerance:
            retourner r
    retourner r
```

### 4.2.2. Paramètres

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `damping (d)` | 0.85 | Facteur d'amortissement |
| `maxIter` | 100 | Nombre maximum d'itérations |
| `tolerance` | $10^{-6}$ | Seuil de convergence |

## 4.3. Application au Graphe de Jaccard

### 4.3.1. Conversion du Graphe

Le graphe de Jaccard est non-orienté et pondéré. Pour l'utiliser avec PageRank :

1. Chaque arête non-orientée devient deux arêtes orientées
2. Les poids de similarité sont utilisés pour pondérer les transitions

### 4.3.2. Interprétation

Un livre avec un PageRank élevé est :
- Similaire à de nombreux autres livres
- Connecté à des livres eux-mêmes centraux

## 4.4. Complexité

- **Temps** : $O(k \times |E|)$ où $k$ est le nombre d'itérations et $|E|$ le nombre d'arêtes
- **Espace** : $O(|V|)$ pour stocker les scores


