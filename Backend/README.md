# Library Search Engine - Backend

A powerful search engine backend with BM25, Regex, PageRank, and Jaccard similarity features.

## Features

- **BM25 Full-Text Search** with advanced options
  - **Proximity Bonus**: Automatically boosts results where query terms appear close together
    - Exact phrase match: ×3.0 score multiplier
    - Consecutive terms: ×2.5 multiplier
    - Within 2 words: ×2.0 multiplier
    - Within 5 words: ×1.5 multiplier
    - Within 10 words: ×1.2 multiplier
  - Exact phrase matching mode
  - Fuzzy search with configurable edit distance
  - Multi-field search (title, author, content)
  - Text highlighting and snippets
- **Regex Search** for pattern matching
- **PageRank** scoring based on book similarity graph
- **Jaccard Similarity** for book recommendations
- **Gutenberg Integration** via Gutendex API
- **Streaming Text API** for efficient book content delivery
- **Cover Image Management**

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and set ADMIN_PASSWORD

# Start the server
npm run dev
```

The server will start on `http://localhost:3000` (or the PORT specified in .env).

## Important Notes

### Proximity Bonus for Better Search Results

The search engine automatically applies a **proximity bonus** to results where query terms appear close together:

- **Exact phrase match** (e.g., "United States of America" in exact order): ×3.0 score boost
- **Consecutive terms** (terms next to each other): ×2.5 boost
- **Within 2 words**: ×2.0 boost
- **Within 5 words**: ×1.5 boost
- **Within 10 words**: ×1.2 boost

This means you don't need to use a special "exact phrase" mode - the search engine will automatically prioritize results where your search terms appear together!

## API Endpoints

### Public Endpoints

- `GET /api/search?q=query&limit=20&fuzzy=true&highlight=true`
  - BM25 search with advanced options and automatic proximity bonus
  - Query parameters:
    - `q`: Search query (required)
    - `limit`: Max results (default: 20)
    - `fuzzy`: Enable fuzzy search
    - `fuzzyDistance`: Edit distance for fuzzy search (1-3, default: 2)
    - `highlight`: Enable text highlighting
    - `fields`: Comma-separated fields to search (title,author,content)
    - `author`: Filter by author
    - `minWordCount`, `maxWordCount`: Filter by word count
    - `minPageRank`: Filter by PageRank score

- `GET /api/search/advanced?regex=pattern&caseSensitive=true`
  - Regex search

- `GET /api/search/suggestions?bookId=123&limit=10`
  - Get similar books using Jaccard similarity

- `GET /api/books` - List all books
- `GET /api/books/:id` - Get book details
- `GET /api/books/:id/text` - Stream book text content
- `GET /api/books/:id/cover` - Get book cover image
- `GET /api/books/stats` - Library statistics

### Admin Endpoints (Require Authorization)

All admin endpoints require the `Authorization: Bearer <ADMIN_PASSWORD>` header.

- `POST /api/admin/import-gutenberg` - Import books from Project Gutenberg
  ```json
  { "count": 100 }
  ```

- `POST /api/admin/rebuild-jaccard` - Rebuild Jaccard similarity graph
  ```json
  { "threshold": 0.1 }
  ```

- `POST /api/admin/calculate-pagerank` - Calculate PageRank scores
  ```json
  { "iterations": 20, "dampingFactor": 0.85 }
  ```

## Environment Variables

Create a `.env` file based on `.env.example`:

```env
PORT=3000
ADMIN_PASSWORD=your-secure-password-here
```

## Database Schema

The SQLite database (`data/library.db`) contains:

- **books**: Book metadata (title, author, file_path, cover_image_path, word_count)
- **inverted_index**: Term positions for BM25 search
- **term_stats**: Document frequency and total frequency per term
- **jaccard_edges**: Similarity graph edges
- **pagerank_scores**: PageRank scores per book
- **library_metadata**: System configuration and statistics

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Build for production
npm run build

# Type check
npx tsc --noEmit
```

## License

Part of the DAAR project.

