/**
 * Connexion à la base de données SQLite
 */

import Database from "better-sqlite3";
import { readFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db: Database.Database | null = null;

/**
 * Initialise la connexion à la base de données
 */
export function initDatabase(
  dbPath: string = "./data/library.db"
): Database.Database {
  if (db) {
    return db;
  }

  console.log(`Initializing database at ${dbPath}...`);

  // Ensure the data directory exists
  const dataDir = dirname(dbPath);
  if (dataDir && dataDir !== "." && !existsSync(dataDir)) {
    console.log(`Creating data directory: ${dataDir}`);
    mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === "development" ? console.log : undefined,
  });

  // Optimisations SQLite
  db.pragma("journal_mode = WAL"); // Write-Ahead Logging pour meilleures performances
  db.pragma("synchronous = NORMAL"); // Balance entre sécurité et performance
  db.pragma("cache_size = -64000"); // 64MB de cache
  db.pragma("temp_store = MEMORY"); // Stocke les tables temporaires en RAM
  db.pragma("mmap_size = 30000000000"); // Memory-mapped I/O

  // Charger et exécuter le schéma
  const schemaPath = join(__dirname, "schema.sql");
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);

  console.log("Database initialized successfully");

  return db;
}

/**
 * Récupère la connexion à la base de données
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error("Database not initialized. Call initDatabase() first.");
  }
  return db;
}

/**
 * Ferme la connexion à la base de données
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log("Database connection closed");
  }
}

/**
 * Exécute une fonction dans une transaction
 */
export function transaction<T>(fn: (db: Database.Database) => T): T {
  const database = getDatabase();
  const txn = database.transaction(fn);
  return txn(database);
}

/**
 * Exécute une fonction dans une transaction (version async-friendly)
 */
export function withTransaction<T>(fn: () => T): T {
  const database = getDatabase();
  database.exec("BEGIN TRANSACTION");
  try {
    const result = fn();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}
