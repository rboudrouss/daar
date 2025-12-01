# Algorithme PageRank

Nous avons choisi d'utiliser pagerank car pour un projet de l'UE AAGA, nous avons rendu un rapport où nous avons étudié l'algorithme.

## Définition

### Principe

PageRank est un algorithme développé par Larry Page et Sergey Brin pour classer les pages web. Il modélise un "surfeur aléatoire" qui navigue de page en page en suivant les liens. La probabilité stationnaire de se trouver sur une page définit son score PageRank.

Dans notre contexte, les "pages" sont les livres et les "liens" sont les arêtes du graphe de Jaccard. Un livre avec un PageRank élevé est un livre central, connecté à de nombreux autres livres importants.

### Formule Itérative

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

Ces ajout permettent permettent de gérer les sommets sans liens sortants et certain cas de boucles qui accumuleront un score.

## Implémentation

### Algorithme Itératif (Power Iteration)

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

### Paramètres

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `damping (d)` | 0.85 | Facteur d'amortissement |
| `maxIter` | 100 | Nombre maximum d'itérations |
| `tolerance` | $10^{-6}$ | Seuil de convergence |

## Complexité

- **Temps** : $O(k \times \bar{d})$ où $k$ est le nombre d'itérations et $\bar{d}$ le degré moyen entrant, qui est directement limité par le Top-k du graphe de Jaccard, donc au maximum 50 dans notre cas.
- **Espace** : $O(|V|)$ pour stocker les scores


