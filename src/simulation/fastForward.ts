import { FIXED_DT_MS } from "./socialForce";
import type { VenueSimulation } from "./engine";

/** Simulated seconds a skip-ahead advances by default. Long enough that the
 * demo scenario has stopped changing: at the shipped defaults the arrival
 * curve is flat well before this, so the metrics a viewer reads after a
 * skip are the metrics of a finished run. */
export const SKIP_AHEAD_SECONDS = 1200;

/** Wall-clock milliseconds one slice may spend before returning to the
 * caller. Sized to stay inside a frame's budget on a slow machine: a skip
 * runs for minutes of wall time at the demo population, and a browser that
 * stops painting for that long looks crashed. Time-boxing rather than
 * fixing a tick count keeps a slice short regardless of how many agents
 * and simulations the tick has to move - measured throughput for three
 * simulations ranges from 726 ticks/s at 80 agents to 155 at 300. */
export const SKIP_SLICE_BUDGET_MS = 24;

/** How often, in ticks, settle-detection checks whether anything is still
 * happening. One second of simulated time - cheap next to the tick itself. */
const SETTLE_CHECK_INTERVAL_TICKS = 60;

export interface SkipSliceResult {
  /** Simulated seconds actually advanced by this slice. */
  advancedSeconds: number;
  /** True once every simulation has settled, so the caller can stop early. */
  settled: boolean;
}

/**
 * Advances every simulation by as many fixed ticks as fit in
 * `budgetMs` of wall clock, or until `maxSeconds` of simulated time have
 * passed, whichever comes first.
 *
 * This is the honest way to "watch it faster". Playback rate is capped by
 * how many fixed ticks a frame can afford (MAX_STEPS_PER_FRAME in the
 * hooks), so raising it past that limit only makes the control lie. This
 * runs the same fixed timestep the render loop uses, just without drawing
 * anything, so the resulting metrics are identical to having watched the
 * whole run at 1x - a property `fastForward.test.ts` pins directly.
 *
 * Callers drive it one slice per animation frame. Doing the whole skip in
 * one call would block the main thread for minutes at the demo population,
 * which is why the loop lives in the caller and not in here.
 *
 * Ticking every simulation inside the same loop keeps a paired or
 * three-way comparison on the shared clock it depends on.
 */
export function fastForwardSlice(
  simulations: VenueSimulation[],
  maxSeconds: number,
  budgetMs: number = SKIP_SLICE_BUDGET_MS
): SkipSliceResult {
  if (simulations.length === 0 || maxSeconds <= 0) return { advancedSeconds: 0, settled: true };

  const maxTicks = Math.round((maxSeconds * 1000) / FIXED_DT_MS);
  const startedAt = Date.now();
  let ticks = 0;

  while (ticks < maxTicks) {
    for (const simulation of simulations) simulation.tick(FIXED_DT_MS);
    ticks++;
    if (ticks % SETTLE_CHECK_INTERVAL_TICKS === 0) {
      if (simulations.every(hasSettled)) break;
      if (Date.now() - startedAt >= budgetMs) break;
    }
  }

  return {
    advancedSeconds: (ticks * FIXED_DT_MS) / 1000,
    settled: simulations.every(hasSettled),
  };
}

/**
 * Runs a whole skip in one blocking call. Used by the headless scripts and
 * the tests; the UI drives `fastForwardSlice` per frame instead, because
 * this takes minutes of wall clock at the demo population.
 */
export function fastForward(simulations: VenueSimulation[], seconds: number = SKIP_AHEAD_SECONDS): void {
  if (simulations.length === 0) return;
  let remaining = seconds;
  while (remaining > 0) {
    const { advancedSeconds, settled } = fastForwardSlice(simulations, remaining, Number.POSITIVE_INFINITY);
    if (settled || advancedSeconds <= 0) return;
    remaining -= advancedSeconds;
  }
}

/** True when a simulation has nobody left moving and nothing left to spawn.
 * Agents wedged in a jam still count as moving, so a deadlocked run is not
 * mistaken for a finished one - it runs out the full budget instead, which
 * is the correct reading: it never finished. */
export function hasSettled(simulation: VenueSimulation): boolean {
  const metrics = simulation.metrics();
  return metrics.moving === 0 && metrics.totalSpawned > 0 && simulation.remainingToSpawn === 0;
}
