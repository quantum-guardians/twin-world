import { describe, expect, it } from "vitest";
import type { Venue } from "../domain/types";
import { VenueSimulation } from "./engine";
import { isPointInWalkableArea } from "../domain/corridors";

function shortLineVenue(): Venue {
  return {
    id: "v1",
    name: "short line",
    region: "test",
    scaleMetersPerUnit: 1,
    isSyntheticLayout: true,
    nodes: [
      { id: "a", x: 0, y: 0, kind: "entrance" },
      { id: "b", x: 5, y: 0, kind: "destination" },
    ],
    edges: [{ id: "e1", fromNodeId: "a", toNodeId: "b", width: 3, direction: "bidirectional" }],
  };
}

const TICK_MS = 1000 / 60;

describe("VenueSimulation", () => {
  it("spawns the requested population over time, batched", () => {
    const sim = new VenueSimulation(shortLineVenue(), { population: 5, seed: 1 });
    expect(sim.counts().total).toBe(0);
    for (let i = 0; i < 20; i++) sim.tick(TICK_MS); // well past one spawn-batch interval
    expect(sim.counts().total).toBeGreaterThan(0);
  });

  it("moves spawned agents toward their destination and marks them arrived", () => {
    const sim = new VenueSimulation(shortLineVenue(), { population: 3, seed: 7 });
    // Run enough ticks (a few seconds) for a 5 m trip at ~1.25 m/s to complete.
    for (let i = 0; i < 60 * 8; i++) sim.tick(TICK_MS);
    const counts = sim.counts();
    expect(counts.total).toBe(3);
    expect(counts.arrived).toBeGreaterThan(0);
  });

  it("never lets an agent's position leave the walkable floor", () => {
    const sim = new VenueSimulation(shortLineVenue(), { population: 4, seed: 3 });
    for (let i = 0; i < 60 * 5; i++) {
      sim.tick(TICK_MS);
      for (const body of sim.world.agents.values()) {
        expect(isPointInWalkableArea(body.position, sim.corridors, sim.hubs, 0.15)).toBe(true);
      }
    }
  });

  it("is deterministic for a given seed", () => {
    const runOnce = () => {
      const sim = new VenueSimulation(shortLineVenue(), { population: 3, seed: 42 });
      for (let i = 0; i < 60 * 3; i++) sim.tick(TICK_MS);
      return Array.from(sim.world.agents.values()).map((a) => [a.position.x, a.position.y]);
    };
    expect(runOnce()).toEqual(runOnce());
  });
});
