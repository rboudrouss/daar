/**
 * Backend - Moteur de recherche de bibliothèque
 */

import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { initDatabase, closeDatabase } from "./db/connection.js";
import booksRoutes from "./routes/books.js";

// Initialiser la base de données
const dbPath = process.env.DB_PATH || "./data/library.db";
initDatabase(dbPath);

// Créer l'application Hono
const app = new Hono();

// Middlewares
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Routes
app.get("/", (c) => {
  return c.json({
    name: "Library Search Engine API",
    version: "1.0.0",
    endpoints: {
      search: "/api/search?q=query",
      advancedSearch: "/api/search/advanced?regex=pattern",
      suggestions: "/api/search/suggestions?bookId=123",
      books: "/api/books",
      bookById: "/api/books/:id",
      stats: "/api/books/stats",
      uploadCover: "POST /api/books/:id/cover",
      getCover: "GET /api/books/:id/cover",
    },
  });
});

app.route("/api/books", booksRoutes);

// Gestion des erreurs
app.onError((err, c) => {
  console.error("Error:", err);
  return c.json(
    {
      error: "Internal Server Error",
      message: err.message,
    },
    500
  );
});

// Démarrer le serveur
const port = parseInt(process.env.PORT || "3000");

console.log(`\nStarting Library Search Engine API...`);

serve({
  fetch: app.fetch,
  port,
});

// Gérer l'arrêt propre
process.on("SIGINT", () => {
  console.log("\n\nShutting down gracefully...");
  closeDatabase();
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n\nShutting down gracefully...");
  closeDatabase();
  process.exit(0);
});
