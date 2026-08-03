import type { Point } from "../domain/corridors";
import { isPointInWalkableArea, type Corridor, type JunctionHub } from "../domain/corridors";
import { addAgent, removeAgent, type DesiredMotion, type SfmWorld } from "./socialForce";
import { chooseHeuristicMotion, type VisionNeighbor, type VisionParams } from "./visionHeuristic";
import { SpatialGrid } from "./spatialGrid";
import type { NodeKind, Venue, VenueNode } from "../domain/types";
import { edgeLength } from "../domain/venueGraph";
import {
  AGENT_CHILD_FRACTION,
  AGENT_MAX_SPEED,
  AGENT_RADIUS,
  AGENT_RENDER_HEIGHT_ADULT_MAX,
  AGENT_RENDER_HEIGHT_ADULT_MIN,
  AGENT_RENDER_HEIGHT_CHILD_MAX,
  AGENT_RENDER_HEIGHT_CHILD_MIN,
  AGENT_SPEED_VARIANCE_MAX,
  AGENT_SPEED_VARIANCE_MIN,
  ARRIVAL_RADIUS,
  SFM_TAU,
  VISION_DECISION_INTERVAL_TICKS,
  VISION_HORIZON_M,
  VISION_NEIGHBOR_MAX,
  VISION_PHI_RAD,
  VISION_RAY_COUNT,
  VISION_RIGHT_BIAS,
} from "../domain/simPresets";

export type AgentAgeGroup = "child" | "adult";

/**
 * Route-finding (Dijkstra over the venue graph) and per-tick steering.
 * Steering follows the Moussaïd et al. (2011) vision heuristics
 * (visionHeuristic.ts): toward the current waypoint, deviated by whatever
 * the agent can see of neighbors and walls, at a speed it can stop within.
 * There is no forced forward progress, no stuck-boost, and no lane
 * clamping - congestion, arching, and lane formation are left to emerge
 * (or fail to) from the model, because measuring exactly that is the
 * point of a crowd-crush simulation. continueArrivedAgents (re-touring)
 * is intentionally absent: a finite population per run keeps baseline vs.
 * MR2S-optimized comparisons on identical arrival conditions.
 */

function rightNormal(from: Point, to: Point): Point {
  const sx = to.x - from.x;
  const sy = to.y - from.y;
  const length = Math.hypot(sx, sy);
  if (length <= 1e-9) return { x: 0, y: 0 };
  return { x: -sy / length, y: sx / length };
}

export interface AdjacencyEntry {
  to: string;
  weight: number;
}

/** Builds directed pathfinding adjacency from a venue's edges: a
 * "forward"/"reverse" edge becomes one-way, "bidirectional" becomes both
 * directions. Weight is the edge's physical length in meters. */
export function buildAdjacency(venue: Venue): Map<string, AdjacencyEntry[]> {
  const adjacency = new Map<string, AdjacencyEntry[]>();
  for (const node of venue.nodes) adjacency.set(node.id, []);
  for (const edge of venue.edges) {
    const weight = Math.max(edgeLength(venue, edge), 1e-6);
    if (edge.direction !== "reverse") {
      adjacency.get(edge.fromNodeId)?.push({ to: edge.toNodeId, weight });
    }
    if (edge.direction !== "forward") {
      adjacency.get(edge.toNodeId)?.push({ to: edge.fromNodeId, weight });
    }
  }
  return adjacency;
}

/** Plain-array Dijkstra - fine at the node counts this app targets (tens to
 * low hundreds); returns null if startId/endId are disconnected. */
