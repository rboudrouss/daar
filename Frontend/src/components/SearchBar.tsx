import { useState, useEffect, useRef } from "react";

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
  onChange?: (
    value: string,
    mode: SearchMode,
    options: AdvancedSearchOptions
  ) => void;
  onSearch?: (
    value: string,
    mode: SearchMode,
    options: AdvancedSearchOptions
  ) => void;
}

export default function SearchBar({
  defaultValue = "",
  onChange,
  onSearch,
}: SearchBarProps) {
  const [searchMode, setSearchMode] = useState<SearchMode>("bm25");
  const [inputValue, setInputValue] = useState(defaultValue);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isDebouncing, setIsDebouncing] = useState(false);

  // Options avancées
  const [options, setOptions] = useState<AdvancedSearchOptions>({
    fuzzyDistance: 2,
    searchFields: ["title", "author", "content"],
    highlight: true, // Activer le highlighting par défaut
  });

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (value: string) => {
    setInputValue(value);
    onChange?.(value, searchMode, options);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Show debouncing indicator
    setIsDebouncing(true);

    // Set new timer to trigger search after short inactivity
    debounceTimerRef.current = setTimeout(() => {
      setIsDebouncing(false);
      onSearch?.(value, searchMode, options);
    }, 50);
  };

  const handleSearch = () => {
    // Clear debounce timer if user manually triggers search
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    setIsDebouncing(false);
    onSearch?.(inputValue, searchMode, options);
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

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

    // Trigger search automatically when options change (if there's a query)
    if (inputValue.trim()) {
      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      // Show debouncing indicator
      setIsDebouncing(true);
      // Trigger search with new options after short delay
      debounceTimerRef.current = setTimeout(() => {
        setIsDebouncing(false);
        onSearch?.(inputValue, searchMode, newOptions);
      }, 300);
    }
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
        <div style={{ flex: 1, display: "flex", gap: "8px", position: "relative" }}>
          <input
            type="text"
            placeholder={
              searchMode === "bm25"
                ? "Search books by title, author, or content..."
                : "Enter regex pattern (e.g., cat|dog, .*test.*)"
            }
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              padding: "12px",
              paddingRight: isDebouncing ? "40px" : "12px",
              fontSize: "16px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              outline: "none",
            }}
          />
          {isDebouncing && (
            <div
              style={{
                position: "absolute",
                right: "120px",
                top: "50%",
                transform: "translateY(-50%)",
                width: "20px",
                height: "20px",
                border: "2px solid #e0e0e0",
                borderTop: "2px solid #2196F3",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
              }}
            />
          )}
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
      </div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
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

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "16px",
            }}
          >
            {/* Filtres */}
            <div>
              <h4
                style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}
              >
                Filters
              </h4>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                <input
                  type="text"
                  placeholder="Author filter"
                  value={options.author || ""}
                  onChange={(e) =>
                    updateOption("author", e.target.value || undefined)
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
                <h4
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "14px",
                    color: "#666",
                  }}
                >
                  BM25 Options
                </h4>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
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
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={options.highlight || false}
                      onChange={(e) =>
                        updateOption("highlight", e.target.checked)
                      }
                    />
                    <span style={{ fontSize: "14px" }}>Highlight matches</span>
                  </label>
                </div>
              </div>
            )}

            {/* Options Regex */}
            {searchMode === "regex" && (
              <div>
                <h4
                  style={{
                    margin: "0 0 8px 0",
                    fontSize: "14px",
                    color: "#666",
                  }}
                >
                  Regex Options
                </h4>
                <label
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <input
                    type="checkbox"
                    checked={options.caseSensitive || false}
                    onChange={(e) =>
                      updateOption("caseSensitive", e.target.checked)
                    }
                  />
                  <span style={{ fontSize: "14px" }}>Case sensitive</span>
                </label>

                {/* Aide sur la syntaxe regex */}
                <div
                  style={{
                    marginTop: "12px",
                    padding: "12px",
                    backgroundColor: "#f5f5f5",
                    borderRadius: "4px",
                    fontSize: "13px",
                    lineHeight: "1.6",
                  }}
                >
                  <div style={{ fontWeight: "600", marginBottom: "6px", color: "#333" }}>
                    Supported syntax:
                  </div>
                  <div style={{ color: "#666" }}>
                    • Literals: <code style={{ backgroundColor: "#e0e0e0", padding: "2px 4px", borderRadius: "2px" }}>abc</code>, <code style={{ backgroundColor: "#e0e0e0", padding: "2px 4px", borderRadius: "2px" }}>123</code>
                    <br />
                    • Operators: <code style={{ backgroundColor: "#e0e0e0", padding: "2px 4px", borderRadius: "2px" }}>*</code> (zero or more), <code style={{ backgroundColor: "#e0e0e0", padding: "2px 4px", borderRadius: "2px" }}>+</code> (one or more), <code style={{ backgroundColor: "#e0e0e0", padding: "2px 4px", borderRadius: "2px" }}>?</code> (optional)
                    <br />
                    • Alternation: <code style={{ backgroundColor: "#e0e0e0", padding: "2px 4px", borderRadius: "2px" }}>cat|dog</code>
                    <br />
                    • Grouping: <code style={{ backgroundColor: "#e0e0e0", padding: "2px 4px", borderRadius: "2px" }}>(ab)+</code>
                    <br />
                    • Any char: <code style={{ backgroundColor: "#e0e0e0", padding: "2px 4px", borderRadius: "2px" }}>.</code>
                    <br />
                    • Escape: <code style={{ backgroundColor: "#e0e0e0", padding: "2px 4px", borderRadius: "2px" }}>\*</code> for literal *
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "12px", color: "#999", fontStyle: "italic" }}>
                    Do not use slashes (e.g., /pattern/). Enter pattern directly.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Champs de recherche */}
          {searchMode === "bm25" && (
            <div style={{ marginTop: "16px" }}>
              <h4
                style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}
              >
                Search Fields
              </h4>
              <div style={{ display: "flex", gap: "16px" }}>
                {(["title", "author", "content"] as const).map((field) => (
                  <label
                    key={field}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={options.searchFields?.includes(field) || false}
                      onChange={() => toggleSearchField(field)}
                    />
                    <span
                      style={{ fontSize: "14px", textTransform: "capitalize" }}
                    >
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
