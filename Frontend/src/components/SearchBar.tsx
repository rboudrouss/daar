import { useState } from "react";

export type SearchMode = "bm25" | "regex";

export interface AdvancedSearchOptions {
  // Filtres
  author?: string;
  minWordCount?: number;
  maxWordCount?: number;
  minPageRank?: number;
  // Options BM25
  fuzzy?: boolean;
  fuzzyDistance?: number;
  highlight?: boolean;
  // Multi-champs
  searchFields?: ("title" | "author" | "content")[];
  // Regex options
  caseSensitive?: boolean;
}

interface SearchBarProps {
  defaultValue?: string;
  onChange?: (value: string, mode: SearchMode, options: AdvancedSearchOptions) => void;
  onSearch?: (value: string, mode: SearchMode, options: AdvancedSearchOptions) => void;
}

export default function SearchBar({
  defaultValue = "",
  onChange,
  onSearch,
}: SearchBarProps) {
  const [searchMode, setSearchMode] = useState<SearchMode>("bm25");
  const [inputValue, setInputValue] = useState(defaultValue);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Options avancées
  const [options, setOptions] = useState<AdvancedSearchOptions>({
    fuzzyDistance: 2,
    searchFields: ["title", "author", "content"],
    highlight: true, // Activer le highlighting par défaut
  });

  const handleInputChange = (value: string) => {
    setInputValue(value);
    onChange?.(value, searchMode, options);
  };

  const handleSearch = () => {
    onSearch?.(inputValue, searchMode, options);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const updateOption = <K extends keyof AdvancedSearchOptions>(
    key: K,
    value: AdvancedSearchOptions[K]
  ) => {
    const newOptions = { ...options, [key]: value };
    setOptions(newOptions);
    onChange?.(inputValue, searchMode, newOptions);
  };

  const toggleSearchField = (field: "title" | "author" | "content") => {
    const currentFields = options.searchFields || [];
    const newFields = currentFields.includes(field)
      ? currentFields.filter((f) => f !== field)
      : [...currentFields, field];
    updateOption("searchFields", newFields);
  };

  return (
    <div
      style={{
        marginBottom: "16px",
        padding: "16px",
        backgroundColor: "#f5f5f5",
        borderRadius: "8px",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
      }}
    >
      {/* Barre de recherche principale */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
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
              onChange?.(inputValue, mode, options);
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
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{
              padding: "8px 16px",
              fontSize: "14px",
              backgroundColor: showAdvanced ? "#4CAF50" : "#757575",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            {showAdvanced ? "Hide" : "Advanced"}
          </button>
        </div>
      </div>

      {/* Options avancées */}
      {showAdvanced && (
        <div
          style={{
            padding: "16px",
            backgroundColor: "white",
            borderRadius: "4px",
            border: "1px solid #ddd",
          }}
        >
          <h3 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>
            Advanced Options
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            {/* Filtres */}
            <div>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}>
                Filters
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Author filter"
                  value={options.author || ""}
                  onChange={(e) => updateOption("author", e.target.value || undefined)}
                  style={{
                    padding: "8px",
                    fontSize: "14px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
                <input
                  type="number"
                  placeholder="Min word count"
                  value={options.minWordCount || ""}
                  onChange={(e) =>
                    updateOption(
                      "minWordCount",
                      e.target.value ? parseInt(e.target.value) : undefined
                    )
                  }
                  style={{
                    padding: "8px",
                    fontSize: "14px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
                <input
                  type="number"
                  placeholder="Max word count"
                  value={options.maxWordCount || ""}
                  onChange={(e) =>
                    updateOption(
                      "maxWordCount",
                      e.target.value ? parseInt(e.target.value) : undefined
                    )
                  }
                  style={{
                    padding: "8px",
                    fontSize: "14px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                  }}
                />
              </div>
            </div>

            {/* Options BM25 */}
            {searchMode === "bm25" && (
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}>
                  BM25 Options
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="checkbox"
                      checked={options.fuzzy || false}
                      onChange={(e) => updateOption("fuzzy", e.target.checked)}
                    />
                    <span style={{ fontSize: "14px" }}>Fuzzy search</span>
                  </label>
                  {options.fuzzy && (
                    <input
                      type="number"
                      placeholder="Fuzzy distance (1-3)"
                      min="1"
                      max="3"
                      value={options.fuzzyDistance || 2}
                      onChange={(e) =>
                        updateOption("fuzzyDistance", parseInt(e.target.value))
                      }
                      style={{
                        padding: "8px",
                        fontSize: "14px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                      }}
                    />
                  )}
                  <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="checkbox"
                      checked={options.highlight || false}
                      onChange={(e) => updateOption("highlight", e.target.checked)}
                    />
                    <span style={{ fontSize: "14px" }}>Highlight matches</span>
                  </label>
                </div>
              </div>
            )}

            {/* Options Regex */}
            {searchMode === "regex" && (
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}>
                  Regex Options
                </h4>
                <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={options.caseSensitive || false}
                    onChange={(e) => updateOption("caseSensitive", e.target.checked)}
                  />
                  <span style={{ fontSize: "14px" }}>Case sensitive</span>
                </label>
              </div>
            )}
          </div>

          {/* Champs de recherche */}
          {searchMode === "bm25" && (
            <div style={{ marginTop: "16px" }}>
              <h4 style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}>
                Search Fields
              </h4>
              <div style={{ display: "flex", gap: "16px" }}>
                {(["title", "author", "content"] as const).map((field) => (
                  <label
                    key={field}
                    style={{ display: "flex", alignItems: "center", gap: "8px" }}
                  >
                    <input
                      type="checkbox"
                      checked={options.searchFields?.includes(field) || false}
                      onChange={() => toggleSearchField(field)}
                    />
                    <span style={{ fontSize: "14px", textTransform: "capitalize" }}>
                      {field}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
