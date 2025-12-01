# Recherche Floue et Highlighting

## Recherche Floue (Fuzzy Search)

### Motivation

Les utilisateurs font fréquemment des fautes de frappe ou d'orthographe. Fuzzy Search permet de trouver des résultats même lorsque la requête ne correspond pas exactement aux termes indexés.

### Distance de Levenshtein

La distance de Levenshtein (ou distance d'édition) entre deux chaînes est le nombre minimum d'opérations élémentaires pour transformer l'une en l'autre :
- **Insertion** d'un caractère
- **Suppression** d'un caractère
- **Substitution** d'un caractère

### Algorithme

Pour deux chaînes $a$ de longueur $m$ et $b$ de longueur $n$, on construit une matrice $D$ de taille $(m+1) \times (n+1)$ :

$$D[i][j] = \begin{cases}
i & \text{si } j = 0 \\
j & \text{si } i = 0 \\
D[i-1][j-1] & \text{si } a[i] = b[j] \\
1 + \min(D[i-1][j], D[i][j-1], D[i-1][j-1]) & \text{sinon}
\end{cases}$$

La distance finale est $D[m][n]$.

### Implémentation

```typescript
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialisation
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  // Remplissage
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i-1] === a[j-1]) {
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = 1 + Math.min(
          matrix[i-1][j-1],  // substitution
          matrix[i][j-1],    // insertion
          matrix[i-1][j]     // suppression
        );
      }
    }
  }
  return matrix[b.length][a.length];
}
```

### Complexité

- **Temps** : $O(m \times n)$
- **Espace** : $O(m \times n)$, réductible à $O(\min(m, n))$ avec optimisation

### Expansion de Requête

Lors d'une recherche floue, chaque terme de la requête est étendu avec les termes de l'index ayant une distance inférieure ou égale au seuil (par défaut 2) :

```
entrée: terme de requête, distance maximale
sortie: ensemble de termes correspondants

pour chaque terme t dans l'index:
    si levenshtein(requête, t) <= distance_max:
        ajouter t aux résultats
trier par distance croissante
```

## Highlighting

### Objectif

Le highlighting consiste à générer des extraits de texte (snippets) mettant en évidence les termes recherchés. Cela permet à l'utilisateur d'évaluer rapidement la pertinence d'un résultat.

### Génération de Snippets

L'algorithme utilise les positions stockées dans l'index inversé :

1. Récupérer les positions de tous les termes de la requête
2. Trier les positions par ordre croissant
3. Pour chaque position, extraire un contexte (caractères avant/après)
4. Fusionner les contextes adjacents si ils se chevauchent
5. Appliquer les balises `<mark>` autour des termes

### Multi-Pattern Matching avec Aho-Corasick

Pour le highlighting de plusieurs termes simultanément, nous utilisons l'algorithme Aho-Corasick (décrit dans le rapport du projet 1). Cet algorithme permet de rechercher tous les termes en un seul parcours du texte.

### Paramètres

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `snippetCount` | 3 | Nombre de snippets par résultat |
| `snippetLength` | 150 | Longueur maximale d'un snippet |
| `contextBefore` | 100 | Caractères de contexte avant |
| `contextAfter` | 100 | Caractères de contexte après |

### Exemple de Sortie

Pour la requête "treasure island" dans un document :

```html
...the young Jim Hawkins discovers a
<mark>treasure</mark> map leading to a distant
<mark>island</mark>...
```
