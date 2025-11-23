/**
 * Calcul de PageRank en utilisant les algorithmes de lib/
 */

import { computePageRank, type Graph } from "@monorepo/lib";
import { getDatabase, withTransaction } from "../db/connection.js";
import { IndexingProgress, PageRankScore } from "../utils/types.js";
import {
  PAGERANK_DEFAULT_DAMPING,
  PAGERANK_DEFAULT_MAX_ITERATIONS,
  PAGERANK_DEFAULT_TOLERANCE,
} from "../utils/const.js";

/**
 * Configuration pour le calcul de PageRank
 */
export interface PageRankConfig {
  damping: number; // Facteur d'amortissement (typiquement 0.85)
  maxIterations: number; // Nombre maximum d'itérations
  tolerance: number; // Seuil de convergence
}

/**
 * Calculateur de PageRank
 */
export class PageRankCalculator {
  private db;
  private config: PageRankConfig;

  constructor(config: Partial<PageRankConfig> = {}) {
    this.db = getDatabase();
    this.config = {
      damping: config.damping ?? PAGERANK_DEFAULT_DAMPING,
      maxIterations: config.maxIterations ?? PAGERANK_DEFAULT_MAX_ITERATIONS,
      tolerance: config.tolerance ?? PAGERANK_DEFAULT_TOLERANCE,
    };
  }

  /**
   * Construit le graphe à partir des arêtes Jaccard
   */
  private buildGraphFromJaccard(): Graph {
    console.log("Building graph from Jaccard edges...");

    // Récupérer tous les livres
    const books = this.db
      .prepare("SELECT id FROM books ORDER BY id")
      .all() as Array<{ id: number }>;
    const nodes = books.map((b) => b.id);

    // Récupérer toutes les arêtes Jaccard
    const jaccardEdges = this.db
      .prepare(
        `
      SELECT book_id_1, book_id_2, similarity FROM jaccard_edges
    `
      )
      .all() as Array<{
      book_id_1: number;
      book_id_2: number;
      similarity: number;
    }>;

    // Créer les arêtes bidirectionnelles (graphe non-orienté)
    const edges: [number, number][] = [];
    for (const edge of jaccardEdges) {
      // Arête dans les deux sens (graphe non-orienté)
      edges.push([edge.book_id_1, edge.book_id_2]);
      edges.push([edge.book_id_2, edge.book_id_1]);
    }

    console.log(`   Nodes: ${nodes.length}`);
    console.log(
      `   Edges: ${edges.length} (${jaccardEdges.length} undirected)`
    );

    return { nodes, edges };
  }

  /**
   * Calcule le PageRank pour tous les livres
   */
  calculatePageRank(
    onProgress?: (progress: IndexingProgress) => void
  ): PageRankScore[] {
    console.log("\nCalculating PageRank...");
    console.log(`   Damping: ${this.config.damping}`);
    console.log(`   Max iterations: ${this.config.maxIterations}`);
    console.log(`   Tolerance: ${this.config.tolerance}\n`);

    if (onProgress) {
      onProgress({
        currentBook: 0,
        totalBooks: 0,
        currentPhase: "pagerank",
        message: "Building graph from Jaccard edges...",
        percentage: 0,
      });
    }

    // Construire le graphe
    const graph = this.buildGraphFromJaccard();

    if (graph.nodes.length === 0) {
      console.log(" No books found in database");
      return [];
    }

    if (graph.edges.length === 0) {
      console.log(" No Jaccard edges found. Run buildJaccardGraph() first.");
      return [];
    }

    if (onProgress) {
      onProgress({
        currentBook: 0,
        totalBooks: graph.nodes.length,
        currentPhase: "pagerank",
        message: "Computing PageRank...",
        percentage: 50,
      });
    }

    // Calculer PageRank avec métriques
    const startTime = Date.now();
    const result = computePageRank(
      graph,
      this.config.damping,
      this.config.maxIterations,
      this.config.tolerance,
      true // withMetrics
    );

    const elapsed = (Date.now() - startTime) / 1000;

    console.log(`PageRank computed in ${elapsed.toFixed(2)}s`);
    console.log(`   Iterations: ${result.iterations}`);
    console.log(`   Converged: ${result.converged}`);
    console.log(`   Final diff: ${result.finalDiff.toExponential(2)}\n`);

    // Créer les scores (associer les ranks aux book IDs)
    const scores: PageRankScore[] = graph.nodes.map((bookId, index) => ({
      bookId,
      score: result.ranks[index],
    }));

    // Insérer dans la DB
    this.insertPageRankScores(scores);

    if (onProgress) {
      onProgress({
        currentBook: graph.nodes.length,
        totalBooks: graph.nodes.length,
        currentPhase: "pagerank",
        message: "PageRank calculation complete",
        percentage: 100,
      });
    }

    // Mettre à jour les métadonnées
    this.db
      .prepare(
        `
      UPDATE library_metadata SET value = 'true', updated_at = CURRENT_TIMESTAMP 
      WHERE key = 'pagerank_calculated'
    `
      )
      .run();

    return scores;
  }

  /**
   * Insère les scores PageRank dans la DB
   */
  private insertPageRankScores(scores: PageRankScore[]): void {
    const insertScore = this.db.prepare(`
      INSERT OR REPLACE INTO pagerank (book_id, score, last_updated)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);

    withTransaction(() => {
      for (const { bookId, score } of scores) {
        insertScore.run(bookId, score);
      }
    });

    console.log(`Stored ${scores.length} PageRank scores in database\n`);
  }

  /**
   * Récupère les scores PageRank de tous les livres
   */
  getPageRankScores(): Map<number, number> {
    const scores = this.db
      .prepare(
        `
      SELECT book_id, score FROM pagerank
    `
      )
      .all() as Array<{ book_id: number; score: number }>;

    return new Map(scores.map((s) => [s.book_id, s.score]));
  }

  /**
   * Récupère le score PageRank d'un livre
   */
  getBookPageRank(bookId: number): number | null {
    const result = this.db
      .prepare(
        `
      SELECT score FROM pagerank WHERE book_id = ?
    `
      )
      .get(bookId) as { score: number } | undefined;

    return result?.score ?? null;
  }

  /**
   * Récupère les livres avec les meilleurs scores PageRank
   */
  getTopPageRankBooks(
    limit: number = 10
  ): Array<{ bookId: number; score: number }> {
    const results = this.db
      .prepare(
        `
      SELECT book_id, score FROM pagerank
      ORDER BY score DESC
      LIMIT ?
    `
      )
      .all(limit) as Array<{ book_id: number; score: number }>;

    return results.map((r) => ({ bookId: r.book_id, score: r.score }));
  }
}
