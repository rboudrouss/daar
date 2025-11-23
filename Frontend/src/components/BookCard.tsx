import type { Book, SearchResult, TextSnippet } from "@/utils";
import { getCoverImageUrl, trackBookClick } from "@/utils/api";

interface BookCardProps {
  book: Book;
  score?: number;
  matchedTerms?: string[];
  snippets?: TextSnippet[];
  showPageRank?: boolean;
}

export default function BookCard({
  book,
  score,
  matchedTerms,
  snippets,
  showPageRank = true,
}: BookCardProps) {
  const coverUrl = book.coverImagePath
    ? getCoverImageUrl(book.id)
    : "/book.png";

  const handleClick = () => {
    // Track the click for recommendations
    trackBookClick(book.id);
  };

  return (
    <a
      style={{
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "16px",
        margin: "8px",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
        transition: "transform 0.2s, box-shadow 0.2s",
        cursor: "pointer",
        maxWidth: snippets && snippets.length > 0 ? "600px" : "350px", // Élargir si snippets
        backgroundColor: "#f9f9f9",
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
      }}
      href={`/book/${book.id}`}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "0 8px 16px rgba(0, 0, 0, 0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 0, 0, 0.1)";
      }}
    >
      <div style={{ display: "flex", gap: "12px" }}>
        <img
          src={coverUrl}
          alt={`Cover of ${book.title}`}
          style={{
            width: "100px",
            height: "150px",
            objectFit: "cover",
            borderRadius: "4px",
            flexShrink: 0,
          }}
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "/book.png";
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: "0 0 8px 0",
              fontSize: "18px",
              fontWeight: "600",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {book.title}
          </h3>
          <p
            style={{
              margin: "0 0 4px 0",
              color: "#666",
              fontSize: "14px",
            }}
          >
            <strong>Author:</strong> {book.author}
          </p>
          <p
            style={{
              margin: "0 0 4px 0",
              color: "#888",
              fontSize: "12px",
            }}
          >
            {book.wordCount.toLocaleString()} words
          </p>
          {book.clickCount !== undefined && book.clickCount > 0 && (
            <p
              style={{
                margin: "0 0 4px 0",
                color: "#FF9800",
                fontSize: "12px",
                fontWeight: "500",
              }}
            >
              👆 {book.clickCount.toLocaleString()} click{book.clickCount !== 1 ? 's' : ''}
            </p>
          )}
          {showPageRank && book.pageRank !== undefined && (
            <p
              style={{
                margin: "4px 0 0 0",
                color: "#4CAF50",
                fontSize: "12px",
                fontWeight: "500",
              }}
            >
              ⭐ PageRank: {book.pageRank.toFixed(6)}
            </p>
          )}
        </div>
      </div>
      {score !== undefined && (
        <div
          style={{
            marginTop: "12px",
            padding: "8px",
            backgroundColor: "#e3f2fd",
            borderRadius: "4px",
            fontSize: "12px",
          }}
        >
          <strong>BM25 Score:</strong> {score.toFixed(4)}
          {matchedTerms && matchedTerms.length > 0 && (
            <div style={{ marginTop: "4px" }}>
              <strong>Matched:</strong>{" "}
              {matchedTerms.slice(0, 5).join(", ")}
              {matchedTerms.length > 5 && ` +${matchedTerms.length - 5} more`}
            </div>
          )}
        </div>
      )}

      {/* Afficher les snippets avec highlighting */}
      {snippets && snippets.length > 0 && (
        <div
          style={{
            marginTop: "12px",
            padding: "12px",
            backgroundColor: "#fff3e0",
            borderRadius: "4px",
            borderLeft: "3px solid #ff9800",
          }}
        >
          <div style={{ fontSize: "12px", fontWeight: "600", marginBottom: "8px", color: "#e65100" }}>
            📝 Highlights:
          </div>
          {snippets.map((snippet, index) => (
            <div
              key={index}
              style={{
                marginBottom: index < snippets.length - 1 ? "8px" : "0",
                padding: "8px",
                backgroundColor: "white",
                borderRadius: "3px",
                fontSize: "13px",
                lineHeight: "1.5",
              }}
            >
              <div
                dangerouslySetInnerHTML={{ __html: snippet.text }}
                style={{
                  color: "#333",
                }}
              />
              {snippet.matchedTerms.length > 0 && (
                <div style={{ marginTop: "4px", fontSize: "11px", color: "#666" }}>
                  <em>Matched: {snippet.matchedTerms.join(", ")}</em>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </a>
  );
}

// Helper component for search results
export function SearchResultCard({ result }: { result: SearchResult }) {
  return (
    <BookCard
      book={result.book}
      score={result.score}
      matchedTerms={result.matchedTerms}
      snippets={result.snippets}
    />
  );
}
