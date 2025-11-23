import { useState } from "react";

export type SearchMode = "bm25" | "regex";

interface SearchBarProps {
  defaultValue?: string;
  onChange?: (value: string, mode: SearchMode) => void;
  onSearch?: (value: string, mode: SearchMode) => void;
}

export default function SearchBar({
  defaultValue = "",
  onChange,
  onSearch,
}: SearchBarProps) {
  const [searchMode, setSearchMode] = useState<SearchMode>("bm25");
  const [inputValue, setInputValue] = useState(defaultValue);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    onChange?.(value, searchMode);
  };

  const handleSearch = () => {
    onSearch?.(inputValue, searchMode);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        marginBottom: "16px",
        padding: "16px",
        backgroundColor: "#f5f5f5",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div style={{ flex: 1, display: "flex", gap: "8px" }}>
        <input
          type="text"
          placeholder={
            searchMode === "bm25"
              ? "Search books by title, author, or content..."
              : "Enter regex pattern (e.g., \\bword\\b)"
          }
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            padding: "12px",
            fontSize: "16px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            outline: "none",
          }}
        />
        <button
          onClick={handleSearch}
          style={{
            padding: "12px 24px",
            fontSize: "16px",
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "500",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#1976D2";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#2196F3";
          }}
        >
          Search
        </button>
      </div>
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}
      >
        <label style={{ fontSize: "14px", fontWeight: "500" }}>Mode:</label>
        <select
          value={searchMode}
          onChange={(e) => {
            const mode = e.target.value as SearchMode;
            setSearchMode(mode);
            onChange?.(inputValue, mode);
          }}
          style={{
            padding: "8px 12px",
            fontSize: "14px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            backgroundColor: "white",
            cursor: "pointer",
          }}
        >
          <option value="bm25">BM25 (Smart Search)</option>
          <option value="regex">Regex (Advanced)</option>
        </select>
      </div>
    </div>
  );
}
