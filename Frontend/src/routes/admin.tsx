import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/admin")({
  component: AdminPanel,
});

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

interface ConfigValue {
  value: string | number | boolean;
  type: "string" | "number" | "boolean";
  description: string;
}

function AdminPanel() {
  const [password, setPassword] = useState("");
  const [importCount, setImportCount] = useState("10");
  const [jaccardThreshold, setJaccardThreshold] = useState("0.1");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [config, setConfig] = useState<Record<string, ConfigValue>>({});
  const [configLoading, setConfigLoading] = useState(false);
  const [editingConfig, setEditingConfig] = useState<Record<string, any>>({});

  async function callAdminAPI(endpoint: string, body: any = {}) {
    if (!password) {
      setMessage({ type: "error", text: "Please enter admin password" });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);

      console.log(
        "Calling admin API: ",
        `${API_BASE_URL}/api/admin/${endpoint}`
      );
      const response = await fetch(`${API_BASE_URL}/api/admin/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Request failed");
      }

      setMessage({ type: "success", text: data.message || "Success!" });
      return data;
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Request failed",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleImportBooks() {
    const count = parseInt(importCount);
    if (isNaN(count) || count < 1 || count > 1000) {
      setMessage({ type: "error", text: "Count must be between 1 and 1000" });
      return;
    }
    await callAdminAPI("import-gutenberg", { count });
  }

  async function handleRebuildJaccard() {
    const threshold = parseFloat(jaccardThreshold);
    if (isNaN(threshold) || threshold < 0 || threshold > 1) {
      setMessage({ type: "error", text: "Threshold must be between 0 and 1" });
      return;
    }
    await callAdminAPI("rebuild-jaccard", { threshold });
  }

  async function handleCalculatePageRank() {
    await callAdminAPI("calculate-pagerank", {});
  }

  async function handleReindex() {
    await callAdminAPI("reindex", {});
  }

  async function handleUpdateStats() {
    await callAdminAPI("update-stats", {});
  }

  // Load configuration on mount
  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    if (!password) return;

    try {
      setConfigLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/admin/config`, {
        headers: {
          Authorization: `Bearer ${password}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load configuration");
      }

      const data = await response.json();
      setConfig(data.config);

      // Initialize editing values
      const initialEditing: Record<string, any> = {};
      Object.entries(data.config).forEach(([key, value]: [string, any]) => {
        initialEditing[key] = value.value;
      });
      setEditingConfig(initialEditing);
    } catch (err) {
      console.error("Error loading config:", err);
    } finally {
      setConfigLoading(false);
    }
  }

  async function handleUpdateConfig(key: string) {
    if (!password) {
      setMessage({ type: "error", text: "Please enter admin password" });
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);

      const response = await fetch(`${API_BASE_URL}/api/admin/config`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${password}`,
        },
        body: JSON.stringify({
          key,
          value: editingConfig[key],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Update failed");
      }

      setMessage({ type: "success", text: `${key} updated successfully` });

      // Reload config to get fresh values
      await loadConfig();
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Update failed",
      });
    } finally {
      setIsLoading(false);
    }
  }

  function handleConfigChange(key: string, value: any, type: string) {
    let parsedValue = value;

    if (type === "number") {
      parsedValue = parseFloat(value);
    } else if (type === "boolean") {
      parsedValue = value === "true" || value === true;
    }

    setEditingConfig({
      ...editingConfig,
      [key]: parsedValue,
    });
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fafafa" }}>
      {/* Header */}
      <header
        style={{
          backgroundColor: "#d32f2f",
          color: "white",
          padding: "16px 24px",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
        }}
      >
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <h1 style={{ margin: "0 0 8px 0", fontSize: "28px" }}>
            Admin Panel
          </h1>
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

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>
        {/* Password Input */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "24px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
            marginBottom: "24px",
          }}
        >
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontWeight: "600",
              color: "#333",
            }}
          >
            Admin Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "16px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              boxSizing: "border-box",
            }}
          />
          <p style={{ margin: "8px 0 0 0", fontSize: "12px", color: "#666" }}>
            Password is configured in Backend/.env file
          </p>
        </div>

        {/* Message Display */}
        {message && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "4px",
              marginBottom: "24px",
              backgroundColor:
                message.type === "success" ? "#e8f5e9" : "#ffebee",
              color: message.type === "success" ? "#2e7d32" : "#c62828",
              border: `1px solid ${message.type === "success" ? "#a5d6a7" : "#ef9a9a"}`,
            }}
          >
            {message.type === "success" ? "✓" : ""} {message.text}
          </div>
        )}

        {/* Import Books Section */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "24px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              margin: "0 0 16px 0",
              fontSize: "20px",
              fontWeight: "600",
            }}
          >
            📥 Import Books from Gutenberg
          </h2>
          <p style={{ margin: "0 0 16px 0", color: "#666", fontSize: "14px" }}>
            Download and index books from Project Gutenberg. The system will
            continue from the last imported book ID.
          </p>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "500",
                  fontSize: "14px",
                }}
              >
                Number of books (1-1000)
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={importCount}
                onChange={(e) => setImportCount(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "16px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button
              onClick={handleImportBooks}
              disabled={isLoading}
              style={{
                padding: "12px 24px",
                fontSize: "16px",
                backgroundColor: isLoading ? "#ccc" : "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isLoading ? "not-allowed" : "pointer",
                fontWeight: "500",
              }}
            >
              {isLoading ? "Processing..." : "Import"}
            </button>
          </div>
        </div>

        {/* Rebuild Jaccard Section */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "24px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              margin: "0 0 16px 0",
              fontSize: "20px",
              fontWeight: "600",
            }}
          >
            🔗 Rebuild Jaccard Graph
          </h2>
          <p style={{ margin: "0 0 16px 0", color: "#666", fontSize: "14px" }}>
            Rebuild the similarity graph between books. Run this after importing
            new books.
          </p>
          <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontWeight: "500",
                  fontSize: "14px",
                }}
              >
                Similarity Threshold (0-1)
              </label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={jaccardThreshold}
                onChange={(e) => setJaccardThreshold(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px",
                  fontSize: "16px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button
              onClick={handleRebuildJaccard}
              disabled={isLoading}
              style={{
                padding: "12px 24px",
                fontSize: "16px",
                backgroundColor: isLoading ? "#ccc" : "#FF9800",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: isLoading ? "not-allowed" : "pointer",
                fontWeight: "500",
              }}
            >
              {isLoading ? "Processing..." : "Rebuild"}
            </button>
          </div>
        </div>

        {/* Calculate PageRank Section */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "24px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              margin: "0 0 16px 0",
              fontSize: "20px",
              fontWeight: "600",
            }}
          >
            Calculate PageRank
          </h2>
          <p style={{ margin: "0 0 16px 0", color: "#666", fontSize: "14px" }}>
            Calculate PageRank scores for all books based on the Jaccard graph.
            Run this after rebuilding the Jaccard graph.
          </p>
          <button
            onClick={handleCalculatePageRank}
            disabled={isLoading}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              backgroundColor: isLoading ? "#ccc" : "#2196F3",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontWeight: "500",
            }}
          >
            {isLoading ? "Processing..." : "Calculate PageRank"}
          </button>
        </div>

        {/* Reindex Section */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "24px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              margin: "0 0 16px 0",
              fontSize: "20px",
              fontWeight: "600",
            }}
          >
            Reindex All Books
          </h2>
          <p style={{ margin: "0 0 16px 0", color: "#666", fontSize: "14px" }}>
            Rebuild the search index for all books. This updates character
            positions and term frequencies. Use this if the index becomes
            corrupted or after database changes.
          </p>
          <button
            onClick={handleReindex}
            disabled={isLoading}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              backgroundColor: isLoading ? "#ccc" : "#9C27B0",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontWeight: "500",
            }}
          >
            {isLoading ? "Processing..." : "Reindex"}
          </button>
        </div>

        {/* Update Stats Section */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "24px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          }}
        >
          <h2
            style={{
              margin: "0 0 16px 0",
              fontSize: "20px",
              fontWeight: "600",
            }}
          >
            Update Library Statistics
          </h2>
          <p style={{ margin: "0 0 16px 0", color: "#666", fontSize: "14px" }}>
            Recalculate library statistics (total books, total words, etc.) from
            the database. Use this if the statistics are showing incorrect values.
          </p>
          <button
            onClick={handleUpdateStats}
            disabled={isLoading}
            style={{
              padding: "12px 24px",
              fontSize: "16px",
              backgroundColor: isLoading ? "#ccc" : "#00BCD4",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontWeight: "500",
            }}
          >
            {isLoading ? "Processing..." : "Update Statistics"}
          </button>
        </div>

        {/* Configuration Management */}
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "8px",
            padding: "24px",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
            marginBottom: "24px",
          }}
        >
          <h2
            style={{
              margin: "0 0 16px 0",
              fontSize: "20px",
              fontWeight: "600",
            }}
          >
            Application Configuration
          </h2>
          <p style={{ margin: "0 0 16px 0", color: "#666", fontSize: "14px" }}>
            Configure application constants. Changes take effect immediately.
          </p>

          {configLoading ? (
            <p style={{ color: "#666" }}>Loading configuration...</p>
          ) : Object.keys(config).length === 0 ? (
            <div>
              <p style={{ color: "#666", marginBottom: "12px" }}>
                Enter admin password and click "Load Configuration" to view and edit settings.
              </p>
              <button
                onClick={loadConfig}
                disabled={!password || isLoading}
                style={{
                  padding: "12px 24px",
                  fontSize: "16px",
                  backgroundColor: !password || isLoading ? "#ccc" : "#607D8B",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: !password || isLoading ? "not-allowed" : "pointer",
                  fontWeight: "500",
                }}
              >
                Load Configuration
              </button>
            </div>
          ) : (
            <div>
              {/* Group configurations by category */}
              {[
                {
                  title: "Tokenizer Settings",
                  keys: Object.keys(config).filter((k) =>
                    k.startsWith("TOKENIZER_")
                  ),
                },
                {
                  title: "Search Highlighting",
                  keys: Object.keys(config).filter((k) =>
                    k.startsWith("SEARCH_HIGHLIGHT_")
                  ),
                },
                {
                  title: "Search Scoring (BM25)",
                  keys: Object.keys(config).filter((k) =>
                    k.startsWith("SEARCH_SCORING_")
                  ),
                },
                {
                  title: "Other Settings",
                  keys: Object.keys(config).filter(
                    (k) =>
                      !k.startsWith("TOKENIZER_") &&
                      !k.startsWith("SEARCH_HIGHLIGHT_") &&
                      !k.startsWith("SEARCH_SCORING_")
                  ),
                },
              ].map(
                (category) =>
                  category.keys.length > 0 && (
                    <div
                      key={category.title}
                      style={{
                        marginBottom: "24px",
                        paddingBottom: "24px",
                        borderBottom: "1px solid #eee",
                      }}
                    >
                      <h3
                        style={{
                          margin: "0 0 16px 0",
                          fontSize: "16px",
                          fontWeight: "600",
                          color: "#555",
                        }}
                      >
                        {category.title}
                      </h3>
                      <div
                        style={{
                          display: "grid",
                          gap: "16px",
                        }}
                      >
                        {category.keys.map((key) => {
                          const configValue = config[key];
                          return (
                            <div
                              key={key}
                              style={{
                                padding: "16px",
                                backgroundColor: "#f9f9f9",
                                borderRadius: "4px",
                                border: "1px solid #e0e0e0",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "flex-start",
                                  gap: "16px",
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <label
                                    style={{
                                      display: "block",
                                      fontWeight: "600",
                                      fontSize: "14px",
                                      marginBottom: "4px",
                                      color: "#333",
                                    }}
                                  >
                                    {key}
                                  </label>
                                  <p
                                    style={{
                                      margin: "0 0 12px 0",
                                      fontSize: "12px",
                                      color: "#666",
                                    }}
                                  >
                                    {configValue.description}
                                  </p>
                                  <div
                                    style={{
                                      display: "flex",
                                      gap: "8px",
                                      alignItems: "center",
                                    }}
                                  >
                                    {configValue.type === "boolean" ? (
                                      <select
                                        value={String(editingConfig[key])}
                                        onChange={(e) =>
                                          handleConfigChange(
                                            key,
                                            e.target.value,
                                            configValue.type
                                          )
                                        }
                                        style={{
                                          padding: "8px",
                                          fontSize: "14px",
                                          border: "1px solid #ddd",
                                          borderRadius: "4px",
                                          backgroundColor: "white",
                                        }}
                                      >
                                        <option value="true">true</option>
                                        <option value="false">false</option>
                                      </select>
                                    ) : (
                                      <input
                                        type={
                                          configValue.type === "number"
                                            ? "number"
                                            : "text"
                                        }
                                        value={editingConfig[key]}
                                        onChange={(e) =>
                                          handleConfigChange(
                                            key,
                                            e.target.value,
                                            configValue.type
                                          )
                                        }
                                        step={
                                          configValue.type === "number"
                                            ? "any"
                                            : undefined
                                        }
                                        style={{
                                          padding: "8px",
                                          fontSize: "14px",
                                          border: "1px solid #ddd",
                                          borderRadius: "4px",
                                          width: "200px",
                                        }}
                                      />
                                    )}
                                    <button
                                      onClick={() => handleUpdateConfig(key)}
                                      disabled={
                                        isLoading ||
                                        editingConfig[key] === configValue.value
                                      }
                                      style={{
                                        padding: "8px 16px",
                                        fontSize: "14px",
                                        backgroundColor:
                                          isLoading ||
                                          editingConfig[key] === configValue.value
                                            ? "#ccc"
                                            : "#4CAF50",
                                        color: "white",
                                        border: "none",
                                        borderRadius: "4px",
                                        cursor:
                                          isLoading ||
                                          editingConfig[key] === configValue.value
                                            ? "not-allowed"
                                            : "pointer",
                                        fontWeight: "500",
                                      }}
                                    >
                                      {isLoading ? "Saving..." : "Save"}
                                    </button>
                                  </div>
                                  <p
                                    style={{
                                      margin: "8px 0 0 0",
                                      fontSize: "12px",
                                      color: "#999",
                                    }}
                                  >
                                    Current: {String(configValue.value)} (
                                    {configValue.type})
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
