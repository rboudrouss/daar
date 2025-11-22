/**
 * Represents a directed graph using an adjacency list
 */
export interface Graph {
  nodes: number[]; // Array of unique nodes
  edges: [number, number][]; // Array of [from, to] edges
}

/**
 * Create a mapping from node names to their indices.
 * Returns null if nodes are already indexed sequentially.
 *
 * We use arrays to store data for each node, we need to be able to use the node ID as an index.
 *
 * @param nodes Array of node identifiers
 * @returns Map from node to index, or null if nodes are sequential
 */
export function createNodeToIndexMap(
  nodes: number[]
): Map<number, number> | null {
  // Check if nodes are already indexed sequentially (node === index)
  if (nodes.every((node, index) => node === index)) {
    return null;
  }

  // Create mapping from original node names to their index
  const nodeToIndex = new Map<number, number>();
  nodes.forEach((node, index) => {
    nodeToIndex.set(node, index);
  });

  return nodeToIndex;
}

/**
 * Build adjacency lists from edges, removing self-loops and parallel edges.
 *
 * @param edges Array of [from, to] edges
 * @param N Number of nodes
 * @param nodeToIndex Optional mapping from node names to indices (null if nodes are sequential)
 * @param buildIncoming Whether to build incoming edge list
 * @returns Object containing outgoing edges, optional incoming edges, and out-degrees
 */
export function buildAdjacencyLists( // Overload, if true then incoming edges correctly typed
  edges: [number, number][],
  N: number,
  nodeToIndex: Map<number, number> | null,
  buildIncoming: true
): {
  outgoingEdges: number[][];
  incomingEdges: number[][];
  outDegrees: number[];
};

export function buildAdjacencyLists( // Overload for no incoming edges
  edges: [number, number][],
  N: number,
  nodeToIndex: Map<number, number> | null,
  buildIncoming?: false
): {
  outgoingEdges: number[][];
  outDegrees: number[];
};

export function buildAdjacencyLists(
  edges: [number, number][],
  N: number,
  nodeToIndex: Map<number, number> | null,
  buildIncoming?: boolean
): {
  outgoingEdges: number[][];
  incomingEdges?: number[][];
  outDegrees: number[];
} {
  // Build forward adjacency list (using Set to avoid parallel edges)
  const outgoingSet: Set<number>[] = Array.from(
    { length: N },
    () => new Set<number>()
  );

  // Build reverse adjacency list if needed
  const incomingSet: Set<number>[] | null = buildIncoming
    ? Array.from({ length: N }, () => new Set<number>())
    : null;

  // Add edges to adjacency sets, filtering out self-loops
  edges.forEach(([from, to]) => {
    if (from === to) return; // Skip self-loops

    const fromIndex = nodeToIndex ? nodeToIndex.get(from)! : from;
    const toIndex = nodeToIndex ? nodeToIndex.get(to)! : to;

    outgoingSet[fromIndex].add(toIndex);
    if (incomingSet) {
      incomingSet[toIndex].add(fromIndex);
    }
  });

  // Convert Sets to arrays
  const outgoingEdges: number[][] = outgoingSet.map((set) => Array.from(set));
  const outDegrees: number[] = outgoingSet.map((set) => set.size);

  const result: {
    outgoingEdges: number[][];
    incomingEdges?: number[][];
    outDegrees: number[];
  } = {
    outgoingEdges,
    outDegrees,
  };

  if (incomingSet) {
    result.incomingEdges = incomingSet.map((set) => Array.from(set));
  }

  return result;
}

/**
 * Find dangling nodes (nodes with no outgoing edges).
 *
 * @param outDegrees Array of out-degrees for each node
 * @returns Array of node indices that are dangling
 */
export function findDanglingNodes(outDegrees: number[]): number[] {
  return outDegrees.flatMap((degree, index) => (degree === 0 ? [index] : []));
}

/**
 * Extract local community around seeds based on PPR scores
 * Returns nodes sorted by PPR score (descending)
 */
export function extractCommunity(
  ranks: number[],
  threshold: number = 0.01
): Array<{ node: number; score: number }> {
  return ranks
    .map((score, node) => ({ node, score }))
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score);
}

/**
 * Compare two rank distributions using various metrics
 */
export function compareRankings(
  ranks1: number[],
  ranks2: number[]
): {
  l1Distance: number;
  l2Distance: number;
  maxDifference: number;
  correlation: number;
} {
  if (ranks1.length !== ranks2.length) {
    throw new Error("Rankings must have the same length");
  }

  const n = ranks1.length;

  // L1 distance (Manhattan)
  const l1Distance = ranks1.reduce(
    (acc, r1, i) => acc + Math.abs(r1 - ranks2[i]),
    0
  );

  // L2 distance (Euclidean)
  const l2Distance = Math.sqrt(
    ranks1.reduce((acc, r1, i) => acc + Math.pow(r1 - ranks2[i], 2), 0)
  );

  // Max difference
  const maxDifference = Math.max(
    ...ranks1.map((r1, i) => Math.abs(r1 - ranks2[i]))
  );

  // Pearson correlation
  const mean1 = ranks1.reduce((a, b) => a + b, 0) / n;
  const mean2 = ranks2.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let sumSq1 = 0;
  let sumSq2 = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = ranks1[i] - mean1;
    const diff2 = ranks2[i] - mean2;
    numerator += diff1 * diff2;
    sumSq1 += diff1 * diff1;
    sumSq2 += diff2 * diff2;
  }

  const correlation = numerator / Math.sqrt(sumSq1 * sumSq2);

  return {
    l1Distance,
    l2Distance,
    maxDifference,
    correlation,
  };
}
