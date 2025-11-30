# 4. Algorithme PageRank

## 4.1. Définition

### 4.1.1. Principe

PageRank est un algorithme développé par Larry Page et Sergey Brin pour classer les pages web. Il modélise un "surfeur aléatoire" qui navigue de page en page en suivant les liens. La probabilité stationnaire de se trouver sur une page définit son score PageRank.

Dans notre contexte, les "pages" sont les livres et les "liens" sont les arêtes du graphe de Jaccard. Un livre avec un PageRank élevé est un livre central, connecté à de nombreux autres livres importants.

### 4.1.2. Formule Itérative

Le score PageRank d'un sommet $v$ est défini par :

$$PR(v) = \frac{1-d}{N} + d \sum_{u \in In(v)} \frac{PR(u)}{|Out(u)|}$$

où :
- $d$ est le facteur d'amortissement (damping factor), typiquement 0.85
- $N$ est le nombre total de sommets
- $In(v)$ est l'ensemble des sommets pointant vers $v$
- $|Out(u)|$ est le degré sortant de $u$

Le terme $(1-d)/N$ représente la probabilité de "téléportation" vers un sommet aléatoire, évitant les pièges (sommets sans liens sortants).

### 4.1.3. Forme Matricielle

En notation matricielle, si $\mathbf{r}$ est le vecteur des scores PageRank et $\mathbf{M}$ la matrice de transition stochastique :

$$\mathbf{r} = d \cdot \mathbf{M}^T \mathbf{r} + \frac{1-d}{N} \mathbf{1}$$

Le vecteur $\mathbf{r}$ est le vecteur propre dominant de la matrice $(d \cdot \mathbf{M}^T + \frac{1-d}{N} \mathbf{J})$ où $\mathbf{J}$ est la matrice de uns.

## 4.2. Implémentation

### 4.2.1. Algorithme Itératif (Power Iteration)

```
fonction computePageRank(graph, d, maxIter, tolerance):
    N ← nombre de sommets
    r ← vecteur de taille N initialisé à 1/N
    
    pour i de 1 à maxIter:
        r_new ← vecteur de zéros
        
        pour chaque sommet v:
            somme ← 0
            pour chaque voisin u de v:
                somme ← somme + r[u] / degré(u)
            r_new[v] ← (1-d)/N + d × somme
        
        diff ← ||r_new - r||_1
        r ← r_new
        
        si diff < tolerance:
            retourner r (convergé)
    
    retourner r
```

### 4.2.2. Paramètres

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `damping` | 0.85 | Facteur d'amortissement |
| `maxIterations` | 100 | Nombre maximum d'itérations |
| `tolerance` | $10^{-6}$ | Seuil de convergence |

### 4.2.3. Convergence

L'algorithme converge car la matrice de transition avec téléportation est :
- Stochastique (colonnes somment à 1)
- Apériodique (grâce à la téléportation)
- Irréductible (tous les états accessibles)

Par le théorème de Perron-Frobenius, il existe un unique vecteur propre dominant.

## 4.3. Application au Graphe de Jaccard

### 4.3.1. Conversion du Graphe

Le graphe de Jaccard est non-orienté et pondéré. Pour l'utiliser avec PageRank :

1. Chaque arête non-orientée devient deux arêtes orientées
2. Les poids de similarité sont utilisés pour pondérer les transitions

### 4.3.2. Interprétation

Un livre avec un PageRank élevé est :
- Similaire à de nombreux autres livres
- Connecté à des livres eux-mêmes centraux

Ces livres peuvent être considérés comme des "œuvres de référence" dans leur domaine thématique.

## 4.4. Complexité

- **Temps** : $O(k \times |E|)$ où $k$ est le nombre d'itérations et $|E|$ le nombre d'arêtes
- **Espace** : $O(|V|)$ pour stocker les scores

En pratique, la convergence est atteinte en 20-50 itérations pour notre corpus.

## 4.5. Exemple de Résultats

Sur notre corpus Gutenberg, les livres avec les PageRank les plus élevés sont généralement des classiques de la littérature anglaise (Shakespeare, Dickens) qui partagent un vocabulaire commun avec de nombreuses autres œuvres.

