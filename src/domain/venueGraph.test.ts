import { describe, expect, it } from "vitest";
import type { Venue } from "./types";
import {
  addEdge,
  addNode,
  applyOptimizedDirections,
  edgeLength,
  isFullyConnected,
  moveNode,
  nodeDegrees,
  removeNode,
  updateEdgeDirection,
} from "./venueGraph";

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

describe("addNode / addEdge", () => {
  it("assigns sequential ids and keeps coordinates", () => {
    const venue = triangleVenue();
    expect(venue.nodes.map((n) => n.id)).toEqual(["n1", "n2", "n3"]);
    expect(venue.edges.map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
  });

  it("rejects a self-loop", () => {
    const venue = addNode(emptyVenue(), { x: 0, y: 0, kind: "normal" });
    expect(() => addEdge(venue, "n1", "n1", 10)).toThrow();
  });

  it("rejects a duplicate edge between the same two nodes", () => {
    const venue = triangleVenue();
    expect(() => addEdge(venue, "n2", "n1", 10)).toThrow();
  });
});

describe("removeNode", () => {
  it("cascades to incident edges", () => {
    const venue = removeNode(triangleVenue(), "n2");
    expect(venue.nodes.map((n) => n.id)).toEqual(["n1", "n3"]);
    expect(venue.edges.map((e) => e.id)).toEqual(["e3"]);
  });
});

describe("edgeLength", () => {
  it("computes Euclidean distance scaled by scaleMetersPerUnit", () => {
    const venue: Venue = { ...emptyVenue(), scaleMetersPerUnit: 2 };
    const withNodes = addNode(addNode(venue, { x: 0, y: 0, kind: "normal" }), {
      x: 3,
      y: 4,
      kind: "normal",
    });
    const withEdge = addEdge(withNodes, "n1", "n2", 10);
    expect(edgeLength(withEdge, withEdge.edges[0])).toBe(10); // 3-4-5 triangle * scale 2
  });

  it("updates after moveNode", () => {
    const withNodes = addNode(addNode(emptyVenue(), { x: 0, y: 0, kind: "normal" }), {
      x: 10,
      y: 0,
      kind: "normal",
    });
    const withEdge = addEdge(withNodes, "n1", "n2", 10);
    const moved = moveNode(withEdge, "n2", 30, 0);
    expect(edgeLength(moved, moved.edges[0])).toBe(30);
  });
});

describe("nodeDegrees", () => {
  it("counts incident edges regardless of direction", () => {
    const venue = triangleVenue();
    const degrees = nodeDegrees(venue);
    expect(degrees.get("n1")).toBe(2);
    expect(degrees.get("n2")).toBe(2);
    expect(degrees.get("n3")).toBe(2);
  });
});

describe("isFullyConnected", () => {
  it("is true for a connected graph", () => {
    expect(isFullyConnected(triangleVenue())).toBe(true);
  });

  it("is false once an edge removal disconnects a node", () => {
    let venue = addNode(emptyVenue(), { x: 0, y: 0, kind: "normal" });
    venue = addNode(venue, { x: 100, y: 0, kind: "normal" });
    expect(isFullyConnected(venue)).toBe(false);
  });
});

describe("applyOptimizedDirections", () => {
  it("marks matched edges forward or reverse based on MR2S pair orientation", () => {
    const venue = triangleVenue();
    const optimized = applyOptimizedDirections(venue, [
      { fromNodeId: "n1", toNodeId: "n2" }, // matches edge n1->n2 as-is
      { fromNodeId: "n3", toNodeId: "n2" }, // matches edge n2->n3 flipped
      { fromNodeId: "n1", toNodeId: "n3" }, // matches edge n1->n3 as-is
    ]);
    expect(optimized.edges.find((e) => e.id === "e1")?.direction).toBe("forward");
    expect(optimized.edges.find((e) => e.id === "e2")?.direction).toBe("reverse");
    expect(optimized.edges.find((e) => e.id === "e3")?.direction).toBe("forward");
  });

  it("throws when a pair does not match any existing edge", () => {
    const venue = triangleVenue();
    expect(() =>
      applyOptimizedDirections(venue, [{ fromNodeId: "n1", toNodeId: "n99" }])
    ).toThrow();
  });
});

describe("updateEdgeDirection", () => {
  it("changes only the targeted edge", () => {
    const venue = updateEdgeDirection(triangleVenue(), "e1", "forward");
    expect(venue.edges.find((e) => e.id === "e1")?.direction).toBe("forward");
    expect(venue.edges.find((e) => e.id === "e2")?.direction).toBe("bidirectional");
  });
});
