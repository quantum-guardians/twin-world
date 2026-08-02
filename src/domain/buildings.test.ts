import { describe, expect, it } from "vitest";
import type { Venue } from "./types";
import { buildCorridors, pointInCorridor } from "./corridors";
import { DEFAULT_BUILDING_LAYOUT, generateBuildings } from "./buildings";

function straightVenue(): Venue {
  return {
    id: "v1",
    name: "straight",
    region: "test",
    scaleMetersPerUnit: 1,
    isSyntheticLayout: true,
    nodes: [
      { id: "a", x: 0, y: 0, kind: "entrance" },
      { id: "b", x: 100, y: 0, kind: "exit" },
    ],
    edges: [{ id: "e1", fromNodeId: "a", toNodeId: "b", width: 10, direction: "bidirectional" }],
  };
}

describe("generateBuildings", () => {
  it("is empty for a venue with no nodes", () => {
    const empty: Venue = { ...straightVenue(), nodes: [], edges: [] };
    expect(generateBuildings(empty, [], [])).toEqual([]);
  });

  it("never places a building overlapping the street", () => {
    const venue = straightVenue();
    const { corridors, hubs } = buildCorridors(venue);
    const buildings = generateBuildings(venue, corridors, hubs);
    for (const b of buildings) {
      const half = b.width / 2;
      const corners = [
        { x: b.x - half, y: b.y - half },
        { x: b.x + half, y: b.y - half },
        { x: b.x - half, y: b.y + half },
        { x: b.x + half, y: b.y + half },
      ];
      for (const corner of corners) {
        for (const corridor of corridors) {
          expect(pointInCorridor(corner, corridor)).toBe(false);
        }
      }
    }
    expect(buildings.length).toBeGreaterThan(0);
  });

  it("is deterministic for a given seed", () => {
    const venue = straightVenue();
    const { corridors, hubs } = buildCorridors(venue);
    const first = generateBuildings(venue, corridors, hubs, { ...DEFAULT_BUILDING_LAYOUT, seed: 7 });
    const second = generateBuildings(venue, corridors, hubs, { ...DEFAULT_BUILDING_LAYOUT, seed: 7 });
    expect(second).toEqual(first);
  });

  it("produces different heights for a different seed", () => {
    const venue = straightVenue();
    const { corridors, hubs } = buildCorridors(venue);
    const a = generateBuildings(venue, corridors, hubs, { ...DEFAULT_BUILDING_LAYOUT, seed: 1 });
    const b = generateBuildings(venue, corridors, hubs, { ...DEFAULT_BUILDING_LAYOUT, seed: 2 });
    expect(a.map((x) => x.height)).not.toEqual(b.map((x) => x.height));
  });
});
