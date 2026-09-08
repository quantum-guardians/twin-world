import { describe, expect, it } from "vitest";
import { createFestivalStreetPreset } from "../domain/festivalPreset";
import { VenueSimulation } from "./engine";
import { fastForward, hasSettled } from "./fastForward";
import { FIXED_DT_MS } from "./socialForce";

const TICK_SECONDS = FIXED_DT_MS / 1000;

function makeSimulation(seed: number, population = 40) {
  return new VenueSimulation(createFestivalStreetPreset(), {
    population,
    seed,
    scenarioMode: "arrival",
  });
}

describe("fastForward", () => {
  it("advances an unsettled simulation to approximately the requested seconds", () => {
    // 40 agents over a 200+ metre route at 1.25 m/s can't fully spawn and
    // arrive within 5 simulated seconds, so this should run the full
    // budget rather than stopping early.
    const sim = makeSimulation(1);
    fastForward([sim], 5);
    expect(hasSettled(sim)).toBe(false);
    expect(sim.elapsedSeconds).toBeCloseTo(5, 1);
    expect(Math.abs(sim.elapsedSeconds - 5)).toBeLessThanOrEqual(TICK_SECONDS);
  });

  it("stops early once the simulation has settled, well short of the budget", () => {
    // A single agent on this venue arrives in well under a minute of
    // simulated time; settle-detection should cut the loop short instead
    // of grinding through the rest of a generous budget.
    const sim = makeSimulation(2, 1);
    const budgetSeconds = 600;
    fastForward([sim], budgetSeconds);
    expect(hasSettled(sim)).toBe(true);
    expect(sim.elapsedSeconds).toBeLessThan(budgetSeconds * 0.6);
  });

  it("advances several simulations together to the same elapsedSeconds", () => {
    // The comparison view relies on this: simulations never settle at the
    // exact same tick, but the shared loop must not let one run ahead of
    // another just because it personally finished first.
    const simA = makeSimulation(3, 10);
    const simB = makeSimulation(4, 60);
    fastForward([simA, simB], 5);
    expect(simA.elapsedSeconds).toBe(simB.elapsedSeconds);
  });

  it("reports not settled before anyone has spawned", () => {
    const sim = makeSimulation(5);
    expect(hasSettled(sim)).toBe(false);
  });

  it("reports not settled while agents are still moving", () => {
    const sim = makeSimulation(6);
    // Run past the first spawn-batch interval (200 ms) so agents exist,
    // but nowhere near enough to cross a 200+ metre route.
    for (let i = 0; i < 30; i++) sim.tick(FIXED_DT_MS);
    expect(sim.counts().total).toBeGreaterThan(0);
    expect(hasSettled(sim)).toBe(false);
  });

  it("is a no-op for an empty simulation list", () => {
    expect(() => fastForward([], 10)).not.toThrow();
  });

  it("produces the same result as ticking manually the same number of times", () => {
    // This is the claim the skip-ahead button makes to the user: the
    // numbers after a skip are identical to watching the whole run at 1x.
    const seconds = 5;
    const ticks = Math.round((seconds * 1000) / FIXED_DT_MS);

    const skipped = makeSimulation(7);
    fastForward([skipped], seconds);

    const manual = makeSimulation(7);
    for (let i = 0; i < ticks; i++) manual.tick(FIXED_DT_MS);

    // Neither simulation settles within 5 simulated seconds (see the first
    // test), so both ran the same number of ticks with no early exit.
    expect(hasSettled(skipped)).toBe(false);
    expect(hasSettled(manual)).toBe(false);
    expect(skipped.elapsedSeconds).toBe(manual.elapsedSeconds);
    expect(skipped.counts().arrived).toBe(manual.counts().arrived);
    expect(skipped.counts().total).toBe(manual.counts().total);
  });
});
