import type { Point } from "../domain/corridors";
import { buildWallSegments, type Corridor, type WallSegment } from "../domain/corridors";
import { SpatialGrid } from "./spatialGrid";
import {
  AGENT_RADIUS,
  MAX_PHYSICAL_SPEED,
  SFM_K_BODY,
  SFM_KAPPA,
  SFM_MAX_ACCEL,
  SFM_TAU,
} from "../domain/simPresets";

/**
 * Contact-force crowd physics (Helbing, Farkas & Vicsek 2000, Nature 407).
 *
 * Steering - who to avoid, which way to swerve - lives entirely in the
 * vision heuristics (visionHeuristic.ts, Moussaïd et al. 2011) that produce
 * each agent's DesiredMotion; there is deliberately no long-range
 * "psychological" repulsion force here anymore. What remains is physical:
 * a driving force relaxing velocity toward the desired motion over SFM_TAU
 * seconds, and, only when bodies actually touch, a compression spring plus
 * sliding friction against other agents and walls. Those contact terms are
 * what the crowd-crush pressure metric measures, so they are never scaled
 * or bypassed. Integration is semi-implicit Euler with substepping and an
 * absolute velocity cap for numeric stability at 60 Hz - high enough that
 * dense-crowd shoving (crowd turbulence) is expressed, not clipped.
 */

export interface SfmAgent {
  id: string;
  position: Point;
  velocity: Point;
  radius: number;
}

export interface SfmWorld {
  walls: WallSegment[];
  /** Static cell → wall-index buckets; see buildWallIndex. */
  wallIndex: Map<number, number[]>;
  agents: Map<string, SfmAgent>;
}

/** Unit direction + desired speed toward the current waypoint. Agents with
 * no entry (arrived, or unknown) get a zero desired velocity and brake. */
export interface DesiredMotion {
  ex: number;
  ey: number;
  speed: number;
}

export const FIXED_DT_MS = 1000 / 60;

// Max distance any agent may travel within a single substep, so a fast
// agent cannot tunnel past a wall or through a body between force
// evaluations. At MAX_PHYSICAL_SPEED (5 m/s) a 60 Hz tick moves at most
// 0.083 m, so a single substep already satisfies this; the ceil() only
// kicks in for larger dtMs.
const MAX_STEP_DISPLACEMENT_M = 0.15;

const MIN_SUBSTEPS = 1;

export function createSfmWorld(): SfmWorld {
  return { walls: [], wallIndex: new Map(), agents: new Map() };
}

const WALL_INDEX_CELL_M = 2;
/** Everything that asks for "walls near an agent" needs at most contact
 * radius + one substep of travel; one meter of margin over the cell's
 * half-diagonal covers all of it comfortably. */
const WALL_INDEX_REACH_M = WALL_INDEX_CELL_M * Math.SQRT2 * 0.5 + 1;

function wallCellKey(cx: number, cy: number): number {
  return (cx + 1_048_576) * 2_097_152 + (cy + 1_048_576);
}

/** Walls are static per floor plan, so agent-vs-wall loops use a
 * precomputed cell index instead of scanning every segment per agent per
 * substep - with thousands of agents that scan dominated the tick. */
function buildWallIndex(walls: WallSegment[]): Map<number, number[]> {
  const index = new Map<number, number[]>();
  for (let w = 0; w < walls.length; w++) {
    const wall = walls[w];
    const minCx = Math.floor((Math.min(wall.a.x, wall.b.x) - WALL_INDEX_REACH_M) / WALL_INDEX_CELL_M);
    const maxCx = Math.floor((Math.max(wall.a.x, wall.b.x) + WALL_INDEX_REACH_M) / WALL_INDEX_CELL_M);
    const minCy = Math.floor((Math.min(wall.a.y, wall.b.y) - WALL_INDEX_REACH_M) / WALL_INDEX_CELL_M);
    const maxCy = Math.floor((Math.max(wall.a.y, wall.b.y) + WALL_INDEX_REACH_M) / WALL_INDEX_CELL_M);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const center = { x: (cx + 0.5) * WALL_INDEX_CELL_M, y: (cy + 0.5) * WALL_INDEX_CELL_M };
        const closest = closestPointOnSegment(center, wall.a, wall.b);
        if (Math.hypot(center.x - closest.x, center.y - closest.y) > WALL_INDEX_REACH_M) continue;
        const key = wallCellKey(cx, cy);
        const bucket = index.get(key);
        if (bucket) bucket.push(w);
        else index.set(key, [w]);
      }
    }
  }
  return index;
}

/** Invokes `callback` for every wall near (x, y) - within contact/crossing
 * reach, not the vision horizon. */
