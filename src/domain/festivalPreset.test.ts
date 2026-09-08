import { describe, expect, it } from "vitest";
import { createFestivalStreetPreset } from "./festivalPreset";
import { isFullyConnected, nodeDegrees, nodesOfKind } from "./venueGraph";
import type { Venue } from "./types";

/**
 * Tarjan's bridge-finding via DFS low-link, treating every edge as
 * undirected (the preset's edges all start bidirectional, but bridges are a
 * property of the underlying undirected graph regardless). Returns the list
 * of edge ids that are bridges - edges whose removal would disconnect the
 * graph. An empty result is exactly the condition Robbins' theorem needs for
 * a strongly connected orientation to exist.
 */
function findBridges(venue: Venue): string[] {
  const adjacency = new Map<string, Array<{ to: string; edgeId: string }>>();
  for (const node of venue.nodes) adjacency.set(node.id, []);
  for (const edge of venue.edges) {
    adjacency.get(edge.fromNodeId)?.push({ to: edge.toNodeId, edgeId: edge.id });
    adjacency.get(edge.toNodeId)?.push({ to: edge.fromNodeId, edgeId: edge.id });
  }

  const discovery = new Map<string, number>();
  const low = new Map<string, number>();
  const bridges: string[] = [];
  let timer = 0;

  function dfs(nodeId: string, parentEdgeId: string | null): void {
    discovery.set(nodeId, timer);
    low.set(nodeId, timer);
    timer += 1;

    for (const { to, edgeId } of adjacency.get(nodeId) ?? []) {
      if (edgeId === parentEdgeId) continue;
      if (!discovery.has(to)) {
        dfs(to, edgeId);
        low.set(nodeId, Math.min(low.get(nodeId)!, low.get(to)!));
        if (low.get(to)! > discovery.get(nodeId)!) {
          bridges.push(edgeId);
        }
      } else {
        low.set(nodeId, Math.min(low.get(nodeId)!, discovery.get(to)!));
      }
    }
  }

  if (venue.nodes.length > 0) dfs(venue.nodes[0].id, null);
  return bridges;
}

describe("createFestivalStreetPreset", () => {
  it("is flagged as a synthetic (non-surveyed) layout", () => {
    expect(createFestivalStreetPreset().isSyntheticLayout).toBe(true);
  });

  it("has 17 nodes and 26 edges", () => {
    const venue = createFestivalStreetPreset();
    expect(venue.nodes.length).toBe(17);
    expect(venue.edges.length).toBe(26);
  });

  it("node and edge ids are unique", () => {
    const venue = createFestivalStreetPreset();
    expect(new Set(venue.nodes.map((n) => n.id)).size).toBe(venue.nodes.length);
    expect(new Set(venue.edges.map((e) => e.id)).size).toBe(venue.edges.length);
  });

  it("every edge references existing node ids", () => {
    const venue = createFestivalStreetPreset();
    const nodeIds = new Set(venue.nodes.map((n) => n.id));
    for (const edge of venue.edges) {
      expect(nodeIds.has(edge.fromNodeId)).toBe(true);
      expect(nodeIds.has(edge.toNodeId)).toBe(true);
    }
  });

  it("is fully connected", () => {
    expect(isFullyConnected(createFestivalStreetPreset())).toBe(true);
  });

  it("has no bridge, so MR2S can produce a strongly connected orientation", () => {
    const bridges = findBridges(createFestivalStreetPreset());
    expect(bridges).toEqual([]);
  });

  it("has at least one entrance, one exit, and one destination", () => {
    const venue = createFestivalStreetPreset();
    expect(nodesOfKind(venue, "entrance").length).toBeGreaterThan(0);
    expect(nodesOfKind(venue, "exit").length).toBeGreaterThan(0);
    expect(nodesOfKind(venue, "destination").length).toBeGreaterThan(0);
  });

  it("every node has degree >= 2", () => {
    const venue = createFestivalStreetPreset();
    const degrees = nodeDegrees(venue);
    for (const node of venue.nodes) {
      expect(degrees.get(node.id) ?? 0).toBeGreaterThanOrEqual(2);
    }
  });
});
