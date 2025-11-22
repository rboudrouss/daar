import type { Graph } from "./utils.ts";
import {
  createNodeToIndexMap,
  buildAdjacencyLists,
  findDanglingNodes,
} from "./utils.ts";

/**
 * Result type for PageRank with detailed metrics
 */
export interface PageRankResult {
  ranks: number[];
  iterations: number;
  converged: boolean;
  finalDiff: number;
  executionTimeMs: number;
}

export function computePageRank(
  graph: Graph,
  damping?: number,
  maxIterations?: number,
  tolerance?: number,
  withMetrics?: false
): number[];
export function computePageRank(
  graph: Graph,
  damping: number,
  maxIterations: number,
  tolerance: number,
  withMetrics: true
): PageRankResult;
export function computePageRank(
  graph: Graph,
  damping: number = 0.85,
  maxIterations: number = 100,
  tolerance: number = 1e-6,
  withMetrics: boolean = false
): number[] | PageRankResult {
  const startTime = withMetrics ? performance.now() : 0;

  const { incomingEdges, outDegrees, danglingNodes, N } =
    preprocessGraph(graph);

  let ranks = new Array(N).fill(1 / N);
  let iter = 0;
  let diff = Infinity;

  for (iter = 0; iter < maxIterations; iter++) {
    // Calculate dangling node contribution
    const danglingSum = danglingNodes.reduce(
      (acc, node) => acc + ranks[node],
      0
    );
    const danglingContribution = (damping * danglingSum) / N;

    // Base rank from damping factor and dangling nodes
    const baseRank = (1 - damping) / N + danglingContribution;

    // Initialize all nodes with base rank, then add contributions from incoming edges
    const newRanks = Array.from({ length: N }, (_, node) => {
      // Start with base rank
      let rank = baseRank;

      // Add contributions from all nodes that link to this node
      incomingEdges[node].forEach((fromNode) => {
        rank += (damping * ranks[fromNode]) / outDegrees[fromNode];
      });

      return rank;
    });

    // Check for convergence
    diff = newRanks.reduce(
      (acc, rank, index) => acc + Math.abs(rank - ranks[index]),
      0
    );

    ranks = newRanks;

    if (diff < tolerance) {
      console.log(`Converged after ${iter + 1} iterations`);
      break;
    }
  }

  if (withMetrics) {
    const executionTimeMs = performance.now() - startTime;
    return {
      ranks,
      iterations: iter,
      converged: diff < tolerance && iter <= maxIterations,
      finalDiff: diff,
      executionTimeMs,
    };
  }

  return ranks;
}

/**
 * Remove self-loops and parallel edges
 * Rename nodes to their position in the nodes array
 * Build reverse adjacency list (incoming edges) and compute out-degrees
 * @param graph
 */
function preprocessGraph(graph: Graph): {
  incomingEdges: number[][];
  outDegrees: number[];
  danglingNodes: number[];
  N: number;
} {
  const N = graph.nodes.length;

  // Create a mapping from original node names to their index
  const nodeToIndex = createNodeToIndexMap(graph.nodes);

  // Build adjacency lists with both incoming and outgoing edges
  const { incomingEdges, outDegrees } = buildAdjacencyLists(
    graph.edges,
    N,
    nodeToIndex,
    true // Build incoming edges
  );

  // Find dangling nodes (nodes with no outgoing edges)
  const danglingNodes = findDanglingNodes(outDegrees);

  return {
    incomingEdges,
    outDegrees,
    danglingNodes,
    N,
  };
}
