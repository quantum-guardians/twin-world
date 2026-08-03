import type { Point } from "./corridors";
import { pointInCorridor, type Corridor } from "./corridors";
import { AGENT_RADIUS } from "./simPresets";

/** Four-step congestion ramp. Hues are deepened relative to a pastel scale so
 * each step stays distinguishable when drawn semi-transparently over the light
 * street surface (see src/three/sceneColors.ts for the surfaces themselves). */
export function getDensityColor(density: number): string {
  if (density < 0.2) return "#12b981"; // low: green
  if (density < 0.5) return "#f5b21a"; // medium: amber
  if (density < 0.8) return "#f2701d"; // high: orange
  return "#e5342c"; // critical: red
}

/**
 * Corridor-occupancy density: for each corridor, what fraction of its
 * floor area is covered by agent footprints (clamped to [0, 1]). Ported
 * from simulation_react's density.ts; intended to be recomputed on a
 * low-frequency cadence (~every 250ms, see BottleneckTracker in
 * simulation/metrics.ts), not every physics tick.
 */
export function computeCorridorOccupancy(
  corridors: Corridor[],
  agentPositions: Point[],
  agentFootprintArea: number = Math.PI * AGENT_RADIUS * AGENT_RADIUS
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const corridor of corridors) counts.set(corridor.id, 0);

  for (const point of agentPositions) {
    for (const corridor of corridors) {
      if (pointInCorridor(point, corridor)) {
        counts.set(corridor.id, (counts.get(corridor.id) ?? 0) + 1);
        break;
      }
    }
  }

  const densities = new Map<string, number>();
  for (const corridor of corridors) {
    const floorArea = Math.max(corridor.length * corridor.width, 1e-6);
    const count = counts.get(corridor.id) ?? 0;
    densities.set(corridor.id, Math.min((count * agentFootprintArea) / floorArea, 1));
  }
  return densities;
}
