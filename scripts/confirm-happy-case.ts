/**
 * Multi-seed confirmation of the demo scenario. One seed can flatter any
 * layout, so the settings the comparison view ships with have to hold
 * across seeds before they are called a result.
 *
 *   npx vite-node scripts/confirm-happy-case.ts [mode] [population] [seeds]
 */
import { createFestivalStreetPreset } from "../src/domain/festivalPreset";
import { createFestivalStreetMr2sVenue } from "../src/domain/festivalPresetMr2s";
import { robbinsOrientation } from "../src/domain/robbinsOrientation";
import { VenueSimulation, type ScenarioMode } from "../src/simulation/engine";
import { FIXED_DT_MS } from "../src/simulation/socialForce";
import { DEMO_SCENARIO_MODE, DEMO_SCENARIO_POPULATION, DEMO_SCENARIO_URGENCY } from "../src/domain/simPresets";
import type { Venue } from "../src/domain/types";

// Defaults come from the shipped constants, so re-running this script
// always re-measures whatever the app actually opens on.
const mode = (process.argv[2] as ScenarioMode) ?? DEMO_SCENARIO_MODE;
const POPULATION = Number(process.argv[3] ?? DEMO_SCENARIO_POPULATION);
const SEEDS = (process.argv[4] ?? "1,2,3,4,5").split(",").map(Number);
const SIM_SECONDS = 1200;
const URGENCY = DEMO_SCENARIO_URGENCY;
const TICKS = Math.round((SIM_SECONDS * 1000) / FIXED_DT_MS);

function run(venue: Venue, seed: number) {
  const sim = new VenueSimulation(venue, { population: POPULATION, seed, urgency: URGENCY, scenarioMode: mode });
  for (let i = 0; i < TICKS; i++) sim.tick(FIXED_DT_MS);
  const m = sim.metrics();
  const dead = sim.agents.filter((a) => a.state === "dead").length;
  return {
    survival: ((m.totalSpawned - dead) / m.totalSpawned) * 100,
    arrival: m.arrivalRatePercent,
    mean: m.meanTravelSeconds ?? 0,
    dead,
  };
}

const base = createFestivalStreetPreset();
const arms: [string, Venue][] = [
  ["기준안", base],
  ["Robbins", robbinsOrientation(base, 1)],
  ["MR2S", createFestivalStreetMr2sVenue()],
];
const f = (v: number, d = 1) => v.toFixed(d).padStart(6);

console.log(`scenario=${mode} population=${POPULATION} urgency=${URGENCY} simSeconds=${SIM_SECONDS} seeds=${SEEDS.join(",")}`);
for (const [name, venue] of arms) {
  const rows = SEEDS.map((s) => run(venue, s));
  const avg = (pick: (r: ReturnType<typeof run>) => number) => rows.reduce((a, r) => a + pick(r), 0) / rows.length;
  const deads = rows.map((r) => r.dead);
  console.log(
    `${name.padEnd(8)} 생존 ${f(avg((r) => r.survival))}%  도착 ${f(avg((r) => r.arrival))}%  평균도착 ${f(avg((r) => r.mean))}s  ` +
      `사망 평균 ${f(avg((r) => r.dead), 1)} (seed별 ${deads.join("/")})`
  );
}