export function forEachWallNear(world: SfmWorld, x: number, y: number, callback: (wall: WallSegment) => void): void {
  const bucket = world.wallIndex.get(
    wallCellKey(Math.floor(x / WALL_INDEX_CELL_M), Math.floor(y / WALL_INDEX_CELL_M))
  );
  if (!bucket) return;
  for (const w of bucket) callback(world.walls[w]);
}

/** Replaces the wall set from the current corridor floor plan. Cheap (plain
 * arrays), safe to call on every floor-plan edit. */
export function rebuildWalls(world: SfmWorld, corridors: Corridor[]): void {
  world.walls = buildWallSegments(corridors);
  world.wallIndex = buildWallIndex(world.walls);
}

export function addAgent(
  world: SfmWorld,
  id: string,
  x: number,
  y: number,
  radius: number = AGENT_RADIUS
): SfmAgent {
  const agent: SfmAgent = {
    id,
    position: { x, y },
    velocity: { x: 0, y: 0 },
    radius,
  };
  world.agents.set(id, agent);
  return agent;
}

export function removeAgent(world: SfmWorld, id: string): void {
  world.agents.delete(id);
}

function closestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  if (lengthSq < 1e-12) return a;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

/** Deterministic unit vector for the d~0 singularity, so exactly-stacked
 * agents separate reproducibly instead of dividing by zero. */