export function shortestPath(
  adjacency: Map<string, AdjacencyEntry[]>,
  startId: string,
  endId: string
): string[] | null {
  if (!adjacency.has(startId) || !adjacency.has(endId)) return null;

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  for (const id of adjacency.keys()) dist.set(id, Infinity);
  dist.set(startId, 0);

  for (;;) {
    let currentId: string | null = null;
    let currentDist = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < currentDist) {
        currentDist = d;
        currentId = id;
      }
    }
    if (currentId === null || currentId === endId) break;
    visited.add(currentId);

    for (const { to, weight } of adjacency.get(currentId) ?? []) {
      if (visited.has(to)) continue;
      const alt = currentDist + weight;
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt);
        prev.set(to, currentId);
      }
    }
  }

  if ((dist.get(endId) ?? Infinity) === Infinity) return null;

  const path: string[] = [];
  let cur: string | undefined = endId;
  while (cur !== undefined) {
    path.unshift(cur);
    if (cur === startId) break;
    cur = prev.get(cur);
  }
  return path[0] === startId ? path : null;
}

function nodesOfKinds(venue: Venue, kinds: NodeKind[]): VenueNode[] {
  return venue.nodes.filter((n) => kinds.includes(n.kind));
}

/** Picks a spawn node (prefers "entrance") and a destination node (prefers
 * "destination"/"exit"), falling back to any node when a venue has none of
 * the preferred kind - e.g. a freshly started blank graph. */
export function pickSpawnTargetPair(
  venue: Venue,
  rng: () => number = Math.random
): [string, string] | null {
  const entrances = nodesOfKinds(venue, ["entrance"]);
  const targets = nodesOfKinds(venue, ["destination", "exit"]);
  const startPool = entrances.length > 0 ? entrances : venue.nodes;
  const targetPool = targets.length > 0 ? targets : venue.nodes;
  if (startPool.length === 0 || targetPool.length === 0) return null;

  const start = startPool[Math.floor(rng() * startPool.length)];
  let target = targetPool[Math.floor(rng() * targetPool.length)];
  let guard = 0;
  while (target.id === start.id && guard < 50) {
    target = targetPool[Math.floor(rng() * targetPool.length)];
    guard++;
  }
  return target.id === start.id ? null : [start.id, target.id];
}

export interface AgentRuntimeState {
  id: string;
  waypoints: Point[];
  waypointIndex: number;
  startNodeId: string;
  targetNodeId: string;
  state: "moving" | "arrived" | "dead";
  /** Multiplier on the base max speed, fixed for this agent's lifetime. */
  speedFactor?: number;
  /** Ticks the cached vision decision below remains valid. Decisions are
   * re-planned every VISION_DECISION_INTERVAL_TICKS (~human steering
   * reaction time), staggered across agents to spread the cost. */
  visionCooldownTicks?: number;
  /** Waypoint index cachedMotion was computed for; a waypoint advance
   * invalidates the cache immediately. */
  cachedMotionWaypointIndex?: number;
  cachedMotion?: DesiredMotion;
  /** Current normalized crowd-compression estimate. */
  pressure?: number;
  /** Consecutive-equivalent physics ticks spent above fatal pressure. */
  highPressureTicks?: number;
  /** Simulation elapsedSeconds at the moment this agent first reached
   * "arrived", set by VenueSimulation.tick (not here - computeDesiredDirections
   * has no notion of wall-clock sim time). Used for the 95%-arrival metric. */
  arrivedAtSeconds?: number;
  /** Visual-only demographic, fixed at spawn. Never affects speed, physics
   * radius, or pathing - see domain/simPresets.ts's render-sizing section. */
  ageGroup: AgentAgeGroup;
  /** Rendered (exaggerated) capsule height in meters for this agent. */
  renderHeightM: number;
}

export interface SpawnAgentDeps {
  world: SfmWorld;
  venue: Venue;
  adjacency: Map<string, AdjacencyEntry[]>;
  rng?: () => number;
  lastValidPositions?: Map<string, Point>;
}

const MAX_SPAWN_PAIR_ATTEMPTS = 30;
const SPAWN_FORWARD_SPREAD_M = 0.5;
const SPAWN_LATERAL_MARGIN_M = 0.3;
/** Minimum free space around a spawn point: a body may not materialize
 * overlapping (or nearly overlapping) an existing one. */
const SPAWN_CLEARANCE_M = AGENT_RADIUS * 2 + 0.05;

