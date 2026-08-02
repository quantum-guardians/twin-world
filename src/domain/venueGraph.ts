import type { Venue, VenueNode, VenueEdge, EdgeDirection, NodeKind } from "./types";

export function edgeLength(venue: Venue, edge: VenueEdge): number {
  const from = venue.nodes.find((n) => n.id === edge.fromNodeId);
  const to = venue.nodes.find((n) => n.id === edge.toNodeId);
  if (!from || !to) return 0;
  return Math.hypot(to.x - from.x, to.y - from.y) * venue.scaleMetersPerUnit;
}

export function findNode(venue: Venue, nodeId: string): VenueNode | undefined {
  return venue.nodes.find((n) => n.id === nodeId);
}

export function nodeDegrees(venue: Venue): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const node of venue.nodes) degrees.set(node.id, 0);
  for (const edge of venue.edges) {
    degrees.set(edge.fromNodeId, (degrees.get(edge.fromNodeId) ?? 0) + 1);
    degrees.set(edge.toNodeId, (degrees.get(edge.toNodeId) ?? 0) + 1);
  }
  return degrees;
}

/** Nodes reachable from `startId` while only crossing edges that are walkable
 * in the traversal direction implied by `direction` (or both, when undirected). */
export function reachableNodeIds(venue: Venue, startId: string): Set<string> {
  const adjacency = new Map<string, string[]>();
  for (const node of venue.nodes) adjacency.set(node.id, []);
  for (const edge of venue.edges) {
    if (edge.direction !== "reverse") {
      adjacency.get(edge.fromNodeId)?.push(edge.toNodeId);
    }
    if (edge.direction !== "forward") {
      adjacency.get(edge.toNodeId)?.push(edge.fromNodeId);
    }
  }

  const visited = new Set<string>([startId]);
  const queue = [startId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return visited;
}

export function isFullyConnected(venue: Venue): boolean {
  if (venue.nodes.length === 0) return true;
  return reachableNodeIds(venue, venue.nodes[0].id).size === venue.nodes.length;
}

export function nodesOfKind(venue: Venue, kind: NodeKind): VenueNode[] {
  return venue.nodes.filter((n) => n.kind === kind);
}

export function nextNodeId(venue: Venue): string {
  let candidate = venue.nodes.length + 1;
  while (venue.nodes.some((n) => n.id === `n${candidate}`)) candidate += 1;
  return `n${candidate}`;
}

export function nextEdgeId(venue: Venue): string {
  let candidate = venue.edges.length + 1;
  while (venue.edges.some((e) => e.id === `e${candidate}`)) candidate += 1;
  return `e${candidate}`;
}

export function addNode(venue: Venue, node: Omit<VenueNode, "id">): Venue {
  const id = nextNodeId(venue);
  return { ...venue, nodes: [...venue.nodes, { ...node, id }] };
}

export function moveNode(venue: Venue, nodeId: string, x: number, y: number): Venue {
  return {
    ...venue,
    nodes: venue.nodes.map((n) => (n.id === nodeId ? { ...n, x, y } : n)),
  };
}

export function updateNodeKind(venue: Venue, nodeId: string, kind: NodeKind): Venue {
  return {
    ...venue,
    nodes: venue.nodes.map((n) => (n.id === nodeId ? { ...n, kind } : n)),
  };
}

/** Removing a node cascades to every incident edge, so the graph never keeps
 * a dangling edge that references a node id which no longer exists. */
export function removeNode(venue: Venue, nodeId: string): Venue {
  return {
    ...venue,
    nodes: venue.nodes.filter((n) => n.id !== nodeId),
    edges: venue.edges.filter((e) => e.fromNodeId !== nodeId && e.toNodeId !== nodeId),
  };
}

export function addEdge(
  venue: Venue,
  fromNodeId: string,
  toNodeId: string,
  width: number,
  direction: EdgeDirection = "bidirectional"
): Venue {
  if (fromNodeId === toNodeId) {
    throw new Error("edge endpoints must be different nodes");
  }
  const exists = venue.edges.some(
    (e) =>
      (e.fromNodeId === fromNodeId && e.toNodeId === toNodeId) ||
      (e.fromNodeId === toNodeId && e.toNodeId === fromNodeId)
  );
  if (exists) {
    throw new Error("an edge already connects these two nodes");
  }
  const id = nextEdgeId(venue);
  return {
    ...venue,
    edges: [...venue.edges, { id, fromNodeId, toNodeId, width, direction }],
  };
}

export function removeEdge(venue: Venue, edgeId: string): Venue {
  return { ...venue, edges: venue.edges.filter((e) => e.id !== edgeId) };
}

export function updateEdgeWidth(venue: Venue, edgeId: string, width: number): Venue {
  return {
    ...venue,
    edges: venue.edges.map((e) => (e.id === edgeId ? { ...e, width } : e)),
  };
}

export function updateEdgeDirection(venue: Venue, edgeId: string, direction: EdgeDirection): Venue {
  return {
    ...venue,
    edges: venue.edges.map((e) => (e.id === edgeId ? { ...e, direction } : e)),
  };
}

/** Applies MR2S-optimized directions (from -> to pairs, in the domain's own
 * node id space) on top of the venue's existing edges. Each MR2S pair is
 * matched against an existing edge by its unordered endpoints; matched edges
 * become one-way "forward" (or "reverse" if MR2S flipped the pair), and
 * edges MR2S didn't return stay bidirectional. Throws if the resulting
 * direction set doesn't cover every edge exactly once, since a partial
 * application would silently mix baseline and optimized routing. */
export function applyOptimizedDirections(
  venue: Venue,
  optimizedPairs: Array<{ fromNodeId: string; toNodeId: string }>
): Venue {
  const directionByEdgeId = new Map<string, EdgeDirection>();

  for (const pair of optimizedPairs) {
    const edge = venue.edges.find(
      (e) =>
        (e.fromNodeId === pair.fromNodeId && e.toNodeId === pair.toNodeId) ||
        (e.fromNodeId === pair.toNodeId && e.toNodeId === pair.fromNodeId)
    );
    if (!edge) {
      throw new Error(
        `optimized pair ${pair.fromNodeId}->${pair.toNodeId} does not match any venue edge`
      );
    }
    directionByEdgeId.set(
      edge.id,
      edge.fromNodeId === pair.fromNodeId ? "forward" : "reverse"
    );
  }

  return {
    ...venue,
    edges: venue.edges.map((e) => ({
      ...e,
      direction: directionByEdgeId.get(e.id) ?? e.direction,
    })),
  };
}
