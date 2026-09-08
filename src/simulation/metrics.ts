import type { AgentRuntimeState } from "./agents";
import type { Corridor } from "../domain/corridors";
import { pointInCorridor } from "../domain/corridors";
import type { SfmWorld } from "./socialForce";

export interface ArrivalMetrics {
  totalSpawned: number;
  arrived: number;
  moving: number;
  /** Ever exceeded the pressure threshold (currently dead, or recovered) -
   * see plan: report as "고압력 위험 노출", not a real casualty count. */
  highPressureExposed: number;
  arrivalRatePercent: number;
  /** Simulation time at which the 95th spawned agent (by spawn order, not
   * arrival order) reached its destination; null until that many have
   * actually arrived. */
  evacuationP95Seconds: number | null;
  /** Mean seconds each arrived agent spent travelling - its own arrival
   * time minus its own spawn time - across agents that have arrived. null
   * until at least one has arrived. */
  meanTravelSeconds: number | null;
  /** Median of the same population. null until at least one agent has
   * arrived. */
  medianTravelSeconds: number | null;
}

/** Aggregates per-agent state into the plan's headline metrics table
 * (도착률, 예상 대피시간, 고압력 위험 노출). Pure function over a snapshot -
 * call it whenever the UI needs fresh numbers, no internal state to keep
 * in sync. */
export function computeArrivalMetrics(agents: AgentRuntimeState[]): ArrivalMetrics {
  const totalSpawned = agents.length;
  let arrived = 0;
  let moving = 0;
  let highPressureExposed = 0;
  const arrivalTimes: number[] = [];
  const travelTimes: number[] = [];

  for (const agent of agents) {
    if (agent.state === "arrived") {
      arrived++;
      if (agent.arrivedAtSeconds !== undefined) arrivalTimes.push(agent.arrivedAtSeconds);
      if (agent.arrivedAtSeconds !== undefined && agent.spawnedAtSeconds !== undefined) {
        travelTimes.push(agent.arrivedAtSeconds - agent.spawnedAtSeconds);
      }
    } else if (agent.state === "moving") {
      moving++;
    }
    if (agent.state === "dead" || (agent.highPressureTicks ?? 0) > 0) highPressureExposed++;
  }

  arrivalTimes.sort((a, b) => a - b);
  const requiredForP95 = Math.ceil(totalSpawned * 0.95);
  const evacuationP95Seconds =
    totalSpawned > 0 && arrivalTimes.length >= requiredForP95 ? arrivalTimes[requiredForP95 - 1] : null;

  travelTimes.sort((a, b) => a - b);
  const meanTravelSeconds =
    travelTimes.length > 0 ? travelTimes.reduce((sum, t) => sum + t, 0) / travelTimes.length : null;
  // Even-sized sample: median is the mean of the two middle values (the
  // odd case collapses to the same formula since both indices coincide).
  const medianTravelSeconds =
    travelTimes.length > 0
      ? (travelTimes[Math.floor((travelTimes.length - 1) / 2)] + travelTimes[Math.ceil((travelTimes.length - 1) / 2)]) / 2
      : null;

  return {
    totalSpawned,
    arrived,
    moving,
    highPressureExposed,
    arrivalRatePercent: totalSpawned > 0 ? (arrived / totalSpawned) * 100 : 0,
    evacuationP95Seconds,
    meanTravelSeconds,
    medianTravelSeconds,
  };
}

const BOTTLENECK_DENSITY_THRESHOLD = 0.55;
const BOTTLENECK_SPEED_THRESHOLD_MPS = 0.4; // well below normal walking pace (~1.25 m/s)
const BOTTLENECK_SUSTAIN_SECONDS = 2;
// Recovers twice as fast as it accumulates, so a momentary clearing (one
// gap in the crowd) doesn't instantly clear a corridor that's still
// effectively jammed.
const BOTTLENECK_RECOVERY_MULTIPLIER = 2;

/**
 * Tracks, per corridor, how long density+speed have simultaneously been in
 * "bottleneck" territory. A corridor only becomes a reported bottleneck
 * once that condition has held for BOTTLENECK_SUSTAIN_SECONDS - a single
 * crowded instant (e.g. a spawn batch passing through) should not count as
 * the structural bottleneck the plan's comparison view cares about.
 * update() is meant to be called on the same low-frequency cadence as the
 * density recompute (see VenueSimulation), not every physics tick.
 */
export class BottleneckTracker {
  private readonly highConditionSeconds = new Map<string, number>();
  readonly bottleneckCorridorIds = new Set<string>();

  update(corridors: Corridor[], world: SfmWorld, occupancy: Map<string, number>, dtSeconds: number): void {
    const speedSumByCorridor = new Map<string, number>();
    const countByCorridor = new Map<string, number>();
    for (const body of world.agents.values()) {
      for (const corridor of corridors) {
        if (!pointInCorridor(body.position, corridor)) continue;
        const speed = Math.hypot(body.velocity.x, body.velocity.y);
        speedSumByCorridor.set(corridor.id, (speedSumByCorridor.get(corridor.id) ?? 0) + speed);
        countByCorridor.set(corridor.id, (countByCorridor.get(corridor.id) ?? 0) + 1);
        break;
      }
    }

    for (const corridor of corridors) {
      const density = occupancy.get(corridor.id) ?? 0;
      const count = countByCorridor.get(corridor.id) ?? 0;
      const avgSpeed = count > 0 ? (speedSumByCorridor.get(corridor.id) ?? 0) / count : Infinity;
      const isHighCondition = density >= BOTTLENECK_DENSITY_THRESHOLD && avgSpeed <= BOTTLENECK_SPEED_THRESHOLD_MPS;

      const previous = this.highConditionSeconds.get(corridor.id) ?? 0;
      const next = isHighCondition
        ? previous + dtSeconds
        : Math.max(0, previous - dtSeconds * BOTTLENECK_RECOVERY_MULTIPLIER);
      this.highConditionSeconds.set(corridor.id, next);

      if (next >= BOTTLENECK_SUSTAIN_SECONDS) this.bottleneckCorridorIds.add(corridor.id);
      else if (next <= 0) this.bottleneckCorridorIds.delete(corridor.id);
    }
  }
}
