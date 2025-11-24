/**
 * Tests pour le moteur de recommandations (code réel avec mock DB)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { RecommendationEngine } from "../../src/search/recommendations";

describe("RecommendationEngine - Code réel avec mock DB", () => {
  let mockDb: any;
  let recommendationEngine: RecommendationEngine;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn((query: string) => {
        // Mock pour book_clicks (historique)
        if (query.includes("book_clicks") && query.includes("GROUP BY")) {
          return {
            all: () => [
              { book_id: 1, click_count: 100 },
              { book_id: 2, click_count: 50 },
            ],
          };
        }

        // Mock pour jaccard_edges (voisins)
        if (query.includes("jaccard_edges")) {
          return {
            all: (bookId: number) => {
              if (bookId === 1) {
                return [
                  { neighbor_id: 3, similarity: 0.8 },
                  { neighbor_id: 4, similarity: 0.6 },
                ];
              } else if (bookId === 2) {
                return [
                  { neighbor_id: 3, similarity: 0.7 },
                  { neighbor_id: 5, similarity: 0.5 },
                ];
              }
              return [];
            },
          };
        }

        // Mock pour récupérer les données des livres
        if (query.includes("SELECT b.id, b.title")) {
          return {
            all: (...bookIds: number[]) => {
              return bookIds.map((id) => ({
                id,
                title: `Book ${id}`,
                author: `Author ${id}`,
                file_path: `/path/to/book${id}.txt`,
                cover_image_path: `/path/to/cover${id}.jpg`,
                word_count: 10000,
                created_at: new Date().toISOString(),
                click_count: 0,
              }));
            },
          };
        }

        // Mock pour PageRank (fallback)
        if (query.includes("pagerank")) {
          return {
            all: (limit: number) => [
              {
                id: 1,
                title: "Top Book",
                author: "Top Author",
                filePath: "/path/to/top.txt",
                coverImagePath: "/path/to/top.jpg",
                wordCount: 10000,
                createdAt: new Date().toISOString(),
                pagerank_score: 0.5,
                click_count: 0,
              },
            ],
          };
        }

        return { all: () => [], get: () => undefined };
      }),
    };

    recommendationEngine = new RecommendationEngine(mockDb);
  });

  describe("Recommandations basées sur l'historique", () => {
    it("devrait générer des recommandations basées sur les clics", () => {
      const recommendations =
        recommendationEngine.getRecommendationsFromHistory(10);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]).toHaveProperty("book");
      expect(recommendations[0]).toHaveProperty("score");
      expect(recommendations[0]).toHaveProperty("reason");
    });

    it("devrait retourner des recommandations triées par score", () => {
      const recommendations =
        recommendationEngine.getRecommendationsFromHistory(10);

      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i].score).toBeLessThanOrEqual(
          recommendations[i - 1].score
        );
      }
    });

    it("devrait respecter la limite de recommandations", () => {
      const recommendations =
        recommendationEngine.getRecommendationsFromHistory(3);

      expect(recommendations.length).toBeLessThanOrEqual(3);
    });

    it("devrait marquer les recommandations comme 'hybrid'", () => {
      const recommendations =
        recommendationEngine.getRecommendationsFromHistory(10);

      for (const rec of recommendations) {
        expect(rec.reason).toBe("hybrid");
      }
    });
  });

  describe("Recommandations Jaccard", () => {
    it("devrait générer des recommandations basées sur Jaccard", () => {
      const recommendations = recommendationEngine.getJaccardRecommendations(
        1,
        10
      );

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0]).toHaveProperty("book");
      expect(recommendations[0]).toHaveProperty("similarity");
    });

    it("devrait retourner des recommandations triées par similarité", () => {
      const recommendations = recommendationEngine.getJaccardRecommendations(
        1,
        10
      );

      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i].score).toBeLessThanOrEqual(
          recommendations[i - 1].score
        );
      }
    });

    it("devrait marquer les recommandations comme 'jaccard'", () => {
      const recommendations = recommendationEngine.getJaccardRecommendations(
        1,
        10
      );

      for (const rec of recommendations) {
        expect(rec.reason).toBe("jaccard");
        expect(rec.similarity).toBeDefined();
      }
    });
  });
});

