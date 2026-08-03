import { describe, expect, it } from "vitest";
import { simulationAlerts } from "./alerts";
import type { SimulationCounts } from "../components/simulation/SimulationControls";

function counts(partial: Partial<SimulationCounts>): SimulationCounts {
  return { total: 100, moving: 0, arrived: 0, dead: 0, pendingSpawn: 0, ...partial };
}

describe("simulationAlerts", () => {
  it("stays quiet on a healthy run", () => {
    expect(simulationAlerts(counts({ arrived: 100 }), 0, 0)).toEqual([]);
  });

  it("ignores a single unlucky agent but flags a casualty event", () => {
    expect(simulationAlerts(counts({ dead: 1 }), 0, 0)).toEqual([]);
    expect(simulationAlerts(counts({ dead: 2 }), 0, 0)).toHaveLength(1);
  });

  it("flags widespread pressure and simultaneous bottlenecks", () => {
    expect(simulationAlerts(counts({}), 15, 0)).toHaveLength(1);
    expect(simulationAlerts(counts({}), 0, 3)).toHaveLength(1);
    expect(simulationAlerts(counts({ dead: 5 }), 20, 4)).toHaveLength(3);
  });

  it("does not divide by zero before anyone spawns", () => {
    expect(simulationAlerts(counts({ total: 0 }), 0, 0)).toEqual([]);
  });
});
