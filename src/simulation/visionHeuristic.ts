import type { WallSegment } from "../domain/corridors";

/**
 * Vision-based steering heuristics from Moussaïd, Helbing & Theraulaz
 * (2011), "How simple rules determine pedestrian behavior and crowd
 * disasters", PNAS 108(17) - main text Eq. 1-3.
 *
 * A pedestrian looking toward goal direction α0 evaluates candidate
 * directions α across a vision field [α0-φ, α0+φ]. For each α it computes
 * f(α), the distance it could walk before colliding with a neighbor
 * (linearly extrapolated at their current velocity) or a wall, capped at a
 * horizon dmax. It then walks in the direction minimizing the anticipated
 * remaining detour
 *
 *     d(α) = sqrt(dmax² + f(α)² − 2·dmax·f(α)·cos(α0 − α))
 *
 * at a speed it could stop within: v = min(v0, f(α*)/τ). Everything here is
 * pure math over plain inputs - no world mutation - so it unit-tests in
 * isolation and the caller decides caching/staggering policy.
 */

export interface VisionNeighbor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export interface VisionParams {
  /** Half-angle of the vision field around the goal direction, radians. */
  phiRad: number;
  /** Collision horizon dmax in meters. */
  horizonM: number;
  /** Number of candidate directions sampled across the field (>= 2). */
  rayCount: number;
  /** Multiplicative cost discount in [0, 1) applied to rightward rays. */
  rightBias: number;
  /** Stopping time τ in seconds for the speed heuristic. */
  tauS: number;
}

export interface HeuristicMotion {
  ex: number;
  ey: number;
  speed: number;
  /** Distance-to-collision along the chosen direction, capped at horizon. */
  clearance: number;
}

/**
 * Distance the agent can walk in direction (ex, ey) at `speed` before its
 * disc touches the neighbor's disc, with the neighbor extrapolated at
 * constant velocity. Returns Infinity when no future collision occurs, 0
 * when the discs already overlap.
 */
export function collisionDistanceToAgent(
  px: number,
  py: number,
  ex: number,
  ey: number,
  speed: number,
  selfRadius: number,
  other: VisionNeighbor
): number {
  const R = selfRadius + other.radius;
  const dx = other.x - px;
  const dy = other.y - py;
  const c = dx * dx + dy * dy - R * R;
  // Already touching/overlapping: only directions that press further into
  // the neighbor are blocked. Walking away from (or tangentially past) a
  // body you are in contact with is free, otherwise one touch anywhere -
  // even from behind - would freeze the agent in every direction at once.
  if (c <= 0) return dx * ex + dy * ey > 0 ? 0 : Infinity;

  // Neighbor position relative to self over time: (dx, dy) + (ux, uy)·t.
  const ux = other.vx - ex * speed;
  const uy = other.vy - ey * speed;
  const a = ux * ux + uy * uy;
  if (a < 1e-12) return Infinity;
  const b = 2 * (dx * ux + dy * uy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant <= 0) return Infinity;

  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  if (t <= 0) return Infinity;
  return speed * t;
}

/**
 * Distance along ray (px, py) + s·(ex, ey) to a wall segment, minus the
 * agent radius. Infinity when the ray misses the segment. Endpoint grazing
 * within one radius is deliberately ignored - hard wall-collision
 * resolution in the physics step backstops that approximation.
 */
export function collisionDistanceToWall(
  px: number,
  py: number,
  ex: number,
  ey: number,
  selfRadius: number,
  wall: WallSegment
): number {
  const dxSeg = wall.b.x - wall.a.x;
  const dySeg = wall.b.y - wall.a.y;
  const denom = ex * dySeg - ey * dxSeg;
  if (Math.abs(denom) < 1e-12) return Infinity;

  const apx = wall.a.x - px;
  const apy = wall.a.y - py;
  const s = (apx * dySeg - apy * dxSeg) / denom;
  if (s < 0) return Infinity;
  const u = (apx * ey - apy * ex) / denom;
  if (u < 0 || u > 1) return Infinity;
  return Math.max(0, s - selfRadius);
}

/** Clearance at/below which the agent counts as boxed in and sidesteps. */
const YIELD_TRIGGER_M = 0.05;
/** Half-angle of the widened sidestep scan (shoulders turned, ~backward). */
const YIELD_FIELD_RAD = (150 * Math.PI) / 180;
/** Sidestepping is a shuffle, not a walk. */
const YIELD_SPEED_FACTOR = 0.25;

