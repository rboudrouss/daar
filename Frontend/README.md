# Library Search Engine - Frontend

A modern React frontend for the Library Search Engine, featuring BM25 search, PageRank scoring, and Jaccard similarity recommendations.

## Features

- **Smart Search**: BM25 algorithm for intelligent full-text search
- **Advanced Search**: Regex pattern matching for precise queries
  - Supported syntax: literals, `*` (star), `+` (plus), `?` (optional), `|` (alternation), `.` (any char), `()` (grouping), `\` (escape)
  - **Note**: Enter patterns directly without slashes (e.g., `cat|dog`, not `/cat|dog/`)
- **PageRank Scoring**: Books ranked by importance and connections
- **Book Recommendations**: Jaccard similarity-based suggestions
- **Cover Images**: Beautiful book covers from Project Gutenberg
- **Admin Panel**: Import books and manage the search engine

## Getting Started

1. Install dependencies: `pnpm install`
2. Configure environment: `cp .env.example .env`
3. Start dev server: `pnpm dev`

The frontend will be available at `http://localhost:3000`

## Pages

- **Home** (`/`): Search books using BM25 or regex
- **Book Detail** (`/book/:bookId`): View book details and recommendations
- **Admin** (`/admin`): Import books and manage the system

## License

Part of the DAAR project.
