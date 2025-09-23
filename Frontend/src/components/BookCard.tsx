import type { Book } from "@/utils";

export default function BookCard({
  book: { Title, Author, Language, link },
}: {
  book: Book;
}) {
  return (
    <a
      style={{
        border: "1px solid #ccc",
        borderRadius: "8px",
        padding: "16px",
        margin: "8px",
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
        transition: "transform 0.2s",
        cursor: "pointer",
        maxWidth: "300px",
        backgroundColor: "#f9f9f9",
        display: "flex",
      }}
      href={`/${link}`}
    >
      <div>
        <h2>{Title}</h2>
        <p>Author: {Author}</p>
        <p>Language: {Language}</p>
      </div>
      <img
        src={`https://www.gutenberg.org/cache/epub/${link}/pg${link}.cover.medium.jpg`}
        alt={`Cover of ${Title}`}
        style={{ marginLeft: "auto", height: "150px", objectFit: "contain" }}
        loading="lazy"
      />
    </a>
  );
}
