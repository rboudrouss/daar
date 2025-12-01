-- Schéma de la base de données pour le moteur de recherche

-- Table des livres
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  cover_image_path TEXT, -- Chemin vers l'image de couverture
  word_count INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index inversé : terme -> livres
CREATE TABLE IF NOT EXISTS inverted_index (
  term TEXT NOT NULL,
  book_id INTEGER NOT NULL,
  term_frequency INTEGER NOT NULL,
  positions TEXT, -- JSON array: [12, 45, 89, ...]
  PRIMARY KEY (term, book_id),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- Index pour recherche rapide par terme
CREATE INDEX IF NOT EXISTS idx_term ON inverted_index(term);
CREATE INDEX IF NOT EXISTS idx_book_id ON inverted_index(book_id);
-- Composite index for Jaccard similarity self-joins (term lookups with book_id filtering)
CREATE INDEX IF NOT EXISTS idx_term_book ON inverted_index(term, book_id);

-- Statistiques globales par terme (pour calcul IDF)
CREATE TABLE IF NOT EXISTS term_stats (
  term TEXT PRIMARY KEY,
  document_frequency INTEGER NOT NULL, -- Nombre de docs contenant ce terme
  total_frequency INTEGER NOT NULL -- Nombre total d'occurrences
);

-- Graphe de Jaccard (similarités entre livres)
CREATE TABLE IF NOT EXISTS jaccard_edges (
  book_id_1 INTEGER NOT NULL,
  book_id_2 INTEGER NOT NULL,
  similarity REAL NOT NULL,
  PRIMARY KEY (book_id_1, book_id_2),
  FOREIGN KEY (book_id_1) REFERENCES books(id) ON DELETE CASCADE,
  FOREIGN KEY (book_id_2) REFERENCES books(id) ON DELETE CASCADE,
  CHECK (book_id_1 < book_id_2) -- Évite les doublons (A,B) et (B,A)
);

-- Index pour recherche rapide des voisins
CREATE INDEX IF NOT EXISTS idx_jaccard_book1 ON jaccard_edges(book_id_1);
CREATE INDEX IF NOT EXISTS idx_jaccard_book2 ON jaccard_edges(book_id_2);
CREATE INDEX IF NOT EXISTS idx_jaccard_similarity ON jaccard_edges(similarity DESC);

-- Scores PageRank
CREATE TABLE IF NOT EXISTS pagerank (
  book_id INTEGER PRIMARY KEY,
  score REAL NOT NULL,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- Index pour tri par PageRank
CREATE INDEX IF NOT EXISTS idx_pagerank_score ON pagerank(score DESC);

-- Statistiques de clics (pour suggestions populaires)
CREATE TABLE IF NOT EXISTS book_clicks (
  book_id INTEGER PRIMARY KEY,
  click_count INTEGER DEFAULT 0,
  last_clicked TIMESTAMP,
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

-- Métadonnées de la bibliothèque
CREATE TABLE IF NOT EXISTS library_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initialiser les métadonnées
INSERT OR IGNORE INTO library_metadata (key, value) VALUES
  ('total_books', '0'),
  ('total_terms', '0'),
  ('avg_doc_length', '0'),
  ('total_words', '0'),
  ('jaccard_edges', '0'),
  ('pagerank_calculated', 'false'),
  ('last_indexed', ''),
  ('last_gutenberg_id', '0');

-- Configuration de l'application
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('string', 'number', 'boolean')),
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initialiser les configurations par défaut
INSERT OR IGNORE INTO app_config (key, value, type, description) VALUES
  -- Tokenizer settings
  ('TOKENIZER_IGNORE_STOP_WORDS', 'true', 'boolean', 'Ignore stop words during tokenization'),
  ('TOKENIZER_MIN_WORD_LENGTH', '2', 'number', 'Minimum word length to index'),
  ('TOKENIZER_CASE_SENSITIVE', 'false', 'boolean', 'Case sensitive tokenization'),
  ('TOKENIZER_KEEP_POSITIONS', 'true', 'boolean', 'Keep word positions in index'),

  -- Search highlighting settings
  ('SEARCH_HIGHLIGHT_SNIPPET_COUNT', '3', 'number', 'Number of snippets to return in search results'),
  ('SEARCH_HIGHLIGHT_SNIPPET_LENGTH', '150', 'number', 'Length of each snippet in characters'),
  ('SEARCH_HIGHLIGHT_CONTEXT_LENGTH_BEFORE', '100', 'number', 'Context length before matched term'),
  ('SEARCH_HIGHLIGHT_CONTEXT_LENGTH_AFTER', '100', 'number', 'Context length after matched term'),

  -- Gutenberg import settings
  ('GUTENBERG_BATCH_SIZE', '30', 'number', 'Number of books to fetch per batch from Gutenberg'),

  -- Jaccard similarity settings
  ('JACCARD_MAX_TERM_FREQUENCY', '0.8', 'number', 'Maximum term document frequency for Jaccard (ignore terms in >70% of books)'),
  ('JACCARD_MIN_SHARED_TERMS', '2', 'number', 'Minimum shared terms required to compare two books for Jaccard similarity'),

  -- Search scoring settings
  ('SEARCH_SCORING_BM25_WEIGHT', '0.5', 'number', 'Weight for BM25 score in final ranking'),
  ('SEARCH_SCORING_PAGERANK_WEIGHT', '0.3', 'number', 'Weight for PageRank score in final ranking'),
  ('SEARCH_SCORING_K1', '1.2', 'number', 'BM25 k1 parameter (term frequency saturation)'),
  ('SEARCH_SCORING_B', '0.75', 'number', 'BM25 b parameter (length normalization)'),
  ('SEARCH_SCORING_ENABLE_PROXIMITY_BONUS', 'true', 'boolean', 'Enable proximity bonus for nearby terms');

