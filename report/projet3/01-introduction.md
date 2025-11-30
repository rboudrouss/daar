# 1. Introduction

## 1.1. Contexte

Ce projet vise à développer une application web de moteur de recherche pour une bibliothèque numérique de documents textuels. Avec la numérisation massive des oeuvres littéraires, notamment via des initiatives comme le projet Gutenberg, les bibliothèques numériques contiennent désormais des dizaines de milliers de documents. Une telle volumétrie rend la recherche manuelle impossible et nécessite des outils de recherche performants.

Des solutions industrielles telles qu'Elasticsearch répondent à ce besoin. Cependant, dans le cadre de ce projet, nous avons développé notre propre solution afin d'explorer les algorithmes de recherche, de scoring et de recommandation.

Les algorithmes de recherche par expressions régulières (NFA, DFA, KMP, Aho-Corasick) ayant été traités dans le rapport du projet 1, nous ne les détaillerons pas ici. Ce rapport se concentre sur les structures de données, le calcul de similarité, le scoring des résultats et les fonctionnalités de recherche avancée.


Ce rapport présente d'abord les structures de données utilisées (Section 2), puis détaille les algorithmes de similarité Jaccard (Section 3) et PageRank (Section 4). La section 5 décrit le système de scoring hybride. La section 6 présente l'optimisation de la recherche par expressions régulières. Les fonctionnalités de recherche floue et de highlighting sont présentées en section 7. Enfin, la section 8 analyse les performances et la section 9 conclut ce rapport.

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
