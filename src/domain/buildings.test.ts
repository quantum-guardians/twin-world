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
      const hw = b.width / 2;
      const hd = b.depth / 2;
      const corners = [
        { x: b.x - hw, y: b.y - hd },
        { x: b.x + hw, y: b.y - hd },
        { x: b.x - hw, y: b.y + hd },
        { x: b.x + hw, y: b.y + hd },
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

  it("mixes 1-, 2- and 3-lot footprints and leaves lots empty", () => {
    const venue = straightVenue();
    const { corridors, hubs } = buildCorridors(venue);
    const { cellSize, gap } = DEFAULT_BUILDING_LAYOUT;
    const buildings = generateBuildings(venue, corridors, hubs);

    const spans = new Set(
      buildings.map((b) => Math.max((b.width + gap) / cellSize, (b.depth + gap) / cellSize))
    );
    expect([...spans].sort()).toEqual([1, 2, 3]);

    const lotsUsed = (list: typeof buildings) =>
      list.reduce((sum, b) => sum + ((b.width + gap) / cellSize) * ((b.depth + gap) / cellSize), 0);
    const packed = generateBuildings(venue, corridors, hubs, {
      ...DEFAULT_BUILDING_LAYOUT,
      emptyLotChance: 0,
    });
    expect(lotsUsed(buildings)).toBeLessThan(lotsUsed(packed));
    expect(buildings.some((b) => b.width !== b.depth)).toBe(true);
  });

  it("spreads heights across low, mid and tall tiers", () => {
    const venue = straightVenue();
    const { corridors, hubs } = buildCorridors(venue);
    const { minHeight, maxHeight } = DEFAULT_BUILDING_LAYOUT;
    const range = maxHeight - minHeight;
    const heights = generateBuildings(venue, corridors, hubs).map((b) => b.height);

    expect(heights.some((h) => h < minHeight + range * 0.25)).toBe(true);
    expect(heights.some((h) => h > minHeight + range * 0.6)).toBe(true);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(range * 0.5);
  });

  it("produces different heights for a different seed", () => {
    const venue = straightVenue();
    const { corridors, hubs } = buildCorridors(venue);
    const a = generateBuildings(venue, corridors, hubs, { ...DEFAULT_BUILDING_LAYOUT, seed: 1 });
    const b = generateBuildings(venue, corridors, hubs, { ...DEFAULT_BUILDING_LAYOUT, seed: 2 });
    expect(a.map((x) => x.height)).not.toEqual(b.map((x) => x.height));
  });
});