function isSpawnPositionFree(world: SfmWorld, position: Point): boolean {
  const clearanceSq = SPAWN_CLEARANCE_M * SPAWN_CLEARANCE_M;
  for (const body of world.agents.values()) {
    const dx = body.position.x - position.x;
    const dy = body.position.y - position.y;
    if (dx * dx + dy * dy < clearanceSq) return false;
  }
  return true;
}

/**
 * Spawns one agent at a free spot near an entrance node, or returns null
 * when no route exists or every candidate spot is currently occupied.
 * Callers should treat a null under congestion as "the entrance is full,
 * try again later" - people queue outside a full venue; they do not
 * materialize on top of the crowd inside.
 */
export function spawnAgent(id: string, deps: SpawnAgentDeps): AgentRuntimeState | null {
  const { world, venue, adjacency, rng = Math.random } = deps;
  const nodePositions = new Map(venue.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));

  let startPos: Point | null = null;
  let start: string | undefined;
  let target: string | undefined;
  let path: string[] | null = null;
  for (let attempt = 0; attempt < MAX_SPAWN_PAIR_ATTEMPTS && startPos === null; attempt++) {
    const pair = pickSpawnTargetPair(venue, rng);
    if (!pair) return null;
    const candidatePath = shortestPath(adjacency, pair[0], pair[1]);
    if (!candidatePath) continue;

    const first = nodePositions.get(candidatePath[0]);
    const second = candidatePath[1] !== undefined ? nodePositions.get(candidatePath[1]) : undefined;
    if (!first) continue;

    const normal = second ? rightNormal(first, second) : { x: 0, y: 0 };
    const segmentLength = second ? Math.hypot(second.x - first.x, second.y - first.y) : 0;
    const forward = second
      ? {
          x: (second.x - first.x) / Math.max(segmentLength, 1e-9),
          y: (second.y - first.y) / Math.max(segmentLength, 1e-9),
        }
      : { x: 0, y: 0 };
    // Spread arrivals across the full usable entrance width, like a real
    // street mouth, rather than dropping everyone on the centerline.
    const edge = venue.edges.find(
      (e) =>
        (e.fromNodeId === candidatePath[0] && e.toNodeId === candidatePath[1]) ||
        (e.toNodeId === candidatePath[0] && e.fromNodeId === candidatePath[1])
    );
    const lateralRange = Math.max(0.05, (edge?.width ?? 0) / 2 - AGENT_RADIUS - SPAWN_LATERAL_MARGIN_M);

    const forwardDistance = rng() * Math.min(SPAWN_FORWARD_SPREAD_M, segmentLength * 0.2);
    const lateralDistance = (rng() * 2 - 1) * lateralRange;
    const candidate: Point = {
      x: first.x + forward.x * forwardDistance + normal.x * lateralDistance,
      y: first.y + forward.y * forwardDistance + normal.y * lateralDistance,
    };
    if (!isSpawnPositionFree(world, candidate)) continue;

    startPos = candidate;
    path = candidatePath;
    [start, target] = pair;
  }
  if (!startPos || !path || !start || !target) return null;

  const waypoints = path.map((nodeId) => nodePositions.get(nodeId)).filter((p): p is Point => p !== undefined);
  if (waypoints.length === 0) return null;

  addAgent(world, id, startPos.x, startPos.y);
  deps.lastValidPositions?.set(id, { x: startPos.x, y: startPos.y });

  const speedFactor = AGENT_SPEED_VARIANCE_MIN + rng() * (AGENT_SPEED_VARIANCE_MAX - AGENT_SPEED_VARIANCE_MIN);

  const ageGroup: AgentAgeGroup = rng() < AGENT_CHILD_FRACTION ? "child" : "adult";
  const renderHeightM =
    ageGroup === "child"
      ? AGENT_RENDER_HEIGHT_CHILD_MIN + rng() * (AGENT_RENDER_HEIGHT_CHILD_MAX - AGENT_RENDER_HEIGHT_CHILD_MIN)
      : AGENT_RENDER_HEIGHT_ADULT_MIN + rng() * (AGENT_RENDER_HEIGHT_ADULT_MAX - AGENT_RENDER_HEIGHT_ADULT_MIN);

  return {
    id,
    waypoints,
    waypointIndex: Math.min(1, waypoints.length - 1),
    startNodeId: start,
    targetNodeId: target,
    state: waypoints.length > 1 ? "moving" : "arrived",
    speedFactor,
    ageGroup,
    renderHeightM,
  };
}

