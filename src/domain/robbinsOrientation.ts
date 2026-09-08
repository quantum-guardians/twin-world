import type { EdgeDirection, Venue, VenueEdge } from "./types";
import { edgeLength } from "./venueGraph";
import { mulberry32 } from "./rng";

/**
 * Robbins' theorem (1939): every finite, connected, bridgeless undirected
 * graph has an orientation of its edges that makes the resulting directed
 * graph strongly connected - a valid one-way street system in which every
 * node can still reach every other node. A graph that has even one bridge
 * has NO strongly connected orientation at all, because whichever way that
 * single edge is pointed, one side of it loses access to the other.
 * `robbinsOrientation` still returns a fully one-way orientation for such a
 * graph (every edge becomes "forward" or "reverse"), but `directedApspSum`
 * on the result will report `null`, since some ordered pair of nodes is then
 * unreachable.
 *
 * The classic constructive proof of the theorem is a DFS over the graph:
 * each tree edge (the edge used to first reach a new node) is oriented away
 * from the root, and each back edge (an edge to an already-visited ancestor)
 * is oriented back toward that ancestor. On a bridgeless connected graph,
 * that construction is guaranteed to produce a strongly connected result -
 * with zero optimization. It exists here purely as the fair one-way baseline
 * to measure MR2S against (Robbins is a "some valid one-way system" bound,
 * not a "good" one), not as an orientation anyone would actually deploy.
 */

/** Builds, for every node, the list of its incident edges in a seeded random
 * order - so the DFS below explores the graph differently per seed and
 * different seeds land on genuinely different valid orientations, instead
 * of always retracing the same tree from `venue.nodes` order. */
function shuffledIncidentEdges(venue: Venue, rng: () => number): Map<string, VenueEdge[]> {
  const incident = new Map<string, VenueEdge[]>();
  for (const node of venue.nodes) incident.set(node.id, []);
  for (const edge of venue.edges) {
    incident.get(edge.fromNodeId)?.push(edge);
    if (edge.toNodeId !== edge.fromNodeId) incident.get(edge.toNodeId)?.push(edge);
  }
  for (const node of venue.nodes) {
    const list = incident.get(node.id);
    if (!list) continue;
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }
  return incident;
}

interface DfsFrame {
  nodeId: string;
  edges: VenueEdge[];
  nextIndex: number;
}

/**
 * Orients every edge of `venue` one-way via the DFS construction behind
 * Robbins' theorem. The DFS is iterative (an explicit stack, no recursion)
 * so a large venue cannot blow the call stack. Each node's incident edges
 * are shuffled with `mulberry32(seed)` first, so different seeds produce
 * different valid orientations on the same graph.
 *
 * Only `edge.direction` is rewritten, exactly as `applyOptimizedDirections`
 * in `venueGraph.ts` does - `fromNodeId`/`toNodeId` are never touched, so
 * edge ids and endpoints stay stable across baseline/Robbins/MR2S
 * comparisons.
 */
export function robbinsOrientation(venue: Venue, seed: number): Venue {
  const rng = mulberry32(seed);
  const incident = shuffledIncidentEdges(venue, rng);
  const directionByEdgeId = new Map<string, EdgeDirection>();
  const visited = new Set<string>();

  for (const root of venue.nodes) {
    if (visited.has(root.id)) continue;
    visited.add(root.id);
    const stack: DfsFrame[] = [{ nodeId: root.id, edges: incident.get(root.id) ?? [], nextIndex: 0 }];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.nextIndex >= frame.edges.length) {
        stack.pop();
        continue;
      }
      const edge = frame.edges[frame.nextIndex];
      frame.nextIndex++;
      // Already oriented from the other endpoint - undirected DFS has no
      // cross edges, so every edge is settled the first time either of its
      // endpoints processes it.
      if (directionByEdgeId.has(edge.id)) continue;

      const neighborId = edge.fromNodeId === frame.nodeId ? edge.toNodeId : edge.fromNodeId;
      // Orient frame.nodeId -> neighborId: away from the root for a fresh
      // tree edge, toward the ancestor for a back edge to an already-visited
      // node (which, in an undirected DFS, is necessarily still an ancestor
      // on this stack).
      directionByEdgeId.set(edge.id, edge.fromNodeId === frame.nodeId ? "forward" : "reverse");

      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        stack.push({ nodeId: neighborId, edges: incident.get(neighborId) ?? [], nextIndex: 0 });
      }
    }
  }

  return {
    ...venue,
    edges: venue.edges.map((e) => ({ ...e, direction: directionByEdgeId.get(e.id) ?? e.direction })),
  };
}

interface WeightedEdge {
  to: string;
  weight: number;
}

/** Plain-array Dijkstra from a single source over all nodes - same approach
 * as `shortestPath` in `simulation/agents.ts`, fine at the node counts this
 * app targets (tens to low hundreds). Returns distances only, since callers
 * here need every reachable node's distance rather than one path. */
function dijkstraDistances(adjacency: Map<string, WeightedEdge[]>, startId: string): Map<string, number> {
  const dist = new Map<string, number>([[startId, 0]]);
  const visited = new Set<string>();

  while (true) {
    let currentId: string | null = null;
    let currentDist = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < currentDist) {
        currentDist = d;
        currentId = id;
      }
    }
    if (currentId === null) break;
    visited.add(currentId);
    for (const { to, weight } of adjacency.get(currentId) ?? []) {
      const next = currentDist + weight;
      if (next < (dist.get(to) ?? Infinity)) dist.set(to, next);
    }
  }
  return dist;
}

/**
 * APSP sum over all ordered node pairs, using edge length in meters as
 * weight and honouring one-way directions. This is the graph-theoretic
 * route-length measure the comparison screen uses to score an orientation
 * before any crowd simulation runs on top of it. Returns `null` when some
 * ordered pair is unreachable, i.e. the orientation is not strongly
 * connected (which is exactly what happens when `robbinsOrientation` is run
 * on a graph that has a bridge - see the module doc comment above).
 *
 * Builds directed adjacency straight from `venue.edges` rather than
 * importing `buildAdjacency` from `simulation/agents.ts`: that module is
 * simulation-layer and depends on `domain/`, so importing it back here would
 * invert the dependency direction.
 */
export function directedApspSum(venue: Venue): number | null {
  const adjacency = new Map<string, WeightedEdge[]>();
  for (const node of venue.nodes) adjacency.set(node.id, []);
  for (const edge of venue.edges) {
    const weight = Math.max(edgeLength(venue, edge), 1e-6);
    if (edge.direction !== "reverse") adjacency.get(edge.fromNodeId)?.push({ to: edge.toNodeId, weight });
    if (edge.direction !== "forward") adjacency.get(edge.toNodeId)?.push({ to: edge.fromNodeId, weight });
  }

  let total = 0;
  for (const source of venue.nodes) {
    const dist = dijkstraDistances(adjacency, source.id);
    for (const target of venue.nodes) {
      if (target.id === source.id) continue;
      const d = dist.get(target.id);
      if (d === undefined) return null;
      total += d;
    }
  }
  return total;
}
