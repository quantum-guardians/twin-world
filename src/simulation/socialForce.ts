import type { Point } from "../domain/corridors";
import { buildWallSegments, type Corridor, type WallSegment } from "../domain/corridors";
import {
  AGENT_MAX_SPEED,
  AGENT_RADIUS,
  SFM_A_AGENT,
  SFM_A_WALL,
  SFM_ANISOTROPY_LAMBDA,
  SFM_B_AGENT,
  SFM_B_WALL,
  SFM_CUTOFF_FACTOR,
  SFM_K_BODY,
  SFM_KAPPA,
  SFM_MAX_ACCEL,
  SFM_SPEED_FACTOR,
  SFM_TAU,
} from "../domain/simPresets";

/**
 * Social Force Model (Helbing & Molnár) crowd dynamics, ported from
 * simulation_react's src/simulation/socialForce.ts (see
 * docs/agent-movement.md) with constants rescaled from pixels to meters
 * (domain/simPresets.ts). Logic is otherwise unchanged - it's already a
 * self-contained, well-tested implementation independent of rendering.
 *
 * Each agent experiences: a driving force relaxing velocity toward its
 * desired speed/direction over SFM_TAU seconds; exponential social
 * repulsion from nearby agents (anisotropic - full strength ahead, reduced
 * behind); a body-contact spring + sliding friction once bodies actually
 * overlap; and the same repulsion/contact terms from the nearest point of
 * each wall segment. Integration is semi-implicit Euler with substepping
 * and a velocity cap for stability at 60 Hz.
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
  /** Route-priority floor applied after all Social Force acceleration. */
  minForwardSpeed?: number;
  /** Multiplier for long-range agent repulsion. Contact forces are never
   * scaled, so values below 1 help break a jam without allowing overlap. */
  socialScale?: number;
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

function effectiveInteractionRadius(agent: SfmAgent, desired: Map<string, DesiredMotion>): number {
  const socialScale = desired.get(agent.id)?.socialScale ?? 1;
  return agent.radius * socialScale;
}

