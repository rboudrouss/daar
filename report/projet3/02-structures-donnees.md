# Structures de Données

## Index Inversé

### Définition

Pour la recherche textuelle, nous utilisons un index inversé avec positions. il associe chaque terme à la liste des documents le contenant, avec la fréquence et les positions d'occurrence. (Les positions seront utiles pour le highlighting et le calcul de bonus de proximité, nous expliquerons cela plus tard.)

Formellement, pour un corpus $D = \{d_1, d_2, ..., d_n\}$ et un vocabulaire $V$, l'index inversé $I$ est défini par :

$$I : V \rightarrow \mathcal{P}(D \times \mathbb{N} \times \mathbb{N}^*)$$

où chaque entrée contient le document, la fréquence du terme, et les positions d'occurrence.

### Implémentation

Notre index inversé est stocké dans SQLite avec le schéma suivant :

```sql
CREATE TABLE inverted_index (
  term TEXT NOT NULL,
  book_id INTEGER NOT NULL,
  term_frequency INTEGER NOT NULL,
  positions TEXT,  -- JSON array: [12, 45, 89, ...]
  PRIMARY KEY (term, book_id)
);

CREATE INDEX idx_term ON inverted_index(term);
CREATE INDEX idx_book_id ON inverted_index(book_id);
```

Le champ `positions` stocke les positions en caractères de chaque occurrence, permettant le highlighting et le calcul de bonus de proximité.

### Complexité

- Recherche d'un terme : $O(1)$ grâce à l'index SQL sur `term`
- Insertion d'un terme : $O(\log n)$ pour la mise à jour de l'index B-tree
- Espace : $O(|V| \times \bar{d})$ où $\bar{d}$ est le nombre moyen de documents par terme

## Statistiques des Termes

Pour le calcul des scores BM25 et IDF, nous maintenons des statistiques globales :

```sql
CREATE TABLE term_stats (
  term TEXT PRIMARY KEY,
  document_frequency INTEGER NOT NULL,  -- df(t)
  total_frequency INTEGER NOT NULL      -- Σ tf(t,d)
);
```

Ces statistiques sont mises à jour lors de l'indexation et permettent notamment de calculer l'IDF :

$$IDF(t) = \log\left(\frac{N}{df(t)}\right)$$

où $N$ est le nombre total de documents et $df(t)$ le nombre de documents contenant le terme $t$.

## Graphe de Jaccard

### Représentation

Le graphe de similarité de Jaccard modélise les relations entre documents. Chaque livre est un sommet, et une arête pondérée relie deux livres.

```sql
CREATE TABLE jaccard_edges (
  book_id_1 INTEGER NOT NULL,
  book_id_2 INTEGER NOT NULL,
  similarity REAL NOT NULL,
  PRIMARY KEY (book_id_1, book_id_2)
);
```

### Propriétés du Graphe

Le graphe est non-orienté (stocké avec $book\_id\_1 < book\_id\_2$) et pondéré. Pour optimiser l'espace, seules les $k$ meilleures arêtes par sommet sont conservées (Top-K).

Avec $n$ livres et $k = 50$ voisins maximum par livre, le nombre d'arêtes est borné par $O(n \times k)$.

## Scores PageRank

Les scores PageRank pré-calculés sont stockés pour éviter un recalcul à chaque requête :

```sql
CREATE TABLE pagerank (
  book_id INTEGER PRIMARY KEY,
  score REAL NOT NULL
);
```

## Tokenizer

Le tokenizer transforme le texte brut en termes indexables. Nous avons implémenté un tokenizer simple qui découpe le texte en mots, en ignorant la ponctuation et les caractères spéciaux. Voici les paramètres configurables et leurs valeurs par défaut :

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `minWordLength` | 2 | Longueur minimale d'un terme |
| `removeStopWords` | true | Filtrage des mots vides |
| `caseSensitive` | false | Normalisation en minuscules |
| `keepPositions` | true | Conservation des positions |
