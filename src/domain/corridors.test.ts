import { describe, expect, it } from "vitest";
import type { Venue } from "./types";
import { buildCorridors, isPointInWalkableArea, pointInCorridor } from "./corridors";

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

describe("buildCorridors", () => {
  it("shortens the strip at both ends by the hub radius", () => {
    const { corridors, hubs } = buildCorridors(straightVenue());
    expect(corridors).toHaveLength(1);
    const corridor = corridors[0];
    const hubRadius = hubs[0].radius; // both hubs have the same radius here (one edge, width 10)
    expect(corridor.length).toBeCloseTo(100 - 2 * hubRadius, 5);
    expect(corridor.a.x).toBeCloseTo(hubRadius, 5);
    expect(corridor.b.x).toBeCloseTo(100 - hubRadius, 5);
  });

  it("sizes each hub to the widest incident edge", () => {
    const venue: Venue = {
      id: "v2",
      name: "junction",
      region: "test",
      scaleMetersPerUnit: 1,
      isSyntheticLayout: true,
      nodes: [
        { id: "a", x: 0, y: 0, kind: "entrance" },
        { id: "hub", x: 100, y: 0, kind: "normal" },
        { id: "b", x: 200, y: 0, kind: "exit" },
      ],
      edges: [
        { id: "e1", fromNodeId: "a", toNodeId: "hub", width: 4, direction: "bidirectional" },
        { id: "e2", fromNodeId: "hub", toNodeId: "b", width: 20, direction: "bidirectional" },
      ],
    };
    const { hubs } = buildCorridors(venue);
    const hub = hubs.find((h) => h.nodeId === "hub")!;
    expect(hub.radius).toBeGreaterThan(10); // driven by the wider (20m) edge, not the 4m one
  });
});

describe("pointInCorridor / isPointInWalkableArea", () => {
  it("accepts a point on the centerline and rejects one far outside the width", () => {
    const { corridors } = buildCorridors(straightVenue());
    const corridor = corridors[0];
    expect(pointInCorridor({ x: 50, y: 0 }, corridor)).toBe(true);
    expect(pointInCorridor({ x: 50, y: 20 }, corridor)).toBe(false);
  });

  it("treats hub disks as walkable even outside any corridor rectangle", () => {
    const { corridors, hubs } = buildCorridors(straightVenue());
    // Point near node "a"'s hub center, off the corridor's centerline axis.
    const nearHub = { x: 0, y: hubs[0].radius * 0.5 };
    expect(isPointInWalkableArea(nearHub, corridors, hubs)).toBe(true);
  });

  it("rejects a point far from every corridor and hub", () => {
    const { corridors, hubs } = buildCorridors(straightVenue());
    expect(isPointInWalkableArea({ x: 50, y: 500 }, corridors, hubs)).toBe(false);
  });
});
