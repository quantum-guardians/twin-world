import { describe, expect, it } from "vitest";
import type { Venue } from "./types";
import { addEdge, addNode } from "./venueGraph";
import { createFestivalStreetPreset } from "./festivalPreset";
import { directedApspSum, robbinsOrientation } from "./robbinsOrientation";

function emptyVenue(): Venue {
  return {
    id: "v1",
    name: "test venue",
    region: "test",
    scaleMetersPerUnit: 1,
    isSyntheticLayout: true,
    nodes: [],
    edges: [],
  };
}

/** Triangle n1-n2-n3-n1: smallest bridgeless (2-edge-connected) graph. */
function triangleVenue(): Venue {
  let venue = emptyVenue();
  venue = addNode(venue, { x: 0, y: 0, kind: "entrance" });
  venue = addNode(venue, { x: 100, y: 0, kind: "normal" });
  venue = addNode(venue, { x: 100, y: 100, kind: "exit" });
  venue = addEdge(venue, "n1", "n2", 10);
  venue = addEdge(venue, "n2", "n3", 10);
  venue = addEdge(venue, "n1", "n3", 10);
  return venue;
}

/** Path n1-n2-n3: both edges are bridges, so no strongly connected
 * orientation exists at all. */
function bridgeVenue(): Venue {
  let venue = emptyVenue();
  venue = addNode(venue, { x: 0, y: 0, kind: "entrance" });
  venue = addNode(venue, { x: 100, y: 0, kind: "normal" });
  venue = addNode(venue, { x: 200, y: 0, kind: "exit" });
  venue = addEdge(venue, "n1", "n2", 10);
  venue = addEdge(venue, "n2", "n3", 10);
  return venue;
}

describe("robbinsOrientation", () => {
  it("leaves no edge bidirectional", () => {
    const oriented = robbinsOrientation(createFestivalStreetPreset(), 1);
    for (const edge of oriented.edges) {
      expect(["forward", "reverse"]).toContain(edge.direction);
    }
  });

  it("keeps edge ids and endpoints unchanged", () => {
    const venue = createFestivalStreetPreset();
    const oriented = robbinsOrientation(venue, 1);
    expect(oriented.edges.map((e) => e.id)).toEqual(venue.edges.map((e) => e.id));
    for (let i = 0; i < venue.edges.length; i++) {
      expect(oriented.edges[i].fromNodeId).toBe(venue.edges[i].fromNodeId);
      expect(oriented.edges[i].toNodeId).toBe(venue.edges[i].toNodeId);
    }
    expect(oriented.nodes).toEqual(venue.nodes);
  });

  it("produces a strongly connected orientation on a bridgeless triangle", () => {
    const oriented = robbinsOrientation(triangleVenue(), 1);
    const sum = directedApspSum(oriented);
    expect(sum).not.toBeNull();
    expect(sum).toBeGreaterThan(0);
  });

  it("produces a strongly connected orientation on the 17-node festival preset", () => {
    const oriented = robbinsOrientation(createFestivalStreetPreset(), 7);
    const sum = directedApspSum(oriented);
    expect(sum).not.toBeNull();
    expect(sum).toBeGreaterThan(0);
  });

  it("is deterministic for a fixed seed", () => {
    const venue = createFestivalStreetPreset();
    const first = robbinsOrientation(venue, 42);
    const second = robbinsOrientation(venue, 42);
    expect(second.edges.map((e) => e.direction)).toEqual(first.edges.map((e) => e.direction));
  });

  it("produces different orientations for different seeds", () => {
    const venue = createFestivalStreetPreset();
    const directionSignatures = [1, 2, 3, 4, 5].map((seed) =>
      robbinsOrientation(venue, seed)
        .edges.map((e) => e.direction)
        .join(",")
    );
    const distinct = new Set(directionSignatures);
    expect(distinct.size).toBeGreaterThan(1);
  });
});

describe("directedApspSum", () => {
  it("returns null when the orientation is not strongly connected", () => {
    // Both edges of a path graph are bridges: whichever way robbinsOrientation
    // points them, n1 cannot reach n3 or n3 cannot reach n1 (at least one
    // ordered pair stays unreachable).
    const oriented = robbinsOrientation(bridgeVenue(), 1);
    expect(directedApspSum(oriented)).toBeNull();
  });

  it("matches a hand-computed value on a known tiny directed cycle", () => {
    // n1 -> n2 -> n3 -> n1, lengths 1, 1, 2 (coordinates chosen so
    // edgeLength works out to exactly those values).
    let venue = emptyVenue();
    venue = addNode(venue, { x: 0, y: 0, kind: "entrance" });
    venue = addNode(venue, { x: 1, y: 0, kind: "normal" });
    venue = addNode(venue, { x: 2, y: 0, kind: "exit" });
    venue = addEdge(venue, "n1", "n2", 5, "forward");
    venue = addEdge(venue, "n2", "n3", 5, "forward");
    venue = addEdge(venue, "n3", "n1", 5, "forward");

    // Ordered pairs and their shortest directed distance around the cycle:
    // (n1,n2)=1 (n1,n3)=2 (n2,n1)=3 (n2,n3)=1 (n3,n1)=2 (n3,n2)=3
    // sum = 1+2+3+1+2+3 = 12
    expect(directedApspSum(venue)).toBe(12);
  });
});
