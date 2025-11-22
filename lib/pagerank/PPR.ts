import {
  type Graph,
  createNodeToIndexMap,
  buildAdjacencyLists,
  findDanglingNodes,
} from "./utils.ts";

/**
 * Result type for PPR with detailed metrics
 */
export interface PPRResult {
  ranks: number[];
  iterations: number;
  converged: boolean;
  finalDiff: number;
  executionTimeMs: number;
  preprocessingTimeMs: number;
  algorithmTimeMs: number;
}

/**
 * Compute Personalized PageRank (PPR)
 *
 * PPR is a variant of PageRank where the random surfer teleports back to a
 * specific set of seed nodes instead of uniformly to all nodes.
 *
 * @param graph The directed graph
 * @param seeds Array of seed node IDs
 * @param damping Damping factor (default: 0.85)
 * @param maxIterations Maximum number of iterations (default: 100)
 * @param tolerance Convergence tolerance (default: 1e-6)
 * @param withMetrics Whether to return detailed metrics (default: false)
 * @returns Array of PPR scores for each node (indexed by position in graph.nodes) or PPRResult with metrics
 */
export function computePersonalizedPageRank(
  graph: Graph,
  seeds: number[],
  damping?: number,
  maxIterations?: number,
  tolerance?: number,
  withMetrics?: false
): number[];
export function computePersonalizedPageRank(
  graph: Graph,
  seeds: number[],
  damping: number,
  maxIterations: number,
  tolerance: number,
  withMetrics: true
): PPRResult;
export function computePersonalizedPageRank(
  graph: Graph,
  seeds: number[],
  damping: number = 0.85,
  maxIterations: number = 100,
  tolerance: number = 1e-6,
  withMetrics: boolean = false
): number[] | PPRResult {
  const totalStartTime = withMetrics ? performance.now() : 0;
  const preprocessingStartTime = withMetrics ? performance.now() : 0;

  // Validate seeds
  if (seeds.length === 0) {
    throw new Error("seeds must contain at least one node");
  }

  const { incomingEdges, outDegrees, danglingNodes, N, nodeToIndex } =
    preprocessGraph(graph);

  // Convert seed nodes to indices and validate they exist
  const seedIndices = seeds.map((seed) => {
    const index = nodeToIndex ? nodeToIndex.get(seed) : seed;
    if (index === undefined) {
      throw new Error(`Seed node ${seed} not found in graph`);
    }
    if (index < 0 || index >= N) {
      throw new Error(`Seed node ${seed} not found in graph`);
    }
    return index;
  });

  const seedSet = new Set(seedIndices);
  const seedWeight = 1 / seedIndices.length;

  // Pre-calculate constants
  const oneMinusDamping = 1 - damping;
  const teleportationWeight = oneMinusDamping * seedWeight;

  const preprocessingTimeMs = withMetrics
    ? performance.now() - preprocessingStartTime
    : 0;
  const algorithmStartTime = withMetrics ? performance.now() : 0;

  // Initialize ranks: seed nodes get seedWeight, others get 0
  let ranks = new Array(N).fill(0);
  seedIndices.forEach((idx) => {
    ranks[idx] = seedWeight;
  });

  let iter = 0;
  let diff = Infinity;

  for (iter = 0; iter < maxIterations; iter++) {
    // Calculate dangling node contribution
    const danglingSum = danglingNodes.reduce(
      (acc, node) => acc + ranks[node],
      0
    );

    // Calculate new ranks
    const newRanks = Array.from({ length: N }, (_, node) => {
      // Base rank: teleportation to this node (only if it's a seed) + dangling contribution (only to seeds)
      const isSeed = seedSet.has(node);
      const teleportation = isSeed ? teleportationWeight : 0;
      const danglingContribution = isSeed
        ? damping * danglingSum * seedWeight
        : 0;
      let rank = teleportation + danglingContribution;

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
      console.log(`PPR converged after ${iter + 1} iterations`);
      break;
    }
  }

  if (withMetrics) {
    const algorithmTimeMs = performance.now() - algorithmStartTime;
    const executionTimeMs = performance.now() - totalStartTime;
    return {
      ranks,
      iterations: iter,
      converged: diff < tolerance && iter <= maxIterations,
      finalDiff: diff,
      executionTimeMs,
      preprocessingTimeMs,
      algorithmTimeMs,
    };
  }

  return ranks;
}

/**
 * Remove self-loops and parallel edges
 * Rename nodes to their position in the nodes array
 * Build reverse adjacency list (incoming edges) and compute out-degrees
 * @param graph The directed graph
 * @returns Preprocessed graph data and node mapping
 *   - incomingEdges: Array of incoming edges for each node (indexed by node index)
 *   - outDegrees: Array of out-degrees for each node (indexed by node index)
 *   - danglingNodes: Array of dangling nodes (nodes with no outgoing edges)
 *   - N: Number of nodes
 *   - nodeToIndex: Mapping from original node names to their index, or null if nodes are already indexed sequentially
 */
function preprocessGraph(graph: Graph): {
  incomingEdges: number[][];
  outDegrees: number[];
  danglingNodes: number[];
  N: number;
  nodeToIndex: Map<number, number> | null;
} {
  const N = graph.nodes.length;

  const nodeToIndex = createNodeToIndexMap(graph.nodes);

  const { incomingEdges, outDegrees } = buildAdjacencyLists(
    graph.edges,
    N,
    nodeToIndex,
    true
  );

  const danglingNodes = findDanglingNodes(outDegrees);

  return {
    incomingEdges,
    outDegrees,
    danglingNodes,
    N,
    nodeToIndex,
  };
}
