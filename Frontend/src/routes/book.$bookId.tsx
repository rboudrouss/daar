import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import type { Book, SuggestionResult } from "@/utils";
import { getBookById, getBookSuggestions, getCoverImageUrl } from "@/utils/api";
import BookCard from "@/components/BookCard";

export const Route = createFileRoute("/book/$bookId")({
  component: BookDetailPage,
});

function BookDetailPage() {
  const { bookId } = Route.useParams();
  const [book, setBook] = useState<Book | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBookData();
  }, [bookId]);

  async function loadBookData() {
    try {
      setIsLoading(true);
      setError(null);

      const bookData = await getBookById(parseInt(bookId));
      setBook(bookData);

      // Load suggestions
      const suggestionsData = await getBookSuggestions(parseInt(bookId), 6);
      setSuggestions(suggestionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load book");
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
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
          <p style={{ marginTop: "16px", color: "#666" }}>Loading book...</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div style={{ minHeight: "100vh", padding: "24px" }}>
        <div
          style={{
            maxWidth: "800px",
            margin: "0 auto",
            backgroundColor: "#ffebee",
            color: "#c62828",
            padding: "16px",
            borderRadius: "4px",
            border: "1px solid #ef9a9a",
          }}
        >
          ⚠️ {error || "Book not found"}
        </div>
        <div style={{ maxWidth: "800px", margin: "16px auto" }}>
          <Link
            to="/"
            style={{
              color: "#2196F3",
              textDecoration: "none",
              fontWeight: "500",
            }}
          >
            ← Back to search
          </Link>
        </div>
      </div>
    );
  }

  const coverUrl = book.coverImagePath
    ? getCoverImageUrl(book.id)
    : "/book.png";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fafafa" }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: "#1976D2",
          color: "white",
          padding: "16px 24px",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <Link
            to="/"
            style={{
              color: "white",
              textDecoration: "none",
              fontSize: "14px",
              opacity: 0.9,
            }}
          >
            ← Back to search
          </Link>
        </div>
      </header>

      {/* Book Details */}
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "32px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
            marginBottom: "32px",
          }}
        >
          <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
            {/* Cover Image */}
            <div style={{ flexShrink: 0 }}>
              <img
                src={coverUrl}
                alt={`Cover of ${book.title}`}
                style={{
                  width: "250px",
                  height: "375px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/book.png";
                }}
              />
            </div>

            {/* Book Info */}
            <div style={{ flex: 1, minWidth: "300px" }}>
              <h1
                style={{
                  margin: "0 0 16px 0",
                  fontSize: "32px",
                  fontWeight: "700",
                  color: "#333",
                }}
              >
                {book.title}
              </h1>

              <div style={{ marginBottom: "24px" }}>
                <p
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "18px",
                    color: "#666",
                  }}
                >
                  <strong>Author:</strong> {book.author}
                </p>
                <p
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "16px",
                    color: "#888",
                  }}
                >
                  <strong>Word Count:</strong> {book.wordCount.toLocaleString()}
                </p>
                {book.pageRank !== undefined && (
                  <p
                    style={{
                      margin: "0 0 8px 0",
                      fontSize: "16px",
                      color: "#4CAF50",
                      fontWeight: "500",
                    }}
                  >
                    <strong>⭐ PageRank Score:</strong> {book.pageRank.toFixed(6)}
                  </p>
                )}
                <p
                  style={{
                    margin: "0",
                    fontSize: "14px",
                    color: "#999",
                  }}
                >
                  <strong>Added:</strong>{" "}
                  {new Date(book.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div
                style={{
                  padding: "16px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "4px",
                  borderLeft: "4px solid #2196F3",
                }}
              >
                <p style={{ margin: "0 0 8px 0", fontWeight: "600" }}>
                  About this book
                </p>
                <p style={{ margin: 0, fontSize: "14px", color: "#666" }}>
                  This book is part of our library collection and has been
                  indexed for full-text search using BM25 algorithm. The
                  PageRank score indicates its importance based on similarity
                  connections with other books in the library.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {suggestions.length > 0 && (
          <div>
            <h2
              style={{
                fontSize: "24px",
                fontWeight: "600",
                marginBottom: "16px",
                color: "#333",
              }}
            >
              📚 Similar Books (Jaccard Similarity)
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
                gap: "16px",
              }}
            >
              {suggestions.map((suggestion) => (
                <div key={suggestion.book.id}>
                  <BookCard book={suggestion.book} showPageRank={true} />
                  <div
                    style={{
                      marginTop: "-8px",
                      padding: "8px",
                      backgroundColor: "#e8f5e9",
                      borderRadius: "0 0 8px 8px",
                      fontSize: "12px",
                      textAlign: "center",
                    }}
                  >
                    <strong>Similarity:</strong> {(suggestion.similarity * 100).toFixed(2)}%
                    {suggestion.reason && (
                      <span style={{ marginLeft: "8px", color: "#666" }}>
                        ({suggestion.reason})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
