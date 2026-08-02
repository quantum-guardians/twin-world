import { describe, expect, it } from "vitest";
import type { Venue } from "../domain/types";
import { buildAdjacency, pickSpawnTargetPair, shortestPath, spawnAgent } from "./agents";
import { createSfmWorld } from "./socialForce";
import { mulberry32 } from "../domain/rng";
import {
  AGENT_RENDER_HEIGHT_ADULT_MAX,
  AGENT_RENDER_HEIGHT_ADULT_MIN,
  AGENT_RENDER_HEIGHT_CHILD_MAX,
  AGENT_RENDER_HEIGHT_CHILD_MIN,
} from "../domain/simPresets";

function lineVenue(): Venue {
  return {
    id: "v1",
    name: "line",
    region: "test",
    scaleMetersPerUnit: 1,
    isSyntheticLayout: true,
    nodes: [
      { id: "a", x: 0, y: 0, kind: "entrance" },
      { id: "b", x: 10, y: 0, kind: "normal" },
      { id: "c", x: 20, y: 0, kind: "destination" },
    ],
    edges: [
      { id: "e1", fromNodeId: "a", toNodeId: "b", width: 4, direction: "bidirectional" },
      { id: "e2", fromNodeId: "b", toNodeId: "c", width: 4, direction: "forward" },
    ],
  };
}

describe("buildAdjacency", () => {
  it("makes a bidirectional edge walkable in both directions", () => {
    const adjacency = buildAdjacency(lineVenue());
    expect(adjacency.get("a")?.some((e) => e.to === "b")).toBe(true);
    expect(adjacency.get("b")?.some((e) => e.to === "a")).toBe(true);
  });

  it("makes a forward edge one-way only", () => {
    const adjacency = buildAdjacency(lineVenue());
    expect(adjacency.get("b")?.some((e) => e.to === "c")).toBe(true);
    expect(adjacency.get("c")?.some((e) => e.to === "b")).toBe(false);
  });

  it("uses physical edge length as weight", () => {
    const adjacency = buildAdjacency(lineVenue());
    const entry = adjacency.get("a")?.find((e) => e.to === "b");
    expect(entry?.weight).toBeCloseTo(10, 5);
  });
});

describe("shortestPath", () => {
  it("finds a path respecting one-way edges", () => {
    const adjacency = buildAdjacency(lineVenue());
    expect(shortestPath(adjacency, "a", "c")).toEqual(["a", "b", "c"]);
  });

  it("returns null when the only path is against a one-way edge", () => {
    const adjacency = buildAdjacency(lineVenue());
    expect(shortestPath(adjacency, "c", "a")).toBeNull();
  });
});

describe("pickSpawnTargetPair", () => {
  it("prefers an entrance node as the start and a destination/exit node as the target", () => {
    const venue = lineVenue();
    const rng = () => 0; // deterministic: always picks pool[0]
    const pair = pickSpawnTargetPair(venue, rng);
    expect(pair).toEqual(["a", "c"]);
  });

  it("falls back to any node when no entrance/destination exists", () => {
    const venue: Venue = {
      ...lineVenue(),
      nodes: [
        { id: "x", x: 0, y: 0, kind: "normal" },
        { id: "y", x: 10, y: 0, kind: "normal" },
      ],
    };
    const pair = pickSpawnTargetPair(venue, mulberry32(9));
    expect(pair).not.toBeNull();
    expect(pair![0]).not.toBe(pair![1]);
  });
});

describe("spawnAgent", () => {
  it("produces an agent with a valid multi-waypoint path from entrance to destination", () => {
    const venue = lineVenue();
    const world = createSfmWorld();
    const adjacency = buildAdjacency(venue);
    const agent = spawnAgent("a1", { world, venue, adjacency, rng: () => 0.42 });
    expect(agent).not.toBeNull();
    expect(agent!.startNodeId).toBe("a");
    expect(agent!.targetNodeId).toBe("c");
    expect(agent!.waypoints.length).toBe(3);
    expect(agent!.state).toBe("moving");
    expect(world.agents.has("a1")).toBe(true);
  });

  it("returns null when start and target are disconnected", () => {
    const venue: Venue = {
      ...lineVenue(),
      edges: [], // no edges at all -> no path between any two nodes
    };
    const world = createSfmWorld();
    const adjacency = buildAdjacency(venue);
    expect(spawnAgent("a1", { world, venue, adjacency, rng: () => 0.1 })).toBeNull();
  });

  it("assigns a child age group and a child-range render height for a low draw", () => {
    const venue = lineVenue();
    const world = createSfmWorld();
    const adjacency = buildAdjacency(venue);
    // A constant low rng() satisfies every draw in spawnAgent, including the
    // age-group check (< AGENT_CHILD_FRACTION = 0.12), so this deterministically
    // produces a child.
    const agent = spawnAgent("a1", { world, venue, adjacency, rng: () => 0.05 });
    expect(agent!.ageGroup).toBe("child");
    expect(agent!.renderHeightM).toBeGreaterThanOrEqual(AGENT_RENDER_HEIGHT_CHILD_MIN);
    expect(agent!.renderHeightM).toBeLessThanOrEqual(AGENT_RENDER_HEIGHT_CHILD_MAX);
  });

  it("assigns an adult age group and an adult-range render height for a high draw", () => {
    const venue = lineVenue();
    const world = createSfmWorld();
    const adjacency = buildAdjacency(venue);
    const agent = spawnAgent("a1", { world, venue, adjacency, rng: () => 0.9 });
    expect(agent!.ageGroup).toBe("adult");
    expect(agent!.renderHeightM).toBeGreaterThanOrEqual(AGENT_RENDER_HEIGHT_ADULT_MIN);
    expect(agent!.renderHeightM).toBeLessThanOrEqual(AGENT_RENDER_HEIGHT_ADULT_MAX);
  });
});
