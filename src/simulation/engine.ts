import type { Venue } from "../domain/types";
import { buildCorridors, type Corridor, type JunctionHub } from "../domain/corridors";
import { mulberry32 } from "../domain/rng";
import {
  buildAdjacency,
  computeDesiredDirections,
  constrainAgentsToRoutes,
  enforceContainment,
  spawnAgent,
  type AdjacencyEntry,
  type AgentRuntimeState,
} from "./agents";
import { createSfmWorld, rebuildWalls, stepSocialForce, type SfmWorld } from "./socialForce";
import { updatePressureDeaths } from "./pressure";
import { ADD_AGENTS_BATCH_INTERVAL_MS, ADD_AGENTS_BATCH_SIZE } from "../domain/simPresets";

export interface SimulationOptions {
  population: number;
  seed: number;
}

/**
 * Ties the ported route-finding/physics/pressure modules to one venue and
 * scenario. Owns no rendering or timing loop of its own - callers advance
 * it with tick(dtMs) from whatever clock they use (React hook with
 * requestAnimationFrame for the live 3D view, a plain for-loop for
 * headless baseline-vs-optimized comparison runs).
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
  private pendingSpawnCount: number;
  private msSinceLastSpawnBatch = 0;
  private nextAgentIndex = 0;

  elapsedSeconds = 0;
  tickCount = 0;

  constructor(venue: Venue, options: SimulationOptions) {
    this.venue = venue;
    this.world = createSfmWorld();
    const { corridors, hubs } = buildCorridors(venue);
    this.corridors = corridors;
    this.hubs = hubs;
    rebuildWalls(this.world, corridors);
    this.adjacency = buildAdjacency(venue);
    this.rng = mulberry32(options.seed);
    this.pendingSpawnCount = Math.max(0, Math.floor(options.population));
  }

  /** Spawns up to ADD_AGENTS_BATCH_SIZE agents at a time on a fixed
   * interval instead of dumping the whole population in one frame, which
   * would drop a pile of deeply-overlapping bodies on the floor at once. */
  private drainSpawnQueue(dtMs: number): void {
    if (this.pendingSpawnCount <= 0) return;
    this.msSinceLastSpawnBatch += dtMs;
    if (this.msSinceLastSpawnBatch < ADD_AGENTS_BATCH_INTERVAL_MS) return;
    this.msSinceLastSpawnBatch = 0;

    const batchSize = Math.min(ADD_AGENTS_BATCH_SIZE, this.pendingSpawnCount);
    for (let i = 0; i < batchSize; i++) {
      const id = `agent-${this.nextAgentIndex++}`;
      const state = spawnAgent(id, {
        world: this.world,
        venue: this.venue,
        adjacency: this.adjacency,
        rng: this.rng,
        lastValidPositions: this.lastValidPositions,
      });
      this.pendingSpawnCount--;
      if (state) this.agents.push(state);
    }
  }

  /** Advances the simulation by one fixed physics tick. */
  tick(dtMs: number): void {
    this.drainSpawnQueue(dtMs);

    const desired = computeDesiredDirections(this.agents, this.world);
    stepSocialForce(this.world, desired, dtMs);
    constrainAgentsToRoutes(this.agents, this.world);
    enforceContainment(this.world, this.corridors, this.hubs, this.lastValidPositions);
    updatePressureDeaths(this.agents, this.world);

    this.elapsedSeconds += dtMs / 1000;
    this.tickCount += 1;
  }

  get remainingToSpawn(): number {
    return this.pendingSpawnCount;
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
}
