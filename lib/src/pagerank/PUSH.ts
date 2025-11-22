import {
  type Graph,
  createNodeToIndexMap,
  buildAdjacencyLists,
} from "./utils.ts";

/**
 * Result type for PUSH with detailed metrics
 */
export interface PushResult {
  ranks: number[];
  pushOperations: number;
  nodesProcessed: number;
  executionTimeMs: number;
  preprocessingTimeMs: number;
  algorithmTimeMs: number;
}

/**
 * Compute Personalized PageRank using the PUSH algorithm
 *
 * The PUSH algorithm is an efficient local approximation method for computing
 * Personalized PageRank. Instead of iterating over all nodes, it maintains
 * residual values and only processes nodes with significant residuals.
 *
 * @param graph The directed graph
 * @param seeds Array of seed node IDs
 * @param damping Damping factor (default: 0.85)
 * @param epsilon Approximation parameter - smaller values give more accurate results but take longer (default: 1e-4)
 * @param withMetrics Whether to return detailed metrics (default: false)
 * @returns Array of approximate PPR scores for each node (indexed by position in graph.nodes) or PushResult with metrics
 */
export function computePushPPR(
  graph: Graph,
  seeds: number[],
  damping?: number,
  epsilon?: number,
  withMetrics?: false
): number[];
export function computePushPPR(
  graph: Graph,
  seeds: number[],
  damping: number,
  epsilon: number,
  withMetrics: true
): PushResult;
export function computePushPPR(
  graph: Graph,
  seeds: number[],
  damping: number = 0.85,
  epsilon: number = 1e-4,
  withMetrics: boolean = false
): number[] | PushResult {
  const totalStartTime = withMetrics ? performance.now() : 0;
  const preprocessingStartTime = withMetrics ? performance.now() : 0;

  // Validate seeds
  if (seeds.length === 0) {
    throw new Error("seeds must contain at least one node");
  }

  const { outgoingEdges, outDegrees, N, nodeToIndex } = preprocessGraph(graph);

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

  const seedWeight = 1 / seedIndices.length;

  const preprocessingTimeMs = withMetrics
    ? performance.now() - preprocessingStartTime
    : 0;
  const algorithmStartTime = withMetrics ? performance.now() : 0;

  // Initialize residual and rank arrays
  const residual = new Array(N).fill(0);
  const rank = new Array(N).fill(0);

  // Initialize residual for seed nodes
  for (const idx of seedIndices) {
    residual[idx] = seedWeight;
  }

  // Queue of nodes to process (nodes with residual >= epsilon)
  const queue: number[] = [...seedIndices];
  let queueHead = 0; // Head pointer avoiding shift() for efficiency
  const inQueue = new Set<number>(seedIndices);

  let pushOperations = 0;
  const nodesProcessedSet = new Set<number>();

  // Process nodes until all residuals are below epsilon
  while (queueHead < queue.length) {
    const node = queue[queueHead++];
    inQueue.delete(node);

    const res = residual[node];

    // Skip if residual is below threshold
    if (res < epsilon) continue;

    if (withMetrics) {
      pushOperations++;
      nodesProcessedSet.add(node);
    }

    // Add a portion of residual to rank
    rank[node] += (1 - damping) * res;

    // Push remaining residual to outgoing neighbors
    const neighbors = outgoingEdges[node];
    const degree = outDegrees[node];

    if (degree > 0) {
      const pushValue = (damping * res) / degree;

      neighbors.forEach((neighbor) => {
        residual[neighbor] += pushValue;

        // Add neighbor to queue if residual becomes significant
        if (!inQueue.has(neighbor) && residual[neighbor] >= epsilon) {
          queue.push(neighbor);
          inQueue.add(neighbor);
        }
      });
    } else {
      // Dangling node: distribute residual back to seed nodes only
      const danglingContribution = damping * res;
      seedIndices.forEach((i) => {
        const contribution = danglingContribution * seedWeight;
        residual[i] += contribution;

        if (!inQueue.has(i) && residual[i] >= epsilon) {
          queue.push(i);
          inQueue.add(i);
        }
      });
    }

    // Clear processed residual
    residual[node] = 0;
  }

  if (withMetrics) {
    const algorithmTimeMs = performance.now() - algorithmStartTime;
    const executionTimeMs = performance.now() - totalStartTime;
    return {
      ranks: rank,
      pushOperations,
      nodesProcessed: nodesProcessedSet.size,
      executionTimeMs,
      preprocessingTimeMs,
      algorithmTimeMs,
    };
  }

  return rank;
}

/**
 * Remove self-loops and parallel edges
 * Build forward adjacency list (outgoing edges) and compute out-degrees
 * @param graph
 */
function preprocessGraph(graph: Graph): {
  outgoingEdges: number[][];
  outDegrees: number[];
  N: number;
  nodeToIndex: Map<number, number> | null;
} {
  const N = graph.nodes.length;

  const nodeToIndex = createNodeToIndexMap(graph.nodes);

  const { outgoingEdges, outDegrees } = buildAdjacencyLists(
    graph.edges,
    N,
    nodeToIndex
  );

  return {
    outgoingEdges,
    outDegrees,
    N,
    nodeToIndex,
  };
}