/** First-pass neighbor scan radius; covers the K nearest in dense crowds. */
const VISION_NEAR_SCAN_M = 2.5;

const VISION_PARAMS: VisionParams = {
  phiRad: VISION_PHI_RAD,
  horizonM: VISION_HORIZON_M,
  rayCount: VISION_RAY_COUNT,
  rightBias: VISION_RIGHT_BIAS,
  tauS: SFM_TAU,
};

/** Squared distance from a point to a wall segment - used to skip walls
 * entirely outside an agent's vision horizon before ray casting. */
function segmentDistanceSq(px: number, py: number, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lengthSq = abx * abx + aby * aby;
  let t = lengthSq < 1e-12 ? 0 : ((px - a.x) * abx + (py - a.y) * aby) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (a.x + abx * t);
  const dy = py - (a.y + aby * t);
  return dx * dx + dy * dy;
}

/**
 * Computes each moving agent's chosen direction + speed via the Moussaïd
 * vision heuristics, advancing waypoints and arrival state as a side
 * effect. Call once per fixed physics tick, in the same accumulator loop
 * as stepSocialForce - checking arrival only at render cadence lets a
 * slow frame overshoot several ticks past a waypoint, which reads as the
 * agent doubling back. Vision decisions are cached for
 * VISION_DECISION_INTERVAL_TICKS and staggered by agent order, so only a
 * fraction of the crowd re-plans on any given tick.
 */