function resolveAgentOverlaps(agents: SfmAgent[], desired: Map<string, DesiredMotion>): void {
  const n = agents.length;
  const pushX = new Float64Array(n);
  const pushY = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const ai = agents[i];
    for (let j = i + 1; j < n; j++) {
      const aj = agents[j];
      const rij = effectiveInteractionRadius(ai, desired) + effectiveInteractionRadius(aj, desired);
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
 * `desired` supplies each moving agent's waypoint direction and speed (see
 * computeDesiredDirections in agents.ts).
 */
export function stepSocialForce(
  world: SfmWorld,
  desired: Map<string, DesiredMotion>,
  dtMs: number = FIXED_DT_MS,
  maxSpeed: number = AGENT_MAX_SPEED
): void {
  const agents = Array.from(world.agents.values());
  const n = agents.length;
  if (n === 0) return;

  const displacementPerStep = (maxSpeed * dtMs) / 1000;
  const substeps = Math.max(MIN_SUBSTEPS, Math.ceil(displacementPerStep / MAX_STEP_DISPLACEMENT_M));
  const dt = dtMs / 1000 / substeps;
  const maxFrictionCoefficient = 0.5 / dt;

  const agentCutoff = SFM_CUTOFF_FACTOR * SFM_B_AGENT;
  const wallCutoff = SFM_CUTOFF_FACTOR * SFM_B_WALL;

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
        const rij = effectiveInteractionRadius(ai, desired) + effectiveInteractionRadius(aj, desired);
        const cutoff = rij + agentCutoff;
        let dx = ai.position.x - aj.position.x;
        let dy = ai.position.y - aj.position.y;
        if (dx > cutoff || dx < -cutoff || dy > cutoff || dy < -cutoff) continue;
        const distSq = dx * dx + dy * dy;
        if (distSq > cutoff * cutoff) continue;

        let dist = Math.sqrt(distSq);
        if (dist < 1e-6) {
          const dir = separationDirection(i, j);
          dx = dir.x;
          dy = dir.y;
          dist = 1;
        }
        const nx = dx / dist;
        const ny = dy / dist;

        const social = SFM_A_AGENT * Math.exp((rij - dist) / SFM_B_AGENT);
        const di = desired.get(ai.id);
        const dj = desired.get(aj.id);
        const wi = di
          ? SFM_ANISOTROPY_LAMBDA + ((1 - SFM_ANISOTROPY_LAMBDA) * (1 - (di.ex * nx + di.ey * ny))) / 2
          : 1;
        const wj = dj
          ? SFM_ANISOTROPY_LAMBDA + ((1 - SFM_ANISOTROPY_LAMBDA) * (1 + (dj.ex * nx + dj.ey * ny))) / 2
          : 1;

        const socialScaleI = di?.socialScale ?? 1;
        const socialScaleJ = dj?.socialScale ?? 1;
        let fxi = social * wi * socialScaleI * nx;
        let fyi = social * wi * socialScaleI * ny;
        let fxj = -social * wj * socialScaleJ * nx;
        let fyj = -social * wj * socialScaleJ * ny;

        const overlap = rij - dist;
        if (overlap > 0) {
          const contactX = SFM_K_BODY * overlap * nx;
          const contactY = SFM_K_BODY * overlap * ny;
          fxi += contactX;
          fyi += contactY;
          fxj -= contactX;
          fyj -= contactY;
          const tx = -ny;
          const ty = nx;
          const relTangentialSpeed = (aj.velocity.x - ai.velocity.x) * tx + (aj.velocity.y - ai.velocity.y) * ty;
          const coefficient = Math.min(SFM_KAPPA * overlap, maxFrictionCoefficient);
          const frictionX = coefficient * relTangentialSpeed * tx;
          const frictionY = coefficient * relTangentialSpeed * ty;
          fxi += frictionX;
          fyi += frictionY;
          fxj -= frictionX;
          fyj -= frictionY;
        }

        ax[i] += fxi;
        ay[i] += fyi;
        ax[j] += fxj;
        ay[j] += fyj;
      }

      for (const wall of world.walls) {
        const closest = closestPointOnSegment(ai.position, wall.a, wall.b);
        const dx = ai.position.x - closest.x;
        const dy = ai.position.y - closest.y;
        const cutoff = ai.radius + wallCutoff;
        const distSq = dx * dx + dy * dy;
        if (distSq > cutoff * cutoff || distSq < 1e-12) continue;
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const ny = dy / dist;

        let f = SFM_A_WALL * Math.exp((ai.radius - dist) / SFM_B_WALL);
        const overlap = ai.radius - dist;
        if (overlap > 0) {
          f += SFM_K_BODY * overlap;
          const tx = -ny;
          const ty = nx;
          const relTangentialSpeed = -(ai.velocity.x * tx + ai.velocity.y * ty);
          const coefficient = Math.min(SFM_KAPPA * overlap, maxFrictionCoefficient);
          ax[i] += coefficient * relTangentialSpeed * tx;
          ay[i] += coefficient * relTangentialSpeed * ty;
        }
        ax[i] += f * nx;
        ay[i] += f * ny;
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

      const speedCap = SFM_SPEED_FACTOR * (motion ? motion.speed : maxSpeed);
      const speed = Math.hypot(agent.velocity.x, agent.velocity.y);
      if (speed > speedCap && speed > 0) {
        const scale = speedCap / speed;
        agent.velocity.x *= scale;
        agent.velocity.y *= scale;
      }

      if (motion?.minForwardSpeed !== undefined) {
        const forwardSpeed = agent.velocity.x * motion.ex + agent.velocity.y * motion.ey;
        if (forwardSpeed < motion.minForwardSpeed) {
          const correction = motion.minForwardSpeed - forwardSpeed;
          agent.velocity.x += correction * motion.ex;
          agent.velocity.y += correction * motion.ey;
        }
      }

      agent.position.x += agent.velocity.x * dt;
      agent.position.y += agent.velocity.y * dt;
    }

    resolveAgentOverlaps(agents, desired);
    for (let i = 0; i < n; i++) {
      resolveWallCollisions(agents[i], world.walls, previousX[i], previousY[i]);
    }

    for (let i = 0; i < n; i++) {
      const motion = desired.get(agents[i].id);
      if (motion?.minForwardSpeed === undefined) continue;
      const forwardDisplacement =
        (agents[i].position.x - previousX[i]) * motion.ex + (agents[i].position.y - previousY[i]) * motion.ey;
      const minimumDisplacement = motion.minForwardSpeed * dt;
      if (forwardDisplacement < minimumDisplacement) {
        const correction = minimumDisplacement - forwardDisplacement;
        agents[i].position.x += correction * motion.ex;
        agents[i].position.y += correction * motion.ey;
      }
    }
  }
}
