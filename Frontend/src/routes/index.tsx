import SearchBar, { type SearchMode, type AdvancedSearchOptions } from "@/components/SearchBar";
import { SearchResultCard } from "@/components/BookCard";
import type { Book, SearchResult, BookStats, SuggestionResult } from "@/utils";
import { getAllBooks, getStats, getRecommendations } from "@/utils/api";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/")({
  component: App,
});

function App() {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [allBooks, setAllBooks] = useState<Book[]>([]);
  const [recommendations, setRecommendations] = useState<SuggestionResult[]>([]);
  const [stats, setStats] = useState<BookStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [executionTime, setExecutionTime] = useState<number>(0);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      setIsLoading(true);
      const [booksData, statsData, recommendationsData] = await Promise.all([
        getAllBooks(),
        getStats(),
        getRecommendations(50),
      ]);
      setAllBooks(booksData);
      setStats(statsData);
      setRecommendations(recommendationsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSearch(
    query: string,
    mode: SearchMode,
    options: AdvancedSearchOptions
  ) {
    if (!query.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setHasSearched(true);

      let response;
      if (mode === "bm25") {
        // Construire les paramètres de recherche
        const params = new URLSearchParams();
        params.append("q", query);
        params.append("limit", "50");

        // Ajouter les options avancées
        if (options.author) params.append("author", options.author);
        if (options.minWordCount)
          params.append("minWordCount", options.minWordCount.toString());
        if (options.maxWordCount)
          params.append("maxWordCount", options.maxWordCount.toString());
        if (options.minPageRank)
          params.append("minPageRank", options.minPageRank.toString());
        if (options.fuzzy) params.append("fuzzy", "true");
        if (options.fuzzyDistance)
          params.append("fuzzyDistance", options.fuzzyDistance.toString());
        if (options.highlight) params.append("highlight", "true");
        if (options.searchFields && options.searchFields.length > 0) {
          params.append("fields", options.searchFields.join(","));
        }

        const API_BASE_URL =
          import.meta.env.VITE_API_URL || "http://localhost:3000";
        const res = await fetch(`${API_BASE_URL}/api/search?${params}`);
        if (!res.ok) throw new Error("Search failed");
        response = await res.json();
        console.log(response);
      } else {
        // Regex search
        const params = new URLSearchParams();
        params.append("regex", query);
        params.append("limit", "50");
        if (options.caseSensitive) params.append("caseSensitive", "true");
        if (options.author) params.append("author", options.author);
        if (options.minWordCount)
          params.append("minWordCount", options.minWordCount.toString());
        if (options.maxWordCount)
          params.append("maxWordCount", options.maxWordCount.toString());

        const API_BASE_URL =
          import.meta.env.VITE_API_URL || "http://localhost:3000";
        const res = await fetch(`${API_BASE_URL}/api/search/advanced?${params}`);
        if (!res.ok) throw new Error("Search failed");
        response = await res.json();
        console.log(response);
      }

      setSearchResults(response.results);
      setExecutionTime(response.executionTimeMs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  }

  // Display search results if searched, otherwise show recommendations (or all books if no recommendations)
  const displayBooks = hasSearched
    ? searchResults
    : recommendations.length > 0
      ? recommendations.map(r => ({ book: r.book, score: r.similarity, matchedTerms: [] }))
      : allBooks.map(b => ({ book: b, score: 0, matchedTerms: [] }));

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fafafa" }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: "#1976D2",
          color: "white",
          padding: "24px",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h1 style={{ margin: "0 0 8px 0", fontSize: "32px" }}>
            📚 Library Search Engine
          </h1>
          <p style={{ margin: 0, opacity: 0.9 }}>
            Powered by BM25, PageRank, and Jaccard Similarity
          </p>
        </div>
      </header>

      {/* Stats Bar */}
      {stats && (
        <div
          style={{
            backgroundColor: "white",
            padding: "16px 24px",
            borderBottom: "1px solid #e0e0e0",
          }}
        >
          <div
            style={{
              maxWidth: "1200px",
              margin: "0 auto",
              display: "flex",
              gap: "24px",
              flexWrap: "wrap",
              fontSize: "14px",
            }}
          >
            <div>
              <strong>📖 Books:</strong> {stats.totalBooks.toLocaleString()}
            </div>
            <div>
              <strong>📝 Total Words:</strong> {stats.totalWords.toLocaleString()}
            </div>
            <div>
              <strong>🔗 Jaccard Edges:</strong> {stats.jaccardEdges.toLocaleString()}
            </div>
            <div>
              <strong>⭐ PageRank:</strong>{" "}
              {stats.pageRankCalculated ? "✓ Calculated" : "✗ Not calculated"}
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 24px" }}>
        <SearchBar onSearch={handleSearch} />
      </div>

      {/* Results Info */}
      {hasSearched && (
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "0 24px 16px 24px",
          }}
        >
          <p style={{ color: "#666", fontSize: "14px" }}>
            Found {searchResults.length} result{searchResults.length !== 1 ? "s" : ""}{" "}
            in {executionTime?.toFixed(2)}ms
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto 16px auto",
            padding: "0 24px",
          }}
        >
          <div
            style={{
              backgroundColor: "#ffebee",
              color: "#c62828",
              padding: "12px 16px",
              borderRadius: "4px",
              border: "1px solid #ef9a9a",
            }}
          >
            ⚠️ {error}
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-block",
              width: "48px",
              height: "48px",
              border: "4px solid #e0e0e0",
              borderTop: "4px solid #2196F3",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <p style={{ marginTop: "16px", color: "#666" }}>Loading...</p>
        </div>
      )}

      {/* Books Grid */}
      {!isLoading && (
        <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 24px 24px 24px" }}>
          {!hasSearched && recommendations.length > 0 && (
            <div style={{ marginBottom: "16px", padding: "12px", backgroundColor: "#e8f5e9", borderRadius: "4px", border: "1px solid #4CAF50" }}>
              <p style={{ margin: 0, color: "#2e7d32", fontWeight: "500" }}>
                Showing popular books based on global activity.
              </p>
            </div>
          )}
          {displayBooks.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: hasSearched
                  ? "repeat(auto-fill, minmax(550px, 1fr))"
                  : "repeat(auto-fill, minmax(350px, 1fr))",
                gap: "16px",
              }}
            >
              {displayBooks.map((result) => (
                <SearchResultCard key={result.book.id} result={result} />
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: "center",
                padding: "48px 24px",
                color: "#666",
              }}
            >
              <p style={{ fontSize: "18px", margin: 0 }}>
                {hasSearched ? "No books found" : "No books in library"}
              </p>
              {hasSearched && (
                <p style={{ fontSize: "14px", marginTop: "8px" }}>
                  Try a different search query
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
