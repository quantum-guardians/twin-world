import { describe, expect, it } from "vitest";
import type { AgentRuntimeState } from "./agents";
import { BottleneckTracker, computeArrivalMetrics } from "./metrics";
import { buildCorridors } from "../domain/corridors";
import { computeCorridorOccupancy } from "../domain/density";
import { createSfmWorld, addAgent } from "./socialForce";
import type { Venue } from "../domain/types";

function narrowVenue(): Venue {
  return {
    id: "v1",
    name: "narrow",
    region: "test",
    scaleMetersPerUnit: 1,
    isSyntheticLayout: true,
    nodes: [
      { id: "a", x: 0, y: 0, kind: "entrance" },
      { id: "b", x: 10, y: 0, kind: "exit" },
    ],
    edges: [{ id: "e1", fromNodeId: "a", toNodeId: "b", width: 1, direction: "bidirectional" }],
  };
}

function agent(overrides: Partial<AgentRuntimeState>): AgentRuntimeState {
  return {
    id: "a",
    waypoints: [],
    waypointIndex: 0,
    startNodeId: "s",
    targetNodeId: "t",
    state: "moving",
    hairLengthM: 0.2,
    ...overrides,
  };
}

describe("computeArrivalMetrics", () => {
  it("is all-zero for an empty population", () => {
    const metrics = computeArrivalMetrics([]);
    expect(metrics).toMatchObject({ totalSpawned: 0, arrived: 0, moving: 0, arrivalRatePercent: 0 });
    expect(metrics.evacuationP95Seconds).toBeNull();
  });

  it("computes arrival rate from arrived vs. total spawned", () => {
    const agents = [
      agent({ id: "1", state: "arrived", arrivedAtSeconds: 10 }),
      agent({ id: "2", state: "arrived", arrivedAtSeconds: 12 }),
      agent({ id: "3", state: "moving" }),
      agent({ id: "4", state: "moving" }),
    ];
    const metrics = computeArrivalMetrics(agents);
    expect(metrics.totalSpawned).toBe(4);
    expect(metrics.arrived).toBe(2);
    expect(metrics.moving).toBe(2);
    expect(metrics.arrivalRatePercent).toBe(50);
  });

  it("counts dead and recovered-from-high-pressure agents as exposed", () => {
    const agents = [
      agent({ id: "1", state: "dead" }),
      agent({ id: "2", state: "arrived", highPressureTicks: 30, arrivedAtSeconds: 5 }), // recovered before arriving
      agent({ id: "3", state: "moving", highPressureTicks: 0 }),
    ];
    expect(computeArrivalMetrics(agents).highPressureExposed).toBe(2);
  });

  it("reports evacuationP95Seconds only once 95% of the population has arrived", () => {
    // 20 agents; 95% = 19. With 18 arrived it should stay null.
    const arrived18 = Array.from({ length: 18 }, (_, i) =>
      agent({ id: `a${i}`, state: "arrived", arrivedAtSeconds: i + 1 })
    );
    const stillMoving2 = [agent({ id: "m1" }), agent({ id: "m2" })];
    expect(computeArrivalMetrics([...arrived18, ...stillMoving2]).evacuationP95Seconds).toBeNull();

    // With 19 arrived (95% of 20), it should report the 19th arrival time.
    const arrived19 = Array.from({ length: 19 }, (_, i) =>
      agent({ id: `a${i}`, state: "arrived", arrivedAtSeconds: i + 1 })
    );
    const metrics = computeArrivalMetrics([...arrived19, agent({ id: "m1" })]);
    expect(metrics.evacuationP95Seconds).toBe(19);
  });
});

describe("BottleneckTracker", () => {
  it("flags a corridor only after high density + low speed persist past the sustain window", () => {
    const venue = narrowVenue();
    const { corridors } = buildCorridors(venue);
    const world = createSfmWorld();
    // Fill the 1m-wide corridor with enough stationary agents to push
    // footprint coverage past the density threshold - high density, zero speed.
    for (let i = 0; i < 40; i++) addAgent(world, `a${i}`, 1 + i * 0.2, 0);

    const tracker = new BottleneckTracker();
    const occupancy = computeCorridorOccupancy(corridors, Array.from(world.agents.values(), (a) => a.position));
    expect(occupancy.get("e1")!).toBeGreaterThan(0.5);

    // Sub-threshold duration: not yet a bottleneck.
    tracker.update(corridors, world, occupancy, 1);
    expect(tracker.bottleneckCorridorIds.has("e1")).toBe(false);

    // Past BOTTLENECK_SUSTAIN_SECONDS (2s) of sustained high condition.
    tracker.update(corridors, world, occupancy, 1.5);
    expect(tracker.bottleneckCorridorIds.has("e1")).toBe(true);
  });

  it("clears once density drops, rather than staying flagged forever", () => {
    const venue = narrowVenue();
    const { corridors } = buildCorridors(venue);
    const world = createSfmWorld();
    for (let i = 0; i < 40; i++) addAgent(world, `a${i}`, 1 + i * 0.2, 0);

    const tracker = new BottleneckTracker();
    const packedOccupancy = computeCorridorOccupancy(corridors, Array.from(world.agents.values(), (a) => a.position));
    tracker.update(corridors, world, packedOccupancy, 3);
    expect(tracker.bottleneckCorridorIds.has("e1")).toBe(true);

    const emptyOccupancy = computeCorridorOccupancy(corridors, []);
    for (let i = 0; i < 5; i++) tracker.update(corridors, world, emptyOccupancy, 1);
    expect(tracker.bottleneckCorridorIds.has("e1")).toBe(false);
  });
});
