import { describe, expect, it } from "vitest";
import { buildCorridors } from "./corridors";
import { computeCorridorOccupancy, getDensityColor } from "./density";
import type { Venue } from "./types";

function straightVenue(): Venue {
  return {
    id: "v1",
    name: "straight",
    region: "test",
    scaleMetersPerUnit: 1,
    isSyntheticLayout: true,
    nodes: [
      { id: "a", x: 0, y: 0, kind: "entrance" },
      { id: "b", x: 20, y: 0, kind: "exit" },
    ],
    edges: [{ id: "e1", fromNodeId: "a", toNodeId: "b", width: 4, direction: "bidirectional" }],
  };
}

describe("computeCorridorOccupancy", () => {
  it("is zero for an empty corridor", () => {
    const { corridors } = buildCorridors(straightVenue());
    const densities = computeCorridorOccupancy(corridors, []);
    expect(densities.get("e1")).toBe(0);
  });

  it("increases with more agents on the same corridor, clamped to 1", () => {
    const { corridors } = buildCorridors(straightVenue());
    const few = computeCorridorOccupancy(corridors, [{ x: 10, y: 0 }]);
    const many = computeCorridorOccupancy(
      corridors,
      Array.from({ length: 200 }, (_, i) => ({ x: 5 + i * 0.05, y: 0 }))
    );
    expect(many.get("e1")!).toBeGreaterThan(few.get("e1")!);
    expect(many.get("e1")!).toBeLessThanOrEqual(1);
  });

  it("does not count an agent standing outside every corridor", () => {
    const { corridors } = buildCorridors(straightVenue());
    const densities = computeCorridorOccupancy(corridors, [{ x: 10, y: 500 }]);
    expect(densities.get("e1")).toBe(0);
  });
});

describe("getDensityColor", () => {
  it("returns distinct colors across the density range", () => {
    const colors = new Set([0, 0.3, 0.6, 0.9].map(getDensityColor));
    expect(colors.size).toBe(4);
  });
});
