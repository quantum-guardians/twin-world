/**
 * High-density three-way sweep: all-bidirectional vs Robbins one-way vs
 * MR2S one-way, on the same population, seed and scenario.
 *
 *   npx vite-node scripts/density-sweep.ts [mode] [simSeconds] [pops]
 *
 * Why three arms and why high density. One-way always makes individual
 * trips longer - on this venue MR2S's mean scenario route is 18-50%
 * longer than the bidirectional one - so at low density one-way can only
 * lose. It can only win where counterflow congestion costs more than that
 * detour, which is a crowding question, not a graph question. Robbins is
 * the fair one-way baseline: a valid strongly connected orientation
 * produced with no optimization at all.
 *
 * The run window must outlast the trips. Mean travel time here is in the
 * hundreds of seconds, so a short window measures "who finished first",
 * not "who got everyone out".
 */
import { createFestivalStreetPreset } from "../src/domain/festivalPreset";
import { createFestivalStreetMr2sVenue } from "../src/domain/festivalPresetMr2s";
import { robbinsOrientation } from "../src/domain/robbinsOrientation";
import { VenueSimulation, type ScenarioMode } from "../src/simulation/engine";
import { FIXED_DT_MS } from "../src/simulation/socialForce";
import type { Venue } from "../src/domain/types";

const mode = (process.argv[2] as ScenarioMode) ?? "evacuation";
const SIM_SECONDS = Number(process.argv[3] ?? 1500);
const POPULATIONS = (process.argv[4] ?? "200,300,400").split(",").map(Number);
const TICKS = Math.round((SIM_SECONDS * 1000) / FIXED_DT_MS);
const URGENCY = 0.4;
const SEED = 1;

function run(venue: Venue, population: number) {
  const sim = new VenueSimulation(venue, { population, seed: SEED, urgency: URGENCY, scenarioMode: mode });
  for (let i = 0; i < TICKS; i++) {
    sim.tick(FIXED_DT_MS);
    if (i % 600 === 0 && i > 0) {
      const m = sim.metrics();
      if (m.moving === 0 && m.totalSpawned >= population) break;
    }
  }
  const m = sim.metrics();
  const dead = sim.agents.filter((a) => a.state === "dead").length;
  return {
    survival: m.totalSpawned > 0 ? ((m.totalSpawned - dead) / m.totalSpawned) * 100 : 0,
    arrival: m.arrivalRatePercent,
    mean: m.meanTravelSeconds,
    dead,
    elapsed: sim.elapsedSeconds,
  };
}

const base = createFestivalStreetPreset();
const arms: [string, Venue][] = [
  ["기준안", base],
  ["Robbins", robbinsOrientation(base, 1)],
  ["MR2S", createFestivalStreetMr2sVenue()],
];

const f = (v: number | null, d = 1) => (v === null ? "--" : v.toFixed(d)).padStart(6);
console.log(`scenario=${mode} urgency=${URGENCY} seed=${SEED} simSeconds=${SIM_SECONDS}`);
for (const population of POPULATIONS) {
  for (const [name, venue] of arms) {
    const r = run(venue, population);
    console.log(
      `pop=${String(population).padStart(3)}  ${name.padEnd(8)} 생존 ${f(r.survival)}%  도착 ${f(r.arrival)}%  평균도착 ${f(r.mean)}s  사망 ${f(r.dead, 0)}  종료 ${f(r.elapsed, 0)}s`
    );
  }
}
