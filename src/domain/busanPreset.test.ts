import { describe, expect, it } from "vitest";
import { createBusanFestivalStreetPreset } from "./busanPreset";
import { isFullyConnected, nodesOfKind } from "./venueGraph";

describe("createBusanFestivalStreetPreset", () => {
  it("is flagged as a synthetic (non-surveyed) layout", () => {
    expect(createBusanFestivalStreetPreset().isSyntheticLayout).toBe(true);
  });

  it("every edge references existing node ids", () => {
    const venue = createBusanFestivalStreetPreset();
    const nodeIds = new Set(venue.nodes.map((n) => n.id));
    for (const edge of venue.edges) {
      expect(nodeIds.has(edge.fromNodeId)).toBe(true);
      expect(nodeIds.has(edge.toNodeId)).toBe(true);
    }
  });

  it("node and edge ids are unique", () => {
    const venue = createBusanFestivalStreetPreset();
    expect(new Set(venue.nodes.map((n) => n.id)).size).toBe(venue.nodes.length);
    expect(new Set(venue.edges.map((e) => e.id)).size).toBe(venue.edges.length);
  });

  it("is fully connected", () => {
    expect(isFullyConnected(createBusanFestivalStreetPreset())).toBe(true);
  });

  it("has at least one entrance, one exit, and one destination", () => {
    const venue = createBusanFestivalStreetPreset();
    expect(nodesOfKind(venue, "entrance").length).toBeGreaterThan(0);
    expect(nodesOfKind(venue, "exit").length).toBeGreaterThan(0);
    expect(nodesOfKind(venue, "destination").length).toBeGreaterThan(0);
  });

  it("has redundant routes (west/east alleys) so MR2S has choices to optimize", () => {
    const venue = createBusanFestivalStreetPreset();
    // Every non-leaf junction on the main spine should have degree > 2,
    // i.e. more than just "in from the spine, out to the spine".
    const junctionIds = ["n2", "n4"];
    const degrees = new Map<string, number>();
    for (const edge of venue.edges) {
      degrees.set(edge.fromNodeId, (degrees.get(edge.fromNodeId) ?? 0) + 1);
      degrees.set(edge.toNodeId, (degrees.get(edge.toNodeId) ?? 0) + 1);
    }
    for (const id of junctionIds) {
      expect(degrees.get(id) ?? 0).toBeGreaterThan(2);
    }
  });
});
