# Introduction

Lien vers la vidéo de présentation : **[https://www.youtube.com/watch?v=nyT_8-T6X7Y](https://www.youtube.com/watch?v=nyT_8-T6X7Y)**

Il est peut-être possible de trouver une instance en ligne à l'adresse **[https://daar.rboud.com](https://daar.rboud.com)**. Cependant, il est possible que l'instance soit down à tout moment, et il est préférable de lancer le code localement.

## Contexte

Nous presentons une application web de recherche textuelle de livres de la bibliothèque du projet Gutenberg. Nous avons cherché a reduire le nombre de librairie externes utilisées, en implementant nous-memes les algorithmes clefs de recherche et de classement, par exemple, nous n'utilisons aucune librairie de recherche textuelle preexistante (Lucene, ElasticSearch, etc...).

## Architecture Technique

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

## Contributions et Choix de Conception

**Fonctionnalité explicite de Recherche** :

- Tokenization puis indexation dans une reverse index
- Plusieurs options de tokenization (stop words, casse, longueur)

**Recherche avec Regex**:

- Support de regex en utilisant un NFA avec cache DFA (expliqué dans le projet 1)
- Analyse le pattern regex pour générer une requête SQL optimisée qui filtre les termes candidats


**Classement** :

- Graphe de Jaccard pondéré par IDF
- PageRank sur le graphe de Jaccard
- Score hybride BM25 + PageRank
- Bonus de proximité et de titre

**Suggestion** :

- Livres similaires basées sur jaccard et pagerank (dans la page de détail d'un livre)
- Suggestions de livres les plus cliqués dans la page d'accueil
- Suggestions de livre proches des livres populaires dans la page d'accueil

**Ajouts** :

- Recherche floue (Levenshtein)
- Highlighting des résultats
- Interface Admin pour configurer tout les paramètres de l'application

## Execution du code

Il est recommendé d'utiliser docker compose pour lancer le serveur avec la commande `docker compose up` (ou `doker-compose up`).

Sinon il faut :

- Installer [Node.js](https://nodejs.org/en/download/) avec NPM si vous ne l'avez pas déjà.
- Installer [pnpm](https://pnpm.io/installation). Généralement il faut juste `npm install -g pnpm`.  
- Lancer `pnpm install` dans le root du projet pour installer les dépendances.  
- Lancer `pnpm build` dans le root du projet pour build le projet.  
- Entrer dans le dossier Backend et lancer `pnpm start` ou `pnpm run dev`pour lancer le serveur.  
- Aller sur [http://localhost:3000](http://localhost:3000) pour accéder à l'application.

Commencez par aller sur l'interface Admin sur **[http://localhost:3000/admin](http://localhost:3000/admin)** pour importer les livres et configurer l'application.  
Utilisez le mot de passe `admin` pour vous connecter.  
Faites attention, à partir d'un certain point, la construction du graphe de jaccard peut prendre plusieurs minutes. (Il est conseillé de commencer avec un `JACCARD_MAX_TERM_FREQUENCY` haut ~90% pour des petites quantités de livres (< 150), et de le baisser pour des plus grandes quantités de livres)
