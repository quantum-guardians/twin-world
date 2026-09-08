import { describe, expect, it } from "vitest";
import type { Venue } from "../domain/types";
import { buildAdjacency, pickSpawnTargetPair, shortestPath, spawnAgent } from "./agents";
import { createSfmWorld } from "./socialForce";
import { mulberry32 } from "../domain/rng";
import {
  AGENT_BODY_RADIUS_M,
  AGENT_HAIR_LENGTH_MAX_FRACTION,
  AGENT_HAIR_LENGTH_MIN_FRACTION,
  AGENT_RENDER_HEIGHT_M,
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

/** entrance + destination + exit, all distinct, so each scenario mode's
 * pools are unambiguous. */
function fullVenue(): Venue {
  return {
    id: "v2",
    name: "full",
    region: "test",
    scaleMetersPerUnit: 1,
    isSyntheticLayout: true,
    nodes: [
      { id: "gate", x: 0, y: 0, kind: "entrance" },
      { id: "plaza", x: 10, y: 0, kind: "destination" },
      { id: "door", x: 20, y: 0, kind: "exit" },
    ],
    edges: [
      { id: "e1", fromNodeId: "gate", toNodeId: "plaza", width: 4, direction: "bidirectional" },
      { id: "e2", fromNodeId: "plaza", toNodeId: "door", width: 4, direction: "bidirectional" },
    ],
  };
}

function allNormalVenue(): Venue {
  return {
    ...fullVenue(),
    nodes: [
      { id: "x", x: 0, y: 0, kind: "normal" },
      { id: "y", x: 10, y: 0, kind: "normal" },
    ],
  };
}

describe("pickSpawnTargetPair", () => {
  it("evacuation mode spawns from entrance/destination and always targets the exit node", () => {
    const venue = fullVenue();
    const rng = mulberry32(1);
    for (let i = 0; i < 50; i++) {
      const pair = pickSpawnTargetPair(venue, "evacuation", rng);
      expect(pair).not.toBeNull();
      const [start, target] = pair!;
      expect(["gate", "plaza"]).toContain(start);
      expect(target).toBe("door");
    }
  });

  it("arrival mode spawns from entrance and always targets the destination node, never the exit", () => {
    const venue = fullVenue();
    const rng = mulberry32(2);
    for (let i = 0; i < 50; i++) {
      const pair = pickSpawnTargetPair(venue, "arrival", rng);
      expect(pair).not.toBeNull();
      const [start, target] = pair!;
      expect(start).toBe("gate");
      expect(target).toBe("plaza");
      expect(target).not.toBe("door");
    }
  });

  it("free mode never returns the same start and target", () => {
    const venue = fullVenue();
    const rng = mulberry32(3);
    for (let i = 0; i < 50; i++) {
      const pair = pickSpawnTargetPair(venue, "free", rng);
      expect(pair).not.toBeNull();
      expect(pair![0]).not.toBe(pair![1]);
    }
  });

  it("evacuation falls back to any node when the venue has no entrance/destination/exit", () => {
    const pair = pickSpawnTargetPair(allNormalVenue(), "evacuation", mulberry32(9));
    expect(pair).not.toBeNull();
    expect(pair![0]).not.toBe(pair![1]);
  });

  it("arrival falls back to any node when the venue has no entrance/destination", () => {
    const pair = pickSpawnTargetPair(allNormalVenue(), "arrival", mulberry32(11));
    expect(pair).not.toBeNull();
    expect(pair![0]).not.toBe(pair![1]);
  });

  it("free mode's pools are already 'any node', so no fallback branch applies", () => {
    const pair = pickSpawnTargetPair(allNormalVenue(), "free", mulberry32(13));
    expect(pair).not.toBeNull();
    expect(["x", "y"]).toContain(pair![0]);
    expect(["x", "y"]).toContain(pair![1]);
  });
});

describe("spawnAgent", () => {
  it("produces an agent with a valid multi-waypoint path from entrance to destination", () => {
    const venue = lineVenue();
    const world = createSfmWorld();
    const adjacency = buildAdjacency(venue);
    // Arrival mode: entrance-only start pool, destination-only target pool
    // - with only one candidate in each, rng 0.42 deterministically picks
    // "a" then "c" regardless of pool-index arithmetic.
    const agent = spawnAgent("a1", { world, venue, adjacency, mode: "arrival", elapsedSeconds: 0, rng: () => 0.42 });
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
    expect(
      spawnAgent("a1", { world, venue, adjacency, mode: "arrival", elapsedSeconds: 0, rng: () => 0.1 })
    ).toBeNull();
  });

  it("gives every spawned body the uniform agent radius", () => {
    const venue = lineVenue();
    const world = createSfmWorld();
    const adjacency = buildAdjacency(venue);
    const agent = spawnAgent("a1", { world, venue, adjacency, mode: "arrival", elapsedSeconds: 0, rng: () => 0.9 });
    expect(agent).not.toBeNull();
    expect(world.agents.get("a1")!.radius).toBe(AGENT_BODY_RADIUS_M);
  });

  it("scales hair length to the shared agent height", () => {
    const venue = lineVenue();
    const world = createSfmWorld();
    const adjacency = buildAdjacency(venue);
    const agent = spawnAgent("a1", {
      world,
      venue,
      adjacency,
      mode: "arrival",
      elapsedSeconds: 0,
      rng: () => 0.9,
    })!;
    expect(agent.hairLengthM).toBeGreaterThanOrEqual(AGENT_RENDER_HEIGHT_M * AGENT_HAIR_LENGTH_MIN_FRACTION);
    expect(agent.hairLengthM).toBeLessThanOrEqual(AGENT_RENDER_HEIGHT_M * AGENT_HAIR_LENGTH_MAX_FRACTION);
  });

  it("stamps spawnedAtSeconds from the caller-supplied simulation clock", () => {
    const venue = lineVenue();
    const world = createSfmWorld();
    const adjacency = buildAdjacency(venue);
    const agent = spawnAgent("a1", {
      world,
      venue,
      adjacency,
      mode: "arrival",
      elapsedSeconds: 12.5,
      rng: () => 0.9,
    });
    expect(agent).not.toBeNull();
    expect(agent!.spawnedAtSeconds).toBe(12.5);
  });
});
