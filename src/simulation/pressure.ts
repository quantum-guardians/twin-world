import type { AgentRuntimeState } from "./agents";
import type { Point } from "../domain/corridors";
import {
  PRESSURE_DEATH_SECONDS,
  PRESSURE_DEATH_THRESHOLD,
  PRESSURE_OVERLAP_FULL_M,
  PRESSURE_RECOVERY_RATE,
} from "../domain/simPresets";
import { forEachWallNear, type SfmWorld } from "./socialForce";
import { SpatialGrid } from "./spatialGrid";

/**
 * Crowd-pressure exposure model, ported from simulation_react's
 * src/simulation/pressure.ts. Framed in the plan as a relative risk
 * indicator ("고압력 위험 노출"), not a real injury/fatality predictor -
 * see .plan/general/2026-08-02-twin-world-mvp-planning.md's technical
 * constraints.
 */

const PHYSICS_TICKS_PER_SECOND = 60;
export const PRESSURE_DEATH_TICKS = PRESSURE_DEATH_SECONDS * PHYSICS_TICKS_PER_SECOND;

function closestPointOnSegment(point: Point, a: Point, b: Point): Point {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared < 1e-12) return a;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSquared));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

/** Compression contributed by one contact, from how deeply the bodies
 * interpenetrate (gap < 0). Touching without deformation (gap = 0) is a
 * calm packed crowd and contributes nothing. */
function compressionFromGap(gap: number): number {
  return Math.max(0, Math.min(2, -gap / PRESSURE_OVERLAP_FULL_M));
}

/** Estimates local compressive pressure from simultaneous squeezed
 * contacts with pedestrians and walls. A packed-but-calm queue stays at
 * zero; a body being visibly compressed from several sides does not. */
export function computeAgentPressures(world: SfmWorld): Map<string, number> {
  const bodies = Array.from(world.agents.values());
  const pressures = new Map(bodies.map((body) => [body.id, 0]));

  // Compression only exists at body overlap, so a contact-scale grid query
  // replaces the previous all-pairs sweep.
  const grid = new SpatialGrid(0.5);
  let maxRadius = 0;
  for (let i = 0; i < bodies.length; i++) {
    grid.insert(i, bodies[i].position.x, bodies[i].position.y);
    if (bodies[i].radius > maxRadius) maxRadius = bodies[i].radius;
  }

  for (let i = 0; i < bodies.length; i++) {
    const first = bodies[i];
    grid.forEachInRadius(first.position.x, first.position.y, first.radius + maxRadius, (j) => {
      if (j <= i) return;
      const second = bodies[j];
      const distance = Math.hypot(first.position.x - second.position.x, first.position.y - second.position.y);
      const compression = compressionFromGap(distance - first.radius - second.radius);
      if (compression === 0) return;
      pressures.set(first.id, (pressures.get(first.id) ?? 0) + compression);
      pressures.set(second.id, (pressures.get(second.id) ?? 0) + compression);
    });
  }

  for (const body of bodies) {
    let maximumWallCompression = 0;
    forEachWallNear(world, body.position.x, body.position.y, (wall) => {
      const closest = closestPointOnSegment(body.position, wall.a, wall.b);
      const distance = Math.hypot(body.position.x - closest.x, body.position.y - closest.y);
      maximumWallCompression = Math.max(maximumWallCompression, compressionFromGap(distance - body.radius));
    });
    // Several corridor wall segments can meet at one junction and describe
    // the same physical boundary; only the strongest wall contact counts.
    pressures.set(body.id, (pressures.get(body.id) ?? 0) + maximumWallCompression);
  }

  return pressures;
}

export interface PressureUpdateResult {
  pressures: Map<string, number>;
  newlyDeadIds: string[];
}

/** Accumulates sustained high-pressure exposure and marks deaths. Exposure
 * decays quickly below the threshold, so separate brief bumps do not add up
 * to a death much later. */
export function updatePressureDeaths(agents: AgentRuntimeState[], world: SfmWorld): PressureUpdateResult {
  const pressures = computeAgentPressures(world);
  const newlyDeadIds: string[] = [];

  for (const agent of agents) {
    agent.pressure = pressures.get(agent.id) ?? 0;
    if (agent.state === "dead") continue;

    agent.highPressureTicks =
      agent.pressure >= PRESSURE_DEATH_THRESHOLD
        ? (agent.highPressureTicks ?? 0) + 1
        : Math.max(0, (agent.highPressureTicks ?? 0) - PRESSURE_RECOVERY_RATE);

    if (agent.highPressureTicks < PRESSURE_DEATH_TICKS) continue;
    agent.state = "dead";
    newlyDeadIds.push(agent.id);
    const body = world.agents.get(agent.id);
    if (body) {
      body.velocity.x = 0;
      body.velocity.y = 0;
    }
  }

  return { pressures, newlyDeadIds };
}
