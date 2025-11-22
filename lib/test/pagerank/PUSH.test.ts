import { describe, it, expect } from "vitest";
import { computePushPPR } from "../../src/pagerank";
import type { Graph } from "../../src/pagerank";

describe("PUSH (Push-based PPR)", () => {
  it("Simple linear graph with single seed (A -> B -> C, seed=A)", () => {
    // Graph: 0 -> 1 -> 2
    // Seed: node 0
    // Node 0 should have highest PPR score
    const graph: Graph = {
      nodes: [0, 1, 2],
      edges: [
        [0, 1],
        [1, 2],
      ],
    };

    const ranks = computePushPPR(graph, [0]);

    expect(ranks.length).toBe(3);
    // All ranks should be positive
    ranks.forEach((rank) => expect(rank > 0).toBe(true));
    // Sum should be less than or equal to 1 (PUSH is an approximation)
    const sum = ranks.reduce((a, b) => a + b, 0);
    expect(sum <= 1.0).toBe(true);
    expect(sum > 0).toBe(true);
    // Node 0 (seed) should have highest rank
    expect(ranks[0] > ranks[1]).toBe(true);
    expect(ranks[0] > ranks[2]).toBe(true);
  });

  it("Simple linear graph with sink seed (A -> B -> C, seed=C)", () => {
    // Graph: 0 -> 1 -> 2
    // Seed: node 2 (sink)
    // Node 2 should have highest PPR score
    const graph: Graph = {
      nodes: [0, 1, 2],
      edges: [
        [0, 1],
        [1, 2],
      ],
    };

    const ranks = computePushPPR(graph, [2]);

    expect(ranks.length).toBe(3);
    // Node 2 (seed and sink) should have highest rank
    expect(ranks[2] > ranks[0]).toBe(true);
    expect(ranks[2] > ranks[1]).toBe(true);
    // Sum should be less than or equal to 1 (PUSH is an approximation)
    const sum = ranks.reduce((a, b) => a + b, 0);
    expect(sum <= 1.0).toBe(true);
    expect(sum > 0).toBe(true);
  });

  it("Cycle graph with single seed (A -> B -> C -> A, seed=A)", () => {
    // Graph: 0 -> 1 -> 2 -> 0 (cycle)
    // Seed: node 0
    const graph: Graph = {
      nodes: [0, 1, 2],
      edges: [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
    };

    const ranks = computePushPPR(graph, [0]);

    expect(ranks.length).toBe(3);
    // Node 0 (seed) should have highest rank
    expect(ranks[0] > ranks[1]).toBe(true);
    expect(ranks[0] > ranks[2]).toBe(true);
    // Sum should be less than or equal to 1 (PUSH is an approximation)
    const sum = ranks.reduce((a, b) => a + b, 0);
    expect(sum <= 1.0).toBe(true);
    expect(sum > 0).toBe(true);
  });

  it("Multiple seeds with equal weight", () => {
    // Graph: 0 -> 1 -> 2 -> 3
    // Seeds: nodes 0 and 3
    const graph: Graph = {
      nodes: [0, 1, 2, 3],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
      ],
    };

    const ranks = computePushPPR(graph, [0, 3]);

    expect(ranks.length).toBe(4);
    // Both seed nodes should have higher ranks than non-seed nodes
    expect(ranks[0] > ranks[1]).toBe(true);
    expect(ranks[3] > ranks[1]).toBe(true);
    expect(ranks[3] > ranks[2]).toBe(true);
    // Sum should be less than or equal to 1 (PUSH is an approximation)
    const sum = ranks.reduce((a, b) => a + b, 0);
    expect(sum <= 1.0).toBe(true);
    expect(sum > 0).toBe(true);
  });

  it("Hub and spoke with hub as seed", () => {
    // Graph: Hub (0) connected bidirectionally to spokes (1, 2, 3)
    // Seed: hub (0)
    const graph: Graph = {
      nodes: [0, 1, 2, 3],
      edges: [
        [1, 0],
        [2, 0],
        [3, 0],
        [0, 1],
        [0, 2],
        [0, 3],
      ],
    };

    const ranks = computePushPPR(graph, [0]);

    expect(ranks.length).toBe(4);
    // Hub (seed) should have highest rank
    expect(ranks[0] > ranks[1]).toBe(true);
    expect(ranks[0] > ranks[2]).toBe(true);
    expect(ranks[0] > ranks[3]).toBe(true);
    // All spokes should have similar ranks (symmetric)
    expect(ranks[1]).toBeCloseTo(ranks[2], 3);
    expect(ranks[2]).toBeCloseTo(ranks[3], 3);
  });

  it("Hub and spoke with spoke as seed", () => {
    // Graph: Hub (0) connected bidirectionally to spokes (1, 2, 3)
    // Seed: spoke (1)
    const graph: Graph = {
      nodes: [0, 1, 2, 3],
      edges: [
        [1, 0],
        [2, 0],
        [3, 0],
        [0, 1],
        [0, 2],
        [0, 3],
      ],
    };

    const ranks = computePushPPR(graph, [1]);

    expect(ranks.length).toBe(4);
    // Hub receives links from all spokes, so it gets highest rank even with spoke seed
    expect(ranks[0] > ranks[2]).toBe(true);
    expect(ranks[0] > ranks[3]).toBe(true);
    // Seed spoke should have higher rank than other spokes
    expect(ranks[1] > ranks[2]).toBe(true);
    expect(ranks[1] > ranks[3]).toBe(true);
    // Other spokes should have equal ranks (symmetric from hub)
    expect(ranks[2]).toBeCloseTo(ranks[3], 3);
  });

  it("Single node graph", () => {
    const graph: Graph = {
      nodes: [0],
      edges: [],
    };

    const ranks = computePushPPR(graph, [0]);

    expect(ranks.length).toBe(1);
    // Single node with no edges gets (1-damping) of the initial residual
    expect(ranks[0] > 0).toBe(true);
    expect(ranks[0] <= 1.0).toBe(true);
  });

  it("Disconnected components with seed in one component", () => {
    // Graph: 0 -> 1, 2 -> 3 (two disconnected components)
    // Seed: node 0
    const graph: Graph = {
      nodes: [0, 1, 2, 3],
      edges: [
        [0, 1],
        [2, 3],
      ],
    };

    const ranks = computePushPPR(graph, [0]);

    expect(ranks.length).toBe(4);
    // Nodes in seed component should have higher ranks
    expect(ranks[0] > ranks[2]).toBe(true);
    expect(ranks[0] > ranks[3]).toBe(true);
    expect(ranks[1] > ranks[2]).toBe(true);
    expect(ranks[1] > ranks[3]).toBe(true);
    // Sum should be less than or equal to 1 (PUSH is an approximation)
    const sum = ranks.reduce((a, b) => a + b, 0);
    expect(sum <= 1.0).toBe(true);
    expect(sum > 0).toBe(true);
  });

  it("Graph with dangling node and seed", () => {
    // Graph: 0 -> 1, 2 (completely disconnected)
    // Seed: node 0
    const graph: Graph = {
      nodes: [0, 1, 2],
      edges: [[0, 1]],
    };

    const ranks = computePushPPR(graph, [0]);

    expect(ranks.length).toBe(3);
    // Nodes 0 and 1 should have positive ranks (connected component)
    expect(ranks[0] > 0).toBe(true);
    expect(ranks[1] > 0).toBe(true);
    // Node 2 is unreachable from seed, so it gets 0 rank
    expect(ranks[2]).toBeCloseTo(0, 3);
    // Sum should be less than or equal to 1 (PUSH is an approximation)
    const sum = ranks.reduce((a, b) => a + b, 0);
    expect(sum <= 1.0).toBe(true);
    expect(sum > 0).toBe(true);
    // Seed should have highest rank
    expect(ranks[0] > ranks[1]).toBe(true);
  });

  it("Self-loops should be ignored", () => {
    // Graph with self-loops: 0 -> 0, 0 -> 1, 1 -> 1
    // Seed: node 0
    const graph: Graph = {
      nodes: [0, 1],
      edges: [
        [0, 0], // self-loop, should be ignored
        [0, 1],
        [1, 1], // self-loop, should be ignored
      ],
    };

    const ranks = computePushPPR(graph, [0]);

    expect(ranks.length).toBe(2);
    // Node 0 (seed) should have higher rank
    expect(ranks[0] > ranks[1]).toBe(true);
  });

  it("Parallel edges should be deduplicated", () => {
    // Graph with parallel edges: 0 -> 1 (three times)
    // Seed: node 0
    const graph: Graph = {
      nodes: [0, 1],
      edges: [
        [0, 1],
        [0, 1], // duplicate
        [0, 1], // duplicate
      ],
    };

    const ranks = computePushPPR(graph, [0]);

    expect(ranks.length).toBe(2);
    // Should behave same as single edge 0 -> 1
    expect(ranks[0] > ranks[1]).toBe(true);
  });

  it("Different damping factors", () => {
    // Graph: 0 -> 1 -> 2, with 2 -> 0
    // Seed: node 0
    const graph: Graph = {
      nodes: [0, 1, 2],
      edges: [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
    };

    const ranks1 = computePushPPR(graph, [0], 0.85);
    const ranks2 = computePushPPR(graph, [0], 0.5);

    // Different damping factors should produce different results
    expect(ranks1.length).toBe(ranks2.length);
    const hasDifference = ranks1.some((r, i) => Math.abs(r - ranks2[i]) > 1e-3);
    expect(hasDifference).toBe(true);
  });

  it("Different epsilon values", () => {
    // Graph: 0 -> 1 -> 2 -> 0
    // Seed: node 0
    const graph: Graph = {
      nodes: [0, 1, 2],
      edges: [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
    };

    const ranks1 = computePushPPR(graph, [0], 0.85, 1e-4);
    const ranks2 = computePushPPR(graph, [0], 0.85, 1e-6);

    // Smaller epsilon should give more accurate results
    expect(ranks1.length).toBe(ranks2.length);
    // Both should sum to approximately 1
    const sum1 = ranks1.reduce((a, b) => a + b, 0);
    const sum2 = ranks2.reduce((a, b) => a + b, 0);
    expect(sum1).toBeCloseTo(1.0, 3);
    expect(sum2).toBeCloseTo(1.0, 3);
  });

  it("Normalization check", () => {
    const graph: Graph = {
      nodes: [0, 1, 2, 3, 4],
      edges: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 0],
        [0, 2],
        [2, 4],
      ],
    };

    const ranks = computePushPPR(graph, [0, 2]);

    // Sum of all PPR scores should be less than or equal to 1 (PUSH is an approximation)
    const sum = ranks.reduce((a, b) => a + b, 0);
    expect(sum <= 1.0).toBe(true);
    expect(sum > 0).toBe(true);

    // All scores should be positive
    ranks.forEach((rank) => expect(rank > 0).toBe(true));

    // Each score should be less than 1
    ranks.forEach((rank) => expect(rank < 1).toBe(true));
  });

  it("Comparison with uniform personalization", () => {
    // When all nodes have equal personalization, results should be symmetric for symmetric graphs
    const graph: Graph = {
      nodes: [0, 1, 2],
      edges: [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
    };

    const pprRanks = computePushPPR(graph, [0, 1, 2]);

    // In a symmetric cycle, all nodes should have similar ranks
    expect(pprRanks[0]).toBeCloseTo(pprRanks[1], 3);
    expect(pprRanks[1]).toBeCloseTo(pprRanks[2], 3);
  });

  // Error handling tests
  it("Error on empty seeds array", () => {
    const graph: Graph = {
      nodes: [0, 1, 2],
      edges: [[0, 1]],
    };

    expect(() => computePushPPR(graph, [])).toThrow(
      "seeds must contain at least one node"
    );
  });

  it("Error on non-existent seed node", () => {
    const graph: Graph = {
      nodes: [0, 1, 2],
      edges: [[0, 1]],
    };

    expect(() => computePushPPR(graph, [5])).toThrow(
      "Seed node 5 not found in graph"
    );
  });

  it("Large graph performance", () => {
    // Create a larger graph: 100 nodes in a chain
    const nodes = Array.from({ length: 100 }, (_, i) => i);
    const edges: [number, number][] = [];
    for (let i = 0; i < 99; i++) {
      edges.push([i, i + 1]);
    }
    // Add some back edges to create cycles
    edges.push([99, 0]);
    edges.push([50, 25]);
    edges.push([75, 50]);

    const graph: Graph = { nodes, edges };

    const startTime = performance.now();
    const ranks = computePushPPR(graph, [0, 50]);
    const endTime = performance.now();

    expect(ranks.length).toBe(100);
    console.log(
      `Large graph PUSH (100 nodes) computed in ${(endTime - startTime).toFixed(
        2
      )}ms`
    );

    // Verify sum is less than or equal to 1 (PUSH is an approximation)
    const sum = ranks.reduce((a, b) => a + b, 0);
    expect(sum <= 1.0).toBe(true);
    expect(sum > 0).toBe(true);

    // Seed nodes should have higher ranks
    expect(ranks[0] > ranks[10]).toBe(true);
    expect(ranks[50] > ranks[10]).toBe(true);
  });

  it("Star graph with center as seed", () => {
    // Graph: 0 <- 1, 0 <- 2, 0 <- 3, 0 <- 4 (all point to center)
    // Seed: center (0)
    const graph: Graph = {
      nodes: [0, 1, 2, 3, 4],
      edges: [
        [1, 0],
        [2, 0],
        [3, 0],
        [4, 0],
      ],
    };

    const ranks = computePushPPR(graph, [0]);

    expect(ranks.length).toBe(5);
    // Central node (seed) should have highest rank
    expect(ranks[0] > ranks[1]).toBe(true);
    expect(ranks[0] > ranks[2]).toBe(true);
    expect(ranks[0] > ranks[3]).toBe(true);
    expect(ranks[0] > ranks[4]).toBe(true);
    // Peripheral nodes should have equal ranks
    expect(ranks[1]).toBeCloseTo(ranks[2], 3);
    expect(ranks[2]).toBeCloseTo(ranks[3], 3);
    expect(ranks[3]).toBeCloseTo(ranks[4], 3);
  });

  it("Non-sequential node IDs", () => {
    // Graph with non-sequential node IDs: 10 -> 20 -> 30
    // Seed: node 10
    const graph: Graph = {
      nodes: [10, 20, 30],
      edges: [
        [10, 20],
        [20, 30],
      ],
    };

    const ranks = computePushPPR(graph, [10]);

    expect(ranks.length).toBe(3);
    // Node 10 (seed) should have highest rank
    expect(ranks[0] > ranks[1]).toBe(true);
    expect(ranks[0] > ranks[2]).toBe(true);
    // Sum should be less than or equal to 1 (PUSH is an approximation)
    const sum = ranks.reduce((a, b) => a + b, 0);
    expect(sum <= 1.0).toBe(true);
    expect(sum > 0).toBe(true);
  });

  it("Dangling node as seed", () => {
    // Graph: 0 -> 1, 2 (dangling node with no outgoing edges)
    // Seed: node 1 (dangling)
    const graph: Graph = {
      nodes: [0, 1, 2],
      edges: [[0, 1]],
    };

    const ranks = computePushPPR(graph, [1]);

    expect(ranks.length).toBe(3);
    // Node 1 (seed and dangling) should have highest rank
    expect(ranks[1] > ranks[0]).toBe(true);
    // Node 2 is unreachable, should have 0 rank
    expect(ranks[2]).toBeCloseTo(0, 3);
    // Sum should be less than or equal to 1 (PUSH is an approximation)
    const sum = ranks.reduce((a, b) => a + b, 0);
    expect(sum <= 1.0).toBe(true);
    expect(sum > 0).toBe(true);
  });
});
