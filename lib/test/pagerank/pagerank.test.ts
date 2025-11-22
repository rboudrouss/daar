import { describe, it, expect } from "vitest";
import { computePageRank } from "../../src/pagerank";
import type { Graph } from "../../src/pagerank";

describe("PageRank", () => {
  it("Simple linear graph (A -> B -> C)", () => {
    // Graph: 0 -> 1 -> 2
    // Node 2 should have highest rank (sink node)
    const graph: Graph = {
      nodes: [0, 1, 2],
      edges: [
        [0, 1],
        [1, 2],
      ],
    };

    const ranks = computePageRank(graph);

    expect(ranks.length).toBe(3);
    // All ranks should be positive
    ranks.forEach((rank) => expect(rank > 0).toBe(true));
    // Sum should be approximately 1
    const sum = ranks.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 6);
    // Node 2 (sink) should have highest rank
    expect(ranks[2] > ranks[1]).toBe(true);
    expect(ranks[2] > ranks[0]).toBe(true);
  });

  it("Cycle graph (A -> B -> C -> A)", () => {
    // Graph: 0 -> 1 -> 2 -> 0 (cycle)
    // All nodes should have equal ranks
    const graph: Graph = {
      nodes: [0, 1, 2],
      edges: [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
    };

    const ranks = computePageRank(graph);

    expect(ranks.length).toBe(3);
    // All nodes should have similar scores in a symmetric cycle
    expect(ranks[0]).toBeCloseTo(ranks[1], 6);
    expect(ranks[1]).toBeCloseTo(ranks[2], 6);
    expect(ranks[0]).toBeCloseTo(1 / 3, 6);
  });

  it("Hub and spoke graph", () => {
    // Graph: Hub (0) connected bidirectionally to spokes (1, 2, 3)
    // 1 -> 0, 2 -> 0, 3 -> 0, 0 -> 1, 0 -> 2, 0 -> 3
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

    const ranks = computePageRank(graph);

    expect(ranks.length).toBe(4);
    // Hub (node 0) should have higher rank than spokes (receives from 3 nodes)
    expect(ranks[0] > ranks[1]).toBe(true);
    expect(ranks[0] > ranks[2]).toBe(true);
    expect(ranks[0] > ranks[3]).toBe(true);
    // All spokes should have equal ranks (symmetric positions)
    expect(ranks[1]).toBeCloseTo(ranks[2], 6);
    expect(ranks[2]).toBeCloseTo(ranks[3], 6);
  });

  it("Single node graph", () => {
    const graph: Graph = {
      nodes: [0],
      edges: [],
    };

    const ranks = computePageRank(graph);

    expect(ranks.length).toBe(1);
    expect(ranks[0]).toBeCloseTo(1.0, 6);
  });

  it("Two disconnected nodes", () => {
    const graph: Graph = {
      nodes: [0, 1],
      edges: [],
    };

    const ranks = computePageRank(graph);

    expect(ranks.length).toBe(2);
    // Both nodes should have equal rank
    expect(ranks[0]).toBeCloseTo(0.5, 6);
    expect(ranks[1]).toBeCloseTo(0.5, 6);
  });

  it("Graph with dangling node", () => {
    // Graph: 0 -> 1, 2 (dangling, no outgoing edges)
    const graph: Graph = {
      nodes: [0, 1, 2],
      edges: [[0, 1]],
    };

    const ranks = computePageRank(graph);

    expect(ranks.length).toBe(3);
    // All ranks should be positive
    ranks.forEach((rank) => expect(rank > 0).toBe(true));
    // Sum should be approximately 1
    const sum = ranks.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 6);
  });

  it("Self-loops should be ignored", () => {
    // Graph with self-loops: 0 -> 0, 0 -> 1, 1 -> 1
    const graph: Graph = {
      nodes: [0, 1],
      edges: [
        [0, 0], // self-loop, should be ignored
        [0, 1],
        [1, 1], // self-loop, should be ignored
      ],
    };

    const ranks = computePageRank(graph);

    expect(ranks.length).toBe(2);
    // Node 1 should have higher rank (receives from 0)
    expect(ranks[1] > ranks[0]).toBe(true);
  });

  it("Parallel edges should be deduplicated", () => {
    // Graph with parallel edges: 0 -> 1 (twice)
    const graph: Graph = {
      nodes: [0, 1],
      edges: [
        [0, 1],
        [0, 1], // duplicate edge
        [0, 1], // another duplicate
      ],
    };

    const ranks = computePageRank(graph);

    expect(ranks.length).toBe(2);
    // Should behave same as single edge 0 -> 1
    expect(ranks[1] > ranks[0]).toBe(true);
  });

  it("Different damping factors on asymmetric graph", () => {
    // Use an asymmetric graph where damping factor matters
    // Graph: 0 -> 1 -> 2, with 2 -> 0 (creates asymmetry)
    const graph: Graph = {
      nodes: [0, 1, 2],
      edges: [
        [0, 1],
        [0, 2],
        [1, 2],
        [2, 0],
      ],
    };

    const ranks1 = computePageRank(graph, 0.85);
    const ranks2 = computePageRank(graph, 0.5);

    // Different damping factors should produce different results on asymmetric graphs
    expect(ranks1.length).toBe(ranks2.length);
    // At least one rank should be different
    const hasDifference = ranks1.some((r, i) => Math.abs(r - ranks2[i]) > 1e-6);
    expect(hasDifference).toBe(true);
  });

  it("Convergence with tight tolerance", () => {
    const graph: Graph = {
      nodes: [0, 1, 2],
      edges: [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
    };

    const ranks = computePageRank(graph, 0.85, 1000, 1e-10);

    expect(ranks.length).toBe(3);
    // Should still converge and sum to 1
    const sum = ranks.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 6);
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
    const ranks = computePageRank(graph);
    const endTime = performance.now();

    expect(ranks.length).toBe(100);
    console.log(
      `Large graph (100 nodes) computed in ${(endTime - startTime).toFixed(2)}ms`
    );

    // Verify sum is approximately 1
    const sum = ranks.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 6);
  });

  it("Star graph (one central node)", () => {
    // Graph: 0 <- 1, 0 <- 2, 0 <- 3, 0 <- 4 (all point to center)
    const graph: Graph = {
      nodes: [0, 1, 2, 3, 4],
      edges: [
        [1, 0],
        [2, 0],
        [3, 0],
        [4, 0],
      ],
    };

    const ranks = computePageRank(graph);

    expect(ranks.length).toBe(5);
    // Central node (0) should have highest rank
    expect(ranks[0] > ranks[1]).toBe(true);
    expect(ranks[0] > ranks[2]).toBe(true);
    expect(ranks[0] > ranks[3]).toBe(true);
    expect(ranks[0] > ranks[4]).toBe(true);
    // Peripheral nodes should have equal ranks
    expect(ranks[1]).toBeCloseTo(ranks[2], 6);
    expect(ranks[2]).toBeCloseTo(ranks[3], 6);
    expect(ranks[3]).toBeCloseTo(ranks[4], 6);
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

    const ranks = computePageRank(graph);

    // Sum of all PageRank scores should be 1
    const sum = ranks.reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 6);

    // All scores should be positive
    ranks.forEach((rank) => expect(rank > 0).toBe(true));

    // Each score should be less than 1
    ranks.forEach((rank) => expect(rank < 1).toBe(true));
  });
});
