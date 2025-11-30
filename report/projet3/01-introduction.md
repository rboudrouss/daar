# 1. Introduction

## 1.1. Contexte

Nous presentons une application web de recherche textuelle de livres de la bibliothèque du projet Gutenberg. Nous avons cherché a reduire le nombre de librairie externes utilisées, en implementant nous-memes les algorithmes clefs de recherche et de classement, par exemple, nous n'utilisons aucune librairie de recherche textuelle preexistante (Lucene, ElasticSearch, etc.).

## 1.2. Architecture Technique

L'application est structurée en trois couches distinctes :

```{.mermaid}
graph TB
    subgraph Frontend["Frontend (React + TanStack Router)"]
        UI[Interface utilisateur]
        API_Client[Client API]
    end

    subgraph Backend["Backend (Node.js + Hono)"]
        REST[API REST]
        subgraph Search["Recherche"]
            SE[SearchEngine]
            SC[ScoringEngine]
            FZ[FuzzyMatcher]
            HL[Highlighter]
        end
        subgraph Index["Indexation"]
            TK[Tokenizer]
            IX[Indexer]
            JC[JaccardCalculator]
            PR[PageRank]
        end
    end

    subgraph Data["Couche Data"]
        DB[(SQLite)]
        TXT[Fichiers texte]
    end

    UI --> API_Client
    API_Client --> REST
    REST --> SE
    SE --> SC
    SE --> FZ
    SE --> HL
    SE --> DB
    IX --> TK
    IX --> DB
    JC --> DB
    PR --> DB
    DB --> TXT
```

- **Couche Data** (`Backend/data/`) : fichiers textuels des livres, images de couverture, et base de données SQLite contenant l'index inversé, le graphe de Jaccard et les scores PageRank.

- **Backend** (`Backend/`) : serveur Node.js utilisant le framework Hono, exposant une API REST pour la recherche, l'indexation et l'administration.

- **Frontend** (`Frontend/`) : application React avec TanStack Router pour la navigation.

## 1.3. Contributions et Choix de Conception

### Fonctionnalité explicite de “Recherche”

- **Index inversé**: fréquences + positions pour BM25 & highlighting.
- **Tokenizer**: filtrage stop words / casse / longueur.
- **BM25**: normalisation longueur + IDF dynamique.
- **Bonus proximité & titre**: multiplicateurs de pertinence.
- **Batch inserts**: + prepared statements pour vitesse.

### Recherche avancée

- **Regex multi‑algos**: NFA/DFA/Aho‑Corasick selon motif.
- **Fuzzy**: Levenshtein + cache pour fautes.
- **Highlighting**: via positions stockées.
- **Hybridation**: mix exact + fuzzy filtré par scoring.
- **PageRank**: injecté dans score hybride.

### Classement

- **PageRank Jaccard**: graphe Top‑K, similarité IDF.
- **BM25**: k1, b ajustables + IDF lissé.
- **Score hybride**: BM25 + PageRank pondéré.
- **Bonus contextuels**: proximité + titre multiplicatifs.
- **Filtrage fréquence**: exclusion termes très fréquents.

### Suggestion

- **Jaccard + clics**: voisins Top‑K combinés à l’usage.
- **Score combiné**: similarité × popularité.
- **Fallback PageRank**: si peu d’historique.
- **Fusion sources**: somme des scores + batch fetch.
- **Explicabilité**: champ `reason` (pagerank/jaccard/hybrid).