function separationDirection(i: number, j: number): { x: number; y: number } {
  const seed = Math.abs((i + 1) * 73856093 + (j + 1) * 19349663);
  const angle = (seed % 6283) / 1000;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

/** Contact interactions reach at most two body radii (0.4 m), so a cell
 * this size still covers every query with a 3×3 neighborhood while keeping
 * dense-crowd buckets small. */
const CONTACT_GRID_CELL_M = 0.5;

function fillContactGrid(grid: SpatialGrid, agents: SfmAgent[]): number {
  grid.clear();
  let maxRadius = 0;
  for (let i = 0; i < agents.length; i++) {
    grid.insert(i, agents[i].position.x, agents[i].position.y);
    if (agents[i].radius > maxRadius) maxRadius = agents[i].radius;
  }
  return maxRadius;
}

function resolveWallCollisions(
  world: SfmWorld,
  agent: SfmAgent,
  previousX: number,
  previousY: number
): void {
  forEachWallNear(world, agent.position.x, agent.position.y, (wall) => {
    const wx = wall.b.x - wall.a.x;
    const wy = wall.b.y - wall.a.y;
    const lengthSq = wx * wx + wy * wy;
    if (lengthSq < 1e-12) return;

    const crossPrevious = wx * (previousY - wall.a.y) - wy * (previousX - wall.a.x);
    const crossCurrent = wx * (agent.position.y - wall.a.y) - wy * (agent.position.x - wall.a.x);
    const t = ((agent.position.x - wall.a.x) * wx + (agent.position.y - wall.a.y) * wy) / lengthSq;
    // Span tolerance must be absolute, not fractional: a ±5%-of-length
    // overhang on a 200 m alley wall extends a phantom wall ~10 m across
    // the junction at its end, sealing the intersection shut.
    const spanTolerance = 0.05 / Math.sqrt(lengthSq);
    const withinSpan = t >= -spanTolerance && t <= 1 + spanTolerance;

    const crossed = withinSpan && crossPrevious * crossCurrent < 0;
    const closest = closestPointOnSegment(agent.position, wall.a, wall.b);
    const dx = agent.position.x - closest.x;
    const dy = agent.position.y - closest.y;
    const dist = Math.hypot(dx, dy);

    if (!crossed && dist >= agent.radius) return;

    let nx: number;
    let ny: number;
    if (crossed) {
      const previousClosest = closestPointOnSegment({ x: previousX, y: previousY }, wall.a, wall.b);
      const pdx = previousX - previousClosest.x;
      const pdy = previousY - previousClosest.y;
      const pdist = Math.hypot(pdx, pdy);
      if (pdist > 1e-9) {
        nx = pdx / pdist;
        ny = pdy / pdist;
      } else {
        const invLength = 1 / Math.sqrt(lengthSq);
        const sign = crossPrevious >= 0 ? 1 : -1;
        nx = -wy * invLength * sign;
        ny = wx * invLength * sign;
      }
    } else {
      if (dist < 1e-9) return;
      nx = dx / dist;
      ny = dy / dist;
    }

    agent.position.x = closest.x + nx * agent.radius;
    agent.position.y = closest.y + ny * agent.radius;

    const inwardSpeed = agent.velocity.x * nx + agent.velocity.y * ny;
    if (inwardSpeed < 0) {
      agent.velocity.x -= inwardSpeed * nx;
      agent.velocity.y -= inwardSpeed * ny;
    }
  });
}

/**
 * Advances the world by one fixed tick of `dtMs`, internally subdivided so
 * no agent moves more than MAX_STEP_DISPLACEMENT_M per force evaluation.
 * `desired` supplies each moving agent's chosen direction and speed (see
 * computeDesiredDirections in agents.ts).
 */
export function stepSocialForce(world: SfmWorld, desired: Map<string, DesiredMotion>, dtMs: number = FIXED_DT_MS): void {
  const agents = Array.from(world.agents.values());
  const n = agents.length;
  if (n === 0) return;

  const displacementPerStep = (MAX_PHYSICAL_SPEED * dtMs) / 1000;
  const substeps = Math.max(MIN_SUBSTEPS, Math.ceil(displacementPerStep / MAX_STEP_DISPLACEMENT_M));
  const dt = dtMs / 1000 / substeps;
  const maxFrictionCoefficient = 0.5 / dt;

  const ax = new Float64Array(n);
  const ay = new Float64Array(n);
  const previousX = new Float64Array(n);
  const previousY = new Float64Array(n);
  const grid = new SpatialGrid(CONTACT_GRID_CELL_M);

  for (let s = 0; s < substeps; s++) {
    ax.fill(0);
    ay.fill(0);

    const maxRadius = fillContactGrid(grid, agents);
    for (let i = 0; i < n; i++) {
      const ai = agents[i];
      grid.forEachInRadius(ai.position.x, ai.position.y, ai.radius + maxRadius, (j) => {
        if (j <= i) return;
        const aj = agents[j];
        const rij = ai.radius + aj.radius;
        let dx = ai.position.x - aj.position.x;
        let dy = ai.position.y - aj.position.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > rij * rij) return;

        let dist = Math.sqrt(distSq);
        if (dist < 1e-6) {
          const dir = separationDirection(i, j);
          dx = dir.x;
          dy = dir.y;
          dist = 1;
        }
        const nx = dx / dist;
        const ny = dy / dist;

        const overlap = rij - dist;
        const contactX = SFM_K_BODY * overlap * nx;
        const contactY = SFM_K_BODY * overlap * ny;
        const tx = -ny;
        const ty = nx;
        const relTangentialSpeed = (aj.velocity.x - ai.velocity.x) * tx + (aj.velocity.y - ai.velocity.y) * ty;
        const coefficient = Math.min(SFM_KAPPA * overlap, maxFrictionCoefficient);
        const frictionX = coefficient * relTangentialSpeed * tx;
        const frictionY = coefficient * relTangentialSpeed * ty;

        ax[i] += contactX + frictionX;
        ay[i] += contactY + frictionY;
        ax[j] -= contactX + frictionX;
        ay[j] -= contactY + frictionY;
      });

      forEachWallNear(world, ai.position.x, ai.position.y, (wall) => {
        const closest = closestPointOnSegment(ai.position, wall.a, wall.b);
        const dx = ai.position.x - closest.x;
        const dy = ai.position.y - closest.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > ai.radius * ai.radius || distSq < 1e-12) return;
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;

        const overlap = ai.radius - dist;
        const tx = -ny;
        const ty = nx;
        const relTangentialSpeed = -(ai.velocity.x * tx + ai.velocity.y * ty);
        const coefficient = Math.min(SFM_KAPPA * overlap, maxFrictionCoefficient);
        ax[i] += SFM_K_BODY * overlap * nx + coefficient * relTangentialSpeed * tx;
        ay[i] += SFM_K_BODY * overlap * ny + coefficient * relTangentialSpeed * ty;
      });
    }

    for (let i = 0; i < n; i++) {
      const agent = agents[i];
      previousX[i] = agent.position.x;
      previousY[i] = agent.position.y;
      let rx = ax[i];
      let ry = ay[i];
      const repulsionMagnitude = Math.hypot(rx, ry);
      if (repulsionMagnitude > SFM_MAX_ACCEL) {
        const scale = SFM_MAX_ACCEL / repulsionMagnitude;
        rx *= scale;
        ry *= scale;
      }

      const motion = desired.get(agent.id);
      const targetVx = motion ? motion.ex * motion.speed : 0;
      const targetVy = motion ? motion.ey * motion.speed : 0;
      const driveX = (targetVx - agent.velocity.x) / SFM_TAU;
      const driveY = (targetVy - agent.velocity.y) / SFM_TAU;

      agent.velocity.x += (driveX + rx) * dt;
      agent.velocity.y += (driveY + ry) * dt;

      const speed = Math.hypot(agent.velocity.x, agent.velocity.y);
      if (speed > MAX_PHYSICAL_SPEED) {
        const scale = MAX_PHYSICAL_SPEED / speed;
        agent.velocity.x *= scale;
        agent.velocity.y *= scale;
      }

      agent.position.x += agent.velocity.x * dt;
      agent.position.y += agent.velocity.y * dt;
    }

    for (let i = 0; i < n; i++) {
      resolveWallCollisions(world, agents[i], previousX[i], previousY[i]);
    }
  }
}
