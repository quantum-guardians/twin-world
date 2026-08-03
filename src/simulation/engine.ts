import type { Venue } from "../domain/types";
import { buildCorridors, type Corridor, type JunctionHub } from "../domain/corridors";
import { computeCorridorOccupancy } from "../domain/density";
import { mulberry32 } from "../domain/rng";
import {
  buildAdjacency,
  computeDesiredDirections,
  enforceContainment,
  spawnAgent,
  type AdjacencyEntry,
  type AgentRuntimeState,
} from "./agents";
import { createSfmWorld, rebuildWalls, stepSocialForce, type SfmWorld } from "./socialForce";
import { updatePressureDeaths } from "./pressure";
import { BottleneckTracker, computeArrivalMetrics, type ArrivalMetrics } from "./metrics";
import { ADD_AGENTS_BATCH_INTERVAL_MS, ADD_AGENTS_BATCH_SIZE } from "../domain/simPresets";

export interface SimulationOptions {
  population: number;
  seed: number;
  /** Rushing/panic level in [0, 1]; 0 = calm walking (default). See the
   * urgency section in domain/simPresets.ts. */
  urgency?: number;
}

// Density/bottleneck state is deliberately recomputed on a low-frequency
// cadence rather than every 60 Hz physics tick - see density.ts's doc
// comment. Occupancy is an O(agents * corridors) scan, and the resulting
// number doesn't change meaningfully within a fraction of a second anyway.
const DENSITY_SAMPLE_INTERVAL_MS = 250;

/**
 * Ties the ported route-finding/physics/pressure modules to one venue and
 * scenario, plus the risk metrics derived from them (density, bottlenecks,
 * arrival/evacuation stats). Owns no rendering or timing loop of its own -
 * callers advance it with tick(dtMs) from whatever clock they use (React
 * hook with requestAnimationFrame for the live 3D view, a plain for-loop
 * for headless baseline-vs-optimized comparison runs).
 */
export class VenueSimulation {
  readonly venue: Venue;
  readonly world: SfmWorld;
  readonly corridors: Corridor[];
  readonly hubs: JunctionHub[];
  readonly adjacency: Map<string, AdjacencyEntry[]>;
  readonly agents: AgentRuntimeState[] = [];
  readonly lastValidPositions = new Map<string, { x: number; y: number }>();

  private readonly rng: () => number;
  private readonly urgency: number;
  private readonly bottleneckTracker = new BottleneckTracker();
  private pendingSpawnCount: number;
  private msSinceLastSpawnBatch = 0;
  private msSinceLastDensitySample = 0;
  private nextAgentIndex = 0;

  elapsedSeconds = 0;
  tickCount = 0;
  densityByCorridor = new Map<string, number>();

  constructor(venue: Venue, options: SimulationOptions) {
    this.venue = venue;
    this.world = createSfmWorld();
    const { corridors, hubs } = buildCorridors(venue);
    this.corridors = corridors;
    this.hubs = hubs;
    rebuildWalls(this.world, corridors);
    this.adjacency = buildAdjacency(venue);
    this.rng = mulberry32(options.seed);
    this.urgency = Math.max(0, Math.min(1, options.urgency ?? 0));
    this.pendingSpawnCount = Math.max(0, Math.floor(options.population));
  }

  /** Spawns up to ADD_AGENTS_BATCH_SIZE agents at a time on a fixed
   * interval instead of dumping the whole population in one frame. When
   * spawnAgent reports the entrances are too congested for another body
   * (null), the remainder stays queued for the next interval - people
   * wait outside a full venue instead of materializing inside the crowd. */
  private drainSpawnQueue(dtMs: number): void {
    if (this.pendingSpawnCount <= 0) return;
    this.msSinceLastSpawnBatch += dtMs;
    if (this.msSinceLastSpawnBatch < ADD_AGENTS_BATCH_INTERVAL_MS) return;
    this.msSinceLastSpawnBatch = 0;

    const batchSize = Math.min(ADD_AGENTS_BATCH_SIZE, this.pendingSpawnCount);
    for (let i = 0; i < batchSize; i++) {
      const id = `agent-${this.nextAgentIndex}`;
      const state = spawnAgent(id, {
        world: this.world,
        venue: this.venue,
        adjacency: this.adjacency,
        rng: this.rng,
        lastValidPositions: this.lastValidPositions,
      });
      if (!state) break;
      this.nextAgentIndex++;
      this.pendingSpawnCount--;
      this.agents.push(state);
    }
  }

  private sampleDensityAndBottlenecks(dtMs: number): void {
    this.msSinceLastDensitySample += dtMs;
    if (this.msSinceLastDensitySample < DENSITY_SAMPLE_INTERVAL_MS) return;
    const dtSeconds = this.msSinceLastDensitySample / 1000;
    this.msSinceLastDensitySample = 0;

    const positions = Array.from(this.world.agents.values(), (a) => a.position);
    this.densityByCorridor = computeCorridorOccupancy(this.corridors, positions);
    this.bottleneckTracker.update(this.corridors, this.world, this.densityByCorridor, dtSeconds);
  }

  /** Advances the simulation by one fixed physics tick. */
  tick(dtMs: number): void {
    this.drainSpawnQueue(dtMs);

    const wasMoving = new Set(this.agents.filter((a) => a.state === "moving").map((a) => a.id));

    const desired = computeDesiredDirections(this.agents, this.world, undefined, undefined, this.urgency);
    stepSocialForce(this.world, desired, dtMs);
    enforceContainment(this.world, this.corridors, this.hubs, this.lastValidPositions);
    updatePressureDeaths(this.agents, this.world);

    this.elapsedSeconds += dtMs / 1000;
    this.tickCount += 1;

    for (const agent of this.agents) {
      if (agent.state === "arrived" && wasMoving.has(agent.id) && agent.arrivedAtSeconds === undefined) {
        agent.arrivedAtSeconds = this.elapsedSeconds;
      }
    }

    this.sampleDensityAndBottlenecks(dtMs);
  }

  get remainingToSpawn(): number {
    return this.pendingSpawnCount;
  }

  get bottleneckCorridorIds(): ReadonlySet<string> {
    return this.bottleneckTracker.bottleneckCorridorIds;
  }

  counts() {
    let moving = 0;
    let arrived = 0;
    let dead = 0;
    for (const agent of this.agents) {
      if (agent.state === "moving") moving++;
      else if (agent.state === "arrived") arrived++;
      else dead++;
    }
    return { total: this.agents.length, moving, arrived, dead, pendingSpawn: this.pendingSpawnCount };
  }

  metrics(): ArrivalMetrics {
    return computeArrivalMetrics(this.agents);
  }
}