function rotate(ex: number, ey: number, theta: number): { x: number; y: number } {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return { x: ex * cos - ey * sin, y: ex * sin + ey * cos };
}

/**
 * Picks the walking direction and speed for one agent. `goalEx/goalEy` must
 * be a unit vector toward the current waypoint (α0). Neighbors should be
 * prefiltered to the horizon by the caller; walls may be the full set or a
 * prefiltered subset.
 */
export function chooseHeuristicMotion(args: {
  x: number;
  y: number;
  radius: number;
  goalEx: number;
  goalEy: number;
  desiredSpeed: number;
  neighbors: readonly VisionNeighbor[];
  walls: readonly WallSegment[];
  params: VisionParams;
  /** Set false for rushing agents: they press on instead of sidestepping. */
  allowYield?: boolean;
}): HeuristicMotion {
  const { x, y, radius, goalEx, goalEy, desiredSpeed, neighbors, walls, params, allowYield = true } = args;
  const { phiRad, horizonM, rayCount, rightBias, tauS } = params;

  // Candidate angles ordered center-outward, rightward (positive θ, see
  // rightNormal in agents.ts for the convention) before leftward, so under
  // strict `<` comparison ties resolve to "least detour, prefer right".
  const step = (2 * phiRad) / (rayCount - 1);
  const thetas: number[] = [0];
  for (let k = 1; thetas.length < rayCount; k++) {
    thetas.push(k * step);
    if (thetas.length < rayCount) thetas.push(-k * step);
  }

  let bestCost = Infinity;
  let bestEx = goalEx;
  let bestEy = goalEy;
  let bestClearance = 0;

  for (const theta of thetas) {
    const dir = rotate(goalEx, goalEy, theta);

    let f = horizonM;
    for (const neighbor of neighbors) {
      const d = collisionDistanceToAgent(x, y, dir.x, dir.y, desiredSpeed, radius, neighbor);
      if (d < f) f = d;
      if (f <= 0) break;
    }
    if (f > 0) {
      for (const wall of walls) {
        const d = collisionDistanceToWall(x, y, dir.x, dir.y, radius, wall);
        if (d < f) f = d;
        if (f <= 0) break;
      }
    }

    let cost = Math.sqrt(horizonM * horizonM + f * f - 2 * horizonM * f * Math.cos(theta));
    if (theta > 1e-12) cost *= 1 - rightBias;

    if (cost < bestCost) {
      bestCost = cost;
      bestEx = dir.x;
      bestEy = dir.y;
      bestClearance = f;
    }
  }

  // Fully boxed in (every vision-field direction is at contact): sidestep.
  // People in a packed standoff turn their shoulders and shuffle toward
  // whatever open space exists, including behind them - a stand-in for the
  // body-rotation behavior the paper models explicitly. Without this, two
  // touching agents facing each other block one another's entire vision
  // cone and freeze permanently.
  if (allowYield && bestClearance <= YIELD_TRIGGER_M) {
    let yieldF = 0;
    let yieldEx = bestEx;
    let yieldEy = bestEy;
    const yieldStep = (2 * YIELD_FIELD_RAD) / (rayCount - 1);
    for (let k = 0; k < rayCount; k++) {
      const theta = -YIELD_FIELD_RAD + k * yieldStep;
      const dir = rotate(goalEx, goalEy, theta);
      let f = horizonM;
      for (const neighbor of neighbors) {
        const d = collisionDistanceToAgent(x, y, dir.x, dir.y, desiredSpeed, radius, neighbor);
        if (d < f) f = d;
        if (f <= 0) break;
      }
      if (f > 0) {
        for (const wall of walls) {
          const d = collisionDistanceToWall(x, y, dir.x, dir.y, radius, wall);
          if (d < f) f = d;
          if (f <= 0) break;
        }
      }
      if (f > yieldF) {
        yieldF = f;
        yieldEx = dir.x;
        yieldEy = dir.y;
      }
    }
    if (yieldF > YIELD_TRIGGER_M) {
      return {
        ex: yieldEx,
        ey: yieldEy,
        speed: Math.min(desiredSpeed * YIELD_SPEED_FACTOR, yieldF / tauS),
        clearance: yieldF,
      };
    }
  }

  return {
    ex: bestEx,
    ey: bestEy,
    speed: Math.min(desiredSpeed, bestClearance / tauS),
    clearance: bestClearance,
  };
}