export function computeDesiredDirections(
  agents: AgentRuntimeState[],
  world: SfmWorld,
  maxSpeed: number = AGENT_MAX_SPEED,
  arrivalRadius: number = ARRIVAL_RADIUS
): Map<string, DesiredMotion> {
  const desired = new Map<string, DesiredMotion>();

  const bodies: (VisionNeighbor & { id: string })[] = [];
  for (const [id, body] of world.agents) {
    bodies.push({
      id,
      x: body.position.x,
      y: body.position.y,
      vx: body.velocity.x,
      vy: body.velocity.y,
      radius: body.radius,
    });
  }
  // Vision queries reach 8 m; a coarse grid keeps each re-planning agent's
  // neighbor scan local instead of touching the whole crowd.
  const grid = new SpatialGrid(VISION_HORIZON_M / 2);
  for (let i = 0; i < bodies.length; i++) grid.insert(i, bodies[i].x, bodies[i].y);

  for (let index = 0; index < agents.length; index++) {
    const agent = agents[index];
    if (agent.state !== "moving") continue;
    const sfmAgent = world.agents.get(agent.id);
    if (!sfmAgent) continue;

    const waypoint = agent.waypoints[agent.waypointIndex];
    if (!waypoint) {
      agent.state = "arrived";
      removeAgent(world, agent.id);
      continue;
    }

    const px = sfmAgent.position.x;
    const py = sfmAgent.position.y;
    const previousWaypoint = agent.waypoints[agent.waypointIndex - 1];
    let dx = waypoint.x - px;
    let dy = waypoint.y - py;
    let dist = Math.hypot(dx, dy);

    const passedWaypoint =
      previousWaypoint !== undefined &&
      (px - waypoint.x) * (waypoint.x - previousWaypoint.x) + (py - waypoint.y) * (waypoint.y - previousWaypoint.y) >= 0;

    if (dist < arrivalRadius || passedWaypoint) {
      if (agent.waypointIndex >= agent.waypoints.length - 1) {
        // Reached the destination/exit: the body leaves the venue floor so
        // it stops blocking (and pressing on) the crowd still flowing in.
        agent.state = "arrived";
        removeAgent(world, agent.id);
        continue;
      }
      agent.waypointIndex += 1;
      const next = agent.waypoints[agent.waypointIndex];
      dx = next.x - px;
      dy = next.y - py;
      dist = Math.hypot(dx, dy);
      if (dist <= 1e-9) continue;
    }

    const reusable =
      agent.cachedMotion !== undefined &&
      agent.cachedMotionWaypointIndex === agent.waypointIndex &&
      (agent.visionCooldownTicks ?? 0) > 0;
    if (reusable) {
      agent.visionCooldownTicks! -= 1;
      desired.set(agent.id, agent.cachedMotion!);
      continue;
    }

    const goalEx = dx / dist;
    const goalEy = dy / dist;
    const baseSpeed = maxSpeed * (agent.speedFactor ?? 1);

    // Bounded nearest-K selection with an adaptive radius: in a dense pack
    // the K nearest bodies all sit within a couple of meters, and letting
    // every decision scan the full 8 m horizon - hundreds of bodies -
    // dominated the tick at crowd sizes in the thousands. Only fall back
    // to the full horizon when the close scan comes up short.
    const nearest: { neighbor: VisionNeighbor; distSq: number }[] = [];
    const collect = (bodyIndex: number) => {
      const body = bodies[bodyIndex];
      if (body.id === agent.id) return;
      const bx = body.x - px;
      const by = body.y - py;
      const distSq = bx * bx + by * by;
      if (nearest.length === VISION_NEIGHBOR_MAX && distSq >= nearest[nearest.length - 1].distSq) return;
      let insertAt = nearest.length;
      while (insertAt > 0 && nearest[insertAt - 1].distSq > distSq) insertAt--;
      nearest.splice(insertAt, 0, { neighbor: body, distSq });
      if (nearest.length > VISION_NEIGHBOR_MAX) nearest.pop();
    };
    grid.forEachInRadius(px, py, VISION_NEAR_SCAN_M, collect);
    if (nearest.length < VISION_NEIGHBOR_MAX) {
      nearest.length = 0;
      grid.forEachInRadius(px, py, VISION_HORIZON_M, collect);
    }
    const neighbors = nearest.map((entry) => entry.neighbor);

    const walls = world.walls.filter(
      (wall) => segmentDistanceSq(px, py, wall.a, wall.b) < VISION_HORIZON_M * VISION_HORIZON_M
    );

    const motion = chooseHeuristicMotion({
      x: px,
      y: py,
      radius: sfmAgent.radius,
      goalEx,
      goalEy,
      desiredSpeed: baseSpeed,
      neighbors,
      walls,
      params: VISION_PARAMS,
    });

    const chosen: DesiredMotion = { ex: motion.ex, ey: motion.ey, speed: motion.speed };
    // First-ever decision gets a cooldown from the agent's position in the
    // roster so re-planning spreads evenly across ticks instead of every
    // agent recomputing on the same frame.
    agent.visionCooldownTicks =
      agent.cachedMotion === undefined ? index % VISION_DECISION_INTERVAL_TICKS : VISION_DECISION_INTERVAL_TICKS - 1;
    agent.cachedMotion = chosen;
    agent.cachedMotionWaypointIndex = agent.waypointIndex;
    desired.set(agent.id, chosen);
  }

  return desired;
}

const CONTAINMENT_TOLERANCE = 0.1;

/**
 * Hard "never visibly tunnel" guarantee: any agent whose center has ended
 * up outside the walkable floor is snapped back to the last position where
 * it was inside, with velocity zeroed. Call once per fixed tick, after
 * stepSocialForce.
 */
export function enforceContainment(
  world: SfmWorld,
  corridors: Corridor[],
  hubs: JunctionHub[],
  lastValidPositions: Map<string, Point>
): void {
  for (const [id, agent] of world.agents) {
    if (isPointInWalkableArea(agent.position, corridors, hubs, CONTAINMENT_TOLERANCE)) {
      lastValidPositions.set(id, { x: agent.position.x, y: agent.position.y });
      continue;
    }
    const lastValid = lastValidPositions.get(id);
    if (!lastValid) continue;
    agent.position.x = lastValid.x;
    agent.position.y = lastValid.y;
    agent.velocity.x = 0;
    agent.velocity.y = 0;
  }
}
