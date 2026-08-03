import type { Point } from "../domain/corridors";
import { buildWallSegments, type Corridor, type WallSegment } from "../domain/corridors";
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

// Max distance any agent may travel within a single substep. The exponential
// repulsion varies on the SFM_B (~0.2 m) scale, so per-substep displacement
// must stay well below it or a fast agent can overshoot past a wall's force
// peak before ever feeling it.
const MAX_STEP_DISPLACEMENT_M = 0.15;

const MIN_SUBSTEPS = 2;

export function createSfmWorld(): SfmWorld {
  return { walls: [], agents: new Map() };
}

/** Replaces the wall set from the current corridor floor plan. Cheap (plain
 * arrays), safe to call on every floor-plan edit. */
export function rebuildWalls(world: SfmWorld, corridors: Corridor[]): void {
  world.walls = buildWallSegments(corridors);
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

const MAX_OVERLAP_CORRECTION_M = 0.125;

function resolveAgentOverlaps(agents: SfmAgent[]): void {
  const n = agents.length;
  const pushX = new Float64Array(n);
  const pushY = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const ai = agents[i];
    for (let j = i + 1; j < n; j++) {
      const aj = agents[j];
      const rij = ai.radius + aj.radius;
      let dx = ai.position.x - aj.position.x;
      let dy = ai.position.y - aj.position.y;
      if (dx > rij || dx < -rij || dy > rij || dy < -rij) continue;
      let dist = Math.hypot(dx, dy);
      if (dist >= rij) continue;
      if (dist < 1e-6) {
        const dir = separationDirection(i, j);
        dx = dir.x;
        dy = dir.y;
        dist = 1;
      }
      const push = (rij - dist) / 2;
      const nx = dx / dist;
      const ny = dy / dist;
      pushX[i] += nx * push;
      pushY[i] += ny * push;
      pushX[j] -= nx * push;
      pushY[j] -= ny * push;
    }
  }

  for (let i = 0; i < n; i++) {
    let cx = pushX[i];
    let cy = pushY[i];
    if (cx === 0 && cy === 0) continue;
    const magnitude = Math.hypot(cx, cy);
    if (magnitude > MAX_OVERLAP_CORRECTION_M) {
      const scale = MAX_OVERLAP_CORRECTION_M / magnitude;
      cx *= scale;
      cy *= scale;
    }
    agents[i].position.x += cx;
    agents[i].position.y += cy;
  }
}

function resolveWallCollisions(
  agent: SfmAgent,
  walls: WallSegment[],
  previousX: number,
  previousY: number
): void {
  for (const wall of walls) {
    const wx = wall.b.x - wall.a.x;
    const wy = wall.b.y - wall.a.y;
    const lengthSq = wx * wx + wy * wy;
    if (lengthSq < 1e-12) continue;

    const crossPrevious = wx * (previousY - wall.a.y) - wy * (previousX - wall.a.x);
    const crossCurrent = wx * (agent.position.y - wall.a.y) - wy * (agent.position.x - wall.a.x);
    const t = ((agent.position.x - wall.a.x) * wx + (agent.position.y - wall.a.y) * wy) / lengthSq;
    const withinSpan = t >= -0.05 && t <= 1.05;

    const crossed = withinSpan && crossPrevious * crossCurrent < 0;
    const closest = closestPointOnSegment(agent.position, wall.a, wall.b);
    const dx = agent.position.x - closest.x;
    const dy = agent.position.y - closest.y;
    const dist = Math.hypot(dx, dy);

    if (!crossed && dist >= agent.radius) continue;

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
      if (dist < 1e-9) continue;
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
  }
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

  for (let s = 0; s < substeps; s++) {
    ax.fill(0);
    ay.fill(0);

    for (let i = 0; i < n; i++) {
      const ai = agents[i];
      for (let j = i + 1; j < n; j++) {
        const aj = agents[j];
        const rij = ai.radius + aj.radius;
        let dx = ai.position.x - aj.position.x;
        let dy = ai.position.y - aj.position.y;
        if (dx > rij || dx < -rij || dy > rij || dy < -rij) continue;
        const distSq = dx * dx + dy * dy;
        if (distSq > rij * rij) continue;

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
      }

      for (const wall of world.walls) {
        const closest = closestPointOnSegment(ai.position, wall.a, wall.b);
        const dx = ai.position.x - closest.x;
        const dy = ai.position.y - closest.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > ai.radius * ai.radius || distSq < 1e-12) continue;
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
      }
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

    resolveAgentOverlaps(agents);
    for (let i = 0; i < n; i++) {
      resolveWallCollisions(agents[i], world.walls, previousX[i], previousY[i]);
    }
  }
}
