import { describe, expect, it } from "vitest";
import type { Venue } from "./types";
import { applyMr2sResponse, buildMr2sRequest, buildVertexMapping, isDisconnectedScore } from "./mr2sAdapter";
import type { Mr2sResponse } from "../api/mr2sClient";

function triangleVenue(): Venue {
  return {
    id: "v1",
    name: "triangle",
    region: "test",
    scaleMetersPerUnit: 1,
    isSyntheticLayout: true,
    nodes: [
      { id: "n1", x: 0, y: 0, kind: "entrance" },
      { id: "n2", x: 3, y: 4, kind: "normal" }, // 3-4-5 triangle -> length 5
      { id: "n3", x: 0, y: 4, kind: "exit" },
    ],
    edges: [
      { id: "e1", fromNodeId: "n1", toNodeId: "n2", width: 4, direction: "bidirectional" },
      { id: "e2", fromNodeId: "n2", toNodeId: "n3", width: 4, direction: "bidirectional" },
      { id: "e3", fromNodeId: "n1", toNodeId: "n3", width: 4, direction: "bidirectional" },
    ],
  };
}

describe("buildVertexMapping", () => {
  it("assigns a distinct integer to every node, invertible both ways", () => {
    const venue = triangleVenue();
    const mapping = buildVertexMapping(venue);
    for (const node of venue.nodes) {
      const vertex = mapping.idToVertex.get(node.id)!;
      expect(mapping.vertexToId.get(vertex)).toBe(node.id);
    }
    expect(new Set(mapping.idToVertex.values()).size).toBe(venue.nodes.length);
  });
});

describe("buildMr2sRequest", () => {
  it("converts edges to integer-vertex pairs with rounded physical-length weights", () => {
    const venue = triangleVenue();
    const mapping = buildVertexMapping(venue);
    const request = buildMr2sRequest(venue, mapping);
    expect(request.edges).toHaveLength(3);
    const e1 = request.edges[0];
    expect(e1.vertices).toEqual([mapping.idToVertex.get("n1"), mapping.idToVertex.get("n2")]);
    expect(e1.weight).toBe(5); // 3-4-5 triangle
  });

  it("never emits a weight below 1, even for a very short edge", () => {
    const venue: Venue = {
      ...triangleVenue(),
      nodes: [
        { id: "n1", x: 0, y: 0, kind: "normal" },
        { id: "n2", x: 0.2, y: 0, kind: "normal" },
      ],
      edges: [{ id: "e1", fromNodeId: "n1", toNodeId: "n2", width: 2, direction: "bidirectional" }],
    };
    const mapping = buildVertexMapping(venue);
    expect(buildMr2sRequest(venue, mapping).edges[0].weight).toBe(1);
  });
});

describe("applyMr2sResponse", () => {
  it("maps response vertex pairs back to venue edge directions", () => {
    const venue = triangleVenue();
    const mapping = buildVertexMapping(venue);
    const response: Mr2sResponse = {
      edges: [
        { _from: mapping.idToVertex.get("n1")!, to: mapping.idToVertex.get("n2")! },
        { _from: mapping.idToVertex.get("n3")!, to: mapping.idToVertex.get("n2")! },
        { _from: mapping.idToVertex.get("n1")!, to: mapping.idToVertex.get("n3")! },
      ],
      optimized_graph_score: 42,
      bidirectional_graph_score: 50,
    };
    const optimized = applyMr2sResponse(venue, response, mapping);
    expect(optimized.edges.find((e) => e.id === "e1")?.direction).toBe("forward");
    expect(optimized.edges.find((e) => e.id === "e2")?.direction).toBe("reverse");
    expect(optimized.edges.find((e) => e.id === "e3")?.direction).toBe("forward");
  });

  it("throws if the response references a vertex the mapping never issued", () => {
    const venue = triangleVenue();
    const mapping = buildVertexMapping(venue);
    const badResponse: Mr2sResponse = {
      edges: [{ _from: 999, to: mapping.idToVertex.get("n2")! }],
      optimized_graph_score: 1,
      bidirectional_graph_score: 1,
    };
    expect(() => applyMr2sResponse(venue, badResponse, mapping)).toThrow();
  });
});

describe("isDisconnectedScore", () => {
  it("is true only for exactly -1", () => {
    expect(isDisconnectedScore(-1)).toBe(true);
    expect(isDisconnectedScore(0)).toBe(false);
    expect(isDisconnectedScore(42)).toBe(false);
  });
});
